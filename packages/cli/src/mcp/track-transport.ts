import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { RequestId } from "@modelcontextprotocol/sdk/types.js";
import { telemetry } from "../telemetry";
import { mcpTools } from "./mcp-tools";

/** Times each tools/call through response delivery, including SDK validation failures. */
export function trackTransport(transport: Transport): Transport {
  const pending = new Map<RequestId, ReturnType<typeof telemetry.begin>>();
  const known = new Set(mcpTools.map((tool) => tool.name));
  const tracked: Transport = {
    async start() {
      transport.onmessage = (message, extra) => {
        if ("method" in message && message.method === "notifications/cancelled") {
          const id = message.params?.requestId;
          if (typeof id === "string" || typeof id === "number") {
            pending.get(id)?.finish({ outcome: "cancelled" });
            pending.delete(id);
          }
        }
        if ("method" in message && message.method === "tools/call" && "id" in message) {
          const name = typeof message.params?.name === "string" ? message.params.name : "unknown";
          const call = telemetry.begin({ tool: name, source: "mcp" });
          pending.set(message.id, call);
          call.run(() => {
            // If SDK validation rejects the call, the tool callback never replaces this category.
            telemetry.set({ error_category: known.has(name) ? "invalid_input" : "unknown_tool" });
            tracked.onmessage?.(message, extra);
          });
        } else tracked.onmessage?.(message, extra);
      };
      transport.onerror = (error) => tracked.onerror?.(error);
      transport.onclose = () => {
        for (const call of pending.values()) call.finish({ outcome: "cancelled" });
        pending.clear();
        tracked.onclose?.();
      };
      await transport.start();
    },
    async send(message, options) {
      const id = "id" in message && !("method" in message) ? message.id : undefined;
      const call = id !== undefined ? pending.get(id) : undefined;
      try {
        await transport.send(message, options);
        if (call) {
          const failed =
            "error" in message || ("result" in message && message.result.isError === true);
          call.finish({ outcome: failed ? "error" : "success" });
        }
      } catch (error) {
        call?.run(() => telemetry.set({ error_category: "transport" }));
        call?.finish({ outcome: "error" });
        throw error;
      } finally {
        if (id !== undefined) pending.delete(id);
      }
    },
    close: () => transport.close(),
    get sessionId() {
      return transport.sessionId;
    },
    setProtocolVersion: (version) => transport.setProtocolVersion?.(version),
  };
  return tracked;
}
