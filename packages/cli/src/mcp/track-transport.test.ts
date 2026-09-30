import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterEach, expect, it } from "bun:test";
import { telemetry } from "../telemetry";
import { trackTransport } from "./track-transport";

afterEach(() => telemetry.configure());

/** A delayed send represents stdout backpressure after the tool has prepared its result. */
function transport(): Transport {
  const value: Transport = {
    async start() {},
    async send() {
      await new Promise((resolve) => setTimeout(resolve, 30));
    },
    async close() {
      value.onclose?.();
    },
  };
  return value;
}

it("includes response delivery time and does not track protocol handshakes", async () => {
  const events: Record<string, unknown>[] = [];
  telemetry.configure({ capture: ({ properties }) => events.push(properties) });
  const base = transport();
  const tracked = trackTransport(base);
  tracked.onmessage = () => {};
  await tracked.start();
  base.onmessage?.({ jsonrpc: "2.0", id: 0, method: "initialize", params: {} });
  await tracked.send({ jsonrpc: "2.0", id: 0, result: {} });
  expect(events).toEqual([]);
  base.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "search-memories" },
  });
  await tracked.send({ jsonrpc: "2.0", id: 1, result: { content: [] } });
  expect(events).toHaveLength(1);
  expect(Number(events[0]!.duration_ms)).toBeGreaterThanOrEqual(25);
  expect(events[0]!.outcome).toBe("success");
});

it("records cancellation once even if a late response follows", async () => {
  const events: Record<string, unknown>[] = [];
  telemetry.configure({ capture: ({ properties }) => events.push(properties) });
  const base = transport();
  const tracked = trackTransport(base);
  await tracked.start();
  base.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "search-memories" },
  });
  base.onmessage?.({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } });
  await tracked.send({ jsonrpc: "2.0", id: 1, result: { content: [] } });
  await tracked.close();
  expect(events).toHaveLength(1);
  expect(events[0]!.outcome).toBe("cancelled");
});

it("records response transport failures without exposing their messages", async () => {
  const events: Record<string, unknown>[] = [];
  telemetry.configure({ capture: ({ properties }) => events.push(properties) });
  const base = transport();
  base.send = async () => {
    throw new Error("private details");
  };
  const tracked = trackTransport(base);
  await tracked.start();
  base.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "search-memories" },
  });
  await expect(tracked.send({ jsonrpc: "2.0", id: 1, result: { content: [] } })).rejects.toThrow(
    "private details",
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ outcome: "error", error_category: "transport" });
  expect(JSON.stringify(events)).not.toContain("private");
});
