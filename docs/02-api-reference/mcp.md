---
title: MCP Tools
icon: Plug
---

The MCP gives your agent six ways to work with memories.

## `insert-memory`

Creates one memory.

| Parameter     | Type       | Required | Description                                   |
| ------------- | ---------- | -------- | --------------------------------------------- |
| `roots`       | `string[]` | Yes      | Absolute paths to workspace projects.         |
| `repo`        | `string`   | Yes      | Absolute path to the target repository.       |
| `body`        | `string`   | Yes      | Markdown content.                             |
| `frontmatter` | `object`   | Yes      | Memory metadata and configured custom fields. |

| `frontmatter` field                             | Type       | Required                                                                   |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| [`title`](./memory-format.md#title)             | `string`   | Yes                                                                        |
| [`scope`](./memory-format.md#scope)             | `string[]` | Yes.                                                                       |
| [`doNotEdit`](./memory-format.md#donotedit)     | `boolean`  | No                                                                         |
| [`doNotDelete`](./memory-format.md#donotdelete) | `boolean`  | No                                                                         |
| Custom fields                                   | `any`      | No. Must be declared in [`frontmatter.custom`](./configuration.md#custom). |

Choose the narrowest [scope](./memory-format.md#scope) where the memory provides useful context. For example, a login-session cookie memory used throughout authentication applies to `["apps/web/auth"]`. Use `["."]` only for context useful across the whole repository.

**Example:**

```json
{
  "roots": ["/Users/adam/Desktop/acme/acme-app", "/Users/adam/Desktop/acme/acme-cli"],
  "repo": "/Users/adam/Desktop/acme/acme-app",
  "body": "Cache responses only after authentication succeeds.",
  "frontmatter": {
    "title": "Authenticated response caching",
    "scope": ["apps/web/auth"]
  }
}
```

Memories are automatically placed into the deepest package or repo root containing every `scope` path.

> [!TIP]
> After insert returns, the agent may add [attachments](./file-conventions.md#attachments) beside `memory.md` in the returned directory when useful. Attachments are supporting files, such as images or long documents, and are not searchable.

## `update-memory`

Updates an existing memory. Omitted fields retain their values. A path-only call repairs the title folder.

**Example:**

```json
{
  "roots": ["/Users/adam/Desktop/acme/acme-app", "/Users/adam/Desktop/acme/acme-cli"],
  "repo": "/Users/adam/Desktop/acme/acme-app",
  "path": "/Users/adam/Desktop/acme/acme-app/.memories/cache-responses",
  "body": "Invalidate cached responses when permissions change."
}
```

| Parameter     | Type       | Required | Description                                                           |
| ------------- | ---------- | -------- | --------------------------------------------------------------------- |
| `roots`       | `string[]` | Yes      | Absolute paths to workspace projects.                                 |
| `repo`        | `string`   | Yes      | Absolute path to the target repository.                               |
| `path`        | `string`   | Yes      | Absolute path to an existing memory directory containing `memory.md`. |
| `body`        | `string`   | No       | New Markdown body.                                                    |
| `frontmatter` | `object`   | No       | Memory metadata and configured custom fields.                         |

| `frontmatter` field                             | Type       | Required                                                                   |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| [`title`](./memory-format.md#title)             | `string`   | No.                                                                        |
| [`scope`](./memory-format.md#scope)             | `string[]` | No.                                                                        |
| [`doNotEdit`](./memory-format.md#donotedit)     | `boolean`  | No                                                                         |
| [`doNotDelete`](./memory-format.md#donotdelete) | `boolean`  | No                                                                         |
| Custom fields                                   | `any`      | No. Must be declared in [`frontmatter.custom`](./configuration.md#custom). |

Changing scope can move the memory to another package or the repo root. Every update also repairs the memory folder's name to match the title, even if the title did not change.

> [!TIP]
> When [pruning](./configuration.md#prune) is enabled, every successful update also records an agent upvote.

`update-memory` will fail if you attempt to update a memory tagged with [`doNotEdit`](./memory-format.md#donotedit).

Memories are automatically placed into the deepest package or repo root containing every `scope` path.

> [!TIP]
> After update returns, the agent may add [attachments](./file-conventions.md#attachments) beside `memory.md` in the returned directory when useful. Attachments are supporting files, such as images or long documents, and are not searchable.

## `search-memories`

Searches the memories.

**Example:**

```json
{
  "roots": ["/Users/adam/Desktop/acme/acme-app", "/Users/adam/Desktop/acme/acme-cli"],
  "repo": "/Users/adam/Desktop/acme/acme-app",
  "query": "cache",
  "scope": ["apps/web"],
  "limit": 10
}
```

| Parameter | Type       | Required | Description                                                                                                  |
| --------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `roots`   | `string[]` | Yes      | Absolute paths to workspace projects.                                                                        |
| `repo`    | `string`   | Yes      | Absolute path to the target repository.                                                                      |
| `query`   | `string`   | Yes      | Text to search.                                                                                              |
| `scope`   | `string[]` | No       | Relative paths to files or directories (includes descendants). Omit or use `["."]` to search the whole repo. |
| `limit`   | `number`   | No       | Positive safe integer. Defaults to `50`.                                                                     |
| `offset`  | `number`   | No       | Nonnegative safe integer. Defaults to `0`.                                                                   |

Ideally, search will only target parts of the repository by using a narrow `scope`, but it may also search the whole project.

Search reads memories from:

- descendant `.memories` directories
- all parents' `.memories` directories up to the repo root whose `scope` includes or overlaps with the requested `scope` param
- other repositories in the workspace with [`availableToWorkspace`](./configuration.md#availabletoworkspace) enabled

> [!TIP]
> Upvotes or memory age don't affect search results.

### Search ranking

**Directory tags** are the folders on the path from the **memory directory** to the root of the repository, such as `errors` and `auth` in `.memories/errors/cache/nextjs-cache/memory.md`.

During search, memory titles get a 3x boost and directory tags get a 2x boost.

## `delete-memories`

Deletes memories and their attachments.

| Parameter | Type       | Required | Description                           |
| --------- | ---------- | -------- | ------------------------------------- |
| `paths`   | `string[]` | Yes      | Absolute paths to memory directories. |

**Example:**

```json
{
  "paths": ["/Users/adam/Desktop/acme/acme-app/.memories/cache-error"]
}
```

Passing the `path` to a memory tagged with [`doNotDelete`](./memory-format.md#donotdelete) blocks the entire operation.

[Nested memories (anti-pattern)](../01-introduction/04-customize.md#anti-pattern-nesting-a-memory-inside-another-memory) must be selected explicitly when deleting their parent folder.

Paths may span multiple Git repositories within the workspace.

## `upvote-memories`

> This feature requires [pruning](./configuration.md#prune) to be enabled.

Upvotes useful memories. Upvotes requested by the user are recorded as `human`. Memories that help the agent produce a reply receive `agent` upvotes. Memories in repositories with pruning enabled receive upvotes; the rest are reported as skipped because pruning is disabled.

**Example:**

```json
{
  "paths": ["/Users/adam/Desktop/acme/acme-app/.memories/cache-error"],
  "actor": "agent"
}
```

| Parameter | Type                 | Required | Description                                                                            |
| --------- | -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `paths`   | `string[]`           | Yes      | Absolute paths to memory directories.                                                  |
| `actor`   | `"human" \| "agent"` | Yes      | `human` when the user requests an upvote, `agent` when a memory helps produce a reply. |

> [!WARNING]
> Updates already record an agent upvote when [pruning](./configuration.md#prune) is enabled. Do not add another upvote for the update alone.

## `prune-memories`

> This feature requires [pruning](./configuration.md#prune) to be enabled.

Lists expired memories within `repo`, excluding the ones tagged with [`doNotDelete`](./memory-format.md#donotdelete).

When candidates exist, the agent is instructed to read each memory and check its relevance against the code, then suggest which to delete or keep.

**Example:**

```json
{
  "repo": "/Users/adam/Desktop/acme/acme-app"
}
```

| Parameter | Required | Description                          |
| --------- | -------- | ------------------------------------ |
| `repo`    | Yes      | Absolute path to the git repository. |
