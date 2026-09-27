---
id: a24d30d4-4489-4c68-9ee2-e0d4e5acc952
created: 2026-09-26
title: Docs app must list bun in compilerOptions.types
---

`apps/docs` typechecks with TypeScript 7 and has its own `node_modules`. `lib/github-blob-href.test.ts` imports `bun:test`.

Installing `@types/bun` in `apps/docs` does not clear `Cannot find module 'bun:test'`. `bun:test` is an ambient module from `@types/bun`. TypeScript 7 does not load that package from the `bun:test` import. It also does not use the workspace root's `@types/bun`, because `apps/docs` has its own `node_modules/@types`.

`apps/docs/tsconfig.json` needs `"types": ["node", "bun"]`. `node` stays so Node globals remain included once `types` is set. With that option, `tsc --noEmit` resolves `bun:test`.
