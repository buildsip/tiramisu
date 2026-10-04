import { FolderOutput, GitBranch, GitPullRequest } from "lucide-react";

// Keep the supplied landing-page copy together so it is easy to review and edit.
export const features: {
  title: string;
  description: string;
  href: string;
  art?: "search" | "pruning" | "scope";
}[] = [
  {
    title: "Fast BM25 Search",
    description:
      "Uses lightweight BM25 keyword search instead of expensive vector embeddings and rerankers.",
    art: "search",
    href: "/docs/introduction/what-is-tiramisu#why-doesnt-tiramisu-use-vector-search-or-reranking",
  },
  {
    title: "Expiration & Pruning",
    description:
      "Memories can expire after a configurable period. Expired memories are recommended for deletion.",
    art: "pruning",
    href: "/docs/introduction/upvotes-and-pruning",
  },
  {
    title: "Scoped retrieval",
    description:
      "Memories are scoped to specific paths, so context always remains relevant to the search.",
    art: "scope",
    href: "/docs/introduction/what-is-tiramisu#how-does-search-work",
  },
  {
    title: "Custom instructions",
    href: "/docs/introduction/customize#memory-creation-instructions",
    description:
      "Write your own instructions on when memories should be saved and how they should be written.",
  },
  {
    title: "Project, personal, team, and company",
    href: "/docs/api-reference/configuration#availabletoworkspace",
    description:
      "Create one repo per tenant to separate memories. Tenants are customizable, e.g., client or team.",
  },
  {
    title: "Frontmatter JSON schema",
    href: "/docs/api-reference/configuration#custom",
    description: "Define a JSON Schema for memory frontmatter and add custom fields.",
  },
  {
    title: "Edit and delete protection",
    href: "/docs/api-reference/memory-format#donotdelete",
    description: "Prevent the agent from deleting or editing certain memories.",
  },
  {
    title: "Directory tags",
    href: "/docs/introduction/customize#directory-names",
    description:
      "Any directory between .memories and a memory folder becomes an indexed search tag.",
  },
  {
    title: "Attachments",
    href: "/docs/api-reference/file-conventions#attachments",
    description:
      "Attachments are excluded from the search index and can be read after the associated memory is retrieved.",
  },
  {
    title: "Automated memory placement",
    href: "/docs/api-reference/mcp#insert-memory",
    description: "Automatically detects packages and stores memories into the relevant project.",
  },
  {
    title: "Lightweight MCP server",
    href: "/docs/api-reference/mcp",
    description: "Only 6 MCP tools: insert, update, delete, upvote, prune, and search.",
  },
];

export const gitBenefits = [
  {
    title: "Branch synchronization",
    description:
      "If code is reverted or branched, its memories revert or branch with it automatically.",
    icon: GitBranch,
  },
  {
    title: "Reviewable",
    description: "Memories are Markdown files inside your repo, reviewed in PRs alongside code.",
    icon: GitPullRequest,
  },
  {
    title: "Portable by Default",
    description: "If you stop using Tiramisu, you can keep your data.",
    icon: FolderOutput,
  },
];
