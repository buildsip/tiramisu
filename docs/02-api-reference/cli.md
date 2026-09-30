---
title: CLI
icon: Terminal
---

## `tiramisu insert`

```bash title="Terminal"
tiramisu insert --roots /Users/adam/Desktop/acme/acme-app --repo /Users/adam/Desktop/acme/acme-app <<'EOF'
{
  "body": "Retry the client once after a reconnect; do not stack interceptors.",
  "frontmatter": {
    "title": "Axios retry duplication after reconnect",
    "scope": ["apps/web"]
  }
}
EOF
```

Alternatively, you may pass the `.json` file using the `--input` flag.

```bash title="Terminal"
tiramisu insert --roots /Users/adam/Desktop/acme/acme-app --repo /Users/adam/Desktop/acme/acme-app --input new-memory.json
```

For more details about adding memories, see [`insert-memory`](./mcp.md#insert-memory).

## `tiramisu update`

```bash title="Terminal"
tiramisu update --roots /Users/adam/Desktop/acme/acme-app --repo /Users/adam/Desktop/acme/acme-app --path /Users/adam/Desktop/acme/acme-app/.memories/cache-responses <<'EOF'
{
  "body": "Invalidate cached responses when permissions change."
}
EOF
```

Alternatively, you may pass the `.json` file using the `--input` flag.

```bash title="Terminal"
tiramisu update --roots /Users/adam/Desktop/acme/acme-app --repo /Users/adam/Desktop/acme/acme-app --path /Users/adam/Desktop/acme/acme-app/.memories/cache-responses --input updated-memory.json
```

For more details about updating memories, see [`update-memory`](./mcp.md#update-memory).

## `tiramisu search`

```bash title="Terminal"
tiramisu search --roots /Users/adam/Desktop/acme/acme-app --repo /Users/adam/Desktop/acme/acme-app --query "axios retry"
```

For more details about searching memories, see [`search-memories`](./mcp.md#search-memories).

## `tiramisu delete`

```bash title="Terminal"
tiramisu delete \
  --paths /Users/adam/Desktop/acme/acme-app/.memories/one \
  --paths /Users/adam/Desktop/acme/acme-cli/.memories/two
```

For more details about deleting memories, see [`delete-memories`](./mcp.md#delete-memories).

## `tiramisu upvote`

```bash title="Terminal"
tiramisu upvote \
  --paths /Users/adam/Desktop/acme/acme-app/.memories/cache-error \
  --actor human
```

For more details about upvoting memories, see [`upvote-memories`](./mcp.md#upvote-memories).

## `tiramisu prune`

```bash title="Terminal"
tiramisu prune --repo /Users/adam/Desktop/acme/acme-app
```

For more details about pruning memories, see [`prune-memories`](./mcp.md#prune-memories).

## `tiramisu telemetry`

Tiramisu collects **completely anonymous** telemetry data about general usage. Participation in this anonymous program is optional, and you can opt-out if you prefer not to share information.

The following options are available for the `tiramisu telemetry` command:

| Option      | Description                               |
| ----------- | ----------------------------------------- |
| `--enable`  | Enables Tiramisu's telemetry collection.  |
| `--disable` | Disables Tiramisu's telemetry collection. |

To check the status of your telemetry settings, run `tiramisu telemetry`.

Your preferences are stored in `~/.tiramisu/telemetry.json`.

### What's this?

Tiramisu sends usage and performance measurements to PostHog. Telemetry helps us understand which tools are used, whether searches return results, and which operations need to be faster.

#### What data is collected?

We collect general usage and performance information:

- Memory tools invoked through the CLI or MCP.
- Software versions (Tiramisu, Node.js, and the PostHog SDK) and operating system.
- Setup activity and feature usage, such as pruning and workspace sharing.
- Operation timing, outcome status, and general error categories.
- Workspace and memory counts.
- Search performance and result counts.
- Upvote and pruning activity.

#### What about sensitive data?

We do not collect any metrics which may contain sensitive data.

The data we collect is also completely anonymous, not traceable to the source, and only meaningful in aggregate form.
