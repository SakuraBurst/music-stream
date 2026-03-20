package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/service"
	"github.com/sakuraburst/sonus/internal/store"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

// LibraryHandler handles library browsing HTTP endpoints.
type LibraryHandler struct {
	library *service.LibraryService
	logger  *slog.Logger
}

// NewLibraryHandler creates a new LibraryHandler.
func NewLibraryHandler(library *service.LibraryService, logger *slog.Logger) *LibraryHandler {
	return &LibraryHandler{
		library: library,
		logger:  logger,
	}
}

// ListArtists handles GET /api/v1/artists.
func (h *LibraryHandler) ListArtists(w http.ResponseWriter, r *http.Request) {
	opts := parsePagination(r)

	result, err := h.library.ListArtists(r.Context(), opts)
	if err != nil {
		h.logger.Error("listing artists failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetArtist handles GET /api/v1/artists/{id}.
func (h *LibraryHandler) GetArtist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result, err := h.library.GetArtist(r.Context(), id)
	if err != nil {
		h.logger.Error("getting artist failed", "error", err, "id", id)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}
	if result == nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "artist not found"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// ListAlbums handles GET /api/v1/albums.
func (h *LibraryHandler) ListAlbums(w http.ResponseWriter, r *http.Request) {
	opts := parsePagination(r)
	opts.ArtistID = r.URL.Query().Get("artist_id")

	result, err := h.library.ListAlbums(r.Context(), opts)
	if err != nil {
		h.logger.Error("listing albums failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetAlbum handles GET /api/v1/albums/{id}.
func (h *LibraryHandler) GetAlbum(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result, err := h.library.GetAlbum(r.Context(), id)
	if err != nil {
		h.logger.Error("getting album failed", "error", err, "id", id)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}
	if result == nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "album not found"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// ListTracks handles GET /api/v1/tracks.
func (h *LibraryHandler) ListTracks(w http.ResponseWriter, r *http.Request) {
	opts := parsePagination(r)
	opts.AlbumID = r.URL.Query().Get("album_id")
	opts.ArtistID = r.URL.Query().Get("artist_id")

	result, err := h.library.ListTracks(r.Context(), opts)
	if err != nil {
		h.logger.Error("listing tracks failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetTrack handles GET /api/v1/tracks/{id}.
func (h *LibraryHandler) GetTrack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result, err := h.library.GetTrack(r.Context(), id)
	if err != nil {
		h.logger.Error("getting track failed", "error", err, "id", id)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}
	if result == nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "track not found"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// parsePagination extracts limit and offset from query parameters.
func parsePagination(r *http.Request) store.ListOptions {
	limit := defaultLimit
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	offset := 0
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	return store.ListOptions{
		Limit:  limit,
		Offset: offset,
	}
}
