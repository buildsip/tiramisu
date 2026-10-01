import * as agents from "add-mcp";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as prompts from "@clack/prompts";
import * as databaseUrl from "./get-database-url";
import * as database from "./migrate-database";
import { stubEnv } from "./test/stub-env";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { confirm, log, outro, text } from "@clack/prompts";
import { Command } from "commander";
import { parse } from "jsonc-parser";
import { afterEach, beforeEach, describe, expect, it, jest, spyOn } from "bun:test";
import { init, registerInitCommand } from "./commands/init";
import { NAMES } from "./names";
import { getDatabaseUrl } from "./get-database-url";
import { migrateDatabase } from "./migrate-database";

// Save real implementations before installing spies, so fallbacks cannot recurse into a mock.
const original = { execFileSync, writeFileSync, confirm };
const exec = spyOn(childProcess, "execFileSync");
const detect = spyOn(agents, "detectGlobalAgents");
const write = spyOn(fs, "writeFileSync");
const getUrl = spyOn(databaseUrl, "getDatabaseUrl");
const migrate = spyOn(database, "migrateDatabase");
const ask = spyOn(prompts, "confirm");
const input = spyOn(prompts, "text");
spyOn(prompts, "intro").mockImplementation(() => {});
spyOn(prompts, "outro").mockImplementation(() => {});
spyOn(log, "info").mockImplementation(() => {});
spyOn(log, "step").mockImplementation(() => {});
spyOn(log, "warn").mockImplementation(() => {});

// Most cases simulate Node launchers; only Bun-specific cases expose this runtime flag.
const bunVersion = Object.getOwnPropertyDescriptor(process.versions, "bun")!;

const dbCommand = "doppler secrets get TIRAMISU_DATABASE_URL --plain";

describe("tiramisu init", () => {
  let temp: string;
  let root: string;
  let web: string;
  let cliRoot: string;
  let globalRoot: string;
  let latest: string;
  let bunError: string | undefined;
  let failure: string | undefined;
  let cancelled: boolean | symbol;

  beforeEach(async () => {
    jest.clearAllMocks();
    detect
      .mockReset()
      .mockResolvedValue([
        "claude-code",
        "codex",
        "cursor",
        "github-copilot-cli",
        "vscode",
        "windsurf",
      ]);
    Object.defineProperty(process.versions, "bun", { ...bunVersion, value: undefined });
    getUrl.mockReset().mockResolvedValue("postgresql://example.test/memories");
    migrate.mockReset().mockResolvedValue({ applied: 1 });
    input.mockReset().mockResolvedValue(dbCommand);
    stubEnv({ name: "TIRAMISU_DATABASE_URL", value: "" });
    stubEnv({ name: "npm_config_user_agent", value: "pnpm/11.24.0 npm/? node/v22.0.0" });
    latest = "0.2.0";
    bunError = undefined;
    failure = undefined;
    exec.mockImplementation(((...args: Parameters<typeof execFileSync>) => {
      if (args[0] === "npx") {
        if (failure === "skills") throw new Error("Could not install skill");
        return Buffer.from("");
      }
      if (["pnpm", "npm", "yarn", "bun"].includes(args[0])) {
        const command = (args[1] as string[])[0];
        if (command === failure) throw new Error(`Could not ${command}`);
        if (command === "root") return globalRoot;
        if (command === "global" && (args[1] as string[])[1] === "dir") return dirname(globalRoot);
        if (command === "pm") {
          if (bunError)
            throw Object.assign(new Error("No global packages"), {
              stderr: bunError,
            });
          return `${dirname(globalRoot)} node_modules (1 installed)\n└── tiramisu@0.1.0\n`;
        }
        if (command === "view" || command === "info")
          return JSON.stringify(args[0] === "yarn" ? { type: "inspect", data: latest } : latest);
        return Buffer.from("");
      }
      return Reflect.apply(original.execFileSync, undefined, args);
    }) as typeof execFileSync);
    write.mockImplementation(original.writeFileSync);
    ask.mockReset().mockImplementation(async (options) => options.initialValue ?? false);
    cancelled = await original.confirm({
      message: "Cancel",
      signal: AbortSignal.abort(),
      input: new PassThrough(),
      output: new PassThrough(),
    });
    temp = realpathSync(mkdtempSync(join(tmpdir(), "mem-init-")));
    root = join(temp, "repo with spaces");
    web = join(root, "apps", "web");
    cliRoot = join(temp, "tiramisu source", "packages", "cli");
    globalRoot = join(temp, "global with spaces", NAMES.NODE_MODULES);
    mkdirSync(join(web, "src"), { recursive: true });
    mkdirSync(join(cliRoot, "scripts"), { recursive: true });
    writeFileSync(join(cliRoot, "scripts", "build.mjs"), "");
    mkdirSync(join(cliRoot, NAMES.TEMPLATES), { recursive: true });
    writeFileSync(
      join(cliRoot, NAMES.TEMPLATES, NAMES.AGENTS_MD),
      readFileSync(new URL("../templates/AGENTS.md", import.meta.url), "utf8"),
    );
    writeFileSync(
      join(cliRoot, "package.json"),
      JSON.stringify({
        name: "tiramisu",
        version: "0.1.0",
        private: true,
        bin: { tiramisu: "dist/index.js" },
      }),
    );
    writeFileSync(join(root, "package.json"), '{"name":"@acme/monorepo"}');
    writeFileSync(join(web, "package.json"), '{"name":"@acme/web"}');
    execFileSync("git", ["init", "--quiet", root]);
  });

  afterEach(() => {
    Object.defineProperty(process.versions, "bun", bunVersion);
    rmSync(temp, { recursive: true, force: true });
  });

  function existing(value: object) {
    writeFileSync(join(root, NAMES.TIRAMISU_JSON), JSON.stringify(value));
  }

  function installed(version: string) {
    mkdirSync(join(globalRoot, "tiramisu"), { recursive: true });
    writeFileSync(
      join(globalRoot, "tiramisu", "package.json"),
      JSON.stringify({
        name: "tiramisu",
        version,
        bin: { tiramisu: "dist/index.js" },
      }),
    );
  }

  function acceptSkill() {
    ask.mockImplementation(async (options) =>
      options.message === "Install the global memory-writing skill?"
        ? true
        : (options.initialValue ?? false),
    );
  }

  function addExtras() {
    ask.mockImplementation(async (options) =>
      options.message.startsWith("Add ") ||
      options.message === "Install the global memory-writing skill?"
        ? true
        : (options.initialValue ?? false),
    );
  }

  function published() {
    stubEnv({ name: "npm_config_user_agent", value: "npm/11.0.0 node/v22.0.0" });
    writeFileSync(
      join(cliRoot, "package.json"),
      JSON.stringify({ name: "tiramisu", version: "0.1.0", bin: { tiramisu: "dist/index.js" } }),
    );
  }

  // beforeEach already writes scripts/build.mjs. src/index.ts is the other source-checkout marker.
  function sourceCheckout() {
    mkdirSync(join(cliRoot, "src"), { recursive: true });
    writeFileSync(join(cliRoot, "src", "index.ts"), "");
    // Mirror the monorepo layout so local setup can install unpublished skill edits.
    const skill = join(cliRoot, "..", "..", NAMES.SKILLS, NAMES.MEMORY_WRITING_SKILL);
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      join(skill, NAMES.SKILL_MD),
      readFileSync(new URL("../../../skills/tiramisu-memory-writing/SKILL.md", import.meta.url), "utf8"),
    );
  }

  it("creates only config at the monorepo root and installs the built local CLI", async () => {
    await init({ cwd: root, cliRoot });
    const memories = join(root, NAMES.MEMORIES);
    expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual({
      version: 1,
      availableToWorkspace: false,
      prune: {
        unvotedTtl: "90d",
        humanUpvoteTtl: "180d",
        agentUpvoteTtl: "90d",
        databaseUrlCommand: dbCommand,
      },
    });
    expect(existsSync(memories)).toBe(false);
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-g", cliRoot],
      expect.objectContaining({ cwd: root }),
    );
    expect(
      exec.mock.calls.some(
        ([, args]) => Array.isArray(args) && ["build", "view"].includes(args[0]!),
      ),
    ).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(5);
    expect(outro).toHaveBeenCalledWith("tiramisu initialized.");
    expect(getDatabaseUrl).toHaveBeenCalledTimes(1);
    expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: dbCommand });
    expect(migrateDatabase).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith("Applied 1 database migration(s).");
  });

  it.each([false, true])(
    "--availableToWorkspace shares memories without prompting (reconfigure: %s)",
    async (reconfigure) => {
      if (reconfigure) {
        existing({ availableToWorkspace: false, prune: false });
        ask.mockResolvedValueOnce(true);
      }
      const program = new Command().exitOverride();
      registerInitCommand({ program, cliRoot });
      // Exercise argument parsing from a nested package while writing at the Git root.
      const cwd = spyOn(process, "cwd").mockReturnValue(web);
      try {
        await program.parseAsync(["init", "--availableToWorkspace"], { from: "user" });
      } finally {
        cwd.mockRestore();
      }
      const config = JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"));
      expect(config.availableToWorkspace).toBe(true);
      expect(confirm).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Make all memories in this repository available to the other projects in this workspace?",
        }),
      );
      expect(confirm).toHaveBeenCalledTimes(4);
      expect(confirm).toHaveBeenCalledWith({
        message: reconfigure ? "Pruning is disabled. Enable?" : "Enable pruning?",
        initialValue: !reconfigure,
      });
      expect(config.prune.databaseUrlCommand).toBe(dbCommand);
      expect(existsSync(join(web, NAMES.TIRAMISU_JSON))).toBe(false);
    },
  );

  it.each(["", "src"])("initializes the repo from a nested package's %j", async (subdir) => {
    await init({ cwd: join(web, subdir), cliRoot });
    expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual({
      version: 1,
      availableToWorkspace: false,
      prune: {
        unvotedTtl: "90d",
        humanUpvoteTtl: "180d",
        agentUpvoteTtl: "90d",
        databaseUrlCommand: dbCommand,
      },
    });
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
    expect(existsSync(join(web, "src", NAMES.MEMORIES))).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(5);
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-g", cliRoot],
      expect.objectContaining({ cwd: root }),
    );
    expect(outro).toHaveBeenCalledWith("tiramisu initialized.");
  });

  it.each(["", "src"])("reconfigures the root from a nested package's %j", async (subdir) => {
    existing({ prune: false });
    ask.mockResolvedValueOnce(true);
    await init({ cwd: join(web, subdir), cliRoot });
    const config = JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"));
    expect(config.prune.databaseUrlCommand).toBe(dbCommand);
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(getDatabaseUrl).toHaveBeenCalledTimes(1);
    expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: dbCommand });
    expect(migrateDatabase).toHaveBeenCalledTimes(1);
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
    expect(existsSync(join(web, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(existsSync(join(root, NAMES.MEMORIES))).toBe(false);
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-g", cliRoot],
      expect.objectContaining({ cwd: root }),
    );
  });

  it("keeps saved config byte-for-byte and refreshes the skill from a nested directory", async () => {
    acceptSkill();
    const cwd = join(web, "src");
    await init({ cwd, cliRoot });
    const path = join(root, NAMES.TIRAMISU_JSON);
    const source = readFileSync(path, "utf8");
    ask.mockClear();
    input.mockClear();
    await init({ cwd, cliRoot });
    expect(readFileSync(path, "utf8")).toBe(source);
    expect(existsSync(join(web, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(text).not.toHaveBeenCalled();
    expect(
      ask.mock.calls.every(
        ([options]) =>
          options.initialValue === (options.message === "Install the global memory-writing skill?"),
      ),
    ).toBe(true);
    expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(2);
  });

  it("preserves existing package memories during setup", async () => {
    mkdirSync(join(web, NAMES.MEMORIES), { recursive: true });
    writeFileSync(join(web, NAMES.MEMORIES, "keep.txt"), "keep");
    await init({ cwd: web, cliRoot });
    expect(readFileSync(join(web, NAMES.MEMORIES, "keep.txt"), "utf8")).toBe("keep");
    expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual({
      version: 1,
      availableToWorkspace: false,
      prune: {
        unvotedTtl: "90d",
        humanUpvoteTtl: "180d",
        agentUpvoteTtl: "90d",
        databaseUrlCommand: dbCommand,
      },
    });
    expect(confirm).toHaveBeenCalledTimes(5);
  });

  it.each(["", '{"broken":', '{"version":2}'])(
    "rejects an invalid root config %j from a nested package before setup",
    async (source) => {
      existing({});
      const path = join(root, NAMES.TIRAMISU_JSON);
      writeFileSync(path, source);
      await expect(init({ cwd: web, cliRoot })).rejects.toThrow("config");
      expect(readFileSync(path, "utf8")).toBe(source);
      expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
      expect(log.step).not.toHaveBeenCalled();
    },
  );

  it("initializes a worktree without a project manifest and uses the CLI package name", async () => {
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Mem Test",
        "-c",
        "user.email=tiramisu@example.test",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-m",
        "fixture",
      ],
      { cwd: root, stdio: "pipe" },
    );
    const worktree = join(temp, "worktree");
    execFileSync("git", ["worktree", "add", "--detach", worktree], { cwd: root, stdio: "pipe" });
    const nested = join(worktree, "packages", "web");
    mkdirSync(join(nested, "src"), { recursive: true });
    writeFileSync(join(nested, "package.json"), '{"name":"web"}');
    await init({ cwd: join(nested, "src"), cliRoot });
    expect(existsSync(join(worktree, NAMES.TIRAMISU_JSON))).toBe(true);
    expect(existsSync(join(nested, NAMES.MEMORIES))).toBe(false);
    expect(existsSync(join(root, NAMES.MEMORIES))).toBe(false);
    expect(outro).toHaveBeenCalledWith("tiramisu initialized.");
  });

  it("fails outside Git before prompting or installing", async () => {
    await expect(init({ cwd: temp, cliRoot })).rejects.toThrow("Git working tree");
    expect(confirm).not.toHaveBeenCalled();
    expect(log.step).not.toHaveBeenCalled();
  });

  it.each([false, undefined])(
    "keeps disabled pruning (%j) unless explicitly enabled",
    async (prune) => {
      const value = { frontmatter: { custom: {} }, prune };
      existing(value);
      const before = readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8");
      await init({ cwd: root, cliRoot });
      expect(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).toBe(before);
      expect(confirm).toHaveBeenCalledWith({
        message: "Pruning is disabled. Enable?",
        initialValue: false,
      });
      expect(text).not.toHaveBeenCalled();
      expect(getDatabaseUrl).not.toHaveBeenCalled();
      expect(migrateDatabase).not.toHaveBeenCalled();
      expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(1);
    },
  );

  it("preserves sharing, pruning durations, custom schemas, and memories on repeat setup", async () => {
    const value = {
      version: 1,
      availableToWorkspace: true,
      frontmatter: { custom: { properties: { ticket: { type: "string" } } } },
      prune: {
        unvotedTtl: "120d",
        humanUpvoteTtl: "200d",
        agentUpvoteTtl: "100d",
        databaseUrlCommand: "secrets read",
      },
    };
    existing(value);
    mkdirSync(join(root, NAMES.MEMORIES), { recursive: true });
    writeFileSync(join(root, NAMES.MEMORIES, "keep.txt"), "keep");
    await init({ cwd: root, cliRoot });
    expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual(value);
    expect(readFileSync(join(root, NAMES.MEMORIES, "keep.txt"), "utf8")).toBe("keep");
    expect(text).not.toHaveBeenCalled();
    expect(ask.mock.calls.map(([options]) => options.message)).toEqual([
      "Add memory tab labels to VS Code / Cursor?",
      "Install the global memory-writing skill?",
      "Add default instructions to AGENTS.md?",
    ]);
  });

  it("initializes a store already populated by insert without disturbing its data", async () => {
    mkdirSync(join(root, NAMES.MEMORIES), { recursive: true });
    writeFileSync(join(root, NAMES.MEMORIES, "keep.txt"), "keep");
    await init({ cwd: web, cliRoot });
    expect(readFileSync(join(root, NAMES.MEMORIES, "keep.txt"), "utf8")).toBe("keep");
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(true);
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(5);
  });

  it.each(["directory", "dangling symlink"])("rejects a config path that is a %s", async (kind) => {
    const path = join(root, NAMES.TIRAMISU_JSON);
    if (kind === "directory") mkdirSync(path);
    else symlinkSync(join(temp, "missing"), path);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
    expect(log.step).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2, 3, 4])("cancels prompt %i without writing or installing", async (position) => {
    for (let i = 0; i < position; i++) ask.mockResolvedValueOnce(false);
    ask.mockResolvedValueOnce(cancelled);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("cancelled");
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(existsSync(join(root, NAMES.VSCODE))).toBe(false);
    expect(log.step).not.toHaveBeenCalled();
  });

  it("cancels reconfiguration without touching the existing config", async () => {
    existing({ prune: false });
    ask.mockResolvedValueOnce(cancelled);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("cancelled");
    expect(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).toBe('{"prune":false}');
  });

  it.each([0, 1])(
    "collects one full command and applies %i pending migrations",
    async (applied) => {
      migrate.mockResolvedValue({ applied });
      ask.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await init({ cwd: root, cliRoot });
      const value = JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"));
      expect(value.prune).toEqual({
        unvotedTtl: "90d",
        humanUpvoteTtl: "180d",
        agentUpvoteTtl: "90d",
        databaseUrlCommand: dbCommand,
      });
      expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: dbCommand });
      expect(migrateDatabase).toHaveBeenCalledWith({
        url: "postgresql://example.test/memories",
        migrationsFolder: join(cliRoot, "dist", "migrations"),
      });
      expect(value).not.toHaveProperty("database");
      expect(value.prune).not.toHaveProperty("database");
      expect(JSON.stringify(value)).not.toContain("postgresql://");
      expect(existsSync(join(root, ".env"))).toBe(false);
      expect(text).toHaveBeenCalledTimes(1);
      // The command prompt comes immediately after pruning, before unrelated setup prompts.
      expect(input.mock.invocationCallOrder[0]).toBeGreaterThan(ask.mock.invocationCallOrder[1]!);
      expect(input.mock.invocationCallOrder[0]).toBeLessThan(ask.mock.invocationCallOrder[2]!);
    },
  );

  it("does not resolve credentials or migrate when pruning is disabled", async () => {
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    await init({ cwd: root, cliRoot });
    expect(getDatabaseUrl).not.toHaveBeenCalled();
    expect(migrateDatabase).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("reuses the saved database command for migrations without prompting", async () => {
    existing({ version: 1, prune: { databaseUrlCommand: "old-command" } });
    await init({ cwd: root, cliRoot });
    expect(text).not.toHaveBeenCalled();
    expect(getDatabaseUrl).toHaveBeenCalledTimes(1);
    expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: "old-command" });
    expect(migrateDatabase).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).prune.databaseUrlCommand,
    ).toBe("old-command");
  });

  it("rejects blank database input when enabling disabled pruning", async () => {
    existing({ prune: false });
    ask.mockResolvedValueOnce(true);
    input.mockImplementationOnce(async (options) => {
      expect(options.initialValue).toBeUndefined();
      expect(options.defaultValue).toBeUndefined();
      if (typeof options.validate !== "function") throw new Error("Expected a command validator.");
      for (const value of [undefined, "", "   "]) {
        expect(options.validate(value)).toContain("Enter the full command");
      }
      expect(options.validate(dbCommand)).toBeUndefined();
      return dbCommand;
    });
    await init({ cwd: root, cliRoot });
    expect(getDatabaseUrl).toHaveBeenCalledTimes(1);
    expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: dbCommand });
  });

  it("keeps enabled pruning settings when refreshing from a package", async () => {
    const settings = { prune: { unvotedTtl: "120d", databaseUrlCommand: "root-command" } };
    existing(settings);
    await init({ cwd: web, cliRoot });
    expect(text).not.toHaveBeenCalled();
    expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: "root-command" });
    expect(migrateDatabase).toHaveBeenCalledTimes(1);
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
    expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual(settings);
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it("asks again after invalid output and saves only the successful command", async () => {
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    input.mockResolvedValueOnce("wrong-command").mockResolvedValueOnce(dbCommand);
    getUrl.mockRejectedValueOnce(
      new Error("The database command must print exactly one PostgreSQL URL."),
    );
    await init({ cwd: root, cliRoot });
    expect(text).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      "The database command must print exactly one PostgreSQL URL.",
    );
    expect(migrateDatabase).toHaveBeenCalledTimes(1);
    const value = JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"));
    expect(value.prune.databaseUrlCommand).toBe(dbCommand);
    expect(JSON.stringify(value)).not.toContain("wrong-command");
  });

  it("allows cancellation after invalid output without enabling pruning", async () => {
    existing({ prune: false });
    const path = join(root, NAMES.TIRAMISU_JSON);
    const before = readFileSync(path, "utf8");
    getUrl.mockRejectedValueOnce(new Error("Invalid PostgreSQL URL."));
    input.mockResolvedValueOnce("wrong-command").mockResolvedValueOnce(cancelled as symbol);
    ask.mockResolvedValueOnce(true);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("cancelled");
    expect(getDatabaseUrl).toHaveBeenCalledTimes(1);
    expect(getDatabaseUrl).toHaveBeenCalledWith({
      repo: root,
      command: "wrong-command",
    });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(migrateDatabase).not.toHaveBeenCalled();
    expect(existsSync(join(web, NAMES.MEMORIES))).toBe(false);
  });

  it("leaves pruning disabled when database setup fails", async () => {
    existing({ prune: false });
    const before = readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8");
    ask.mockResolvedValueOnce(true);
    migrate.mockRejectedValue(new Error("Database setup failed."));
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Database setup failed");
    expect(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).toBe(before);
    expect(outro).not.toHaveBeenCalled();
  });

  it("cancels database configuration without saving or migrating", async () => {
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    input.mockResolvedValueOnce(cancelled as symbol);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("cancelled");
    expect(migrateDatabase).not.toHaveBeenCalled();
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
  });

  it("preserves JSONC comments, unrelated settings, and other labels", async () => {
    addExtras();
    mkdirSync(join(root, NAMES.VSCODE));
    writeFileSync(
      join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON),
      '{\n // Keep this\n "editor.tabSize": 4,\n "workbench.editor.customLabels.patterns": {"**/index.ts":"${dirname}"},\n}',
    );
    await init({ cwd: root, cliRoot });
    const text = readFileSync(join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON), "utf8");
    expect(text).toContain("// Keep this");
    expect(parse(text)).toEqual({
      "editor.tabSize": 4,
      "workbench.editor.customLabels.patterns": {
        "**/index.ts": "${dirname}",
        [`**/${NAMES.MEMORIES}/**/${NAMES.MEMORY_MD}`]: `\${dirname}/${NAMES.MEMORY_MD}`,
      },
    });
  });

  it.each(["", "// Empty settings\n", "{}", '{"editor.tabSize":4}'])(
    "handles settings %j",
    async (text) => {
      addExtras();
      mkdirSync(join(root, NAMES.VSCODE));
      writeFileSync(join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON), text);
      await init({ cwd: root, cliRoot });
      expect(
        parse(readFileSync(join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON), "utf8"))[
          "workbench.editor.customLabels.patterns"
        ],
      ).toEqual({
        [`**/${NAMES.MEMORIES}/**/${NAMES.MEMORY_MD}`]: `\${dirname}/${NAMES.MEMORY_MD}`,
      });
    },
  );

  it.each([
    '{"broken":',
    "[]",
    "null",
    '{"workbench.editor.customLabels.patterns":null}',
    '{"workbench.editor.customLabels.patterns":[]}',
  ])("rejects invalid settings %j before installing", async (text) => {
    addExtras();
    mkdirSync(join(root, NAMES.VSCODE));
    const path = join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON);
    writeFileSync(path, text);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Cannot update");
    expect(readFileSync(path, "utf8")).toBe(text);
    expect(log.step).not.toHaveBeenCalled();
  });

  it("leaves editor and ignore files untouched when labels are declined", async () => {
    mkdirSync(join(root, NAMES.VSCODE));
    const paths = [
      join(root, ".gitignore"),
      join(root, ".npmignore"),
      join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON),
    ];
    for (const path of paths) writeFileSync(path, "keep");
    ask.mockResolvedValue(false);
    await init({ cwd: root, cliRoot });
    for (const path of paths) expect(readFileSync(path, "utf8")).toBe("keep");
  });

  it("does not scaffold if global installation fails", async () => {
    failure = "add";
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow(
      "Could not install tiramisu globally",
    );
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(outro).not.toHaveBeenCalled();
  });

  it.each([
    {
      stderr: Buffer.from("error: refusing to install dependency with unsafe name \n"),
      stdout: "",
      message: "Command failed",
      expected: "refusing to install dependency with unsafe name",
    },
    {
      stderr: "",
      stdout: Buffer.from("Could not link the executable\n"),
      message: "Command failed",
      expected: "Could not link the executable",
    },
    {
      stderr: null,
      stdout: null,
      message: "spawnSync bun ENOENT",
      expected: "spawnSync bun ENOENT",
    },
  ])("preserves package manager failure details: $expected", async ({ expected, ...details }) => {
    published();
    stubEnv({ name: "npm_config_user_agent", value: "bun/1.4.2" });
    const fallback = exec.getMockImplementation()!;
    const error = Object.assign(new Error(details.message), details);
    exec.mockImplementation(((...args: Parameters<typeof execFileSync>) => {
      if (args[0] === "bun" && args[1]?.[0] === "add") {
        // Bun can update the manifest and binary before another dependency fails.
        installed("0.2.0");
        throw error;
      }
      return Reflect.apply(fallback, undefined, args);
    }) as typeof execFileSync);

    await expect(init({ cwd: root, cliRoot })).rejects.toMatchObject({
      message: expect.stringContaining(expected),
      cause: error,
    });
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(outro).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "installs the accepted skill independently of instructions: %s",
    async (instructions) => {
      ask.mockImplementation(async (options) => {
        if (options.message === "Install the global memory-writing skill?") return true;
        if (options.message === "Add default instructions to AGENTS.md?") {
          expect(options.initialValue).toBe(false);
          return instructions;
        }
        return options.initialValue ?? false;
      });
      await init({ cwd: join(web, "src"), cliRoot });
      expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(1);
      expect(execFileSync).toHaveBeenCalledWith(
        "npx",
        [
          "--yes",
          "skills",
          "add",
          "buildsip/tiramisu",
          "--skill",
          NAMES.MEMORY_WRITING_SKILL,
          "--global",
          "--yes",
          "--agent",
          "claude-code",
          "codex",
          "cursor",
          "github-copilot",
          "windsurf",
        ],
        expect.objectContaining({ cwd: root }),
      );
      expect(existsSync(join(root, NAMES.AGENTS_MD))).toBe(instructions);
      expect(existsSync(join(web, NAMES.AGENTS_MD))).toBe(false);
      if (instructions) {
        expect(readFileSync(join(root, NAMES.AGENTS_MD), "utf8")).toContain(
          readFileSync(join(cliRoot, NAMES.TEMPLATES, NAMES.AGENTS_MD), "utf8").trimEnd(),
        );
      }
    },
  );

  it.each(["", "# Team rules", "# Team rules\n", "# Team rules\r\n\r\n"])(
    "appends starter instructions while preserving existing AGENTS.md bytes: %j",
    async (previous) => {
      addExtras();
      const path = join(root, NAMES.AGENTS_MD);
      writeFileSync(path, previous);
      await init({ cwd: root, cliRoot });
      const text = readFileSync(path, "utf8");
      expect(text.startsWith(previous)).toBe(true);
      expect(text.match(/<!-- tiramisu -->/g)).toHaveLength(1);
      if (previous.includes("\r\n")) expect(text.replaceAll("\r\n", "")).not.toContain("\n");
    },
  );

  it.each([false, true])(
    "asks about skill installation on every run (initialized: %s)",
    async (initialized) => {
      if (initialized) existing({ prune: false });
      await init({ cwd: root, cliRoot });
      expect(confirm).toHaveBeenCalledWith({
        message: "Install the global memory-writing skill?",
        initialValue: true,
      });
      expect(detect).toHaveBeenCalledTimes(1);
      expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(1);
      expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(true);
    },
  );

  it("leaves the installed skill alone when installation is declined on a repeat run", async () => {
    acceptSkill();
    await init({ cwd: root, cliRoot });
    ask.mockImplementation(async (options) =>
      options.message === "Install the global memory-writing skill?"
        ? false
        : (options.initialValue ?? false),
    );
    exec.mockClear();
    detect.mockClear();
    await init({ cwd: root, cliRoot });
    expect(detect).not.toHaveBeenCalled();
    expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(0);
  });

  it("refreshes the skill but preserves customized starter rules on repeated setup", async () => {
    addExtras();
    installed("0.2.0");
    await init({ cwd: root, cliRoot });
    const path = join(root, NAMES.AGENTS_MD);
    const customized = readFileSync(path, "utf8").replace(
      "## When to create a memory",
      "## Our team's rules\n\nOnly save memories when requested.",
    );
    writeFileSync(path, customized);
    acceptSkill();
    await init({ cwd: root, cliRoot });
    expect(readFileSync(path, "utf8")).toBe(customized);
    expect(exec.mock.calls.filter(([command]) => command === "npx")).toHaveLength(2);
  });

  it.each(["\n", "\r\n"])(
    "replaces only the marked instructions using %j line endings",
    async (newline) => {
      existing({ prune: false });
      const path = join(root, NAMES.AGENTS_MD);
      const before = `# Team rules${newline}${newline}`;
      const after = `${newline}${newline}Keep this footer.`;
      writeFileSync(
        path,
        `${before}<!-- tiramisu -->${newline}Custom instructions${newline}<!-- /tiramisu -->${after}`,
      );
      ask.mockImplementation(async (options) => {
        if (
          options.message ===
          "You have Tiramisu instructions in AGENTS.md. Override with default instructions?"
        ) {
          expect(options.initialValue).toBe(false);
          expect(options.message).not.toContain("\n");
          return true;
        }
        return options.initialValue ?? false;
      });
      await init({ cwd: root, cliRoot });
      const template = readFileSync(join(cliRoot, NAMES.TEMPLATES, NAMES.AGENTS_MD), "utf8")
        .trimEnd()
        .replace(/\r?\n/g, newline);
      expect(readFileSync(path, "utf8")).toBe(
        `${before}<!-- tiramisu -->${newline}${template}${newline}<!-- /tiramisu -->${after}`,
      );
    },
  );

  it.each([
    "<!-- tiramisu -->Custom rules",
    "<!-- /tiramisu -->",
    "<!-- /tiramisu --><!-- tiramisu -->",
    "<!-- tiramisu --><!-- tiramisu --><!-- /tiramisu -->",
  ])("rejects ambiguous instruction markers without writing: %j", async (value) => {
    const path = join(root, NAMES.AGENTS_MD);
    writeFileSync(path, value);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("keep exactly one matching pair");
    expect(readFileSync(path, "utf8")).toBe(value);
    expect(log.step).not.toHaveBeenCalled();
  });

  it("preserves instructions edited while the override prompt is open", async () => {
    existing({ prune: false });
    const path = join(root, NAMES.AGENTS_MD);
    writeFileSync(path, "<!-- tiramisu -->Old<!-- /tiramisu -->");
    ask.mockImplementation(async (options) => {
      if (options.message.includes("Override with default instructions?")) {
        writeFileSync(path, "Concurrent edit");
        return true;
      }
      return options.initialValue ?? false;
    });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Settings changed");
    expect(readFileSync(path, "utf8")).toBe("Concurrent edit");
  });

  it.each(["${dirname}/memory.md", "My custom memory label"])(
    "keeps an existing label %j without prompting",
    async (label) => {
      existing({ prune: false });
      mkdirSync(join(root, NAMES.VSCODE));
      const path = join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON);
      const source = `{ // Custom settings\n "workbench.editor.customLabels.patterns": { "**/.memories/**/memory.md": ${JSON.stringify(label)} } }`;
      writeFileSync(path, source);
      await init({ cwd: root, cliRoot });
      expect(readFileSync(path, "utf8")).toBe(source);
      expect(
        ask.mock.calls.some(([options]) => options.message.includes("memory tab labels")),
      ).toBe(false);
    },
  );

  it("declines optional additions by default", async () => {
    existing({ prune: false });
    await init({ cwd: root, cliRoot });
    expect(
      ask.mock.calls.every(
        ([options]) =>
          options.initialValue === (options.message === "Install the global memory-writing skill?"),
      ),
    ).toBe(true);
    expect(existsSync(join(root, NAMES.AGENTS_MD))).toBe(false);
    expect(existsSync(join(root, NAMES.VSCODE))).toBe(false);
  });

  it("preserves settings edited while the label prompt is open", async () => {
    existing({ prune: false });
    mkdirSync(join(root, NAMES.VSCODE));
    const path = join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON);
    writeFileSync(path, "{}");
    ask.mockImplementation(async (options) => {
      if (options.message.includes("memory tab labels")) {
        writeFileSync(path, '{"editor.tabSize":8}');
        return true;
      }
      return options.initialValue ?? false;
    });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Settings changed");
    expect(readFileSync(path, "utf8")).toBe('{"editor.tabSize":8}');
  });

  it.each([false, undefined])(
    "enables disabled pruning (%j) and immediately asks for the database command",
    async (prune) => {
      existing({ availableToWorkspace: true, prune });
      ask.mockResolvedValueOnce(true);
      await init({ cwd: root, cliRoot });
      expect(ask.mock.calls[0]?.[0]).toEqual({
        message: "Pruning is disabled. Enable?",
        initialValue: false,
      });
      expect(text).toHaveBeenCalledTimes(1);
      expect(input.mock.invocationCallOrder[0]).toBeGreaterThan(ask.mock.invocationCallOrder[0]!);
      expect(input.mock.invocationCallOrder[0]).toBeLessThan(ask.mock.invocationCallOrder[1]!);
      expect(getDatabaseUrl).toHaveBeenCalledWith({ repo: root, command: dbCommand });
      expect(migrateDatabase).toHaveBeenCalledTimes(1);
      expect(JSON.parse(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8"))).toEqual({
        availableToWorkspace: true,
        prune: {
          unvotedTtl: "90d",
          humanUpvoteTtl: "180d",
          agentUpvoteTtl: "90d",
          databaseUrlCommand: dbCommand,
        },
      });
    },
  );

  it.each([undefined, "broken-command"])(
    "does not replace an enabled pruning command (%j) when setup fails",
    async (command) => {
      existing({ prune: { databaseUrlCommand: command } });
      getUrl.mockRejectedValue(new Error("Secret command output"));
      const path = join(root, NAMES.TIRAMISU_JSON);
      const before = readFileSync(path, "utf8");
      await expect(init({ cwd: root, cliRoot })).rejects.toThrow("prune.databaseUrlCommand");
      expect(readFileSync(path, "utf8")).toBe(before);
      expect(text).not.toHaveBeenCalled();
      expect(migrateDatabase).not.toHaveBeenCalled();
    },
  );

  it("leaves files unchanged when skill installation fails", async () => {
    acceptSkill();
    const path = join(root, NAMES.AGENTS_MD);
    writeFileSync(path, "Existing team instructions");
    failure = "skills";
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("tiramisu init --verbose");
    expect(readFileSync(path, "utf8")).toBe("Existing team instructions");
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(existsSync(join(root, NAMES.VSCODE))).toBe(false);
    expect(outro).not.toHaveBeenCalled();
  });

  it("rejects an AGENTS.md symlink before installing", async () => {
    const outside = join(temp, "outside.md");
    writeFileSync(outside, "Keep this");
    symlinkSync(outside, join(root, NAMES.AGENTS_MD));
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Symbolic links");
    expect(readFileSync(outside, "utf8")).toBe("Keep this");
    expect(log.step).not.toHaveBeenCalled();
  });

  it("preserves AGENTS.md edits made while installing the skill", async () => {
    addExtras();
    const path = join(root, NAMES.AGENTS_MD);
    writeFileSync(path, "Before install");
    const run = exec.getMockImplementation()!;
    exec.mockImplementation(((...args: Parameters<typeof execFileSync>) => {
      if (args[0] === "npx") writeFileSync(path, "Concurrent edit");
      return Reflect.apply(run, undefined, args);
    }) as typeof execFileSync);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Settings changed");
    expect(readFileSync(path, "utf8")).toBe("Concurrent edit");
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
  });

  it("skips reinstalling an equal or newer private global CLI", async () => {
    acceptSkill();
    installed("0.2.0");
    await init({ cwd: root, cliRoot });
    expect(log.step).toHaveBeenCalledTimes(1);
    expect(log.step).toHaveBeenCalledWith("Installing tiramisu-memory-writing globally.");
    expect(confirm).toHaveBeenCalledTimes(5);
  });

  it("rebuilds and links a public development package even when a newer CLI is installed", async () => {
    published();
    installed("0.2.0");
    sourceCheckout();
    await init({ cwd: root, cliRoot });
    const calls = exec.mock.calls.filter(([command]) => command === "bun");
    expect(calls).toEqual([
      ["bun", ["run", "build"], expect.objectContaining({ cwd: cliRoot, stdio: "pipe" })],
      ["bun", ["link"], expect.objectContaining({ cwd: cliRoot, stdio: "pipe" })],
    ]);
    expect(execFileSync).not.toHaveBeenCalledWith("npm", expect.anything(), expect.anything());
    expect(confirm).toHaveBeenCalledTimes(5);
    expect(log.warn).not.toHaveBeenCalled();
    expect(outro).toHaveBeenCalledWith("tiramisu initialized.");
  });

  it("automatically builds and links a source checkout without checking the registry", async () => {
    published();
    installed("0.2.0");
    sourceCheckout();
    await init({ cwd: web, cliRoot });
    expect(execFileSync).toHaveBeenCalledWith(
      "bun",
      ["run", "build"],
      expect.objectContaining({ cwd: cliRoot }),
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "bun",
      ["link"],
      expect.objectContaining({ cwd: cliRoot }),
    );
    expect(execFileSync).not.toHaveBeenCalledWith("npm", expect.anything(), expect.anything());
  });

  it("does not treat the user's project as the CLI source checkout", async () => {
    published();
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "src", "index.ts"), "");
    writeFileSync(join(root, "scripts", "build.mjs"), "");
    await init({ cwd: root, cliRoot });
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", "tiramisu@0.2.0"],
      expect.objectContaining({ cwd: root }),
    );
    expect(execFileSync).not.toHaveBeenCalledWith("bun", expect.anything(), expect.anything());
  });

  it("shows local build and link output in verbose mode", async () => {
    sourceCheckout();
    await init({ cwd: root, cliRoot, verbose: true });
    for (const args of [["run", "build"], ["link"]]) {
      expect(execFileSync).toHaveBeenCalledWith(
        "bun",
        args,
        expect.objectContaining({ cwd: cliRoot, stdio: "inherit" }),
      );
    }
  });

  it.each(["run", "link"])("stops setup when the local %s fails", async (command) => {
    sourceCheckout();
    failure = command;
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow(
      command === "run"
        ? "Could not build the local tiramisu CLI"
        : "Could not link the local tiramisu CLI",
    );
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
    expect(execFileSync).not.toHaveBeenCalledWith("npx", expect.anything(), expect.anything());
    if (command === "run") {
      expect(execFileSync).not.toHaveBeenCalledWith("bun", ["link"], expect.anything());
    }
  });

  it("prompts before upgrading a published global CLI", async () => {
    published();
    installed("0.1.0");
    await init({ cwd: root, cliRoot });
    expect(ask.mock.calls[5]?.[0].message).toContain("0.1.0 to 0.2.0");
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", "tiramisu@0.2.0"],
      expect.anything(),
    );
  });

  it("declining an upgrade preserves the global CLI and still initializes the project", async () => {
    published();
    installed("0.1.0");
    ask
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    await init({ cwd: root, cliRoot });
    expect(log.step).not.toHaveBeenCalled();
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(true);
  });

  it("installs the running published version if a first-install upgrade is declined", async () => {
    published();
    ask
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    await init({ cwd: root, cliRoot });
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", "tiramisu@0.1.0"],
      expect.anything(),
    );
  });

  it("cancels an upgrade without writing or installing", async () => {
    published();
    installed("0.1.0");
    ask
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(cancelled);
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("cancelled");
    expect(log.step).not.toHaveBeenCalled();
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
  });

  it("continues with the running version when the registry is unavailable", async () => {
    published();
    failure = "view";
    await init({ cwd: root, cliRoot });
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Could not check"));
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", "tiramisu@0.1.0"],
      expect.anything(),
    );
  });

  it("never downgrades a newer installed release", async () => {
    acceptSkill();
    published();
    installed("0.3.0");
    await init({ cwd: root, cliRoot });
    expect(log.step).toHaveBeenCalledTimes(1);
    expect(log.step).toHaveBeenCalledWith("Installing tiramisu-memory-writing globally.");
    expect(confirm).toHaveBeenCalledTimes(5);
  });

  it("refuses to overwrite a different global package using the same name", async () => {
    mkdirSync(join(globalRoot, "tiramisu"), { recursive: true });
    writeFileSync(
      join(globalRoot, "tiramisu", "package.json"),
      '{"name":"tiramisu","version":"10.0.0"}',
    );
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("not this CLI");
    expect(log.step).not.toHaveBeenCalled();
  });

  it("forwards global install output in verbose mode", async () => {
    await init({ cwd: root, cliRoot, verbose: true });
    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["add", "-g", cliRoot],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it.each([
    { agent: "pnpm/11.24.0 npm/? node/v22.0.0", manager: "pnpm", args: ["add", "-g"] },
    { agent: "npm/11.0.0 node/v22.0.0", manager: "npm", args: ["install", "--global"] },
    { agent: "yarn/1.22.22 npm/? node/v22.0.0", manager: "yarn", args: ["global", "add"] },
    { agent: "bun/1.3.0", manager: "bun", args: ["add", "-g"] },
  ])(
    "uses the $manager launcher for installation and version checks",
    async ({ agent, manager, args }) => {
      existing({});
      published();
      stubEnv({ name: "npm_config_user_agent", value: agent });
      installed("0.1.0");
      ask.mockResolvedValueOnce(true);
      await init({ cwd: join(web, "src"), cliRoot });
      expect(execFileSync).toHaveBeenCalledWith(
        manager,
        [...args, "tiramisu@0.2.0"],
        expect.objectContaining({ cwd: root }),
      );
      expect(ask.mock.calls[4]?.[0].message).toContain("0.1.0 to 0.2.0");
    },
  );

  it("ignores repository lockfiles and packageManager when launched with npx", async () => {
    existing({});
    ask.mockResolvedValueOnce(true);
    stubEnv({ name: "npm_config_user_agent", value: "npm/11.0.0 node/v22.0.0" });
    writeFileSync(join(root, "pnpm-lock.yaml"), "");
    writeFileSync(join(web, "yarn.lock"), "");
    writeFileSync(join(web, "bun.lock"), "");
    writeFileSync(join(web, "package.json"), '{"name":"web","packageManager":"bun@1.3.0"}');
    await init({ cwd: web, cliRoot });
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", cliRoot],
      expect.objectContaining({ cwd: root }),
    );
  });

  it.each([undefined, "unknown/1.0"])(
    "falls back to npm without a recognized launcher (%s)",
    async (agent) => {
      stubEnv({ name: "npm_config_user_agent", value: agent });
      await init({ cwd: root, cliRoot });
      expect(execFileSync).toHaveBeenCalledWith(
        "npm",
        ["install", "--global", cliRoot],
        expect.anything(),
      );
    },
  );

  it.each([undefined, "pnpm/11.24.0 npm/? node/v22.0.0"])(
    "recognizes bunx --bun even with inherited launcher metadata (%s)",
    async (agent) => {
      stubEnv({ name: "npm_config_user_agent", value: agent });
      Object.defineProperty(process.versions, "bun", { ...bunVersion, value: "1.3.0" });
      await init({ cwd: root, cliRoot });
      expect(execFileSync).toHaveBeenCalledWith("bun", ["add", "-g", cliRoot], expect.anything());
    },
  );

  it("uses npm for global installation when launched by yarn dlx", async () => {
    stubEnv({ name: "npm_config_user_agent", value: "yarn/4.9.0 npm/? node/v22.0.0" });
    await init({ cwd: root, cliRoot });
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("does not support global installs"),
    );
    expect(execFileSync).toHaveBeenCalledWith(
      "npm",
      ["install", "--global", cliRoot],
      expect.anything(),
    );
  });

  it.each([
    {
      reason: "no package.json",
      stderr: 'error: No package.json was found for directory "/global"',
    },
    {
      reason: "no lockfile",
      stderr: "error: missing lockfile, nothing to list\nnote: run 'bun install' first",
    },
  ])(
    "installs a published CLI with Bun when the global directory has $reason",
    async ({ stderr }) => {
      published();
      latest = "0.1.0";
      bunError = stderr;
      stubEnv({ name: "npm_config_user_agent", value: "bun/1.4.2" });
      await init({ cwd: root, cliRoot });
      expect(execFileSync).toHaveBeenCalledWith(
        "bun",
        ["add", "-g", "tiramisu@0.1.0"],
        expect.anything(),
      );
      expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(true);
      expect(outro).toHaveBeenCalledWith("tiramisu initialized.");
    },
  );

  it.each([
    "error: failed to parse lockfile: InvalidLockfile",
    "error: failed to read lockfile: EACCES",
  ])("does not install over Bun global listing errors (%s)", async (stderr) => {
    bunError = stderr;
    stubEnv({ name: "npm_config_user_agent", value: "bun/1.4.2" });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("No global packages");
    expect(execFileSync).not.toHaveBeenCalledWith(
      "bun",
      ["add", "-g", expect.anything()],
      expect.anything(),
    );
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(false);
  });

  it("does not mistake a failed Bun lookup for a missing installation", async () => {
    failure = "pm";
    stubEnv({ name: "npm_config_user_agent", value: "bun/1.3.0" });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Could not pm");
    expect(log.step).not.toHaveBeenCalled();
  });

  it("preserves config changed while the prompts were open", async () => {
    existing({ prune: false });
    ask.mockImplementationOnce(async () => {
      writeFileSync(join(root, NAMES.TIRAMISU_JSON), '{"prune":{"unvotedTtl":"500d"}}');
      return true;
    });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("Settings changed");
    expect(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).toBe(
      '{"prune":{"unvotedTtl":"500d"}}',
    );
  });

  it("preserves a root config created while the prompts were open", async () => {
    const path = join(root, NAMES.TIRAMISU_JSON);
    ask.mockImplementationOnce(async () => {
      writeFileSync(path, '{"prune":false}');
      return false;
    });
    await expect(init({ cwd: web, cliRoot })).rejects.toThrow("Settings changed");
    expect(readFileSync(path, "utf8")).toBe('{"prune":false}');
  });

  it("preserves a memory store created during the prompts", async () => {
    ask.mockImplementationOnce(async () => {
      mkdirSync(join(root, NAMES.MEMORIES));
      writeFileSync(join(root, NAMES.MEMORIES, "keep"), "keep");
      return false;
    });
    await init({ cwd: root, cliRoot });
    expect(readFileSync(join(root, NAMES.MEMORIES, "keep"), "utf8")).toBe("keep");
    expect(existsSync(join(root, NAMES.TIRAMISU_JSON))).toBe(true);
  });

  it("does not truncate the existing config on a failed write", async () => {
    existing({ prune: false });
    ask
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    write.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    await expect(init({ cwd: root, cliRoot })).rejects.toThrow("disk full");
    expect(readFileSync(join(root, NAMES.TIRAMISU_JSON), "utf8")).toBe('{"prune":false}');
    expect(readdirSync(root).some((name) => name.startsWith(NAMES.MEM_PREFIX))).toBe(false);
  });
});
