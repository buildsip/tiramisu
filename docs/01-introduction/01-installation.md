---
title: Installation
description: Getting Started with Tiramisu
icon: Rocket
---

**Tiramisu is an [open source](https://github.com/buildsip/tiramisu) git-native memory system for coding agents.**

## Quick Start

### Step 1: Configure pruning (Optional)

[Upvotes and pruning](./05-upvotes-and-pruning.md) reduce stale memories.

When a memory helps solve a task, it gets upvoted, which extends its lifespan. These events are stored in the [database](../02-api-reference/database.md). On request, the agent can prune memories, meaning it reviews expired memories and suggests updates or deletions.

If you skip this step, upvotes are disabled, but the agent can still prune manually by searching your codebase to verify relevance.

#### Option A: Self-Hosted

Spin up a PostgreSQL database to store upvotes.

> [!TIP]
> You can use the **same database** across all your organization's repositories. Try **[Neon](https://neon.tech)** or **[Supabase](https://supabase.com)** for free.

#### Option B: Tiramisu app (Coming Soon)

- ⚡ Cloud Database
- 📊 Dashboard
- 🤖 Automated Pruning PRs

### Step 2: Separate project memories from personal, team, and/or organization memories (Optional)

This step is useful for teams. Solo devs can skip to [Step 3](#step-3-install-to-project).

1. Create one repo per set of memories you want to keep separate (e.g. per team, one company-wide, one personal).
2. Add each repo to your IDE **and** agent harness **workspaces** to "import" the memories.
3. Install Tiramisu in **each repo**:

```bash package="npm"
npx tiramisu@latest init --availableToWorkspace
```

```bash package="pnpm"
pnpm dlx tiramisu@latest init --availableToWorkspace
```

```bash package="yarn"
yarn dlx tiramisu@latest init --availableToWorkspace
```

```bash package="bun"
bunx --bun tiramisu@latest init --availableToWorkspace
```

### Step 3: Install to project

Inside your **project(s)**, run:

```bash package="npm"
npx tiramisu@latest init
```

```bash package="pnpm"
pnpm dlx tiramisu@latest init
```

```bash package="yarn"
yarn dlx tiramisu@latest init
```

```bash package="bun"
bunx --bun tiramisu@latest init
```

## Manual Installation

1. Install the `tiramisu` CLI:

```bash package="npm"
npm i -g tiramisu
```

```bash package="pnpm"
pnpm i -g tiramisu
```

```bash package="yarn"
yarn i -g tiramisu
```

```bash package="bun"
bun i -g tiramisu
```

2. Create `tiramisu.json` at the root of your repository with the [options](../02-api-reference/configuration.md) you want:

```json title="tiramisu.json"
{
  "version": 1,
  "availableToWorkspace": false,
  "prune": {
    "unvotedTtl": "90d",
    "humanUpvoteTtl": "180d",
    "agentUpvoteTtl": "90d",
    "databaseUrlCommand": "doppler secrets get TIRAMISU_DATABASE_URL --plain"
  }
}
```

3. Add the MCP tools:

**Option 1: Using `add-mcp`**

```bash package="npm"
npx add-mcp "tiramisu mcp" -g --auto-approve
```

```bash package="pnpm"
pnpm dlx add-mcp "tiramisu mcp" -g --auto-approve
```

```bash package="yarn"
yarn dlx add-mcp "tiramisu mcp" -g --auto-approve
```

```bash package="bun"
bunx --bun add-mcp "tiramisu mcp" -g --auto-approve
```

**Option 2: Manual installation**

Refer to your agent's documentation on how to add a global MCP server.

Add:

```bash
tiramisu mcp
```

4. Add the memory writing skill:

```bash package="npm"
npx skills add buildsip/tiramisu --global
```

```bash package="pnpm"
pnpm dlx skills add buildsip/tiramisu --global
```

```bash package="yarn"
yarn dlx skills add buildsip/tiramisu --global
```

```bash package="bun"
bunx --bun skills add buildsip/tiramisu --global
```

5. VS Code / Cursor memory tab labels

```json title="vscode/settings.json"
{
  "workbench.editor.customLabels.patterns": {
    "**/.memories/**/memory.md": "${dirname}/memory.md"
  }
}
```

6. If you've enabled [pruning](./05-upvotes-and-pruning.md), migrate your database using the drizzle schema from [`tiramisu/packages/cli/migrations`](../../packages/cli/migrations).
