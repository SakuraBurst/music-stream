---
name: bd edit notes workaround
description: bd edit --notes opens vim by default; use EDITOR=tee to pipe content without interactive editor
type: feedback
---

`bd edit <id> --notes` opens an interactive editor (vim). To use non-interactively, set `EDITOR="tee"` and pipe content via heredoc.

There is no `--append-notes` flag. The `--notes` flag opens the notes field for editing.

**Why**: bd is CLI-based and defaults to vim for editing, which doesn't work in non-interactive sessions.

**How to apply**: Always use `EDITOR="tee" bd edit <id> --notes <<'EOF' ... EOF` pattern when writing implementation handoff notes.
