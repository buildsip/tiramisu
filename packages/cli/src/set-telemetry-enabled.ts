import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CLI_NAME } from "./cli-name";
import { readTelemetryConfig } from "./read-telemetry-config";
import { writeText } from "./write-text";

/** Saves a global preference while preserving the existing identity and other fields. */
export async function setTelemetryEnabled({ enabled }: { enabled: boolean }) {
  const config = await readTelemetryConfig();
  if (config.text !== undefined && !config.data) {
    throw new Error(
      `Telemetry settings must contain a JSON object: ${config.path}. Fix the JSON or move this file aside, then run ${CLI_NAME} telemetry --${enabled ? "enable" : "disable"} again.`,
    );
  }
  const data: Record<string, unknown> = { ...config.data, enabled };
  // Disabling before first use needs no ID or salt. Enabling supplies any missing values.
  if (enabled && !config.id) {
    data.id = randomUUID();
    data.createdAt = new Date().toISOString();
  }
  if (enabled && !config.salt) data.salt = randomBytes(16).toString("hex");
  await mkdir(dirname(config.path), { recursive: true, mode: 0o700 });
  // Stage the complete JSON beside its destination, then publish it with private permissions.
  writeText({
    path: config.path,
    text: `${JSON.stringify(data, null, 2)}\n`,
    previous: config.text,
    mode: 0o600,
  });
}
