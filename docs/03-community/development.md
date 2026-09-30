---
title: Development
icon: Code
---

Run from the repository root:

```bash file="Terminal"
bun install
bun run lint
bun run typecheck
bun run test
bun run build
```

To uninstall in development mode, run:

```bash file="Terminal"
cd packages/cli
bun unlink
```

## Packaging

To inspect the npm package, run `npm pack --dry-run` in [`packages/cli`](../../packages/cli). Its packaging hooks use Bun to build and prepare the [`README`](../../README.md).

## Release

```bash package="Patch"
bun run release patch
```

```bash package="Minor"
bun run release minor
```

```bash package="Major"
bun run release major
```

The release script updates the CLI version and Bun lockfile together, commits them, creates an annotated version tag, and pushes the commit and tag. The publish workflow runs the same checks, then publishes through npm with provenance.

### Telemetry

When running the CLI from a source checkout, including a linked installation, events are appended to `~/.tiramisu/telemetry-debug.jsonl` instead of sent to PostHog.

To watch the events:

```bash title="Terminal"
tail -f ~/.tiramisu/telemetry-debug.jsonl
```
