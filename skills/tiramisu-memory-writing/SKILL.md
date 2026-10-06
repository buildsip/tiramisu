---
name: tiramisu-memory-writing
description: Memory writing guidelines. Write or revise Tiramisu memory titles and bodies. Use when preparing content for insert-memory or update-memory.
---

- Less is more.
- One memory file per topic. This level of granularity makes it easy to browse.
- Never repeat information.
- Mannered prose substitutes metaphor and flourish for direct statement. Instead of "a parameter worth varying," the mannered writer produces "a dial worth turning." Instead of "this point still matters," they write "this point earns its keep." The phrases exist to display the writer, not to convey the idea, and readers can tell. That is why mannered prose irritates: it makes the reader work harder so the writer can perform. It is also imprecise. Metaphors drag in connotations the writer did not choose and cannot control. The fix is to say what you mean. When a literal phrase is available, use it.
- You could include: benchmarks, basic usage examples, a reference section with tables and bullet lists, nested headings for variants, "Good to know:" callouts, optional caveats, a separate Examples section with subheadings, prop tables, code blocks with language tags, inline comments, links to related memories, code, or documentation from the project rather than repeating information, external links.
- Favor short factual sentences.
- For decisions, describe the alternatives considered and why they failed.
- Understanding the triggering mechanism for when a memory is read: when the agent searches memories by calling the `search-memories` tool, the results list `path` + `title` + `description`. The agent decides whether to consult a memory based on that `description`.