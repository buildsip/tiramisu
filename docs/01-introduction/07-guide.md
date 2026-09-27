---
title: Guide
icon: Book
---

## General

1. **Most of the time, you should commit new project memories to the same PR that generated them.**
2. **Review `.memories` like code.**
3. **If pruning is enabled, ask the agent to upvote a memory when it provided useful context.** The agent also upvotes by itself, but `human` upvotes might be more valuable depending on your [configuration](../02-api-reference/configuration.md#lifetimes).

## Writing memories

1. **A memory should be short.** Stick to one idea per file. If you need additional context that doesn't have to be searchable, like screenshots, put the file next to `memory.md` as an [attachment](../02-api-reference/file-conventions.md#attachments).
2. **Memories are context, not rules.**

Some good examples:

- organization overview: product, business model, teams
- common errors
- glossary
- reasons for why a decision was made, including ADRs, e.g. "Kafka was attempted for notifications in 2025 and reverted because..."
- module → owner mappings
- blockers
- facts, e.g. "our staging DB resets every Sunday"

Use [`AGENTS.md`](./04-customize.md#memory-creation-instructions) and [skills](./04-customize.md#memory-writing-instructions) for rules.

3. **Directory names act as search tags, so they matter when searching memories.** Use straightforward names, like `errors/`, `gotchas/`, `decisions/`, `architecture/`.
4. **You may create your own custom tags,** e.g. `kind`, `sentry`, Linear URLs, etc.
5. **Prefer a custom `retireWhen` field** when you can name an objective test for making this memory obsolete:

```yaml title="memory.md"
retireWhen: Zero occurrences in Sentry for 60 days
sentry: https://sentry.io/organizations/acme/issues/12345/
```

Defining obsolescence up front turns pruning from a guess into a fast, deterministic check for both agents and humans. Add `retireWhen` to the [schema](../02-api-reference/configuration.md#custom) if you use it.

## Anti-patterns

### Nesting a memory inside another memory

A nested memory is a `memory.md` sitting inside another memory's folder, like:

```bash
.memories/
└── webpack-error/
    ├── memory.md
    └── compile-error/
        └── memory.md   # ❌ nested memory
```

The outer folder name becomes a search tag on the inner memory. The outer memory cannot be edited until the inner one is moved out, because an edit renames the whole folder and would take the inner memory with it.

Deleting the outer memory is refused unless the inner memory is deleted in the same action.
