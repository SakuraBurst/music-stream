---
name: Sonus web player epic d9n
description: Epic sonus-d9n tracks 5 web player enhancements — volume persist, session sync, expanded player, visualizer, zen contrast
type: project
---

Epic sonus-d9n "Улучшения веб-плеера Sonus" created 2026-03-29.

**Why:** User wants to enhance the web player UX with volume persistence, cross-device session sync (Spotify Connect style), an expanded now-playing view with queue, audio spectrum visualizer, and Zen mode text contrast fix.

**How to apply:** Tasks d9n.1/2/3/5 are independent and can proceed in parallel. Task d9n.4 (visualizer) is blocked by d9n.3 (expanded player) because the visualizer renders inside that view. Task d9n.2 is the largest — it spans backend (Go handler + SQLite migration + store) and frontend (API client + sync hook + playerStore).

Tasks:
- sonus-d9n.1: Сохранение громкости в localStorage (ready, quick, p2)
- sonus-d9n.2: Серверная синхронизация сессии воспроизведения (ready, large, p1)
- sonus-d9n.3: Расширенный вид плеера с очередью (ready, medium, p1)
- sonus-d9n.4: Аудио-визуализатор спектра (blocked by d9n.3, p1)
- sonus-d9n.5: Исправление контрастности текста в Zen-режиме (ready, quick, p2)
