---
name: Sonus backend implementation state
description: Current state of Sonus Go backend - which modules are implemented, wiring patterns, and known issues
type: project
---

Sonus backend has auth, scanner, and library API implemented through main.go wiring pattern.

**Wiring pattern**: main.go creates stores -> services -> passes to api.Deps struct -> NewRouter wires handlers and middleware. All stores are concrete types (not interfaces) from internal/store/sqlite package.

**Known issue**: FTS5 table was broken in 001_init.sql (used content=tracks but columns didn't match). Fixed in 002_fix_fts.sql migration. FTS rebuild reads all data into memory first to avoid MaxOpenConns=1 deadlock.

**Why**: Understanding the wiring pattern and known gotchas saves time in future tasks.

**How to apply**: When adding new services/handlers, follow the same pattern: create store -> create service -> add to api.Deps -> register routes in NewRouter. When working with FTS or concurrent DB access, remember MaxOpenConns=1 constraint.
