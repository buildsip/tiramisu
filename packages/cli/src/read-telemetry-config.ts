import { readTextIfExists } from "@buildsip/file-utils";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { NAMES } from "./names";

// Both random values must be valid before startup can use this installation's identity.
const identitySchema = z.object({
  id: z.uuidv4(),
  salt: z.string().regex(/^[a-f0-9]{32}$/),
});

/** Reads the saved preference without creating an identity or changing the file. */
export async function readTelemetryConfig() {
  const path = join(homedir(), NAMES.TIRAMISU_HOME_DIR, NAMES.TELEMETRY_JSON);
  const text = await readTextIfExists(path);
  let data: Record<string, unknown> | undefined;
  try {
    const value = text === undefined ? undefined : JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) data = value;
  } catch {
    // Malformed settings disable analytics; a status check must not replace them.
  }
  const result = identitySchema.safeParse(data);
  const id = result.success ? result.data.id : undefined;
  const salt = result.success ? result.data.salt : undefined;
  // With no file, normal startup will create an identity. An invalid existing file stays disabled.
  const enabled =
    text === undefined || (id !== undefined && salt !== undefined && data?.enabled !== false);
  return { path, text, data, id, salt, enabled };
}
