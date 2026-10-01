import type { Command } from "commander";
import { CLI_NAME } from "../cli-name";
import { readTelemetryConfig } from "../read-telemetry-config";
import { setTelemetryEnabled } from "../set-telemetry-enabled";
import { NAMES } from "../names";

/** Controls the local preference without starting analytics or requiring a repository. */
export function registerTelemetryCommand({ program }: { program: Command }) {
  program
    .command("telemetry")
    .description("Show telemetry status, or enable or disable it for this computer.")
    .option("--enable", "Enable telemetry.")
    .option("--disable", "Disable telemetry.")
    .addHelpText("after", "\nRestart any running Tiramisu MCP servers after changing this setting.")
    .action(async (options: { enable?: boolean; disable?: boolean }) => {
      if (options.enable && options.disable) {
        throw new Error(
          `Choose one telemetry option: --enable or --disable, then run ${CLI_NAME} telemetry again.`,
        );
      }
      let enabled: boolean;
      try {
        if (options.enable || options.disable) {
          enabled = !!options.enable;
          await setTelemetryEnabled({ enabled });
        } else {
          enabled = (await readTelemetryConfig()).enabled;
        }
      } catch (error) {
        if (!(error as NodeJS.ErrnoException).code) throw error;
        throw new Error(
          `Could not access telemetry settings. Ensure ~/${NAMES.TIRAMISU_HOME_DIR} is a directory and ${NAMES.TELEMETRY_JSON} is readable${options.enable || options.disable ? " and writable" : ""}, then retry ${CLI_NAME} telemetry. ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      process.stdout.write(`${JSON.stringify({ enabled })}\n`);
    });
}
