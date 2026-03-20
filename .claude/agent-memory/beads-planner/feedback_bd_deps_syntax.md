---
name: Beads dep syntax direction
description: bd create --deps "blocks:X" means THIS issue blocks X (inverted from what you might expect). Use bd dep add <blocked> <blocker> for correct direction.
type: feedback
---

When using `bd create --deps "blocks:X"`, the semantics are "this new issue blocks X" — NOT "this issue is blocked by X".

**Why:** First attempt at creating the Sonus MVP task tree had all dependencies inverted, requiring manual removal and re-creation of ~22 dependencies.

**How to apply:** Always use `bd dep add <blocked-id> <blocker-id>` after creating issues, rather than `--deps` flag on `bd create`. This makes the direction explicit: "blocked-id depends on blocker-id". For example, to say "task B depends on task A": `bd dep add B A`.
