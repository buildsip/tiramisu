import { initPosthog } from "./init-posthog";
import { isSourceCheckout } from "./is-source-checkout";
import { readTelemetryId } from "./read-telemetry-id";
import { telemetry } from "./telemetry";
import { writeTelemetryLog } from "./write-telemetry-log";

/** Configures analytics once at the executable boundary; domain functions never start it. */
export async function initTelemetry({
  cliRoot,
  version,
  source,
}: {
  cliRoot: string;
  version: string;
  source: "mcp" | "cli";
}) {
  telemetry.configure();
  try {
    const identity = await readTelemetryId();
    if (!identity) return;
    // Check the CLI package, not the user's repository. Linked source builds stay local.
    const dev = isSourceCheckout({ root: cliRoot });
    const client = dev ? undefined : initPosthog();
    telemetry.configure({
      salt: identity.salt,
      capture: ({ event, properties }) => {
        const payload = {
          distinctId: identity.id,
          event,
          properties: {
            ...properties,
            version,
            os: process.platform,
            node_version: process.versions.node,
            $process_person_profile: false,
          },
        };
        // The telemetry schema already removed unapproved fields before calling this sink.
        if (dev) writeTelemetryLog({ payload });
        else client?.capture(payload);
      },
    });
    if (identity.first) telemetry.capture({ event: "first run", properties: { source } });
  } catch {
    // Analytics initialization is optional even if the SDK cannot start.
    telemetry.configure();
  }
}
