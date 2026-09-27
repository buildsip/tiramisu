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

## Memory frontmatter

Custom frontmatter fields act as searchable tags.

You may create your own custom tags, e.g. `kind`, `sentry`, Linear URLs, etc.

Example:

```md title="memory.md"
---
id: 7fe24e91-4808-4f80-bc39-5d86f7a74be0
created: 2026-09-19
title: Axios retry duplication after reconnect

# custom fields
linear: https://linear.app/acme/issue/ACM-86/axios-reconnect-issue
sentry: https://sentry.io/organizations/acme/issues/12345/
deleteWhen: Zero occurrences in Sentry for 60 days
---

Content goes here...
```

> [!TIP]
> Defining obsolescence up front using a `deleteWhen` custom field turns pruning from a guess into a fast, deterministic check for both agents and humans.

To use custom fields, define [a schema](../02-api-reference/configuration.md#custom).

## Directory names

You can organize memories using any folder hierarchy inside `.memories`. Intermediate directories can be nested to any depth, and their names automatically function as indexed search tags.
