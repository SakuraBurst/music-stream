package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/service"
)

// imageMIMETypes maps file extensions to MIME types for image formats.
var imageMIMETypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".bmp":  "image/bmp",
}

// CoverArtHandler handles cover art HTTP endpoints.
type CoverArtHandler struct {
	coverArt *service.CoverArtService
	logger   *slog.Logger
}

// NewCoverArtHandler creates a new CoverArtHandler.
func NewCoverArtHandler(coverArt *service.CoverArtService, logger *slog.Logger) *CoverArtHandler {
	return &CoverArtHandler{
		coverArt: coverArt,
		logger:   logger,
	}
}

// GetCoverArt handles GET /api/v1/coverart/{albumID}.
// It serves the album's cover art file with the correct Content-Type.
// Supports ?token=<jwt> query param for authorization (handled by auth middleware).
func (h *CoverArtHandler) GetCoverArt(w http.ResponseWriter, r *http.Request) {
	albumID := chi.URLParam(r, "albumID")

	coverPath, err := h.coverArt.GetCoverArtPath(r.Context(), albumID)
	if err != nil {
		if errors.Is(err, service.ErrAlbumNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "album not found"})
			return
		}
		if errors.Is(err, service.ErrCoverArtMissing) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "cover art not found"})
			return
		}
		h.logger.Error("getting cover art path failed", "albumID", albumID, "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	f, err := os.Open(coverPath)
	if err != nil {
		h.logger.Error("opening cover art file failed", "albumID", albumID, "path", coverPath, "error", err)
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "cover art not found"})
		return
	}
	defer f.Close()

	// Get file info for modification time.
	var modTime time.Time
	if info, err := f.Stat(); err == nil {
		modTime = info.ModTime()
	}

	// Set Content-Type based on file extension.
	ext := strings.ToLower(filepath.Ext(coverPath))
	if mimeType, ok := imageMIMETypes[ext]; ok {
		w.Header().Set("Content-Type", mimeType)
	} else {
		// Default to JPEG for extracted embedded art (saved as .jpg).
		w.Header().Set("Content-Type", "image/jpeg")
	}

	http.ServeContent(w, r, filepath.Base(coverPath), modTime, f)
}
