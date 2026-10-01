import { telemetry } from "./telemetry";
import { assertNoSymlinks, lstatIfExists, walkDirectory } from "@buildsip/file-utils";
import { join } from "node:path";
import type { Memory } from "./memory";
import { NAMES } from "./names";
import { readConfig } from "./read-config";
import { readMemory } from "./read-memory";

/**
 * Loads memory.md files beneath each store's .memories directory.
 * Missing store directories are empty stores; temporary memory directories are skipped.
 *
 * `availableToWorkspaceOnly` includes stores only when their repo root sets
 * `availableToWorkspace` to true.
 * Reads validate built-in fields while preserving custom fields from older schemas.
 */
export async function loadMemories({
  stores,
  repo,
  availableToWorkspaceOnly = false,
}: {
  stores: string[];
  repo: string;
  availableToWorkspaceOnly?: boolean;
}) {
  return telemetry.stage({
    name: "load_memories",
    run: async () => {
      const memories: Memory[] = [];
      // Sharing is repository-wide, so read it once for all package stores.
      const { availableToWorkspace } = await readConfig(repo);
      if (availableToWorkspaceOnly && !availableToWorkspace) return memories;
      for (const project of stores) {
        const store = join(project, NAMES.MEMORIES);
        await assertNoSymlinks({ path: store, base: repo });
        if (!(await lstatIfExists({ path: store }))) continue;
        const files: string[] = [];
        for await (const { path, entry } of walkDirectory({
          path: store,
          skip: (entry) => entry.isDirectory() && entry.name.startsWith(NAMES.MEM_PREFIX),
        })) {
          if (entry.isFile() && entry.name === NAMES.MEMORY_MD) files.push(path);
        }
        files.sort();
        // Bound open file handles even when a store contains thousands of memories.
        for (let offset = 0; offset < files.length; offset += 50) {
          memories.push(
            ...(await Promise.all(
              files.slice(offset, offset + 50).map((path) =>
                readMemory({
                  path,
                  project,
                  repo,
                }),
              ),
            )),
          );
        }
      }
      telemetry.add({ loaded_count: memories.length });
      return memories;
    },
  });
}
