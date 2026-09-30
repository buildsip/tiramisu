import { isInside, lstatIfExists } from "@buildsip/file-utils";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { findRepo } from "./find-repo";
import { findStores } from "./find-stores";
import type { Memory } from "./memory";
import { resolveMemoryFile } from "./resolve-memory-file";
import { NAMES } from "./names";
import { readMemory } from "./read-memory";
import { telemetry } from "./telemetry";

/** Validates a complete mixed-repo selection before any file or database write. */
export async function selectMemories({ paths }: { paths: string[] }) {
  if (!paths.length) throw new Error("Provide at least one memory directory path.");
  const stores = new Map<string, string[]>();
  const selected = new Map<string, Memory>();
  for (const input of paths) {
    if (typeof input !== "string" || !isAbsolute(input) || input.includes("\0")) {
      throw new Error(
        "Provide absolute memory directory paths without NUL characters. Reuse paths returned by memory tools.",
      );
    }
    // Check the directory before finding its Git root, which resolves symbolic links.
    const target = resolve(input);
    const info = await lstatIfExists({ path: target });
    if (info?.isSymbolicLink())
      throw new Error(
        `Symbolic links are not supported: ${input}. Use the memory's actual directory path.`,
      );
    if (info && !info.isDirectory())
      throw new Error(
        `Provide an existing memory directory containing ${NAMES.MEMORY_MD}, not a file: ${input}`,
      );
    if (!info)
      throw new Error(
        `No memory exists at ${input}. Search again and use its current directory path.`,
      );
    const repo = await findRepo(target).catch((cause) => {
      throw new Error(`Choose a memory directory inside a Git repository: ${input}.`, { cause });
    });
    if (!isInside({ path: target, parent: repo }))
      throw new Error(
        `Use the memory's actual absolute directory path inside ${repo}; symbolic links and path aliases are not supported: ${input}.`,
      );
    const path = await resolveMemoryFile({ path: target, repo });
    await telemetry.setProject({ repo });
    if (selected.has(path)) continue;
    // Discover valid stores once per repository, but read only the selected memory files.
    if (!stores.has(repo)) {
      stores.set(repo, (await findStores({ repo, project: repo })).stores);
    }
    const project = stores.get(repo)!.find((candidate) => {
      const store = join(candidate, NAMES.MEMORIES);
      return (
        isInside({ path, parent: store }) &&
        !relative(store, target)
          .split(sep)
          .some((part) => part.startsWith(NAMES.MEM_PREFIX))
      );
    });
    if (!project)
      throw new Error(
        `Choose an existing memory directory in a repo or package ${NAMES.MEMORIES} store: ${input}. Temporary memory directories are not supported.`,
      );
    selected.set(path, await readMemory({ path, project, repo }));
  }
  return [...selected.values()];
}
