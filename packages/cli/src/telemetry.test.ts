import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./mcp/create-mcp-server";
import { trackTransport } from "./mcp/track-transport";
import { insertMemory } from "./mcp/insert-memory";
import { telemetry } from "./telemetry";
import { registerSearchCommand } from "./commands/search";
import { registerDeleteCommand } from "./commands/delete-memories";
import { registerUpdateCommand } from "./commands/update";
import { Command } from "commander";
import { getProjectId } from "./get-project-id";

let temp: string;
let repo: string;
let client: Client;
let server: ReturnType<typeof createMcpServer>;
let events: { event: string; properties: Record<string, string | number | boolean | string[]> }[];
const salt = "9e6c56fd7418c5cdd8b45613a4c1c027";

beforeEach(async () => {
  temp = await realpath(await mkdtemp(join(tmpdir(), "tiramisu-telemetry-")));
  repo = join(temp, "private-project-name");
  await mkdir(repo);
  execFileSync("git", ["init", "--quiet", repo]);
  events = [];
  telemetry.configure({
    salt,
    capture: ({ event, properties }) => events.push({ event, properties }),
  });
  server = createMcpServer({ version: "test" });
  client = new Client({ name: "test", version: "test" });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(trackTransport(left)), client.connect(right)]);
});

afterEach(async () => {
  telemetry.configure();
  await client.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
});

/** Waits for the response-send promise to settle after the client receives its result. */
async function settle() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

it("records search stages, warm caches, and pagination without private data", async () => {
  await client.callTool({
    name: "insert-memory",
    arguments: {
      roots: [repo],
      repo,
      body: "private memory contents",
      frontmatter: { title: "Private title", scope: ["."] },
    },
  });
  const args = { roots: [repo], repo, query: "private", offset: 0 };
  await client.callTool({ name: "search-memories", arguments: args });
  await client.callTool({ name: "search-memories", arguments: { ...args, offset: 5 } });
  await settle();
  expect(events).toHaveLength(3);
  const cold = events[1]!.properties;
  const warm = events[2]!.properties;
  expect(cold).toMatchObject({
    tool: "search-memories",
    source: "mcp",
    outcome: "success",
    root_count: 1,
    store_count: 1,
    loaded_count: 1,
    before_filter_count: 1,
    after_filter_count: 1,
    searchable_count: 1,
    match_count: 1,
    result_count: 1,
    cache_misses: 1,
    index_reused: false,
    whole_repo: true,
  });
  expect(warm).toMatchObject({
    match_count: 1,
    result_count: 0,
    offset: 5,
    cache_hits: 1,
    index_reused: true,
  });
  for (const key of ["duration_ms", "workspace_load_ms", "index_ms", "query_ms"]) {
    expect(Number(cold[key])).toBeGreaterThanOrEqual(0);
  }
  expect(cold.error_category).toBeUndefined();
  expect(cold.project_id).toBe(await getProjectId({ repo, salt }));
  expect(warm.project_id).toBe(cold.project_id);
  expect(JSON.stringify(events)).not.toContain("private");
  expect(events[0]!.properties.affected_count).toBe(1);
});

it("reports scope validation failures within workspace loading", async () => {
  const result = await client.callTool({
    name: "search-memories",
    arguments: { roots: [repo], repo, query: "anything", scope: ["missing-private-directory"] },
  });
  await settle();
  expect(result.isError).toBe(true);
  expect(events).toHaveLength(1);
  const properties = events[0]!.properties;
  // The outer workspace timer must preserve the failing validation stage.
  expect(properties).toMatchObject({ outcome: "error", failure_stage: "validate_scopes" });
  expect(Number(properties.workspace_load_ms)).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(events)).not.toContain("private");
});

it("times SDK validation failures and unknown tools without exposing supplied names", async () => {
  await client.callTool({ name: "search-memories", arguments: { query: "secret query" } });
  await client.callTool({ name: "secret-unknown-name", arguments: {} });
  await settle();
  expect(events).toHaveLength(2);
  expect(events[0]!.properties).toMatchObject({
    tool: "search-memories",
    outcome: "error",
    error_category: "invalid_input",
  });
  expect(events[1]!.properties).toMatchObject({
    tool: "unknown",
    outcome: "error",
    error_category: "unknown_tool",
  });
  expect(JSON.stringify(events)).not.toContain("secret");
  expect(Number(events[0]!.properties.duration_ms)).toBeGreaterThanOrEqual(0);
});

it.each(["delete-memories", "update-memory"])(
  "classifies protected %s calls as permission denials through MCP and CLI",
  async (tool) => {
    const inserted = await client.callTool({
      name: "insert-memory",
      arguments: {
        roots: [repo],
        repo,
        body: "private memory contents",
        frontmatter: {
          title: "Private protected memory",
          scope: ["."],
          doNotDelete: true,
          doNotEdit: true,
        },
      },
    });
    const path = JSON.parse((inserted.content as { text: string }[])[0]!.text)[0] as string;
    const file = join(path, "memory.md");
    const before = await readFile(file, "utf8");
    await settle();
    events.length = 0;

    const result = await client.callTool({
      name: tool,
      arguments:
        tool === "delete-memories"
          ? { paths: [path] }
          : { roots: [repo], repo, path, frontmatter: { doNotEdit: false } },
    });
    await settle();
    expect(result.isError).toBe(true);
    const message = (result.content as { text: string }[])[0]!.text;
    const flag = tool === "delete-memories" ? "doNotDelete" : "doNotEdit";
    const action = tool === "delete-memories" ? "delete" : "edit";
    expect(message).toBe(
      `You cannot ${action} this memory because ${flag} is true: ${path}. Ask the user to ${action} it.`,
    );

    // Commander runs the same domain command, but the CLI has its own telemetry boundary.
    const program = new Command();
    if (tool === "delete-memories") {
      registerDeleteCommand({ program });
      await expect(
        program.parseAsync(["node", "tiramisu", "delete", "--paths", path]),
      ).rejects.toThrow(message);
    } else {
      registerUpdateCommand({ program });
      const input = join(temp, "input.json");
      await writeFile(input, JSON.stringify({ frontmatter: { doNotEdit: false } }));
      await expect(
        program.parseAsync([
          "node", "tiramisu", "update", "--roots", repo, "--repo", repo,
          "--path", path, "--input", input,
        ]),
      ).rejects.toThrow(message);
    }

    expect(events).toHaveLength(2);
    for (const [index, source] of ["mcp", "cli"].entries()) {
      expect(events[index]!.properties).toMatchObject({
        tool,
        source,
        outcome: "error",
        error_category: "permission_denied",
      });
      expect(events[index]!.properties.affected_count).toBeUndefined();
    }
    expect(JSON.stringify(events)).not.toContain("private");
    expect(JSON.stringify(events)).not.toContain(path);
    expect(await readFile(file, "utf8")).toBe(before);
  },
);

it("includes response instructions in duration and keeps concurrent calls separate", async () => {
  const original = insertMemory.call;
  const mock = spyOn(insertMemory, "call").mockImplementation(async (input) => {
    const result = await original(input);
    // The full tool callback includes instructions after the domain command has returned.
    await new Promise((resolve) => setTimeout(resolve, 40));
    return result;
  });
  try {
    await Promise.all([
      client.callTool({
        name: "insert-memory",
        arguments: {
          roots: [repo],
          repo,
          body: "content",
          frontmatter: { title: "One", scope: ["."] },
        },
      }),
      client.callTool({ name: "delete-memories", arguments: { paths: [join(repo, "missing")] } }),
    ]);
    await settle();
    expect(events).toHaveLength(2);
    const insert = events.find((value) => value.properties.tool === "insert-memory")!.properties;
    const removed = events.find((value) => value.properties.tool === "delete-memories")!.properties;
    expect(insert.outcome).toBe("success");
    expect(Number(insert.duration_ms)).toBeGreaterThanOrEqual(40);
    expect(removed.outcome).toBe("error");
    expect(removed.affected_count).toBeUndefined();
  } finally {
    mock.mockRestore();
  }
});

it("measures direct CLI commands once, including preparation of JSON output", async () => {
  const program = new Command();
  registerSearchCommand({ program });
  const write = spyOn(process.stdout, "write").mockReturnValue(true);
  try {
    await program.parseAsync([
      "node",
      "tiramisu",
      "search",
      "--roots",
      repo,
      "--repo",
      repo,
      "--query",
      "empty",
    ]);
  } finally {
    write.mockRestore();
  }
  expect(events).toHaveLength(1);
  expect(events[0]!.properties).toMatchObject({
    source: "cli",
    tool: "search-memories",
    outcome: "success",
    result_count: 0,
  });
});

it("preserves a successful operation when telemetry delivery throws", async () => {
  telemetry.configure({
    capture: () => {
      throw new Error("Analytics unavailable");
    },
  });
  const result = await client.callTool({
    name: "search-memories",
    arguments: { roots: [repo], repo, query: "anything" },
  });
  expect(result.isError).toBeUndefined();
});

it("omits private data and invalid measurements while preserving valid fields", async () => {
  await telemetry.run({
    tool: "search-memories",
    run: async () => {
      telemetry.set({ whole_repo: false, root_count: 2 });
      telemetry.set({
        query: "secret",
        path: repo,
        error_category: "secret",
        actor: "secret",
        project_id: "secret",
        project_ids: ["a".repeat(64), "secret"],
        whole_repo: "true",
        index_reused: 1,
        root_count: -1,
        index_ms: NaN,
        query_ms: "12",
        cache_misses: Infinity,
        duration_ms: Infinity,
      });
      telemetry.add({ cache_hits: 2, private_count: 8 });
    },
  });
  expect(events[0]!.properties).toMatchObject({
    tool: "search-memories",
    whole_repo: false,
    root_count: 2,
    cache_hits: 2,
    outcome: "success",
  });
  expect(JSON.stringify(events)).not.toContain("secret");
  expect(events[0]!.properties.private_count).toBeUndefined();
  expect(events[0]!.properties.project_id).toBeUndefined();
  expect(events[0]!.properties.project_ids).toBeUndefined();
  expect(events[0]!.properties.index_reused).toBeUndefined();
  expect(events[0]!.properties.index_ms).toBeUndefined();
  expect(events[0]!.properties.query_ms).toBeUndefined();
  expect(events[0]!.properties.cache_misses).toBeUndefined();
  expect(Number.isFinite(events[0]!.properties.duration_ms)).toBe(true);
});

it("records setup outcomes separately from tool usage", async () => {
  await expect(
    telemetry.run({
      init: true,
      run: async () => {
        telemetry.set({ already_configured: false, outcome: "cancelled" });
        throw new Error("Cancelled");
      },
    }),
  ).rejects.toThrow("Cancelled");
  expect(events.map((value) => value.event)).toEqual(["init started", "init finished"]);
  expect(events[1]!.properties).toMatchObject({ outcome: "cancelled", already_configured: false });
  expect(events[1]!.properties.error_category).toBeUndefined();
});

it("measures shared repositories without sending their names", async () => {
  const other = join(temp, "other-private-repo");
  await mkdir(other);
  execFileSync("git", ["init", "--quiet", other]);
  await writeFile(join(other, "tiramisu.json"), JSON.stringify({ availableToWorkspace: true }));
  await client.callTool({
    name: "search-memories",
    arguments: { roots: [repo, other], repo, query: "anything" },
  });
  await settle();
  expect(events[0]!.properties).toMatchObject({
    root_count: 2,
    store_count: 2,
  });
  expect(events[0]!.properties.project_id).toBe(await getProjectId({ repo, salt }));
  expect(events[0]!.properties.project_ids).toBeUndefined();
  expect(JSON.stringify(events)).not.toContain("private");
});

it("keeps project IDs separate for concurrent searches", async () => {
  const other = join(temp, "another-private-repo");
  await mkdir(other);
  execFileSync("git", ["init", "--quiet", other]);
  execFileSync("git", [
    "-C", repo, "config", "remote.origin.url", "https://private-token@example.invalid/one.git",
  ]);
  execFileSync("git", [
    "-C", other, "config", "remote.origin.url", "https://private-token@example.invalid/two.git",
  ]);
  await Promise.all([
    client.callTool({ name: "search-memories", arguments: { roots: [repo], repo, query: "anything" } }),
    client.callTool({ name: "search-memories", arguments: { roots: [other], repo: other, query: "anything" } }),
  ]);
  await settle();
  expect(events).toHaveLength(2);
  expect(new Set(events.map((event) => event.properties.project_id))).toEqual(
    new Set(await Promise.all([repo, other].map((repo) => getProjectId({ repo, salt })))),
  );
  expect(JSON.stringify(events)).not.toContain("private");
  expect(JSON.stringify(events)).not.toContain(salt);
});

it("records every project in mixed-repo upvote and delete batches", async () => {
  const other = join(temp, "another-private-repo");
  await mkdir(other);
  execFileSync("git", ["init", "--quiet", other]);
  const paths: string[] = [];
  for (const root of [repo, other]) {
    const result = await client.callTool({
      name: "insert-memory",
      arguments: {
        roots: [root], repo: root, body: "content", frontmatter: { title: "One", scope: ["."] },
      },
    });
    paths.push(...JSON.parse((result.content as { text: string }[])[0]!.text));
  }
  await client.callTool({ name: "upvote-memories", arguments: { paths, actor: "human" } });
  await client.callTool({ name: "delete-memories", arguments: { paths } });
  await settle();
  const ids = (await Promise.all([repo, other].map((repo) => getProjectId({ repo, salt })))).sort();
  for (const event of events.slice(2)) {
    expect(event.properties.outcome).toBe("success");
    expect(event.properties.project_id).toBeUndefined();
    expect(event.properties.project_ids).toEqual(ids);
  }
  expect(events).toHaveLength(4);
  expect(JSON.stringify(events)).not.toContain("private");
});
