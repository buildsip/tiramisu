import { z } from "zod";

/** Omits a bad measurement without losing the other valid fields in the event. */
function optional<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

// Zod numbers reject NaN and infinity; durations and counts must also be nonnegative.
const number = optional(z.number().nonnegative());
const flag = optional(z.boolean());
const id = z.string().regex(/^[a-f0-9]{64}$/);

/** Defines the request data allowed in telemetry; Zod strips unknown properties. */
export const telemetrySchema = z.object({
  event: z.enum(["first run", "init started", "init finished", "tool finished"]),
  properties: z
    .object({
      duration_ms: number,
      root_count: number,
      store_count: number,
      git_path_count: number,
      loaded_count: number,
      cache_hits: number,
      cache_misses: number,
      before_filter_count: number,
      after_filter_count: number,
      searchable_count: number,
      match_count: number,
      result_count: number,
      offset: number,
      affected_count: number,
      recorded_count: number,
      skipped_count: number,
      scanned_count: number,
      eligible_count: number,
      candidate_count: number,
      index_ms: number,
      query_ms: number,
      workspace_load_ms: number,
      database_ms: number,
      whole_repo: flag,
      index_reused: flag,
      already_configured: flag,
      pruning_enabled: flag,
      available_to_workspace: flag,
      tool: optional(
        z.enum([
          "insert-memory",
          "update-memory",
          "search-memories",
          "delete-memories",
          "upvote-memories",
          "prune-memories",
          "unknown",
        ]),
      ),
      project_id: optional(id),
      project_ids: optional(z.array(id)),
      source: optional(z.enum(["mcp", "cli"])),
      outcome: optional(z.enum(["success", "error", "cancelled"])),
      actor: optional(z.enum(["human", "agent"])),
      failure_stage: optional(
        z.enum([
          "resolve_repo",
          "validate_scopes",
          "find_stores",
          "git",
          "load_memories",
          "filter",
          "index",
          "query",
          "workspace_load",
          "database",
          "setup",
          "prompts",
          "install",
        ]),
      ),
      error_category: optional(
        z.enum([
          "operation",
          "permission_denied",
          "invalid_input",
          "filesystem",
          "connection",
          "unknown_tool",
          "transport",
        ]),
      ),
    })
    .transform((properties) => {
      // Remove undefined fallbacks so they cannot overwrite an earlier valid measurement.
      for (const key of Object.keys(properties) as (keyof typeof properties)[]) {
        if (properties[key] === undefined) delete properties[key];
      }
      return properties;
    }),
});
