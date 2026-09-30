import { recordToolCounts } from "../record-tool-counts";
import { telemetry } from "../telemetry";
import { isInside } from "@buildsip/file-utils";
import type { Command } from "commander";
import { dirname } from "node:path";
import type { z } from "zod";
import { CLI_NAME } from "../cli-name";
import { findRepo } from "../find-repo";
import { findStores } from "../find-stores";
import { loadMemories } from "../load-memories";
import { updateSchema } from "../mcp/update-memory";
import { parseValue } from "../parse-value";
import { placeMemory } from "../place-memory";
import { readJsonInput } from "../read-json-input";
import { resolveRepo } from "../resolve-repo";
import { resolveMemoryFile } from "../resolve-memory-file";
import { saveMemory } from "../save-memory";
import { readPruneConfig } from "../read-prune-config";
import { recordUpvotes } from "../record-upvotes";
import { NAMES } from "../names";

/**
 * Updates only supplied fields on an existing memory; id and created never change.
 * Even a path-only update repairs the title folder and returns its directory path in an array.
 */
export async function update({
  roots,
  repo,
  path: target,
  ...value
}: z.infer<typeof updateSchema> & {
  roots: string[];
  repo: string;
  path: string;
}) {
  const input = parseValue({ schema: updateSchema, value, label: "update input" });
  const workspace = await resolveRepo({ roots, repo });
  const canonical = await resolveMemoryFile({ path: target, repo: workspace.repo });
  if ((await findRepo(dirname(canonical))) !== workspace.repo) {
    throw new Error(
      `Choose a memory in ${workspace.repo}; ${target} belongs to a different Git repository.`,
    );
  }
  const { stores } = await findStores({ repo: workspace.repo, project: workspace.repo });
  const memories = await loadMemories({ stores, repo: workspace.repo });
  const existing = memories.find((memory) => memory.path === canonical);
  if (!existing) {
    throw new Error(
      `Choose a memory path inside a repo or package ${NAMES.MEMORIES} store in ${workspace.repo}: ${target}`,
    );
  }
  if (existing.frontmatter.doNotEdit) {
    throw new Error(
      `You cannot edit this memory because doNotEdit is true: ${dirname(existing.path)}. Ask the user to edit it.`,
    );
  }
  if (
    memories.some(
      (memory) =>
        memory.path !== existing.path &&
        isInside({ path: memory.path, parent: dirname(existing.path) }),
    )
  ) {
    throw new Error(
      `Move nested memories out of ${dirname(existing.path)} before updating it. Cannot rename or edit a memory folder containing other memories.`,
    );
  }

  // Undefined fields from direct callers behave like omitted JSON fields. Null is a real value.
  const fields = Object.fromEntries(
    Object.entries(input.frontmatter ?? {}).filter(([, value]) => value !== undefined),
  );
  const frontmatter = {
    ...existing.frontmatter,
    ...fields,
    id: existing.frontmatter.id,
    created: existing.frontmatter.created,
  };
  if (input.frontmatter?.title !== undefined) {
    frontmatter.title = input.frontmatter.title.trim();
  }
  let project = existing.project;
  // A content-only update must not recompute placement or change implicit scope.
  if (input.frontmatter?.scope !== undefined) {
    const placement = await placeMemory({ repo: workspace.repo, scope: input.frontmatter.scope });
    project = placement.project;
    if (placement.scope === undefined) {
      delete frontmatter.scope;
    } else {
      frontmatter.scope = placement.scope;
    }
  }
  const prune = await readPruneConfig(workspace.repo);
  const saved = await saveMemory({
    repo: workspace.repo,
    project,
    frontmatter,
    body: input.body === undefined ? existing.body : `${input.body.replace(/\s*$/, "")}\n`,
    existing,
  });
  // Saving can succeed even if the follow-up database vote fails.
  telemetry.set({ affected_count: saved.length });
  if (prune) {
    try {
      await recordUpvotes({
        repo: workspace.repo,
        command: prune.command,
        ids: [existing.frontmatter.id],
        actor: "agent",
      });
    } catch (error) {
      // A title/scope change may have moved the file. Give the caller its new retry path.
      throw new Error(
        `The memory was saved at ${saved[0]}, but its agent upvote failed. ${error instanceof Error ? error.message : "Check the database and retry."} Retry only the upvote with upvote-memories using paths ${JSON.stringify(saved)}, and actor "agent" (CLI: ${CLI_NAME} upvote with the saved directory via --paths and --actor agent). The content is already saved, even if this update set doNotEdit.`,
      );
    }
  }
  return saved;
}

/** Registers path-based updates with optional body and frontmatter patches. */
export function registerUpdateCommand({ program }: { program: Command }) {
  program
    .command("update")
    .requiredOption(
      "--roots <path...>",
      "Every workspace Git root; repeat the flag or provide multiple paths.",
    )
    .requiredOption("--repo <path>", "Git root of the workspace project the agent is working on.")
    .requiredOption("--path <path>", "Absolute memory directory returned by a memory command.")
    .description(
      "Update the memory selected by --path from JSON with optional body and frontmatter. Omitted fields keep their values. Use {} to only repair the title folder. Every update repairs the title folder if needed. Use the returned path for subsequent calls.",
    )
    .option("--input <file>", "Read one memory JSON object from a file; omit or use - for stdin.")
    .action(async (options: { roots: string[]; repo: string; path: string; input?: string }) => {
      return telemetry.run({
        tool: "update-memory",
        run: async () => {
          const value = await readJsonInput({
            file: options.input,
            label: "update",
            example: '{"body":"Updated content"}',
          });
          const input = parseValue({ schema: updateSchema, value, label: "update input" });
          const result = await update({
            ...input,
            roots: options.roots,
            repo: options.repo,
            path: options.path,
          });
          recordToolCounts({ name: "update-memory", result });
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        },
      });
    });
}
