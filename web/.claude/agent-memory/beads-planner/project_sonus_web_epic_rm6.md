---
name: Sonus web epic rm6
description: Epic sonus-rm6 tracks upload metadata editing, cover art preview, and Zen mode player for the web frontend
type: project
---

Epic sonus-rm6 "Загрузка с редактированием метаданных и Zen-режим плеера" created 2026-03-29.

**Why:** User wants to enhance the upload UX (metadata editing + cover art preview before upload) and add a fullscreen immersive player experience.

**How to apply:** When working on upload or player features, check this epic for context. The upload flow is changing from immediate-upload to a 3-stage flow (dropzone -> editing -> uploading). The backend upload endpoint at POST /api/v1/upload needs to be extended first before frontend work can proceed on metadata/coverart features. The Zen mode player is independent and can proceed in parallel.

Tasks:
- sonus-rm6.1: Backend upload extension (ready)
- sonus-rm6.2: Frontend upload editing + cover art (blocked by rm6.1)
- sonus-rm6.3: Zen mode player (ready, independent)
