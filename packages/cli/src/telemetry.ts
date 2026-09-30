import { AsyncLocalStorage } from "node:async_hooks";
import type { z } from "zod";
import { errorCategory } from "./error-category";
import { getProjectId } from "./get-project-id";
import { telemetrySchema } from "./telemetry-schema";

type Payload = z.infer<typeof telemetrySchema>;
type Event = Payload["event"];
type Properties = Record<string, string | number | boolean | string[]>;
type Scope = { properties: Properties; projects: Set<string> };

/**
 * AsyncLocalStorage keeps the context attached to the current asynchronous call.
 * Keeps measurements separate when two MCP requests overlap.
 * Without separate contexts, one "search" could accidentally collect another "search"'s data.
 */
const storage = new AsyncLocalStorage<Scope>();
type Capture = (input: Payload) => void;
let send: Capture | undefined;
let salt: string | undefined;
// Resolve each repo once per process configuration, like Next.js caches its project ID.
const projects = new Map<string, Promise<string>>();

/** Validates request measurements before merging them into the current call. */
function clean(properties: Record<string, unknown>): Payload["properties"] {
  const result = telemetrySchema.shape.properties.safeParse(properties);
  return result.success ? result.data : {};
}

/** Request-local counters keep concurrent MCP calls separate without changing domain inputs. */
export const telemetry = {
  configure(options: { capture?: Capture; salt?: string } = {}) {
    send = options.capture;
    salt = options.salt;
    projects.clear();
  },
  capture({ event, properties = {} }: { event: Event; properties?: Record<string, unknown> }) {
    try {
      const result = telemetrySchema.safeParse({ event, properties });
      if (result.success) send?.(result.data);
    } catch {
      /* Analytics must never fail a command. */
    }
  },
  set(properties: Record<string, unknown>) {
    Object.assign(storage.getStore()?.properties ?? {}, clean(properties));
  },
  /** Associates the call with validated repo roots; raw paths remain inside this process. */
  async setProject({ repo }: { repo: string }) {
    const ctx = storage.getStore();
    if (!ctx || !send || !salt) return;
    try {
      let id = projects.get(repo);
      if (!id) {
        id = getProjectId({ repo, salt });
        projects.set(repo, id);
      }
      ctx.projects.add(await id);
      const ids = [...ctx.projects].sort();
      // A mixed-repo batch has several owners; never attribute it to just the first one.
      if (ids.length === 1) ctx.properties.project_id = ids[0]!;
      else {
        delete ctx.properties.project_id;
        ctx.properties.project_ids = ids;
      }
    } catch {
      // Project attribution is optional, just like event delivery.
    }
  },
  add(properties: Record<string, number>) {
    const ctx = storage.getStore();
    if (!ctx) return;
    for (const [key, value] of Object.entries(clean(properties))) {
      ctx.properties[key] = Number(ctx.properties[key] ?? 0) + Number(value);
    }
  },
  /** Starts a timer at the request boundary; finish is safe to call more than once. */
  begin({ tool, source, init = false }: { tool?: string; source: "mcp" | "cli"; init?: boolean }) {
    const ctx: Scope = {
      properties: { source, ...(tool ? { tool: clean({ tool }).tool ?? "unknown" } : {}) },
      projects: new Set(),
    };
    const start = performance.now();
    let finished = false;
    if (init) telemetry.capture({ event: "init started", properties: ctx.properties });
    return {
      run<T>(run: () => T): T {
        return storage.run(ctx, run);
      },
      finish({
        outcome,
        category,
      }: {
        outcome: "success" | "error" | "cancelled";
        category?: string;
      }) {
        if (finished) return;
        finished = true;
        const { error_category, failure_stage, ...properties } = ctx.properties;
        telemetry.capture({
          event: init ? "init finished" : "tool finished",
          properties: {
            ...properties,
            outcome: ctx.properties.outcome === "cancelled" ? "cancelled" : outcome,
            duration_ms: performance.now() - start,
            ...(outcome === "error" && ctx.properties.outcome !== "cancelled"
              ? {
                  error_category: error_category ?? category ?? "operation",
                  ...(failure_stage ? { failure_stage } : {}),
                }
              : {}),
          },
        });
      },
    };
  },
  /** Labels failures without timing the stage; outer stages keep the most specific label. */
  async stage<T>({ name, run }: { name: string; run: () => Promise<T> }): Promise<T> {
    if (!storage.getStore()) return run();
    try {
      return await run();
    } catch (error) {
      if (!storage.getStore()?.properties.failure_stage) telemetry.set({ failure_stage: name });
      throw error;
    }
  },
  /** Labels synchronous failures without adding an async boundary to filtering or MiniSearch. */
  stageSync<T>({ name, run }: { name: string; run: () => T }): T {
    if (!storage.getStore()) return run();
    try {
      return run();
    } catch (error) {
      if (!storage.getStore()?.properties.failure_stage) telemetry.set({ failure_stage: name });
      throw error;
    }
  },
  /** Records async stage duration on success and failure; repeated calls accumulate. */
  async measure<T>({ name, run }: { name: string; run: () => Promise<T> }): Promise<T> {
    if (!storage.getStore()) return run();
    const start = performance.now();
    try {
      return await telemetry.stage({ name, run });
    } finally {
      telemetry.add({ [`${name}_ms`]: performance.now() - start });
    }
  },
  /** Times synchronous work without changing its return value into a promise. */
  measureSync<T>({ name, run }: { name: string; run: () => T }): T {
    if (!storage.getStore()) return run();
    const start = performance.now();
    try {
      return telemetry.stageSync({ name, run });
    } finally {
      telemetry.add({ [`${name}_ms`]: performance.now() - start });
    }
  },
  /** Times direct CLI operations, including JSON output preparation. */
  async run<T>({
    tool,
    init,
    run,
  }: {
    tool?: string;
    init?: boolean;
    run: () => Promise<T>;
  }): Promise<T> {
    const call = telemetry.begin({ tool, source: "cli", init });
    return call.run(async () => {
      try {
        const result = await run();
        call.finish({ outcome: "success" });
        return result;
      } catch (error) {
        call.finish({ outcome: "error", category: errorCategory(error) });
        throw error;
      }
    });
  },
};
