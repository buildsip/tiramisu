import { z } from "zod";
import { update } from "../commands/update";
import { describeMemory } from "../describe-memory";
import { frontmatterSchema } from "../frontmatter-schema";
import { NAMES } from "../names";
import { memoryScopeDescription, scopeSchema } from "../scope-schema";
import { insertSchema } from "./insert-memory";
import { inputError, memoryPath, repo, roots } from "./shared-input";
import { tool } from "./tool";

/** Update JSON contains only changed memory fields; path selects the existing memory. */
export const updateSchema = z.strictObject(
  {
    body: insertSchema.shape.body.optional(),
    frontmatter: frontmatterSchema
      .partial()
      .extend({ scope: scopeSchema.describe(memoryScopeDescription).optional() })
      .refine((value) => !Object.hasOwn(value, "id"), {
        path: ["id"],
        message: "Omit id. Insert generates it; update preserves the stored ID.",
      })
      .refine((value) => !Object.hasOwn(value, "created"), {
        path: ["created"],
        message: "Omit created. Insert writes the UTC calendar date; update preserves it.",
      })
      .optional(),
  },
  {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? "Remove this unknown field. Only body and frontmatter are allowed at the top level. Pass the memory path via --path and workspace paths via --roots and --repo. Put title, description, scope, protection flags, and configured custom fields inside frontmatter."
        : 'Expected one JSON object, for example {"body":"Updated content"}. Pass the existing memory path via --path. Omit body or frontmatter fields to keep their current values; use {} for a folder-name repair.',
  },
);

/** Patches one memory. The CLI parses `updateSchema`; this tool also takes roots, repo, and path. */
export const updateMemory = tool({
  name: "update-memory",
  description: `Patch an existing memory in repo. Before calling this tool: 1. Call the \`search-memories\` tool first to check for related memories to avoid duplicate info; 2. Read the ${NAMES.TIRAMISU_JSON} at the root of the \`repo\` to know what \`frontmatter.custom\` fields are allowed (no \`frontmatter.custom\` means no extra keys). Omitted fields keep their values. A \`scope\` or \`title\` change can move the memory; use the returned path for subsequent calls. Every update repairs ${NAMES.MEMORY_MD}'s parent folder name to match the memory's frontmatter \`title\`. If \`doNotEdit\` blocks the update, ask the user to edit the memory. After this tool returns, you may add attachments beside ${NAMES.MEMORY_MD} in the returned directory when useful. Attachments are supporting files, such as images or long documents, and are not searchable.`,
  schema: z.strictObject(
    {
      roots,
      repo,
      path: memoryPath.describe(
        `Absolute path to an existing memory directory containing ${NAMES.MEMORY_MD}.`,
      ),
      ...updateSchema.shape,
    },
    { error: inputError },
  ),
  // Called from inside run so this file and the update command can import each other.
  run: (input) => update(input),
  instructions: ({ result, input }) => describeMemory({ path: result[0]!, repo: input.repo }),
  destructive: true,
});
