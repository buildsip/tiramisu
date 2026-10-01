import { recordToolCounts } from "../record-tool-counts";
import { telemetry } from "../telemetry";
import { findNestedMemories } from "../find-nested-memories";
import { selectMemories } from "../select-memories";
import type { Command } from "commander";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NAMES } from "../names";
import { PermissionDeniedError } from "../permission-denied-error";

/**
 * Deletes selected memory folders, including their attachments.
 * Validates the whole selection first: protected memories cannot be deleted, and
 * nested memories must be selected explicitly before deleting their parent.
 *
 * @returns Deleted memory directory paths, ordered with descendants before parents.
 */
export async function deleteMemories({ paths }: { paths: string[] }) {
  if (!paths.length) throw new Error("Provide at least one memory directory path to delete.");
  const batch = await selectMemories({ paths });
  const selected = new Set<string>();
  // Validate all protection flags and descendants before deleting anything.
  for (const memory of batch) {
    const canonical = memory.path;
    if (memory.frontmatter.doNotDelete) {
      throw new PermissionDeniedError(
        `You cannot delete this memory because doNotDelete is true: ${dirname(canonical)}. Ask the user to delete it.`,
      );
    }
    if (dirname(canonical) === join(memory.project, NAMES.MEMORIES)) {
      throw new Error(
        `You cannot delete the ${NAMES.MEMORIES} directory itself. Select individual memory directories inside it.`,
      );
    }
    selected.add(canonical);
  }
  for (const path of selected) {
    const folder = dirname(path);
    for (const nested of await findNestedMemories(folder)) {
      if (!selected.has(join(nested, NAMES.MEMORY_MD))) {
        throw new Error(`Select nested memory explicitly before deleting its parent: ${nested}`);
      }
    }
  }
  // Descendant paths are longer: delete them before removing their parent folders.
  const deleted = [...selected].map((path) => dirname(path)).sort((a, b) => b.length - a.length);
  for (const path of deleted) {
    await rm(path, { recursive: true, force: true });
    telemetry.add({ affected_count: 1 });
  }
  return deleted;
}

export function registerDeleteCommand({ program }: { program: Command }) {
  program
    .command("delete")
    .description("Delete memories and their attachments by path, respecting doNotDelete.")
    .requiredOption(
      "--paths <path...>",
      "Absolute memory directory paths returned by memory commands; repeatable.",
    )
    .action(async (options: { paths: string[] }) => {
      return telemetry.run({
        tool: "delete-memories",
        run: async () => {
          const result = await deleteMemories(options);
          recordToolCounts({ name: "delete-memories", result });
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        },
      });
    });
}
