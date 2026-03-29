---
name: Sonus epic structure
description: Root MVP epic sonus-n31 (closed) and post-MVP epics, with IDs and task counts
type: project
---

## MVP (all closed)

Root epic `sonus-n31` (Sonus MVP) with 6 phase sub-epics, all tasks closed as of 2026-03-29:

- `sonus-n31.1` Phase 1: Core Backend (8 tasks)
- `sonus-n31.2` Phase 2: Web Frontend (5 tasks)
- `sonus-n31.3` Phase 3: Transcoding (2 tasks)
- `sonus-n31.4` Phase 4: iOS (4 tasks)
- `sonus-n31.5` Phase 5: TUI (3 tasks)
- `sonus-n31.6` Phase 6: Polish/Deploy (3 tasks)

## Post-MVP

- `sonus-6dq` — Загрузка треков: бэкенд + веб-интерфейс (epic, 2 tasks)
  - `sonus-6dq.1` — Backend upload endpoint (ready)
  - `sonus-6dq.2` — Web frontend upload page (blocked by 6dq.1)

**Why:** Tracking all epics helps when deciding where new tasks belong and prevents duplicate planning.

**How to apply:** When creating new Sonus tasks, check if they fit under an existing epic. New feature areas get their own top-level epic (not nested under sonus-n31).
