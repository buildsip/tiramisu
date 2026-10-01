#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cancel, log } from "@clack/prompts";
import { Command } from "commander";
import { registerDeleteCommand } from "./commands/delete-memories";
import { registerUpvoteCommand } from "./commands/upvote";
import { registerPruneCommand } from "./commands/prune";
import { registerInitCommand } from "./commands/init";
import { registerSearchCommand } from "./commands/search";
import { registerInsertCommand } from "./commands/insert";
import { registerUpdateCommand } from "./commands/update";
import { registerTelemetryCommand } from "./commands/telemetry";
import { CLI_NAME } from "./cli-name";
import { installMcp } from "./install-mcp";
import { initTelemetry } from "./init-telemetry";
import { trackTransport } from "./mcp/track-transport";
import { createMcpServer } from "./mcp/create-mcp-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// The built entry point lives in dist; its parent is the installed tiramisu package.
const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(cliRoot, "package.json"), "utf8"));
// Route Commander errors through our catch block so agent commands return JSON errors.
// Accept lowercase -v while preserving Commander's existing -V and --version flags.
const program = new Command()
  .name(CLI_NAME)
  .version(pkg.version)
  .version(pkg.version, "-v")
  .exitOverride();
program.configureOutput({ writeErr: () => {} });

registerInitCommand({ program, cliRoot });
registerSearchCommand({ program });
registerInsertCommand({ program });
registerUpdateCommand({ program });
registerDeleteCommand({ program });
registerUpvoteCommand({ program });
registerPruneCommand({ program });
registerTelemetryCommand({ program });
program
  .command("mcp")
  .description("Serve memory tools over MCP using stdin and stdout.")
  .action(async () => {
    const server = createMcpServer({ version: pkg.version });
    await server.connect(trackTransport(new StdioServerTransport()));
  });

program.action(() => program.help());

try {
  // Preference checks and changes must not start analytics or rewrite agent configuration.
  if (process.argv[2] !== "telemetry") {
    await initTelemetry({
      cliRoot,
      version: pkg.version,
      source: process.argv[2] === "mcp" ? "mcp" : "cli",
    });
    // This also runs for help, version, and MCP startup. Warnings go to stderr to keep JSON intact.
    const agents = await installMcp({
      log: { warn: (message) => process.stderr.write(`${JSON.stringify({ warning: message })}\n`) },
    });
    // Only interactive setup gets a success message; other commands keep their machine output.
    if (process.argv[2] === "init" && agents.length) {
      log.success(`Memory MCP tools added to:\n${agents.map((agent) => `- ${agent}`).join("\n")}`);
    }
  }
  await program.parseAsync(process.argv);
} catch (error) {
  const code = (error as { code?: string }).code;
  if (code !== "commander.helpDisplayed" && code !== "commander.version") {
    const message = error instanceof Error ? error.message : `${CLI_NAME} failed.`;
    if (process.argv[2] === "init") cancel(message);
    else process.stderr.write(`${JSON.stringify({ error: message })}\n`);
    process.exitCode = 1;
  }
}
