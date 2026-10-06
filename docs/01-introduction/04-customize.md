---
title: Customize
icon: Settings
---

## Memory creation instructions

During `tiramisu init`, [default prompt rules](../../packages/cli/templates/AGENTS.md) are added to your `AGENTS.md` file to guide when the agent should capture a memory. You can edit these instructions to fit your team's workflow.

## Memory writing instructions

Tiramisu includes a [default skill called `tiramisu-memory-writing`](../../skills/tiramisu-memory-writing/SKILL.md). It instructs the agent on how to format memory titles and bodies before it calls the [`insert-memory`](../02-api-reference/mcp.md#insert-memory) or [`update-memory`](../02-api-reference/mcp.md#update-memory) MCP tools.

You can replace the default skill with your own. Point your agent to the custom skill by adding an instruction to your `AGENTS.md` file:

```md title="AGENTS.md"
Use the `my-custom-memory-writing` skill before calling the `insert-memory` and `update-memory` MCP tools.
```

### Recommendations

1. Stick to one idea per memory. If you need additional context that doesn't have to be searchable, like screenshots, put the file next to `memory.md` and it'll become an [attachment](../02-api-reference/file-conventions.md#attachments).
2. Memories are context, not rules.

Some good examples:

- organization overview: product, business model, teams
- common errors
- glossary
- reasons for why a decision was made, including ADRs, e.g. "Kafka was attempted for notifications in 2025 and reverted because..."
- module → owner mappings
- blockers
- facts, e.g. "our staging DB resets every Sunday"

Use `AGENTS.md` and skills for rules.

## Memory frontmatter

Custom frontmatter fields act as searchable tags.

You may create your own custom tags, e.g. `kind`, `sentry`, Linear URLs, etc.

Example:

```md title="memory.md"
---
id: 7fe24e91-4808-4f80-bc39-5d86f7a74be0
created: 2026-09-19
title: Axios retry duplication after reconnect
description: Reconnects registered Axios retry interceptors more than once. Read when debugging duplicate requests after reconnects, changing client initialization, or adding retry logic.

# custom fields
linear: https://linear.app/acme/issue/ACM-86/axios-reconnect-issue
sentry: https://sentry.io/organizations/acme/issues/12345/
deleteWhen: Zero occurrences in Sentry for 60 days
---

Content goes here...
```

> [!TIP]
> Defining obsolescence up front using a `deleteWhen` custom field turns pruning from a guess into a fast, deterministic check for both agents and humans.
>
> ```yaml title="memory.md"
> retireWhen: Zero occurrences in Sentry for 60 days
> sentry: https://sentry.io/organizations/acme/issues/12345/
> ```

To use custom fields, define [a schema](../02-api-reference/configuration.md#custom).

## Directory names

You can organize memories using any folder hierarchy inside `.memories`. Intermediate directories can be nested to any depth, and their names automatically function as indexed search tags.

> [!TIP]
> **Directory names act as search tags, so they matter when searching memories.** Use straightforward names, like `errors/`, `gotchas/`, `decisions/`, `architecture/`.

### Anti-pattern: Nesting a memory inside another memory

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
