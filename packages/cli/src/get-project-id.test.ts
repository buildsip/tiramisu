import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "bun:test";
import { getProjectId } from "./get-project-id";

let temp: string;
let repo: string;
let other: string;
const salt = "9e6c56fd7418c5cdd8b45613a4c1c027";
const fallback = process.env.REPOSITORY_URL;

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "tiramisu-project-id-"));
  repo = join(temp, "one");
  other = join(temp, "two");
  for (const path of [repo, other]) {
    await mkdir(path);
    execFileSync("git", ["init", "--quiet", path]);
  }
  delete process.env.REPOSITORY_URL;
});

afterEach(async () => {
  if (fallback === undefined) delete process.env.REPOSITORY_URL;
  else process.env.REPOSITORY_URL = fallback;
  await rm(temp, { recursive: true, force: true });
});

it("uses the selected repo's remote before environment or directory fallbacks", async () => {
  const remote = "https://private-token@example.invalid/private-project.git";
  execFileSync("git", ["-C", repo, "config", "remote.origin.url", remote]);
  execFileSync("git", ["-C", other, "config", "remote.origin.url", remote]);
  process.env.REPOSITORY_URL = "https://example.invalid/different-project.git";
  const id = await getProjectId({ repo, salt });
  expect(id).toMatch(/^[a-f0-9]{64}$/);
  expect(await getProjectId({ repo: other, salt })).toBe(id);
  expect(await getProjectId({ repo, salt: "b".repeat(32) })).not.toBe(id);
  expect(id).not.toContain("private");
});

it("uses REPOSITORY_URL when the selected repo has no remote", async () => {
  process.env.REPOSITORY_URL = "https://example.invalid/fallback.git";
  const id = await getProjectId({ repo, salt });
  expect(await getProjectId({ repo: other, salt })).toBe(id);
  execFileSync("git", ["-C", other, "config", "remote.origin.url", process.env.REPOSITORY_URL]);
  delete process.env.REPOSITORY_URL;
  expect(await getProjectId({ repo: other, salt })).toBe(id);
});

it("falls back to the repo root when neither remote nor REPOSITORY_URL is available", async () => {
  const id = await getProjectId({ repo, salt });
  expect(await getProjectId({ repo, salt })).toBe(id);
  expect(await getProjectId({ repo: other, salt })).not.toBe(id);
  // A Git failure must still allow hashing the supplied fallback directory.
  expect(await getProjectId({ repo: temp, salt })).toMatch(/^[a-f0-9]{64}$/);
});
