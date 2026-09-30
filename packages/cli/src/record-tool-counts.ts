import { telemetry } from "./telemetry";

/** Records array lengths only; never stores or sends the tool result itself. */
export function recordToolCounts({ name, result }: { name: string; result: unknown }) {
  if (
    ["insert-memory", "update-memory", "delete-memories"].includes(name) &&
    Array.isArray(result)
  ) {
    telemetry.set({ affected_count: result.length });
  }
  if (name === "upvote-memories" && result && typeof result === "object") {
    const votes = result as { upvoted: unknown[]; skipped: { paths: unknown[] }[] };
    telemetry.set({
      recorded_count: votes.upvoted.length,
      skipped_count: votes.skipped.reduce((count, group) => count + group.paths.length, 0),
    });
  }
}
