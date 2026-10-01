import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mcpTools } from "./mcp-tools";
import { telemetry } from "../telemetry";
import { errorCategory } from "../error-category";

/** Registers schemas and callbacks with the SDK, which handles discovery and input validation. */
export function createMcpServer({ version }: { version: string }) {
  const server = new McpServer({ name: "tiramisu", version });
  for (const tool of mcpTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema, annotations: tool.annotations },
      async (input: unknown): Promise<CallToolResult> => {
        telemetry.set({ error_category: "operation" });
        try {
          return await tool.call(input);
        } catch (error) {
          telemetry.set({ error_category: errorCategory(error) });
          const message =
            error instanceof Error
              ? error.message
              : "Retry the memory operation with valid workspace paths and tool arguments.";
          // Filesystem failures need a next step too; domain errors already include instructions.
          const code = (error as NodeJS.ErrnoException | null)?.code;
          const text = code
            ? `${message}. Check that the supplied paths exist and are accessible, then retry. For an existing memory, search again and use its current path.`
            : message;
          return { isError: true, content: [{ type: "text", text }] };
        }
      },
    );
  }
  return server;
}
