---
title: File Conventions
icon: FolderTree
---

## `.memories`

The memories store, also known as `.memories`, is a directory that may be placed at the root of the git repository or at the root of a package.

Memory files must be named `memory.md`.

```bash
.memories/
├── webassembly-compile-error/      # memory directory matches the memory's title
│   └── memory.md                   # memory file
└── opennext-cache-components/
    ├── memory.md
    ├── response.json               # unindexed attachment that the agent inspects once it retrieves the memory
    └── error.png                   # unindexed attachment
```

The names of the memory's parent directories act as searchable tags.

```bash
.memories/
├── errors/
│   └── webassembly-compile-error/
│       └── memory.md
├── gotchas/
│   └── cache/
│       └── opennext-cache-components/
│           └── memory.md
└── ADRs/
```

## Directories used to categories memories

Directories between `.memories` and the memory directory become tags during search.

```bash
repo/
├── tiramisu.json
└── .memories/
    └── errors/     # A directory used to categorize memories
        └── axios-reconnect-retry/
            └── memory.md
```

## Memory directory

Each memory file (`memory.md`) lives in its own memory directory, named after the memory's title.

## `memory.md`

The memory file.

It contains YAML frontmatter and Markdown.

```md
---
id: 11111111-1111-4111-8111-111111111111
created: 2026-09-19
title: Axios reconnect retry
description: Reconnects registered Axios retry interceptors more than once. Read when debugging duplicate requests after reconnects, changing client initialization, or adding retry logic.
---

Memory body goes here...
```

The memory file respects a strict [format](./memory-format.md).

## Attachments

Any sibling of `memory.md`, including nested files or directories.

Attachments aren't indexed during search.

## `tiramisu.json`

Repository settings.

Read more about [configuration](./configuration.md).
