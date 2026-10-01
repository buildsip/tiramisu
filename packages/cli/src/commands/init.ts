import { telemetry } from "../telemetry";
import { cancelInit } from "../cancel-init";
import { assertNoSymlinks, readTextIfExistsSync } from "@buildsip/file-utils";
import type { Command } from "commander";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { confirm, group, intro, log, outro } from "@clack/prompts";
import { applyEdits, findNodeAtLocation, modify, parseTree, type ParseError } from "jsonc-parser";
import { CLI_NAME } from "../cli-name";
import { findRepo } from "../find-repo";
import { installCli } from "../install-cli";
import { installWritingSkill } from "../install-writing-skill";
import { prepareInstructions } from "../prepare-instructions";
import type { Config } from "../read-config";
import { NAMES } from "../names";
import { readConfig } from "../read-config";
import { writeText } from "../write-text";
import { getDatabaseUrl } from "../get-database-url";
import { migrateDatabase } from "../migrate-database";
import { promptDatabaseCommand } from "../prompt-database-command";

/**
 * Configures the Git root, even when started inside a nested package.
 * Preserves saved settings, offers missing integrations and instruction replacement,
 * and installs the global CLI before saving the chosen configuration.
 *
 * `cliRoot` is the running CLI package directory, not the package being initialized.
 */
export async function init({
  cwd,
  cliRoot,
  availableToWorkspace = false,
  verbose = false,
}: {
  cwd: string;
  cliRoot: string;
  availableToWorkspace?: boolean;
  verbose?: boolean;
}) {
  telemetry.set({ failure_stage: "setup" });
  const root = await findRepo(cwd);
  await telemetry.setProject({ repo: root });
  const { config, source } = await readConfig(root);
  // Setup messages use the CLI package's name, regardless of the project being configured.
  const { name } = JSON.parse(readFileSync(join(cliRoot, "package.json"), "utf8"));
  const configPath = join(root, NAMES.TIRAMISU_JSON);

  intro(`${CLI_NAME} init`);
  const initialized = source !== undefined;
  telemetry.set({ already_configured: initialized });
  const pruning = initialized && !!config.prune;
  // Snapshot instruction and editor files before asking, so concurrent edits are detected.
  const instructions = await prepareInstructions({ root, cliRoot });
  const settingsPath = join(root, NAMES.VSCODE, NAMES.SETTINGS_JSON);
  await assertNoSymlinks({ path: settingsPath, base: root });
  const previous = readTextIfExistsSync(settingsPath);
  const settingsText = previous ?? "{}\n";
  const errors: ParseError[] = [];
  const tree = parseTree(settingsText, errors, {
    allowTrailingComma: true,
    allowEmptyContent: true,
  });
  const key = "workbench.editor.customLabels.patterns";
  const pattern = `**/${NAMES.MEMORIES}/**/${NAMES.MEMORY_MD}`;
  const patterns = tree && findNodeAtLocation(tree, [key]);
  const label = tree && findNodeAtLocation(tree, [key, pattern]);
  let url: string | undefined;
  telemetry.set({ failure_stage: "prompts" });
  const answers = await group<{
    availableToWorkspace: boolean | symbol;
    prune: boolean | symbol;
    databaseUrlCommand: string | undefined;
    labels: boolean | symbol;
    skill: boolean | symbol;
    instructions: boolean | symbol;
  }>(
    {
      // The flag answers only the sharing question; all other prompts still run.
      availableToWorkspace: async () =>
        availableToWorkspace ||
        (initialized
          ? config.availableToWorkspace === true
          : confirm({
              message:
                "Make all memories in this repository available to the other projects in this workspace?",
              initialValue: false,
            })),
      prune: async () =>
        pruning ||
        confirm({
          message: initialized ? "Pruning is disabled. Enable?" : "Enable pruning?",
          initialValue: !initialized,
        }),
      // Enabled pruning keeps its saved command; only new opt-ins need database input.
      databaseUrlCommand: async ({ results }) => {
        if (!results.prune || pruning) return undefined;
        while (true) {
          const command = await promptDatabaseCommand();
          try {
            // Validate before continuing setup; a bad command can be corrected in this run.
            url = await getDatabaseUrl({ repo: root, command });
            return command;
          } catch (error) {
            // getDatabaseUrl hides credentials and command output in its actionable errors.
            log.warn(
              error instanceof Error
                ? error.message
                : "The database command failed. Enter a command that prints one PostgreSQL URL.",
            );
          }
        }
      },
      labels: async () =>
        // A customized nonempty label is already configured and must not be replaced.
        errors.length === 0 && label?.type === "string" && label.value !== ""
          ? false
          : confirm({ message: "Add memory tab labels to VS Code / Cursor?", initialValue: false }),
      // Enter installs or refreshes the skill. Declining leaves an existing copy alone.
      skill: () =>
        confirm({ message: "Install the global memory-writing skill?", initialValue: true }),
      instructions: () =>
        confirm({
          message: instructions.exists
            ? "You have Tiramisu instructions in AGENTS.md. Override with default instructions?"
            : "Add default instructions to AGENTS.md?",
          initialValue: false,
        }),
    },
    {
      onCancel: cancelInit,
    },
  );
  // Repeat runs change only explicit opt-ins, keeping omitted fields and custom durations intact.
  const next: Config = initialized
    ? { ...config }
    : {
        version: 1,
        availableToWorkspace: answers.availableToWorkspace,
        prune: false,
      };
  if (availableToWorkspace) next.availableToWorkspace = true;
  telemetry.set({
    pruning_enabled: Boolean(answers.prune),
    available_to_workspace: Boolean(answers.availableToWorkspace),
  });
  if (answers.prune && !pruning) {
    next.prune = {
      unvotedTtl: "90d",
      humanUpvoteTtl: "180d",
      agentUpvoteTtl: "90d",
      databaseUrlCommand: answers.databaseUrlCommand,
    };
  }

  let settings: string | undefined;
  if (answers.labels) {
    if (errors.length > 0 || (tree && tree.type !== "object"))
      throw new Error(
        `Cannot update ${settingsPath}: expected a valid JSON object (comments are allowed).`,
      );
    if (patterns && patterns.type !== "object")
      throw new Error(`Cannot update ${settingsPath}: ${key} must be an object.`);
    // Edit only this property so existing JSONC comments and other settings survive.
    settings = applyEdits(
      settingsText,
      modify(settingsText, [key, pattern], `\${dirname}/${NAMES.MEMORY_MD}`, {
        formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
      }),
    );
  }

  // Refresh the schema using saved credentials setup without asking for a new command.
  telemetry.set({ failure_stage: "database" });
  if (pruning && config.prune) {
    const command = config.prune.databaseUrlCommand;
    if (!command) {
      throw new Error(
        `Set prune.databaseUrlCommand in ${configPath} to a shell command that prints one PostgreSQL URL, then run ${CLI_NAME} init again.`,
      );
    }
    try {
      url = await getDatabaseUrl({ repo: root, command });
    } catch (cause) {
      throw new Error(
        `Check prune.databaseUrlCommand in ${configPath}: it must succeed and print exactly one postgres:// or postgresql:// URL. Fix the command or its credentials, then run ${CLI_NAME} init again.`,
        { cause },
      );
    }
  }

  if (url) {
    // The URL was validated by getDatabaseUrl. Never persist the URL itself.
    const result = await migrateDatabase({
      url,
      migrationsFolder: join(cliRoot, "dist", "migrations"),
    });
    log.info(
      result.applied
        ? `Applied ${result.applied} database migration(s).`
        : "Database schema is already up to date. No migrations were applied.",
    );
  }

  telemetry.set({ failure_stage: "install" });
  await installCli({ log }, { cwd: root, cliRoot, verbose });
  if (answers.skill) await installWritingSkill({ log }, { cwd: root, cliRoot, verbose });

  if (answers.instructions && instructions.text !== instructions.previous) {
    await assertNoSymlinks({ path: instructions.path, base: root });
    writeText(instructions);
  }
  if (settings !== undefined) {
    await assertNoSymlinks({ path: settingsPath, base: root });
    mkdirSync(join(root, NAMES.VSCODE), { recursive: true });
    writeText({ path: settingsPath, text: settings, previous });
  }
  // Recheck after prompts and installation; the config path may have changed in the meantime.
  if (!initialized || JSON.stringify(next) !== JSON.stringify(config)) {
    await assertNoSymlinks({ path: configPath, base: root });
    writeText({ path: configPath, text: `${JSON.stringify(next, null, 2)}\n`, previous: source });
  }
  outro(`${name} initialized.`);
}

export function registerInitCommand({ program, cliRoot }: { program: Command; cliRoot: string }) {
  program
    .command("init")
    .description(`Initialize ${CLI_NAME}.`)
    .option("--availableToWorkspace", "Share this repository's memories with the workspace.")
    .option("--verbose", "Print setup command output.")
    .action(async (options: { availableToWorkspace?: boolean; verbose?: boolean }) => {
      return telemetry.run({
        init: true,
        run: async () => {
          await init({
            cwd: process.cwd(),
            cliRoot,
            availableToWorkspace: options.availableToWorkspace,
            verbose: options.verbose,
          });
        },
      });
    });
}
