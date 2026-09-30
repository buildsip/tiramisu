import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { readTelemetryConfig } from "./read-telemetry-config";
import { writeText } from "./write-text";

/** Creates the installation ID and private salt together, then reuses them across startups. */
export async function readTelemetryId() {
  let first = false;
  try {
    let config = await readTelemetryConfig();
    if (config.text === undefined) {
      await mkdir(dirname(config.path), { recursive: true, mode: 0o700 });
      const data = {
        enabled: true,
        id: randomUUID(),
        salt: randomBytes(16).toString("hex"),
        createdAt: new Date().toISOString(),
      };
      try {
        // Publish both values in one complete file. Concurrent startups reuse the winner.
        writeText({
          path: config.path,
          text: `${JSON.stringify(data, null, 2)}\n`,
          mode: 0o600,
        });
        first = true;
      } catch {
        // Another process may have created the settings after our first read.
      }
      config = await readTelemetryConfig();
    }
    if (!config.enabled || !config.id || !config.salt) return;
    return { id: config.id, salt: config.salt, first };
  } catch {
    // Unreadable or malformed configuration disables telemetry, not memory operations.
    return;
  }
}
