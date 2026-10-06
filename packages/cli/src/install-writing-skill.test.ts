import * as agents from "add-mcp";
import * as childProcess from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, jest, spyOn } from "bun:test";
import { installWritingSkill } from "./install-writing-skill";
import { NAMES } from "./names";

const detect = spyOn(agents, "detectGlobalAgents");
const exec = spyOn(childProcess, "execFileSync");
const ctx = { log: { step: jest.fn(), warn: jest.fn() } };
let root: string;
const source = "buildsip/tiramisu";

beforeEach(() => {
  jest.resetAllMocks();
  detect.mockResolvedValue(["claude-code", "codex", "cursor", "windsurf"]);
  exec.mockReturnValue(Buffer.from(""));
  root = mkdtempSync(join(tmpdir(), "tiramisu-skill-"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

it("installs unpublished root skill edits when running from a source checkout", async () => {
  const cliRoot = join(root, "packages", "cli");
  const local = join(root, NAMES.SKILLS, NAMES.MEMORY_WRITING_SKILL);
  mkdirSync(join(cliRoot, "src"), { recursive: true });
  mkdirSync(join(cliRoot, "scripts"), { recursive: true });
  writeFileSync(join(cliRoot, "src", "index.ts"), "");
  writeFileSync(join(cliRoot, "scripts", "build.mjs"), "");
  mkdirSync(local, { recursive: true });
  writeFileSync(join(local, NAMES.SKILL_MD), "# Unpublished writing guidance");

  // The repository being initialized is unrelated to the CLI checkout.
  await installWritingSkill(ctx, { cwd: join(root, "another repo"), cliRoot });
  expect(exec.mock.calls[0]?.[1]).toEqual([
    "--yes",
    "skills",
    "add",
    local,
    "--skill",
    NAMES.MEMORY_WRITING_SKILL,
    "--global",
    "--yes",
    "--agent",
    "claude-code",
    "codex",
    "cursor",
    "windsurf",
  ]);
});

it("reports a missing checkout skill without installing the GitHub version", async () => {
  const cliRoot = join(root, "packages", "cli");
  mkdirSync(join(cliRoot, "src"), { recursive: true });
  mkdirSync(join(cliRoot, "scripts"), { recursive: true });
  writeFileSync(join(cliRoot, "src", "index.ts"), "");
  writeFileSync(join(cliRoot, "scripts", "build.mjs"), "");

  await expect(installWritingSkill(ctx, { cwd: root, cliRoot })).rejects.toThrow(
    "restore skills/tiramisu-memory-writing/SKILL.md at the repository root",
  );
  expect(exec).not.toHaveBeenCalled();
});

it("explicitly targets every detected supported agent on each accepted installation", async () => {
  await installWritingSkill(ctx, { cwd: root, cliRoot: root });
  await installWritingSkill(ctx, { cwd: root, cliRoot: root });
  expect(detect).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenCalledTimes(2);
  expect(exec).toHaveBeenCalledWith(
    "npx",
    [
      "--yes",
      "skills",
      "add",
      source,
      "--skill",
      NAMES.MEMORY_WRITING_SKILL,
      "--global",
      "--yes",
      "--agent",
      "claude-code",
      "codex",
      "cursor",
      "windsurf",
    ],
    expect.objectContaining({ cwd: root, stdio: "pipe" }),
  );
});

it("maps differing IDs and deduplicates agents sharing a Skills target", async () => {
  detect.mockResolvedValue([
    "vscode",
    "github-copilot-cli",
    "cline-cli",
    "cline",
    "grok-build",
    "kilo-code",
    "kimi-code",
  ]);
  await installWritingSkill(ctx, { cwd: root, cliRoot: root });
  expect(exec.mock.calls[0]?.[1]).toEqual([
    "--yes",
    "skills",
    "add",
    source,
    "--skill",
    NAMES.MEMORY_WRITING_SKILL,
    "--global",
    "--yes",
    "--agent",
    "github-copilot",
    "cline",
    "grok",
    "kilo",
    "kimi-code-cli",
  ]);
});

it("skips unsupported agents while installing for supported ones", async () => {
  detect.mockResolvedValue(["claude-desktop", "mcporter", "mastracode", "claude-code"]);
  await installWritingSkill(ctx, { cwd: root, cliRoot: root });
  expect(exec.mock.calls[0]?.[1]).toEqual([
    "--yes",
    "skills",
    "add",
    source,
    "--skill",
    NAMES.MEMORY_WRITING_SKILL,
    "--global",
    "--yes",
    "--agent",
    "claude-code",
  ]);
  expect(ctx.log.warn).toHaveBeenCalledWith(expect.stringContaining("Vercel Skills has no target"));
});

it.each([
  { detected: [] as agents.AgentType[] },
  { detected: ["claude-desktop"] as agents.AgentType[] },
])("does not invoke the installer without supported targets: $detected", async ({ detected }) => {
  detect.mockResolvedValue(detected);
  await installWritingSkill(ctx, { cwd: root, cliRoot: root });
  expect(exec).not.toHaveBeenCalled();
  expect(ctx.log.warn).toHaveBeenCalledWith(
    expect.stringContaining("the writing skill was not installed"),
  );
});

it("shows installer output in verbose mode", async () => {
  await installWritingSkill(ctx, { cwd: root, cliRoot: root, verbose: true });
  expect(exec).toHaveBeenCalledWith(
    "npx",
    expect.anything(),
    expect.objectContaining({ stdio: "inherit" }),
  );
});

it("reports detection failures without invoking a fallback installer", async () => {
  detect.mockRejectedValue(new Error("cannot inspect config"));
  await expect(installWritingSkill(ctx, { cwd: root, cliRoot: root })).rejects.toThrow(
    "Check access to your agent configuration directories",
  );
  expect(exec).not.toHaveBeenCalled();
});

it("explains how to continue when installation fails", async () => {
  exec.mockImplementation(() => {
    throw new Error("installation failed");
  });
  await expect(installWritingSkill(ctx, { cwd: root, cliRoot: root })).rejects.toThrow(
    "You can decline skill installation",
  );
});
