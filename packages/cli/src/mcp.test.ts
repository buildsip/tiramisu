import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { memoryScopeDescription } from "./scope-schema";
import { cliEnv } from "./test/cli-env";

const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp: string;
let repo: string;
let home: string;
let client: Client | undefined;
let stderr: string;

beforeEach(async () => {
  temp = await realpath(await mkdtemp(join(tmpdir(), "mem-mcp-")));
  repo = join(temp, "repo with spaces");
  home = join(temp, "home");
  await mkdir(join(repo, "apps", "web", "src"), { recursive: true });
  await mkdir(join(home, ".cursor"), { recursive: true });
  await writeFile(join(repo, "package.json"), "{}");
  await writeFile(join(repo, "apps", "web", "package.json"), "{}");
  execFileSync("git", ["init", "--quiet", repo]);
  stderr = "";
});

afterEach(async () => {
  await client?.close();
  client = undefined;
  await rm(temp, { recursive: true, force: true });
});

/** Starts the built executable, exercising the actual stdio protocol and startup installer. */
async function connect({ cwd = repo }: { cwd?: string } = {}) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [cli, "mcp"],
    cwd,
    env: cliEnv({ home }),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  client = new Client({ name: "mem-test", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

function text(result: CallToolResult) {
  const content = result.content[0]!;
  if (content.type !== "text") throw new Error("Expected a text result");
  return content.text;
}

/** Write tools keep their JSON in the first block and add categorization guidance afterward. */
function instructions(result: CallToolResult) {
  expect(result.isError).toBeUndefined();
  expect(result.content).toHaveLength(2);
  const content = result.content[1]!;
  if (content.type !== "text") throw new Error("Expected text instructions");
  return content.text;
}

async function call({ name, args = {} }: { name: string; args?: Record<string, unknown> }) {
  return (await client!.callTool({
    name,
    arguments: {
      ...(["delete-memories", "upvote-memories"].includes(name)
        ? {}
        : name === "prune-memories"
          ? { repo }
          : { roots: [repo], repo }),
      ...args,
    },
  })) as CallToolResult;
}

describe("MCP stdio server", () => {
  it("instructs the agent to initialize non-Git workspace projects before retrying", async () => {
    await connect();
    const project = join(temp, "new project");
    await mkdir(project);
    const result = await call({
      name: "search-memories",
      args: { roots: [repo, project], query: "cache" },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain(
      `Initialize a Git repository in ${project} by running git init from that directory, then retry.`,
    );
    // The tool supplies instructions; the agent performs initialization for the user.
    expect(existsSync(join(project, ".git"))).toBe(false);
    execFileSync("git", ["init", "--quiet", project]);
    const retried = await call({
      name: "search-memories",
      args: { roots: [repo, project], query: "cache" },
    });
    expect(retried.isError).toBeUndefined();
    expect(JSON.parse(text(retried))).toEqual([]);
  });

  it("advertises exactly six tools, field descriptions, required fields, and the package version", async () => {
    const client = await connect();
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.bin).toEqual({ tiramisu: "./dist/index.js" });
    expect(client.getServerVersion()).toEqual({ name: "tiramisu", version: pkg.version });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "insert-memory",
      "update-memory",
      "search-memories",
      "delete-memories",
      "upvote-memories",
      "prune-memories",
    ]);
    for (const tool of tools) {
      if (["insert-memory", "update-memory", "search-memories"].includes(tool.name)) {
        expect(tool.inputSchema.required).toContain("roots");
      } else {
        expect(tool.inputSchema.properties).not.toHaveProperty("roots");
      }
      if (!["delete-memories", "upvote-memories"].includes(tool.name)) {
        expect(tool.inputSchema.required).toContain("repo");
      }
      expect(tool.inputSchema.additionalProperties).toBe(false);
      for (const [name, field] of Object.entries(tool.inputSchema.properties ?? {})) {
        // Frontmatter's individual fields describe its contents below.
        if (name === "frontmatter") continue;
        expect(field).toHaveProperty("description", expect.any(String));
      }
    }
    const insert = tools.find((tool) => tool.name === "insert-memory")!;
    expect(insert.inputSchema.required).toEqual(["roots", "repo", "body", "frontmatter"]);
    const fields = insert.inputSchema.properties!.frontmatter as Tool["inputSchema"];
    expect(fields.required).toEqual(["title", "description", "scope"]);
    expect(fields.properties!.description).toMatchObject({
      type: "string",
      minLength: 1,
      description:
        'A brief description of what the memory is about AND specific contexts for when to read it (this is the primary triggering mechanism). All "when to read" info goes here, not in the body.',
    });
    expect(fields.properties!.description).not.toHaveProperty("maxLength");
    expect(fields.additionalProperties).toEqual({});
    expect(fields.properties).not.toHaveProperty("id");
    expect(fields.properties!.title).toMatchObject({ type: "string", minLength: 1 });
    expect(fields.properties!.scope).toMatchObject({
      type: "array",
      minItems: 1,
      description: memoryScopeDescription,
    });
    for (const field of Object.values(fields.properties ?? {})) {
      expect(field).toHaveProperty("description", expect.any(String));
    }
    const update = tools.find((tool) => tool.name === "update-memory")!;
    expect(update.inputSchema.required).toEqual(["roots", "repo", "path"]);
    const patch = update.inputSchema.properties!.frontmatter as Tool["inputSchema"];
    expect(patch.required ?? []).toEqual([]);
    expect(patch.properties).not.toHaveProperty("id");
    expect(patch.properties!.scope).toMatchObject({
      type: "array",
      minItems: 1,
      description: memoryScopeDescription,
    });
    const search = tools.find((tool) => tool.name === "search-memories")!;
    const searchScope = search.inputSchema.properties!.scope as { description?: string };
    expect(searchScope).toMatchObject({ type: "array", minItems: 1 });
    expect(searchScope.description).not.toBe(memoryScopeDescription);
    expect(searchScope.description).toContain("Omit");
    const prune = tools.find((tool) => tool.name === "prune-memories")!;
    expect(prune.inputSchema.required).toEqual(["repo"]);
    for (const name of ["delete-memories", "upvote-memories"]) {
      const tool = tools.find((tool) => tool.name === name)!;
      expect(tool.inputSchema.required).toContain("paths");
      expect(tool.inputSchema.properties!.paths).toMatchObject({ type: "array", minItems: 1 });
      expect(tool.inputSchema.properties).not.toHaveProperty("path");
      expect(tool.inputSchema.properties).not.toHaveProperty("repo");
      expect(tool.inputSchema.required).toEqual(
        name === "delete-memories" ? ["paths"] : ["paths", "actor"],
      );
    }
    expect(stderr).toBe("");
  });

  it("reuses absolute memory paths when the server starts elsewhere", async () => {
    await connect({ cwd: home });
    const created = await call({
      name: "insert-memory",
      args: {
        body: "Cache responses carefully",
        frontmatter: {
          description: "A memory description.",
          title: "Cache responses",
          scope: ["."],
        },
      },
    });
    expect(created.isError).toBeUndefined();
    const [path] = JSON.parse(text(created));
    expect(path).toBe(join(repo, ".memories/cache-responses"));
    expect(instructions(created)).toContain(
      `anywhere within ${JSON.stringify(join(repo, ".memories"))}`,
    );
    expect(instructions(created).split("looks like this:\n")[1]).toBe(".memories/");
    const file = join(path, "memory.md");
    const before = await readFile(file, "utf8");
    // Even a valid relative path must fail rather than depend on a process or repo base.
    for (const name of ["update-memory", "delete-memories", "upvote-memories"]) {
      const args =
        name === "update-memory"
          ? { path: relative(repo, path) }
          : {
              paths: [relative(repo, path)],
              ...(name === "upvote-memories" ? { actor: "human" } : {}),
            };
      const result = await call({ name, args });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain("absolute memory directory path");
      expect(await readFile(file, "utf8")).toBe(before);
    }
    for (const name of ["delete-memories", "upvote-memories"]) {
      for (const context of [{ repo }, { roots: [repo] }]) {
        const result = await call({
          name,
          args: {
            ...context,
            paths: [path],
            ...(name === "upvote-memories" ? { actor: "human" } : {}),
          },
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("Remove unknown top-level fields");
        expect(await readFile(file, "utf8")).toBe(before);
      }
    }
    for (const name of ["update-memory", "delete-memories"]) {
      const args = name === "update-memory" ? { path: file } : { paths: [file] };
      const result = await call({ name, args });
      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(text(result)).toContain("existing memory directory");
      expect(await readFile(file, "utf8")).toBe(before);
    }
    const found = JSON.parse(
      text(await call({ name: "search-memories", args: { query: "cache" } })),
    );
    expect(found).toEqual([
      { path, title: "Cache responses", description: "A memory description." },
    ]);
    const updated = await call({
      name: "update-memory",
      args: {
        path,
        frontmatter: { title: "Package cache", scope: ["apps/web"] },
      },
    });
    const [next] = JSON.parse(text(updated));
    expect(next).toBe(join(repo, "apps/web/.memories/package-cache"));
    expect(instructions(updated)).toContain(
      `anywhere within ${JSON.stringify(join(repo, "apps/web/.memories"))}`,
    );
    expect(instructions(updated)).not.toContain(JSON.stringify(join(repo, ".memories")));
    expect(existsSync(path)).toBe(false);
    const page = JSON.parse(
      text(
        await call({
          name: "search-memories",
          args: { query: "cache", scope: ["apps"], limit: 1 },
        }),
      ),
    );
    expect(page).toEqual([
      { path: next, title: "Package cache", description: "A memory description." },
    ]);
    expect(await readFile(join(next, "memory.md"), "utf8")).toContain(
      "Cache responses carefully\n",
    );
    expect(
      JSON.parse(
        text(await call({ name: "search-memories", args: { query: "cache", offset: 1 } })),
      ),
    ).toEqual([]);
    const voted = await call({
      name: "upvote-memories",
      args: { paths: [next], actor: "human" },
    });
    expect(voted.isError).toBeUndefined();
    expect(JSON.parse(text(voted))).toMatchObject({
      upvoted: [],
      skipped: [{ repo, paths: [next] }],
    });
    expect(
      JSON.parse(text(await call({ name: "delete-memories", args: { paths: [next] } }))),
    ).toEqual([next]);
    expect(existsSync(next)).toBe(false);
    expect(stderr).toBe("");
  });

  it("shows only the saved store's categories and searches tags after a manual move", async () => {
    const data = join(repo, "apps/web/.memories");
    for (const folder of ["network/http", "rendering/hydration", "state/zustand/selectors"]) {
      await mkdir(join(data, folder), { recursive: true });
    }
    await mkdir(join(repo, ".memories/other-store"), { recursive: true });
    await connect();
    const created = await call({
      name: "insert-memory",
      args: {
        body: "Details",
        frontmatter: {
          description: "A memory description.",
          title: "New note",
          scope: ["apps/web"],
        },
      },
    });
    const listing =
      ".memories/\n.memories/network/\n.memories/network/http/\n.memories/rendering/\n.memories/rendering/hydration/\n.memories/state/\n.memories/state/zustand/\n.memories/state/zustand/selectors/";
    expect(instructions(created).split("looks like this:\n")[1]).toBe(listing);
    const [path] = JSON.parse(text(created));
    await mkdir(join(path, "attachments"));
    await writeFile(join(path, "attachments", "trace.txt"), "Keep with the memory");
    const moved = join(data, "rendering/hydration/new-note");
    await rename(path, moved);
    const updated = await call({ name: "update-memory", args: { path: moved } });
    expect(JSON.parse(text(updated))).toEqual([moved]);
    expect(instructions(updated).split("looks like this:\n")[1]).toBe(listing);
    expect(await readFile(join(moved, "attachments", "trace.txt"), "utf8")).toBe(
      "Keep with the memory",
    );
    const found = await call({ name: "search-memories", args: { query: "hydration" } });
    expect(found.content).toHaveLength(1);
    expect(JSON.parse(text(found))).toEqual([expect.objectContaining({ path: moved })]);
  });

  it("returns bare actionable errors and keeps the server available after invalid calls", async () => {
    await connect();
    for (const args of [
      { roots: undefined },
      { roots: ["."] },
      { repo: join(repo, "apps/web") },
      { limit: 0 },
      { query: "" },
    ]) {
      const result = await call({ name: "search-memories", args: { query: "cache", ...args } });
      expect(result.isError).toBe(true);
      expect(text(result)).not.toMatch(/^\{/);
    }
    const invalid = await call({
      name: "insert-memory",
      args: { body: "Note", frontmatter: { description: "A memory description.", title: "Note" } },
    });
    expect(invalid.isError).toBe(true);
    expect(text(invalid)).toContain("frontmatter");
    expect(text(invalid)).toContain("scope");
    expect(text(invalid)).toContain("Expected a nonempty array of repository-relative");
    const unknown = await call({ name: "old-tool-name" });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toContain("old-tool-name not found");
    const missing = await call({
      name: "delete-memories",
      args: { paths: [join(repo, "missing")] },
    });
    expect(missing.isError).toBe(true);
    expect(text(missing)).toContain("Search again");
    expect(
      JSON.parse(text(await call({ name: "search-memories", args: { query: "cache" } }))),
    ).toEqual([]);
  });

  it("keeps protection and whole-batch deletion checks", async () => {
    await connect();
    const paths: string[] = [];
    for (const [title, protectedMemory] of [
      ["Keep", true],
      ["Other", false],
    ] as const) {
      const created = await call({
        name: "insert-memory",
        args: {
          body: "Original",
          frontmatter: {
            description: "A memory description.",
            title,
            scope: ["."],
            doNotEdit: protectedMemory,
            doNotDelete: protectedMemory,
          },
        },
      });
      paths.push(JSON.parse(text(created))[0]);
    }
    const edit = await call({ name: "update-memory", args: { path: paths[0], body: "Changed" } });
    expect(edit.isError).toBe(true);
    expect(text(edit)).toContain("doNotEdit");
    const deleted = await call({ name: "delete-memories", args: { paths: [...paths].reverse() } });
    expect(deleted.isError).toBe(true);
    expect(text(deleted)).toContain("doNotDelete");
    expect(paths.every((path) => existsSync(path))).toBe(true);
  });

  it("validates custom frontmatter against the destination store", async () => {
    await mkdir(join(repo, ".memories"));
    await writeFile(
      join(repo, "tiramisu.json"),
      JSON.stringify({
        frontmatter: {
          custom: { properties: { ticket: { type: "string" } }, required: ["ticket"] },
        },
      }),
    );
    await connect();
    const args = {
      body: "Details",
      frontmatter: {
        description: "A memory description.",
        title: "Ticket",
        scope: ["."],
        ticket: "ENG-1",
      },
    };
    expect((await call({ name: "insert-memory", args })).isError).toBeUndefined();
    const invalid = await call({
      name: "insert-memory",
      args: { ...args, frontmatter: { ...args.frontmatter, ticket: 42 } },
    });
    expect(invalid.isError).toBe(true);
    expect(text(invalid)).toContain("ticket");
  });

  it("warns without breaking the protocol when no agents are installed", async () => {
    await rm(join(home, ".cursor"), { recursive: true });
    const client = await connect();
    expect((await client.listTools()).tools).toHaveLength(6);
    expect(stderr).toContain("No installed agents were detected");
    expect(stderr).toContain("api-reference/mcp/installation.md");
  });
});

describe("automatic MCP installation", () => {
  it("overwrites the server on help and version, preserving unrelated entries and refreshing approvals", async () => {
    await mkdir(join(home, ".claude"));
    const config = join(home, ".cursor/mcp.json");
    const other = { command: "other-server", args: [] };
    for (const args of [["--help"], ["--version"], ["init", "--help"]]) {
      await writeFile(
        config,
        JSON.stringify({ mcpServers: { other, tiramisu: { command: "old-mem", args: ["old"] } } }),
      );
      const result = spawnSync("node", [cli, ...args], {
        cwd: repo,
        env: cliEnv({ home }),
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe("");
      if (args[0] === "init") {
        expect(result.stdout).toContain("Memory MCP tools added to:");
        expect(result.stdout).toContain("- Cursor");
        expect(result.stdout).toContain("- Claude Code");
      } else {
        expect(result.stdout).not.toContain("Memory MCP tools added to:");
      }
      const next = JSON.parse(await readFile(config, "utf8"));
      expect(next.mcpServers).toEqual({ other, tiramisu: { command: "tiramisu", args: ["mcp"] } });
    }
    const settings = JSON.parse(await readFile(join(home, ".claude/settings.json"), "utf8"));
    expect(settings.permissions.allow).toEqual([
      "mcp__tiramisu__insert-memory",
      "mcp__tiramisu__update-memory",
      "mcp__tiramisu__search-memories",
      "mcp__tiramisu__delete-memories",
      "mcp__tiramisu__upvote-memories",
      "mcp__tiramisu__prune-memories",
    ]);
    expect(existsSync(join(repo, ".cursor"))).toBe(false);
  });

  it("continues the command and installs other agents when a config cannot be written", async () => {
    // A directory where a config file belongs fails writes even when tests run as root.
    await mkdir(join(home, ".cursor/mcp.json"));
    await mkdir(join(home, ".claude"));
    const result = spawnSync(
      "node",
      [cli, "search", "--roots", repo, "--repo", repo, "--query", "cache"],
      {
        cwd: repo,
        env: cliEnv({ home }),
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(JSON.parse(result.stderr).warning).toContain("Could not install tiramisu for cursor");
    const config = JSON.parse(await readFile(join(home, ".claude.json"), "utf8"));
    expect(config.mcpServers["tiramisu"].command).toBe("tiramisu");
  });
});
