---
title: Database
icon: Database
---

Tiramisu uses Drizzle ORM with `pg`. PostgreSQL is optional and stores [upvote events](../01-introduction/05-upvotes-and-pruning.md), not memory content.

Before opening a connection, Tiramisu converts the legacy `sslmode` values `prefer`, `require`, and `verify-ca` to `verify-full`. This preserves pg's current certificate and hostname verification and removes its warning about future SSL defaults. Explicit `uselibpqcompat=true` and other SSL modes are preserved.

`tiramisu init` automatically migrates the database for you.

## Table

One `tiramisu.upvotes` table is shared by all repositories using the database:

| Column       | PostgreSQL type         | Meaning                                      |
| ------------ | ----------------------- | -------------------------------------------- |
| `id`         | `uuid`, primary key     | Event ID                                     |
| `memory_id`  | `text`, required        | Stable ID from memory frontmatter            |
| `actor`      | `text`, required        | `human` or `agent`                           |
| `created_at` | `timestamptz`, required | Defaults to the database's current timestamp |
