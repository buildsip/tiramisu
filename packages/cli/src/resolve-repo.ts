import { telemetry } from "./telemetry";
import { resolveGitRoot } from "./resolve-git-root";
import { resolveRoots } from "./resolve-roots";

type Workspace = {
  roots: string[];
  repo: string;
};

/**
 * Validates workspace Git roots and selects the active repository from that list.
 *
 * @param roots - Paths to every workspace Git root
 * @param repo - Git root of the active repository
 *
 * @returns Canonicalized paths
 */
export async function resolveRepo({
  roots,
  repo,
}: {
  roots: string[];
  repo: string;
}): Promise<Workspace> {
  return telemetry.stage({
    name: "resolve_repo",
    run: async () => {
      if (!roots.length || !repo.trim()) {
        throw new Error(
          "Provide roots with every workspace Git root and repo with the active Git root.",
        );
      }
      const folders = await resolveRoots({ roots });
      telemetry.set({ root_count: folders.length });
      const path = await resolveGitRoot(repo);
      // Both sides are canonical paths, so aliases of the same repo compare equally.
      if (!folders.includes(path)) {
        throw new Error(
          "Include repo in the workspace roots, then retry with repo set to one of those Git roots.",
        );
      }
      // Attribute shared-workspace searches to the active repo, not every workspace root.
      await telemetry.setProject({ repo: path });
      return { roots: folders, repo: path };
    },
  });
}
