import { dirname } from "node:path";
import type { Memory } from "./memory";

/** Returns enough context to choose a memory; read memory.md inside path for its content. */
export function summarizeMemory(memory: Memory) {
  return {
    path: dirname(memory.path),
    title: memory.frontmatter.title,
    description: memory.frontmatter.description,
  };
}
