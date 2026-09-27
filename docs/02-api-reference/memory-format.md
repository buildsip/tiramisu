---
title: Memory format
icon: Brain
---

Frontmatter fields act as searchable tags.

```bash
---
id: 7fe24e91-4808-4f80-bc39-5d86f7a74be0          # DO NOT CHANGE
created: 2026-09-19                               # DO NOT CHANGE
title: Axios retry duplication after reconnect
scope:
  - apps        # Includes every app beneath this directory
  - services/billing
doNotDelete: false
doNotEdit: false
---

Content
```

## Fields

### id

Required. Stable identifier for this memory. Don't change it.

The id is used to track the memory across renames, and for upvotes when those are enabled.

### created

Required. UTC calendar date when the memory was inserted (`YYYY-MM-DD`). Don't change it. [Pruning](../01-introduction/06-upvotes-and-pruning.md) uses this date for the unvoted lifetime.

### title

Required. The memory title. Can be changed anytime.

```yaml
title: Axios reconnect retry
```

The title becomes the name of the memory directory. [`update`](./mcp.md#update-memory) always repairs the memory directory to this slug.

### doNotDelete

| Type      | Required | Default |
| --------- | -------- | ------- |
| `boolean` | No.      | `false` |

To prevent the agent from deleting a memory, set `doNotDelete` to `true` in your `memory.md` file:

```yaml title="memory.md"
doNotDelete: true
```

### doNotEdit

| Type      | Required | Default |
| --------- | -------- | ------- |
| `boolean` | No.      | `false` |

To prevent the agent from editing a memory, set `doNotEdit` to `true` in your `memory.md` file:

```yaml title="memory.md"
doNotEdit: true
```

### scope

Optional. **`Scope` contains literal paths relative to the git root, not globs.**

A missing frontmatter scope means the scope defaults to the parent of the `.memories` directory.

Example:

```yaml
scope:
  - apps/web
  - apps/api
```

This memory applies to the `web` and `api` directories and all files beneath them.

## Custom fields

Custom frontmatter fields act as searchable tags.

Example:

```bash title="memory.md"
---
id: 7fe24e91-4808-4f80-bc39-5d86f7a74be0
created: 2026-09-19
title: Axios retry duplication after reconnect

linear: https://linear.app/acme/issue/ACM-86/axios-reconnect-issue
sentry:
- https://sentry.io/organizations/acme/issues/12345/
- https://sentry.io/organizations/acme/issues/67890/
retireWhen: Zero occurrences in Sentry for 60 days
---

Content
```

To use custom fields, define [a schema](./configuration.md#custom).
