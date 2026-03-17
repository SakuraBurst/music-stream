# Sonus

Personal music streaming server with web, iOS, and terminal clients. Monorepo with Go backend + TUI, React frontend, and Swift iOS app.

## Tech Stack

- **Backend**: Go 1.22+, chi router, SQLite (modernc.org/sqlite, pure Go), JWT auth (golang-jwt), dhowden/tag for metadata
- **Frontend**: React 19, Vite, TypeScript (strict), Tailwind CSS, Zustand, React Router v7
- **iOS**: Swift 5.9+, SwiftUI, AVFoundation, Observation framework (@Observable)
- **TUI**: bubbletea, bubbles, lipgloss
- **External**: ffmpeg/ffprobe (transcoding + audio duration extraction)

## Repository Structure

```
cmd/server/         Go backend entrypoint
cmd/tui/            Terminal client entrypoint
internal/           Shared Go code (not importable outside module)
  api/handler/      HTTP handlers (auth, library, stream, playlist, etc.)
  api/middleware/    JWT auth, CORS, logging
  service/          Business logic (scanner, transcoder, stream, etc.)
  model/            Domain types (user, track, album, artist, playlist)
  store/            Data access interfaces
  store/sqlite/     SQLite implementation + migrations
  config/           Configuration loading (TOML + env + flags)
  auth/             JWT creation/validation
pkg/client/         Go API client (shared by TUI and tests)
web/                React frontend (Vite project, its own package.json)
ios/                Xcode project (SwiftUI)
docs/               Design documents (docs/design.md is the source of truth)
scripts/            Dev scripts
```

## Development Commands

```bash
# Backend
go run ./cmd/server                    # Run backend server
go test ./...                          # Run all Go tests

# Frontend
cd web && npm install                  # Install frontend deps
cd web && npm run dev                  # Vite dev server
cd web && npm run build                # Build to web/dist/
cd web && npm test                     # Run frontend tests

# TUI
go run ./cmd/tui                       # Run terminal client

# Full stack
make dev                               # Run backend + frontend dev servers
make build                             # Build everything
make test                              # Run all tests
```

## Key Conventions

### API
- REST API at `/api/v1/` — see docs/design.md section 4 for full endpoint list
- Auth: JWT in `Authorization: Bearer <token>` header
- Stream and coverart endpoints also accept `?token=<jwt>` query param (needed for HTML5 audio/img src)

### Database
- SQLite with WAL mode, single file at `<data_dir>/sonus.db`
- Migrations in `internal/store/sqlite/migrations/` — embedded via `go:embed`
- Pure Go driver (modernc.org/sqlite), no CGO required

### Audio
- Supported formats: FLAC, MP3, OGG, WAV, AAC, M4A, ALAC, WMA, APE, Opus
- Transcoding: on-the-fly via ffmpeg + disk cache at `<data_dir>/cache/transcoded/`
- Cover art extracted at scan time, stored at `<data_dir>/coverart/`
- Streaming uses `http.ServeContent` for Range request support

### Config
- TOML config file + env vars (prefix `SONUS_`) + CLI flags
- See docs/design.md section 12 for full config reference

### Code Style
- Go: `gofmt`, structured logging via `log/slog`
- TypeScript: strict mode, no `any`, Prettier formatting
- Swift: SwiftUI with MVVM pattern, `@Observable` for state

### Frontend Build
- `web/dist/` is embedded into the Go binary via `//go:embed` for single-binary production deployment
- SPA fallback: non-API, non-static routes serve index.html
