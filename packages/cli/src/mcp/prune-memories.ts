import { z } from "zod";
import { prune } from "../commands/prune";
import { inputError, repo } from "./shared-input";
import { tool } from "./tool";

/** Lists prune candidates from one repository without deleting anything. */
export const pruneMemories = tool({
  name: "prune-memories",
  description:
    "Only call when the user asks to prune unused memories. Returns memory candidates from the selected repository's root and child package memory stores that might not be relevant anymore. This tool never deletes memories.",
  schema: z.strictObject({ repo }, { error: inputError }),
  run: prune,
  // Review guidance belongs with the results, and only applies when candidates exist.
  instructions: async ({ result }) =>
    result.length
      ? "Read memory.md inside each candidate's directory path, check its relevance against the code, and suggest which to delete or keep."
      : undefined,
  readOnly: true,
});
