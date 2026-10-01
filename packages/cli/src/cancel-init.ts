import { CLI_NAME } from "./cli-name";
import { telemetry } from "./telemetry";

/** Marks cancellation consistently across setup, database, and upgrade prompts. */
export function cancelInit(): never {
  telemetry.set({ outcome: "cancelled" });
  throw new Error(`${CLI_NAME} init cancelled.`);
}
