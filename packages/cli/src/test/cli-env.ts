import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Isolates child-process agent configs from the developer's real home and agent overrides.
 * */
export function cliEnv({ home }: { home: string }): Record<string, string> {
  // Built CLI tests use real transports; disable analytics before starting those children.
  mkdirSync(join(home, ".tiramisu"), { recursive: true });
  writeFileSync(join(home, ".tiramisu", "telemetry.json"), '{"enabled":false}');
  const env: Record<string, string> = { HOME: home, USERPROFILE: home };
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}
