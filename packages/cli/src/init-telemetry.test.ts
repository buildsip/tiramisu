import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import * as os from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import * as posthog from "./init-posthog";
import { initTelemetry } from "./init-telemetry";
import { telemetry } from "./telemetry";
import { setTelemetryEnabled } from "./set-telemetry-enabled";

let home: string;
let cliRoot: string;
let events: { distinctId: string; event: string; properties: Record<string, unknown> }[];
const getHome = spyOn(os, "homedir");
const start = spyOn(posthog, "initPosthog");
beforeEach(async () => {
  home = await mkdtemp(join(os.tmpdir(), "tiramisu-analytics-init-"));
  cliRoot = join(home, "cli");
  await mkdir(cliRoot);
  getHome.mockReturnValue(home);
  events = [];
  // The boundary is mocked here; transport delivery has separate real-SDK tests.
  start.mockReset().mockReturnValue({
    capture: (event: (typeof events)[number]) => events.push(event),
  } as unknown as ReturnType<typeof posthog.initPosthog>);
});
afterEach(async () => {
  telemetry.configure();
  await rm(home, { recursive: true, force: true });
});
afterAll(() => {
  getHome.mockRestore();
  start.mockRestore();
});

/** Source installs include these files; published packages omit them. */
async function makeDev() {
  await mkdir(join(cliRoot, "src"));
  await mkdir(join(cliRoot, "scripts"));
  await writeFile(join(cliRoot, "src", "index.ts"), "");
  await writeFile(join(cliRoot, "scripts", "build.mjs"), "");
}

it("sends first run once and reuses its ID across versions and entry points", async () => {
  await initTelemetry({ cliRoot, version: "0.5.3", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: async () => {} });
  await initTelemetry({ cliRoot, version: "0.5.4", source: "cli" });
  await telemetry.run({ tool: "prune-memories", run: async () => {} });
  expect(events.map((value) => value.event)).toEqual([
    "first run",
    "tool finished",
    "tool finished",
  ]);
  expect(new Set(events.map((value) => value.distinctId)).size).toBe(1);
  expect(events[0]!.properties).toMatchObject({
    version: "0.5.3",
    source: "mcp",
    $process_person_profile: false,
  });
  expect(events[2]!.properties.version).toBe("0.5.4");
  expect(start).toHaveBeenCalledTimes(2);
  const saved = JSON.parse(await readFile(join(home, ".tiramisu", "telemetry.json"), "utf8"));
  expect(events[0]!.distinctId).toBe(saved.id);
  await expect(readFile(join(home, ".tiramisu", "telemetry-debug.jsonl"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it.each([false, true])("honors the saved opt-out with development install set to %s", async (dev) => {
  if (dev) await makeDev();
  await mkdir(join(home, ".tiramisu"));
  await writeFile(join(home, ".tiramisu", "telemetry.json"), '{"enabled":false}');
  await initTelemetry({ cliRoot, version: "test", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: async () => {} });
  expect(start).not.toHaveBeenCalled();
  expect(events).toEqual([]);
  expect(JSON.parse(await readFile(join(home, ".tiramisu", "telemetry.json"), "utf8"))).toEqual({
    enabled: false,
  });
  await expect(readFile(join(home, ".tiramisu", "telemetry-debug.jsonl"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("appends sanitized development events across startups without initializing PostHog", async () => {
  await makeDev();
  await initTelemetry({ cliRoot, version: "0.5.3", source: "mcp" });
  await telemetry.run({
    tool: "search-memories",
    run: async () => {
      await telemetry.setProject({ repo: home });
      telemetry.set({ query: "private search", path: home, result_count: 0 });
    },
  });
  await initTelemetry({ cliRoot, version: "0.5.4", source: "cli" });
  await telemetry.run({ tool: "prune-memories", run: async () => {} });
  const file = join(home, ".tiramisu", "telemetry-debug.jsonl");
  const text = await readFile(file, "utf8");
  const logged = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const identity = JSON.parse(await readFile(join(home, ".tiramisu", "telemetry.json"), "utf8"));
  expect(start).not.toHaveBeenCalled();
  expect(events).toEqual([]);
  expect(logged.map((entry) => entry.event)).toEqual([
    "first run",
    "tool finished",
    "tool finished",
  ]);
  expect(new Set(logged.map((entry) => entry.distinctId))).toEqual(new Set([identity.id]));
  expect(logged.every((entry) => Number.isFinite(Date.parse(entry.timestamp)))).toBe(true);
  expect(logged[1].properties).toMatchObject({
    version: "0.5.3",
    source: "cli",
    tool: "search-memories",
    outcome: "success",
    result_count: 0,
    os: process.platform,
    node_version: process.versions.node,
    $process_person_profile: false,
  });
  expect(logged[1].properties.project_id).toMatch(/^[a-f0-9]{64}$/);
  expect(logged[2].properties.version).toBe("0.5.4");
  expect(text).not.toContain("private search");
  expect(text).not.toContain(home);
  expect(text).not.toContain(identity.salt);
  if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
});

it("keeps development log failures from breaking commands or enabling network delivery", async () => {
  await makeDev();
  await mkdir(join(home, ".tiramisu", "telemetry-debug.jsonl"), { recursive: true });
  await initTelemetry({ cliRoot, version: "test", source: "cli" });
  await expect(
    telemetry.run({ tool: "search-memories", run: async () => "result" }),
  ).resolves.toBe("result");
  expect(start).not.toHaveBeenCalled();
  expect(events).toEqual([]);
});

it("reuses the private salt across restarts and sends only project hashes", async () => {
  await initTelemetry({ cliRoot, version: "0.5.3", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: () => telemetry.setProject({ repo: home }) });
  const file = join(home, ".tiramisu", "telemetry.json");
  const { salt } = JSON.parse(await readFile(file, "utf8"));
  await initTelemetry({ cliRoot, version: "0.5.4", source: "cli" });
  await telemetry.run({ tool: "search-memories", run: () => telemetry.setProject({ repo: home }) });
  expect(JSON.parse(await readFile(file, "utf8")).salt).toBe(salt);
  expect(events[1]!.properties.project_id).toMatch(/^[a-f0-9]{64}$/);
  expect(events[2]!.properties.project_id).toBe(events[1]!.properties.project_id);
  expect(JSON.stringify(events)).not.toContain(salt);
  expect(JSON.stringify(events)).not.toContain(home);
});

it("uses the saved preference at the next MCP startup and reuses the identity", async () => {
  await setTelemetryEnabled({ enabled: false });
  await initTelemetry({ cliRoot, version: "test", source: "mcp" });
  expect(start).not.toHaveBeenCalled();
  await setTelemetryEnabled({ enabled: true });
  await initTelemetry({ cliRoot, version: "test", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: async () => {} });
  expect(start).toHaveBeenCalledTimes(1);
  expect(events).toHaveLength(1);
  const id = events[0]!.distinctId;
  await setTelemetryEnabled({ enabled: false });
  await initTelemetry({ cliRoot, version: "test", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: async () => {} });
  expect(events).toHaveLength(1);
  await setTelemetryEnabled({ enabled: true });
  await initTelemetry({ cliRoot, version: "test", source: "mcp" });
  await telemetry.run({ tool: "search-memories", run: async () => {} });
  expect(events[1]!.distinctId).toBe(id);
});

it("ignores SDK initialization failures", async () => {
  start.mockImplementation(() => {
    throw new Error("Unavailable");
  });
  await expect(initTelemetry({ cliRoot, version: "test", source: "cli" })).resolves.toBeUndefined();
});
