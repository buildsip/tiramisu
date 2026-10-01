---
title: Upvotes and Pruning
icon: ThumbsUp
---

When a memory helps solve a task, it gets upvoted, which extends its lifespan. These events are stored in the database.

On request, the agent can prune memories, meaning it reviews expired memories and suggests updates or deletions.

> [!TIP]
> Ask the agent to upvote on your behalf if you encounter useful memories. Depending on your [configuration](../02-api-reference/configuration.md#lifetimes), a `human` upvote may extend the lifespawn of a memory longer than an `agent` upvote.

Reading alone does not record an upvote. A memory that helps the agent produce a reply receives an `agent` upvote when pruning is enabled. Every memory update also records an `agent` upvote.

Upvotes do not stack or shorten a longer lifetime.

## How pruning works

1. When you ask to prune, the agent calls the [`prune-memories`](../02-api-reference/mcp.md#prune-memories) MCP tool. It returns memory directories that meet the [pruning conditions](../02-api-reference/configuration.md#prune) in the repository you choose. Memories marked [`doNotDelete`](../02-api-reference/memory-format.md#donotdelete) are excluded.
2. The agent then analyses the returned memories by searching the repo and suggests a list of candidates to delete.
3. It's highly recommended to ask the agent to upvote the pruning candidates you decide to keep, so that they don't show up on your next pruning session.

[Configure pruning](../02-api-reference/configuration.md#prune) in your `tiramisu.json` file.

## Expiry

A memory becomes a pruning candidate when the current time reaches the latest of:

- [`created`](../02-api-reference/memory-format.md#created) + `unvotedTtl`.
- Last human upvote + `humanUpvoteTtl`, if one exists.
- Last agent upvote + `agentUpvoteTtl`, if one exists.
