---
title: Configuration
icon: FileBraces
---

## availableToWorkspace

`availableToWorkspace` makes all memories in a repository available to all other projects in the workspace.

To enable the `availableToWorkspace` flag, set it to `true` in your `tiramisu.json` file:

```json title="tiramisu.json"
{
  "availableToWorkspace": true
}
```

## frontmatter

### custom

`custom` allows you to use custom frontmatter fields with your `memory.md` files.

Define a JSON schema in your `tiramisu.json` file:

```json title="tiramisu.json"
{
  "frontmatter": {
    "custom": {
      "properties": {
        "sentry": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "linear": {
          "type": "string"
        }
      },
      "required": ["linear"],
      "additionalProperties": false
    }
  }
}
```

> [!TIP]
> Existing memories remain searchable when you add, change, or remove custom fields. Only newly created or edited memories will be required to comply with the new schema.

[`insert-memory`](./mcp.md#insert-memory) and [`update-memory`](./mcp.md#update-memory) MCP tools validate the input memory against the schema. Without a custom schema, extra fields are rejected.

#### Schema changes

When the `frontmatter.custom` schema changes, existing files are not migrated or revalidated against the custom schema changes when read. [`search-memories`](./mcp.md#search-memories) keeps their custom fields searchable.

## prune

To enable [pruning](../01-introduction/01-quick-start.md#step-1-configure-pruning-optional), update your `tiramisu.json` file:

```json title="tiramisu.json"
{
  "prune": {
    "unvotedTtl": "90d",
    "humanUpvoteTtl": "180d",
    "agentUpvoteTtl": "90d",
    "databaseUrlCommand": "doppler secrets get TIRAMISU_DATABASE_URL --plain"
  }
}
```

### Lifetimes

| Name             | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `unvotedTtl`     | Lifetime in days from the memory's [`created`](./memory-format.md#created) date. |
| `humanUpvoteTtl` | Lifetime in days from its last human upvote.                                     |
| `agentUpvoteTtl` | Lifetime in days from its last agent upvote.                                     |

> [!TIP]
> The memory becomes eligible for review when all applicable lifetimes have elapsed. Upvotes do not stack or shorten a longer lifetime.

### databaseUrlCommand

A command that supplies the database connection string used for upvote storage. It must print exactly one `postgres://` or
`postgresql://` URL to stdout.

Multiple repositories may share one database.

To configure the `databaseUrlCommand`, update your `tiramisu.json` file:

```json title="tiramisu.json"
{
  // Example for doppler
  "prune": {
    "databaseUrlCommand": "doppler secrets get TIRAMISU_DATABASE_URL --plain"
  }
}
```

Use a direct or session-pooled PostgreSQL connection. Transaction-pooling endpoints are not supported.

> [!WARNING]
> The database `role` needs permission to create the `tiramisu` schema and create/alter its objects.

## version

The configuration file version. Don't change this number.

```json title="tiramisu.json"
{
  "version": 1
}
```
