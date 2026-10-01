import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "bun:test";
import { cliEnv } from "./test/cli-env";

const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
let home: string;
let file: string;
let hook: string;
let env: Record<string, string>;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "tiramisu-telemetry-command-"));
  env = cliEnv({ home });
  file = join(home, ".tiramisu", "telemetry.json");
  await rm(file);
  await mkdir(join(home, ".cursor"));
  hook = join(home, "fetch.mjs");
  // Trap HTTP in the real executable, so a regression cannot send production analytics.
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
  await rm(home, { recursive: true, force: true });
});

/** Runs the published CLI outside a repository, with the same home across preference changes. */
function run(args: string[] = []) {
  return spawnSync("node", ["--import", hook, cli, "telemetry", ...args], {
    cwd: home,
    env,
    encoding: "utf8",
  });
}

it("reports the default without creating an identity or touching agent configuration", async () => {
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ enabled: true });
  expect(existsSync(file)).toBe(false);
  expect(await readdir(join(home, ".cursor"))).toEqual([]);
  expect(existsSync(join(home, "network-called"))).toBe(false);
});

it("disables telemetry before first use without creating an identity or sending events", async () => {
  const result = run(["--disable"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ enabled: false });
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ enabled: false });
  expect(JSON.parse(run().stdout)).toEqual({ enabled: false });
  expect(await readdir(join(home, ".cursor"))).toEqual([]);
  expect(existsSync(join(home, "network-called"))).toBe(false);
});

it("enables telemetry after opting out and keeps status checks local", async () => {
  expect(run(["--disable"]).status).toBe(0);
  const result = run(["--enable"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ enabled: true });
  const saved = JSON.parse(await readFile(file, "utf8"));
  expect(saved.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  expect(saved.salt).toMatch(/^[a-f0-9]{32}$/);
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  expect(JSON.parse(run().stdout)).toEqual({ enabled: true });
  expect(existsSync(join(home, "network-called"))).toBe(false);
  expect(await readdir(join(home, ".cursor"))).toEqual([]);
  if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
});

it("preserves the ID, salt, creation date, and other fields across toggles", async () => {
  const original = {
    id: "2b91e9e3-25eb-4f63-a882-49186f0f6cb0",
    salt: "9e6c56fd7418c5cdd8b45613a4c1c027",
    createdAt: "2026-09-01T00:00:00.000Z",
    extra: { preserved: true },
  };
  await writeFile(file, JSON.stringify(original));
  for (const enabled of [false, false, true, true]) {
    const result = run([enabled ? "--enable" : "--disable"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ ...original, enabled });
  }
  expect(existsSync(join(home, "network-called"))).toBe(false);
});

it.each(["broken json", "null", "[]", '{"id":"invalid"}'])(
  "reports disabled for invalid settings without rewriting them: %s",
  async (value) => {
    await writeFile(file, value);
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ enabled: false });
    expect(await readFile(file, "utf8")).toBe(value);
  },
);

it("rejects conflicting flags before writing anything", () => {
  const result = run(["--enable", "--disable"]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error).toContain("Choose one telemetry option");
  expect(existsSync(file)).toBe(false);
  expect(existsSync(join(home, "network-called"))).toBe(false);
});

it("preserves malformed settings and returns repair instructions", async () => {
  await writeFile(file, "broken json");
  const result = run(["--enable"]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error).toContain("Fix the JSON or move this file aside");
  expect(await readFile(file, "utf8")).toBe("broken json");
});

it("returns filesystem repair instructions without reporting a successful change", async () => {
  await rm(join(home, ".tiramisu"), { recursive: true });
  await writeFile(join(home, ".tiramisu"), "existing file");
  const result = run(["--disable"]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).error).toContain("Ensure ~/.tiramisu is a directory");
  expect(await readFile(join(home, ".tiramisu"), "utf8")).toBe("existing file");
});

it("documents flags and MCP restarts without starting telemetry", () => {
  const result = run(["--help"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("--enable");
  expect(result.stdout).toContain("--disable");
  expect(result.stdout).toContain("Restart");
  expect(result.stderr).toBe("");
  expect(existsSync(file)).toBe(false);
});
