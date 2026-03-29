# Sonus — Personal Music Streaming Server
# Multi-stage Dockerfile: builds Go backend with embedded React frontend.
#
# Usage:
#   docker build -t sonus .
#   docker run -d \
#     -p 8080:8080 \
#     -v /path/to/music:/music:ro \
#     -v sonus-data:/data \
#     -e SONUS_AUTH_JWT_SECRET=change-me \
#     -e SONUS_LIBRARY_MUSIC_DIRS=/music \
#     sonus
#
# The /data volume stores the SQLite database, cover art cache, and transcoded
# audio cache. Mount it to persist state across container restarts.
#
# Environment variables (SONUS_ prefix):
#   SONUS_SERVER_ADDRESS        Listen address (default :8080)
#   SONUS_SERVER_DATA_DIR       Data directory (default /data inside container)
#   SONUS_AUTH_JWT_SECRET       JWT signing secret (auto-generated if unset)
#   SONUS_LIBRARY_MUSIC_DIRS    Comma-separated music directories
#   SONUS_LIBRARY_SCAN_ON_STARTUP  Scan library at startup (default true)
#   SONUS_TRANSCODING_FFMPEG_PATH  Path to ffmpeg (default: ffmpeg)
#
# See docs/design.md section 12 for the full configuration reference.

# ---------------------------------------------------------------------------
# Stage 1: Build React frontend
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend

WORKDIR /app/web

# Install dependencies first (layer cache).
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the frontend.
COPY web/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Build Go binary with embedded frontend
# ---------------------------------------------------------------------------
FROM golang:1.25-alpine AS backend

WORKDIR /app

# Install git (needed by some Go modules for version info).
RUN apk add --no-cache git

# Download Go modules first (layer cache).
COPY go.mod go.sum ./
RUN go mod download

# Copy source code.
COPY cmd/ cmd/
COPY internal/ internal/
COPY pkg/ pkg/
COPY web/embed.go web/embed.go

# Copy built frontend from stage 1 into the expected embed path.
COPY --from=frontend /app/web/dist/ web/dist/

# Build a statically-linked binary.
# CGO is disabled — the SQLite driver (modernc.org/sqlite) is pure Go.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -trimpath \
    -o /sonus \
    ./cmd/server

# ---------------------------------------------------------------------------
# Stage 3: Minimal runtime image
# ---------------------------------------------------------------------------
FROM alpine:3.21

# ffmpeg is required for audio transcoding and duration extraction.
RUN apk add --no-cache ffmpeg ca-certificates tzdata \
    && addgroup -S sonus \
    && adduser -S -G sonus -h /data sonus

COPY --from=backend /sonus /usr/local/bin/sonus

# /data stores the SQLite database, cover art, and transcode cache.
# Mount a volume here to persist state.
VOLUME /data

# Default server port.
EXPOSE 8080

# Run as non-root user.
USER sonus

# Set sensible defaults for container environment.
ENV SONUS_SERVER_DATA_DIR=/data \
    SONUS_SERVER_ADDRESS=:8080

ENTRYPOINT ["sonus"]
