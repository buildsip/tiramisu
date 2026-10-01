import { telemetry } from "./telemetry";
import { assertNoSymlinks, statIfExists } from "@buildsip/file-utils";
import { dirname, resolve } from "node:path";
import { findRepo } from "./find-repo";
import { normalizeScopes } from "./normalize-scopes";

/** Checks supplied scopes before placement or search; stored memories may refer to deleted code. */
export async function validateScopes({ repo, scope }: { repo: string; scope: string[] }) {
  return telemetry.stage({
    name: "validate_scopes",
    run: async () => {
      const scopes = normalizeScopes(scope);
      telemetry.set({ whole_repo: scopes.includes(".") });
      for (const scope of scopes) {
        const path = resolve(repo, scope);
        // Treat a file used as a parent (file.ts/child) as an invalid path too.
        const info = await statIfExists({ path, ignoreNotDirectory: true });
        if (!info || (!info.isFile() && !info.isDirectory())) {
          throw new Error(
            `Invalid scope: ${JSON.stringify(scope)}. Use an existing repository-relative file or directory inside ${repo}. No file or directory exists at ${path}. Check the path before retrying; use "." only if the memory or search applies to the whole repo.`,
          );
        }
        // Inspect every ancestor so a symlink cannot make an outside path appear repo-relative.
        await assertNoSymlinks({ path, base: repo });
        const directory = info.isDirectory() ? path : dirname(path);
        if ((await findRepo(directory)) !== repo) {
          throw new Error(
            `Choose scopes inside ${repo}. Scope ${JSON.stringify(scope)} belongs to a different Git repository.`,
          );
        }
      }
      return scopes;
    },
  });
}
