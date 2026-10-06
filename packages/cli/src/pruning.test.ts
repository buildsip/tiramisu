import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest, spyOn } from "bun:test";
import { deleteMemories } from "./commands/delete-memories";
import { insert } from "./commands/insert";
import { prune } from "./commands/prune";
import { update } from "./commands/update";
import { upvote } from "./commands/upvote";
import { mcpTools } from "./mcp/mcp-tools";
import { migrateDatabase } from "./migrate-database";
import { readMemory } from "./read-memory";
import { cliEnv } from "./test/cli-env";
import { startDatabase } from "./test/start-database";

let temp: string;
let folder: string;
let repo: string;
let client: Client;
let url: string;
let close: (() => Promise<void>) | undefined;
const day = 86_400_000;
const now = Date.parse("2026-01-01T00:00:00Z");
const migrationsFolder = fileURLToPath(new URL("../dist/migrations", import.meta.url));

beforeAll(async () => {
  temp = await realpath(await mkdtemp(join(tmpdir(), "tiramisu-pruning-")));
  const database = await startDatabase(temp);
  ({ client, url, close } = database);
}, 30_000);

beforeEach(async () => {
  await client.query("DROP SCHEMA IF EXISTS tiramisu CASCADE");
  await migrateDatabase({ url, migrationsFolder });
  folder = await mkdtemp(join(temp, "workspace-"));
  repo = await makeRepo("app");
  spyOn(Date, "now").mockReturnValue(now);
});

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await close?.();
  if (temp) await rm(temp, { recursive: true, force: true });
}, 30_000);

/** Real repos keep Git history and visibility checks in the integration path. */
async function makeRepo(name: string) {
  const path = join(folder, name);
  await mkdir(path);
  execFileSync("git", ["init", "--quiet", path]);
  await configure({ repo: path });
  return path;
}

async function configure({
  repo,
  settings = {},
  shared = false,
  enabled = true,
}: {
  repo: string;
  settings?: Record<string, unknown>;
  shared?: boolean;
  enabled?: boolean;
}) {
  await mkdir(join(repo, ".memories"), { recursive: true });
  await writeFile(
    join(repo, "tiramisu.json"),
    JSON.stringify({
      availableToWorkspace: shared,
      prune: enabled ? { databaseUrlCommand: `printf '%s\\n' '${url}'`, ...settings } : false,
    }),
  );
}

async function memory({
  owner = repo,
  title = "Memory",
  protected: protectedMemory = false,
  scope = ["."],
  // Default age is past unvotedTtl so prune tests do not depend on Git commit dates.
  at = now - 365 * day,
}: {
  owner?: string;
  title?: string;
  protected?: boolean;
  scope?: string[];
  at?: number;
} = {}) {
  spyOn(Date, "now").mockReturnValue(at);
  const [path] = await insert({
    roots: [owner],
    repo: owner,
    body: "Useful knowledge",
    frontmatter: {
      description: "A memory description.",
      title,
      scope,
      doNotDelete: protectedMemory,
    },
  });
  spyOn(Date, "now").mockReturnValue(now);
  const stored = await readMemory({ path: join(path!, "memory.md"), project: owner, repo: owner });
  return {
    path: path!,
    id: stored.frontmatter.id,
    summary: { path: path!, title, description: "A memory description." },
  };
}

async function vote({ id, actor, at }: { id: string; actor: "human" | "agent"; at: number }) {
  await client.query(
    "INSERT INTO tiramisu.upvotes (id, memory_id, actor, created_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), id, actor, new Date(at)],
  );
}

it("uses the maximum lifetime and the latest vote for each actor, including exact expiry", async () => {
  const expired = await memory({ title: "Expired" });
  const human = await memory({ title: "Human keeper" });
  const agent = await memory({ title: "Agent keeper" });
  const repeated = await memory({ title: "Repeated old votes" });
  await memory({ title: "Protected", protected: true });
  await vote({ id: human.id, actor: "human", at: now - 100 * day });
  await vote({ id: human.id, actor: "agent", at: now - 95 * day });
  await vote({ id: agent.id, actor: "agent", at: now - 89 * day });
  await vote({ id: agent.id, actor: "agent", at: now - 300 * day });
  await vote({ id: repeated.id, actor: "human", at: now - 180 * day });
  await vote({ id: repeated.id, actor: "human", at: now - 181 * day });
  const young = await memory({ title: "Young", at: now - 89 * day });
  await vote({ id: young.id, actor: "agent", at: now - 100 * day });
  expect(await prune({ repo })).toEqual(
    [expired.summary, repeated.summary].sort((a, b) => a.path.localeCompare(b.path)),
  );
  expect(existsSync(expired.path)).toBe(true);
  // Config durations are applied at read time, without rewriting stored votes.
  await configure({ repo, settings: { unvotedTtl: "400d" } });
  expect(await prune({ repo })).toEqual([]);
});

it("expires from the stored created date, not Git history", async () => {
  const fresh = await memory({ at: now });
  expect(await prune({ repo })).toEqual([]);
  const expired = await memory({ title: "Expired uncommitted" });
  expect(await prune({ repo })).toEqual([expired.summary]);
  await writeFile(
    join(expired.path, "memory.md"),
    (await readFile(join(expired.path, "memory.md"), "utf8")) + "\nEdited today\n",
  );
  expect(await prune({ repo })).toEqual([expired.summary]);
  expect(await prune({ repo })).not.toContainEqual(fresh.summary);
});

it("keeps created across folder moves", async () => {
  const entry = await memory({ title: "Original" });
  const path = join(repo, ".memories/renamed");
  await rename(entry.path, path);
  expect(await prune({ repo })).toEqual([{ ...entry.summary, path }]);
  const stored = await readMemory({
    path: join(path, "memory.md"),
    project: repo,
    repo,
  });
  expect(stored.frontmatter.created).toBe("2025-01-01");
});

it("prunes only the selected repo, including its package stores", async () => {
  const local = await memory();
  await mkdir(join(repo, "packages/web"), { recursive: true });
  await writeFile(join(repo, "packages/web/package.json"), "{}");
  const packaged = await memory({ title: "Package", scope: ["packages/web"] });
  await mkdir(join(repo, "crates/engine"), { recursive: true });
  await writeFile(join(repo, "crates/engine/Cargo.toml"), '[package]\nname = "engine"\n');
  const rust = await memory({ title: "Rust package", scope: ["crates/engine"] });
  expect(rust.path).toBe(join(repo, "crates/engine/.memories/rust-package"));
  const team = await makeRepo("team");
  await configure({ repo: team, shared: true });
  const shared = await memory({ owner: team });
  const hidden = await makeRepo("private");
  await memory({ owner: hidden });
  expect(await prune({ repo })).toEqual(
    [local.summary, packaged.summary, rust.summary].sort((a, b) => a.path.localeCompare(b.path)),
  );
  expect(await prune({ repo: team })).toEqual([shared.summary]);
  await configure({ repo, enabled: false });
  await expect(prune({ repo })).rejects.toThrow("Pruning is disabled");
});

it("requires an absolute Git root for prune", async () => {
  await expect(prune({ repo: "." })).rejects.toThrow("absolute path");
  const child = join(repo, "packages/web");
  await mkdir(child, { recursive: true });
  await expect(prune({ repo: child })).rejects.toThrow("Git root");
});

it("rejects a prune candidate without a description", async () => {
  const entry = await memory();
  const path = join(entry.path, "memory.md");
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replace(/^description:.*\n/m, ""));
  await expect(prune({ repo })).rejects.toThrow("frontmatter.description");
});

it.each([false, true])(
  "upvotes and deletes mixed-repo batches when sharing is %s",
  async (shared) => {
    const team = await makeRepo("team");
    await configure({ repo: team, shared });
    const other = await makeRepo("other");
    const keep = await memory({ owner: other });
    const one = await memory();
    const two = await memory({ owner: team });
    // Unrelated malformed memories do not block an explicit selection, even in a selected repo.
    const invalid = await memory({ title: "Unselected" });
    await writeFile(join(invalid.path, "memory.md"), "invalid frontmatter");
    // Reuse absolute result paths, including a duplicate, without choosing an active repo.
    const paths = [one.path, two.path, one.path];
    expect(await upvote({ paths, actor: "human" })).toEqual({
      upvoted: [one.path, two.path],
      skipped: [],
    });
    const rows = (
      await client.query("SELECT memory_id, actor FROM tiramisu.upvotes ORDER BY memory_id")
    ).rows;
    expect(rows).toEqual([one.id, two.id].sort().map((id) => ({ memory_id: id, actor: "human" })));
    await configure({ repo, enabled: false });
    await configure({ repo: team, shared, enabled: false });
    expect(await deleteMemories({ paths })).toHaveLength(2);
    expect(existsSync(one.path)).toBe(false);
    expect(existsSync(two.path)).toBe(false);
    expect(existsSync(keep.path)).toBe(true);
    expect(existsSync(invalid.path)).toBe(true);
  },
);

it.each(["active", "shared"])(
  "upvotes eligible memories when the %s repo has pruning disabled",
  async (disabled) => {
    const team = await makeRepo("team");
    await configure({ repo: team, shared: true });
    const owner = disabled === "active" ? repo : team;
    await configure({ repo: owner, shared: owner === team, enabled: false });
    const one = await memory();
    const two = await memory({ owner: team });
    const extra = await memory({ owner, title: "Another skipped memory" });
    const skipped = disabled === "active" ? one : two;
    const voted = disabled === "active" ? two : one;

    const result = await upvote({
      paths: [one.path, two.path, extra.path, one.path, extra.path],
      actor: "agent",
    });
    expect(result).toEqual({
      upvoted: [voted.path],
      skipped: [
        {
          repo: owner,
          paths: [skipped.path, extra.path],
          message: expect.stringContaining(`pruning is disabled in ${owner}`),
        },
      ],
    });
    expect((await client.query("SELECT memory_id, actor FROM tiramisu.upvotes")).rows).toEqual([
      { memory_id: voted.id, actor: "agent" },
    ]);
  },
);

it.each([false, undefined])(
  "reports every skipped repo without using the database when prune is %s",
  async (prune) => {
    const team = await makeRepo("team");
    for (const owner of [repo, team]) {
      await writeFile(
        join(owner, "tiramisu.json"),
        JSON.stringify({ availableToWorkspace: true, prune }),
      );
    }
    const one = await memory();
    const two = await memory({ owner: team });
    // Missing tables would fail any accidental vote write in this disabled batch.
    await client.query("DROP SCHEMA tiramisu CASCADE");
    expect(await upvote({ paths: [one.path, two.path], actor: "human" })).toEqual({
      upvoted: [],
      skipped: [
        { repo, paths: [one.path], message: expect.stringContaining("pruning is disabled") },
        {
          repo: team,
          paths: [two.path],
          message: expect.stringContaining("pruning is disabled"),
        },
      ],
    });
  },
);

it("validates the entire upvote/delete selection before any mutation", async () => {
  const one = await memory();
  const outside = await makeRepo("outside");
  const two = await memory({ owner: outside });
  await writeFile(join(two.path, "memory.md"), "invalid frontmatter");
  await expect(upvote({ paths: [one.path, two.path], actor: "agent" })).rejects.toThrow(
    "frontmatter",
  );
  await expect(deleteMemories({ paths: [one.path, two.path] })).rejects.toThrow("frontmatter");
  expect((await client.query("SELECT * FROM tiramisu.upvotes")).rowCount).toBe(0);
  expect(existsSync(one.path)).toBe(true);
  const broken = await makeRepo("broken");
  const three = await memory({ owner: broken });
  await configure({
    repo: broken,
    settings: { databaseUrlCommand: undefined },
  });
  await expect(upvote({ paths: [one.path, three.path], actor: "agent" })).rejects.toThrow(
    "Set prune.databaseUrlCommand",
  );
  expect((await client.query("SELECT * FROM tiramisu.upvotes")).rowCount).toBe(0);
});

it("rejects a relative path before recording any upvotes", async () => {
  const one = await memory();
  const two = await memory({ title: "Second" });
  await expect(
    upvote({ paths: [one.path, relative(repo, two.path)], actor: "human" }),
  ).rejects.toThrow("absolute memory directory paths");
  expect((await client.query("SELECT * FROM tiramisu.upvotes")).rowCount).toBe(0);
});

it("keeps cross-repo protected and nested deletion checks", async () => {
  const one = await memory();
  const team = await makeRepo("team");
  await configure({ repo: team, shared: true });
  const protectedMemory = await memory({ owner: team, protected: true });
  await expect(deleteMemories({ paths: [one.path, protectedMemory.path] })).rejects.toThrow(
    "doNotDelete",
  );
  expect(existsSync(one.path)).toBe(true);
});

it("records agent votes for renamed, package-moved, and empty updates, and skips disabled databases", async () => {
  const entry = await memory();
  await mkdir(join(repo, "web"));
  await writeFile(join(repo, "web/package.json"), "{}");
  const [moved] = await update({
    roots: [repo],
    repo,
    path: entry.path,
    frontmatter: { description: "A memory description.", title: "New title", scope: ["web"] },
  });
  await update({ roots: [repo], repo, path: moved! });
  expect((await client.query("SELECT memory_id, actor FROM tiramisu.upvotes")).rows).toEqual([
    { memory_id: entry.id, actor: "agent" },
    { memory_id: entry.id, actor: "agent" },
  ]);
  await configure({ repo, enabled: false });
  await client.query("DROP SCHEMA tiramisu CASCADE");
  await expect(
    update({ roots: [repo], repo, path: moved!, body: "No database needed" }),
  ).resolves.toEqual([moved!]);
});

it("reports a saved update path when the database fails and never migrates implicitly", async () => {
  const entry = await memory();
  await client.query("DROP SCHEMA tiramisu CASCADE");
  const moved = join(repo, ".memories/renamed");
  const result = update({
    roots: [repo],
    repo,
    path: entry.path,
    frontmatter: { description: "A memory description.", title: "Renamed", doNotEdit: true },
  });
  await expect(result).rejects.toThrow(`memory was saved at ${moved}`);
  await expect(result).rejects.toThrow("Run tiramisu init");
  await expect(result).rejects.toThrow("Retry only the upvote");
  expect(existsSync(moved)).toBe(true);
  expect(
    (await client.query("SELECT to_regclass('tiramisu.upvotes') AS name")).rows[0].name,
  ).toBeNull();
  // The recovery instruction must still work after the saved update protects the file.
  await migrateDatabase({ url, migrationsFolder });
  await expect(update({ roots: [repo], repo, path: moved })).rejects.toThrow("doNotEdit");
  expect(await upvote({ paths: [moved], actor: "agent" })).toEqual({
    upvoted: [moved],
    skipped: [],
  });
  expect((await client.query("SELECT memory_id, actor FROM tiramisu.upvotes")).rows).toEqual([
    { memory_id: entry.id, actor: "agent" },
  ]);
});

it("uses only the selected repo's database and reports its failures", async () => {
  const local = await memory();
  const team = await makeRepo("team");
  await memory({ owner: team });
  await configure({
    repo: team,
    shared: true,
    settings: { databaseUrlCommand: "printf 'SECRET'; exit 1" },
  });
  expect(await prune({ repo })).toEqual([local.summary]);
  const result = prune({ repo: team });
  await expect(result).rejects.toThrow("The command you entered failed");
  await expect(result).rejects.not.toThrow("SECRET");
});

it("runs upvote and prune through CLI JSON and MCP contracts", async () => {
  const entry = await memory();
  const team = await makeRepo("team");
  await configure({ repo: team, shared: true, enabled: false });
  const skipped = await memory({ owner: team });
  const home = join(folder, "home");
  await mkdir(join(home, ".cursor"), { recursive: true });
  const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const run = (command: string[]) =>
    spawnSync("node", [cli, ...command], {
      cwd: repo,
      env: cliEnv({ home }),
      encoding: "utf8",
    });
  const listed = run(["prune", "--repo", repo]);
  expect(listed.status, listed.stderr).toBe(0);
  expect(JSON.parse(listed.stdout)).toEqual([entry.summary]);
  const tool = mcpTools.find((tool) => tool.name === "prune-memories")!;
  const candidates = await tool.call({ repo });
  expect(candidates.content).toEqual([
    { type: "text", text: JSON.stringify([entry.summary], null, 2) },
    {
      type: "text",
      text: "Read memory.md inside each candidate's directory path, check its relevance against the code, and suggest which to delete or keep.",
    },
  ]);
  const voted = run(["upvote", "--paths", entry.path, skipped.path, "--actor", "human"]);
  expect(voted.status, voted.stderr).toBe(0);
  const result = JSON.parse(voted.stdout);
  expect(result).toEqual({
    upvoted: [entry.path],
    skipped: [
      {
        repo: team,
        paths: [skipped.path],
        message: expect.stringContaining(`pruning is disabled in ${team}`),
      },
    ],
  });
  const disabled = run(["upvote", "--paths", skipped.path, "--actor", "human"]);
  expect(disabled.status, disabled.stderr).toBe(0);
  expect(JSON.parse(disabled.stdout)).toEqual({ upvoted: [], skipped: result.skipped });
  const response = await tool.call({ repo });
  expect(response.content).toEqual([{ type: "text", text: "[]" }]);
  const upvoteTool = mcpTools.find((tool) => tool.name === "upvote-memories")!;
  await expect(upvoteTool.call({ paths: [entry.path] })).rejects.toThrow("actor");
  const upvoted = await upvoteTool.call({
    paths: [entry.path, skipped.path],
    actor: "agent",
  });
  expect(upvoted.content).toEqual([{ type: "text", text: JSON.stringify(result, null, 2) }]);
  expect((await client.query("SELECT actor FROM tiramisu.upvotes ORDER BY actor")).rows).toEqual([
    { actor: "agent" },
    { actor: "human" },
  ]);
  await expect(tool.call({ repo, scope: ["*"] })).rejects.toThrow("Remove unknown");
  await expect(tool.call({ repo, roots: [repo] })).rejects.toThrow("Remove unknown");
});
