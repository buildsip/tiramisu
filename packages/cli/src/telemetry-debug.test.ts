import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, expect, it } from "bun:test";
import { cliEnv } from "./test/cli-env";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
let home: string;
let repo: string;
let hook: string;
let env: Record<string, string>;
let client: Client | undefined;

beforeEach(async () => {
  home = await realpath(await mkdtemp(join(tmpdir(), "tiramisu-telemetry-debug-")));
  repo = join(home, "private-project-name");
  await mkdir(repo);
  execFileSync("git", ["init", "--quiet", repo]);
  await mkdir(join(home, ".cursor"));
  env = cliEnv({ home });
  // Allow normal first-use initialization inside this isolated home.
  await rm(join(home, ".tiramisu", "telemetry.json"));
  hook = join(home, "fetch.mjs");
  // Trap HTTP in the real executable so a regression cannot reach production PostHog.
  await writeFile(
    hook,
    `import { writeFileSync } from "node:fs";
globalThis.fetch = async () => {
  writeFileSync(new URL("./network-called", import.meta.url), "called");
  return new Response('{"status":1}', { status: 200 });
};`,
  );
});

afterEach(async () => {
  await client?.close();
  client = undefined;
  await rm(home, { recursive: true, force: true });
});

/** Reads the JSONL file once response delivery has also finished in the child process. */
async function readLog() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const text = await readFile(join(home, ".tiramisu", "telemetry-debug.jsonl"), "utf8");
    const entries = text.trim().split("\n").map((line) => JSON.parse(line));
    if (entries.some((entry) => entry.event === "tool finished")) return { text, entries };
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    "No completed telemetry event was logged. Check development capture after response delivery.",
  );
}

it("logs CLI search events locally while keeping stdout JSON and avoiding HTTP", async () => {
  const result = await exec(
    "node",
    [
      "--import", hook, cli, "search", "--roots", repo, "--repo", repo,
      "--query", "private search text",
    ],
    { cwd: repo, env, timeout: 5_000 },
  );
  expect(JSON.parse(result.stdout)).toEqual([]);
  expect(result.stderr).toBe("");
  const { text, entries } = await readLog();
  expect(entries.map((entry) => entry.event)).toEqual(["first run", "tool finished"]);
  expect(entries[1].properties).toMatchObject({
    source: "cli", tool: "search-memories", outcome: "success", result_count: 0,
  });
  expect(text).not.toContain("private");
  expect(text).not.toContain(home);
  expect(existsSync(join(home, "network-called"))).toBe(false);
});

it("logs MCP events locally without corrupting stdio or making HTTP requests", async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["--import", hook, cli, "mcp"],
    cwd: repo,
    env,
    stderr: "pipe",
  });
  const errors: Error[] = [];
  client = new Client({ name: "telemetry-debug-test", version: "test" });
  client.onerror = (error) => errors.push(error);
  await client.connect(transport);
  const result = (await client.callTool({
    name: "search-memories",
    arguments: { roots: [repo], repo, query: "private search text" },
  })) as CallToolResult;
  expect(result.isError).toBeUndefined();
  expect(result.content[0]).toEqual({ type: "text", text: "[]" });
  const { text, entries } = await readLog();
  expect(entries.map((entry) => entry.event)).toEqual(["first run", "tool finished"]);
  expect(entries[1].properties).toMatchObject({
    source: "mcp", tool: "search-memories", outcome: "success", result_count: 0,
  });
  expect(text).not.toContain("private");
  expect(text).not.toContain(home);
  expect(errors).toEqual([]);
  expect(existsSync(join(home, "network-called"))).toBe(false);
});
