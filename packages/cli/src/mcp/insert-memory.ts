import { z } from "zod";
import { insert } from "../commands/insert";
import { describeMemory } from "../describe-memory";
import { frontmatterSchema } from "../frontmatter-schema";
import { NAMES } from "../names";
import { memoryScopeDescription, scopeSchema } from "../scope-schema";
import { inputError, repo, roots } from "./shared-input";
import { tool } from "./tool";

/** New memories need their content and scope; the command generates id and created. */
export const insertSchema = z.strictObject(
  {
    body: z
      .string({ error: "Expected a nonempty string containing the Markdown body." })
      .min(1, "Expected a nonempty string containing the Markdown body.")
      .regex(/\S/, "Expected a nonempty string containing the Markdown body.")
      .describe("Markdown content for the memory."),
    frontmatter: frontmatterSchema
      .extend({ scope: scopeSchema.describe(memoryScopeDescription) })
      // Custom fields are allowed, but generated fields must not pass through as metadata.
      .refine((value) => !Object.hasOwn(value, "id"), {
        path: ["id"],
        message: "Omit id. Insert generates it; update preserves the stored ID.",
      })
      .refine((value) => !Object.hasOwn(value, "created"), {
        path: ["created"],
        message: "Omit created. Insert writes the UTC calendar date; update preserves it.",
      }),
  },
  {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? "Remove this unknown field. Only body and frontmatter are allowed at the top level. Put title, description, scope, protection flags, and configured custom fields inside frontmatter; pass workspace paths via --roots and --repo."
        : 'Expected one JSON object: {"body":"Markdown content","frontmatter":{"title":"Memory title","description":"A brief description of the memory content.","scope":["apps/web/auth"]}}. Use ["."] only for memories that apply to the whole repo.',
  },
);

/** Creates one memory. The CLI parses `insertSchema`; this tool adds roots and repo. */
export const insertMemory = tool({
  name: "insert-memory",
  description: `Create one memory. Before calling this tool: 1. Call the \`search-memories\` tool first to check for related memories to avoid duplicate info; 2. Read the ${NAMES.TIRAMISU_JSON} at the root of the \`repo\` to know what \`frontmatter.custom\` fields are allowed (no \`frontmatter.custom\` means no extra keys). After this tool returns, you may add attachments beside ${NAMES.MEMORY_MD} in the returned directory when useful. Attachments are supporting files, such as images or long documents, and are not searchable.`,
  schema: z.strictObject({ roots, repo, ...insertSchema.shape }, { error: inputError }),
  // Called from inside run so this file and the insert command can import each other.
  // The command needs insertSchema; this tool needs insert.
  run: (input) => insert(input),
  instructions: ({ result, input }) => describeMemory({ path: result[0]!, repo: input.repo }),
});
