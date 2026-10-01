---
id: f13e047c-bf79-4615-889d-5869da486a23
created: 2026-10-01
title: Bun global lockfile missing during init
scope:
  - packages/cli/src/install-cli.ts
  - packages/cli/src/init.test.ts
---

Investigated a recurring production failure in `tiramisu@0.6.0` on Bun 1.4.2: `bunx --bun tiramisu@latest init` stopped at `bun pm ls -g` with `missing lockfile, nothing to list`.

The missing file belonged to Bun's global install directory, not the repository. The affected directory contained `{}` in `package.json` and leftover dependencies but no global lockfile. Corruption was not established. Fresh directories and directories containing only linked packages reproduced the failure too.

Tiramisu handled Bun's older `No package.json was found for directory` message but rejected the missing-lockfile message before reaching global installation. Repeating the lookup did not repair it. Installing Tiramisu globally first was the workaround.

The fix allows global installation to create the absent lockfile while preserving failures for malformed or unreadable lockfiles. The regression failed before the patch, then passed; a real Bun integration check verified creation of the package, executable, and lockfile.
