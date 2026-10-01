import { closeSync, fchmodSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NAMES } from "./names";

/** Appends a validated telemetry payload locally; synchronous writes finish before CLI exit. */
export function writeTelemetryLog({
  payload,
}: {
  payload: { distinctId: string; event: string; properties: Record<string, unknown> };
}) {
  const folder = join(homedir(), NAMES.TIRAMISU_HOME_DIR);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  // Append mode preserves previous runs and keeps each event on its own JSON line.
  const file = openSync(join(folder, NAMES.TELEMETRY_DEBUG_JSONL), "a", 0o600);
  try {
    // Apply private permissions to existing logs too, not just newly created files.
    fchmodSync(file, 0o600);
    writeFileSync(file, `${JSON.stringify({ timestamp: new Date().toISOString(), ...payload })}\n`);
  } finally {
    closeSync(file);
  }
}
