import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as os from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { readTelemetryId } from "./read-telemetry-id";

let home: string;
// Bun caches homedir(), so replace the OS lookup instead of changing HOME mid-process.
const homePath = spyOn(os, "homedir");
afterAll(() => homePath.mockRestore());
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "tiramisu-identity-"));
  homePath.mockReturnValue(home);
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

it("publishes one private ID and salt for concurrent initializations", async () => {
  const identities = await Promise.all(Array.from({ length: 12 }, () => readTelemetryId()));
  expect(identities.every(Boolean)).toBe(true);
  expect(new Set(identities.map((value) => value!.id)).size).toBe(1);
  expect(new Set(identities.map((value) => value!.salt)).size).toBe(1);
  expect(identities.filter((value) => value!.first)).toHaveLength(1);
  const saved = JSON.parse(await readFile(join(home, ".tiramisu", "telemetry.json"), "utf8"));
  expect(saved.id).toBe(identities[0]!.id);
  expect(saved.salt).toBe(identities[0]!.salt);
  expect(saved.salt).toMatch(/^[a-f0-9]{32}$/);
  expect(saved.enabled).toBe(true);
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  expect(await readTelemetryId()).toEqual({ id: saved.id, salt: saved.salt, first: false });
  if (process.platform !== "win32") {
    const file = join(home, ".tiramisu", "telemetry.json");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  }
});

it.each([
  '{"enabled":false}',
  '{"id":"not-a-uuid"}',
  '{"id":"2b91e9e3-25eb-4f63-a882-49186f0f6cb0","salt":"invalid"}',
  "broken json",
  "null",
])("silently disables telemetry for unavailable identity: %s", async (value) => {
  await mkdir(join(home, ".tiramisu"));
  await writeFile(join(home, ".tiramisu", "telemetry.json"), value);
  expect(await readTelemetryId()).toBeUndefined();
  expect(await readFile(join(home, ".tiramisu", "telemetry.json"), "utf8")).toBe(value);
});

it("does not fail the CLI when the configuration directory cannot be created", async () => {
  await writeFile(join(home, ".tiramisu"), "existing file");
  expect(await readTelemetryId()).toBeUndefined();
});
