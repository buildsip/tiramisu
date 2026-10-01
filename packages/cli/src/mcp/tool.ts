import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { parseValue } from "../parse-value";
import { recordToolCounts } from "../record-tool-counts";

/**
 * Turns a name, description, schema, and command into one MCP tool.
 * `call` checks the arguments, runs the command, and returns its JSON.
 * When `instructions` returns text, that text is a second block after the JSON.
 */
export function tool<T, R>({
  name,
  description,
  schema,
  run,
  instructions,
  readOnly = false,
  destructive = false,
}: {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  run: (input: T) => Promise<R>;
  instructions?: (args: { result: R; input: T }) => Promise<string | undefined>;
  readOnly?: boolean;
  destructive?: boolean;
}) {
  return {
    name,
    description,
    schema,
    annotations: { readOnlyHint: readOnly, destructiveHint: destructive, openWorldHint: false },
    call: async (value: unknown): Promise<CallToolResult> => {
      const input = parseValue({ schema, value, label: `${name} arguments` });
      const result = await run(input);
      recordToolCounts({ name, result });
      // Preserve the CLI's JSON result and add readable guidance as a separate text block.
      const content: TextContent[] = [{ type: "text", text: JSON.stringify(result, null, 2) }];
      if (instructions) {
        const text = await instructions({ result, input });
        if (text) content.push({ type: "text", text });
      }
      return { content };
    },
  };
}
