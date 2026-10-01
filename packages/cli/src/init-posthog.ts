import { PostHog } from "posthog-node";
import { fetchPosthog } from "./fetch-posthog";

/** Creates Tiramisu's analytics client using its public project token. */
export function initPosthog() {
  const client = new PostHog("phc_yr5TL8RWwJPxryCaseosvitLajrPNuD3ZvTyy3ZxYLHT", {
    host: "https://us.i.posthog.com",
    // Tiramisu runs on the user's machine, even when it serves MCP requests.
    isServer: false,
    disableGeoip: true,
    enableExceptionAutocapture: false,
    // Start delivery on capture; do not run a separate background flush timer.
    flushAt: 1,
    flushInterval: 0,
    // Bound the shutdown backlog to one queued batch plus any in-flight batch.
    maxQueueSize: 100,
    maxBatchSize: 100,
    requestTimeout: 1_000,
    fetchRetryCount: 0,
    fetch: (url, options) => fetchPosthog({ url, options }),
  });

  let shutdown: Promise<void> | undefined;
  /** Shares one flush when normal exit and a termination signal overlap. */
  function stop() {
    return (shutdown ??= client.shutdown(1_500).catch(() => {
      // Analytics delivery must not change the command's result or MCP output.
    }));
  }

  // Command parsing finishes before an MCP session does. Wait for Node to run
  // out of work so the client stays available throughout the session.
  process.once("beforeExit", stop);
  // beforeExit does not run for signals. Keep the usual shell exit codes after flushing.
  process.once("SIGINT", async () => {
    await stop();
    process.exit(130);
  });
  process.once("SIGTERM", async () => {
    await stop();
    process.exit(143);
  });

  return client;
}
