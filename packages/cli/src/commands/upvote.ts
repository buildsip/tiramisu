import { recordToolCounts } from "../record-tool-counts";
import { telemetry } from "../telemetry";
import type { Command } from "commander";
import { dirname } from "node:path";
import { readPruneConfig } from "../read-prune-config";
import { recordUpvotes } from "../record-upvotes";
import { selectMemories } from "../select-memories";

/** Records eligible upvotes and reports memories whose repo has pruning disabled. */
export async function upvote({ paths, actor }: { paths: string[]; actor: "human" | "agent" }) {
  if (actor !== "human" && actor !== "agent")
    throw new Error(
      'Provide actor as "human" when the user asked for an upvote, or "agent" when a memory helped produce the reply.',
    );
  const memories = await selectMemories({ paths });
  telemetry.set({ actor });
  const batches = [];
  const skipped = [];
  // Check every selected root before writing; disabled pruning skips only that repo.
  for (const owner of new Set(memories.map((memory) => memory.repo))) {
    const config = await readPruneConfig(owner);
    const selected = memories.filter((memory) => memory.repo === owner);
    if (!config) {
      skipped.push({
        repo: owner,
        paths: selected.map((memory) => dirname(memory.path)),
        message: `These memories could not be upvoted because pruning is disabled in ${owner}. Tell the user these memories were skipped; retry them only after pruning is enabled for this repository.`,
      });
      continue;
    }
    batches.push({
      repo: owner,
      command: config.command,
      ids: selected.map((memory) => memory.frontmatter.id),
    });
  }
  try {
    for (const batch of batches) {
      await recordUpvotes({ ...batch, actor });
      telemetry.add({ recorded_count: batch.ids.length });
    }
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : "The upvote failed. Check the configured database and retry."} Earlier repositories may already have recorded votes. Retry the batch after fixing the failure; votes do not stack.`,
    );
  }
  // Keep the caller's path order, but report only repositories whose writes succeeded.
  const enabled = new Set(batches.map((batch) => batch.repo));
  return {
    upvoted: memories
      .filter((memory) => enabled.has(memory.repo))
      .map((memory) => dirname(memory.path)),
    skipped,
  };
}

/** Registers the CLI equivalent of upvote-memories. */
export function registerUpvoteCommand({ program }: { program: Command }) {
  program
    .command("upvote")
    .description("Record human or agent upvotes for selected memories across repositories.")
    .requiredOption("--paths <path...>", "Absolute memory directories returned by memory commands.")
    .requiredOption(
      "--actor <actor>",
      "human for user-requested upvotes; agent for useful context.",
    )
    .action(async (options: { paths: string[]; actor: "human" | "agent" }) => {
      return telemetry.run({
        tool: "upvote-memories",
        run: async () => {
          const result = await upvote(options);
          recordToolCounts({ name: "upvote-memories", result });
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        },
      });
    });
}
