/**
 * Well-known file and directory names we look for on disk.
 * Keep shared internal paths here; other ecosystems' manifests live in is-package-manifest.ts.
 */
export enum NAMES {
  /** Repository instructions, extended only when the user accepts during init. */
  AGENTS_MD = "AGENTS.md",
  /** Bundled templates copied into user repositories during setup. */
  TEMPLATES = "templates",
  /** Root skill directory used when installing from a source checkout. */
  SKILLS = "skills",
  MEMORY_WRITING_SKILL = "tiramisu-memory-writing",
  SKILL_MD = "SKILL.md",
  /** Marks a Git working-tree root. This is a directory in a normal clone and a file in a worktree. */
  GIT = ".git",
  /** Memory store directory. Only allowed at a package root or the repo root. */
  MEMORIES = ".memories",
  /** Repository-wide settings file, directly inside the Git root. */
  TIRAMISU_JSON = "tiramisu.json",
  /** The markdown file that holds one memory. */
  MEMORY_MD = "memory.md",
  /** Dependency installs and Git internals; never treated as a package store. */
  NODE_MODULES = "node_modules",
  /** Editor folder at the Git root, used for memory tab labels. */
  VSCODE = ".vscode",
  /** Cursor / VS Code settings that receive the memory.md tab-label pattern. */
  SETTINGS_JSON = "settings.json",
  /** Prefix for temporary memory directories and staged writes. */
  MEM_PREFIX = ".mem-",
  /** Private global telemetry preference, installation ID, and project hashing salt. */
  TELEMETRY_JSON = "telemetry.json",
  /** Local event payloads from development builds of the CLI. */
  TELEMETRY_DEBUG_JSONL = "telemetry-debug.jsonl",
  TIRAMISU_HOME_DIR = ".tiramisu",
}
