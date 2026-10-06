import { telemetry } from "../telemetry";
import { loadScopedWorkspaceMemories } from "../load-scoped-workspace-memories";
import { summarizeMemory } from "../summarize-memory";
import type { Command } from "commander";
import { relative } from "node:path";
import MiniSearch from "minisearch";

let cached: { stamp: string; index: MiniSearch } | undefined;

/**
 * Searches the selected repo plus memories from other workspace repos that
 * set availableToWorkspace.
 * Local scopes filter which memories apply; results are ranked before pagination.
 *
 * @returns Memory directory paths, titles, and descriptions for the requested page.
 */
export async function search({
  roots,
  repo,
  query,
  scope = ["."],
  limit = 50,
  offset = 0,
}: {
  roots: string[];
  repo: string;
  query: string;
  scope?: string[];
  limit?: number;
  offset?: number;
}) {
  if (!query.trim()) throw new Error("query must not be empty.");
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0)
    throw new Error("limit must be a positive integer and offset a nonnegative integer.");
  const { memories: unique } = await loadScopedWorkspaceMemories({ roots, repo, scope });
  telemetry.set({ searchable_count: unique.length, offset });
  const { index, byPath } = telemetry.measureSync({
    name: "index",
    run: () => {
      // Rebuild the index when the selected files or their filesystem metadata change.
      const stamp = JSON.stringify(unique.map((memory) => [memory.path, memory.stamp]));
      telemetry.set({ index_reused: cached?.stamp === stamp });
      if (cached?.stamp !== stamp) {
        const index = new MiniSearch({
          idField: "path",
          fields: ["title", "tags", "frontmatter", "body"],
          searchOptions: { boost: { title: 3, tags: 2 } },
        });
        index.addAll(
          unique.map((memory) => ({
            path: memory.path,
            title: memory.frontmatter.title,
            tags: relative(memory.project, memory.path),
            frontmatter: JSON.stringify(memory.frontmatter),
            body: memory.body,
          })),
        );
        cached = { stamp, index };
      }
      return {
        index: cached.index,
        byPath: new Map(unique.map((memory) => [memory.path, memory])),
      };
    },
  });
  const matches = telemetry.measureSync({ name: "query", run: () => index.search(query) });
  // Bodies and other metadata stay searchable, but only summaries leave the command.
  const result = matches
    .slice(offset, offset + limit)
    .map(({ id }) => summarizeMemory(byPath.get(String(id))!));
  telemetry.set({ match_count: matches.length, result_count: result.length });
  return result;
}

export function registerSearchCommand({ program }: { program: Command }) {
  program
    .command("search")
    .requiredOption(
      "--roots <path...>",
      "Every workspace Git root; repeat the flag or provide multiple paths.",
    )
    .requiredOption("--repo <path>", "Git root of the workspace project the agent is working on.")
    .description("Search memory titles, frontmatter, directory tags, and Markdown bodies.")
    .requiredOption("--query <text>", "Nonempty search query.")
    .option(
      "--scope <path...>",
      "Existing repository-relative file or directory paths; directories include child packages. Defaults to . (the whole repo).",
    )
    .option("--limit <number>", "Maximum number of results.", "50")
    .option("--offset <number>", "Number of ranked results to skip.", "0")
    .action(
      async (options: {
        roots: string[];
        repo: string;
        query: string;
        scope?: string[];
        limit: string;
        offset: string;
      }) => {
        return telemetry.run({
          tool: "search-memories",
          run: async () => {
            const result = await search({
              ...options,
              limit: Number(options.limit),
              offset: Number(options.offset),
            });
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          },
        });
      },
    );
}
