import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { cliEnv } from "./test/cli-env";

const exec = promisify(execFile);
let temp: string;
let script: string;

beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), "tiramisu-posthog-"));
  const entry = join(temp, "entry.ts");
  script = join(temp, "entry.js");
  // Run the real SDK in Node with a fake transport: no project receives test events.
  await writeFile(
    entry,
    `import { initPosthog } from ${JSON.stringify(fileURLToPath(new URL("./init-posthog.ts", import.meta.url)))};
const mode = process.argv[2];
globalThis.fetch = async (_url, options) => {
  process.stdout.write("request\\n");
  if (mode === "tls") throw new Error("self signed certificate in certificate chain");
  if (mode === "offline") throw new TypeError("fetch failed");
  if (mode === "timeout") {
    return new Promise((_, reject) => {
      // A real network request keeps Node alive until it finishes or is aborted.
      const timer = setTimeout(() => reject(new Error("Request was not aborted")), 5000);
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(options.signal.reason);
      }, { once: true });
    });
  }
  if (mode === "http") return new Response("Unavailable", { status: 503 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  process.stdout.write("delivered\\n");
  return new Response('{"status":1}', { status: 200 });
};
const client = initPosthog();
client.capture({ distinctId: "test-installation", event: "test event" });
if (mode === "SIGINT" || mode === "SIGTERM") {
  setTimeout(() => process.kill(process.pid, mode), 10);
}
`,
  );
  // Bundle the fixture so Node can resolve the SDK even from the temporary directory.
  const result = await Bun.build({ entrypoints: [entry], outdir: temp, target: "node", format: "esm" });
  if (!result.success) throw new AggregateError(result.logs, "Could not build the PostHog test.");
});

afterAll(async () => {
  await rm(temp, { recursive: true, force: true });
});

/** Runs with isolated configuration and a deadline to catch shutdown hangs. */
function run({ mode }: { mode: string }) {
  return exec("node", [script, mode], {
    env: cliEnv({ home: temp }),
    timeout: 4_000,
  });
}

it("delivers an event and exits normally without diagnostic output", async () => {
  const result = await run({ mode: "success" });
  expect(result.stdout).toBe("request\ndelivered\n");
  expect(result.stderr).toBe("");
});

it.each(["tls", "offline", "http", "timeout"])(
  "silently drops %s failures without retries",
  async (mode) => {
    const result = await run({ mode });
    expect(result.stdout).toBe("request\n");
    expect(result.stderr).toBe("");
  },
);

it.each([
  { mode: "SIGINT", code: 130 },
  { mode: "SIGTERM", code: 143 },
])("flushes before exiting for $mode", async ({ mode, code }) => {
  await expect(run({ mode })).rejects.toMatchObject({
    code,
    stdout: "request\ndelivered\n",
    stderr: "",
  });
});
