package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/api/middleware"
	"github.com/sakuraburst/sonus/internal/service"
)

// PlaylistHandler handles playlist HTTP endpoints.
type PlaylistHandler struct {
	playlist *service.PlaylistService
	logger   *slog.Logger
}

// NewPlaylistHandler creates a new PlaylistHandler.
func NewPlaylistHandler(playlist *service.PlaylistService, logger *slog.Logger) *PlaylistHandler {
	return &PlaylistHandler{
		playlist: playlist,
		logger:   logger,
	}
}

type createPlaylistRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type updatePlaylistRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type addTrackRequest struct {
	TrackID string `json:"trackId"`
}

// List handles GET /api/v1/playlists.
func (h *PlaylistHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	playlists, err := h.playlist.List(r.Context(), userID)
	if err != nil {
		h.logger.Error("listing playlists failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, playlists)
}

// Create handles POST /api/v1/playlists.
func (h *PlaylistHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req createPlaylistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "name is required"})
		return
	}

	playlist, err := h.playlist.Create(r.Context(), userID, req.Name, req.Description)
	if err != nil {
		h.logger.Error("creating playlist failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, playlist)
}

// Get handles GET /api/v1/playlists/{id}.
func (h *PlaylistHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	playlistID := chi.URLParam(r, "id")

	detail, err := h.playlist.Get(r.Context(), userID, playlistID)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "playlist not found"})
			return
		}
		if errors.Is(err, service.ErrPlaylistForbidden) {
			writeJSON(w, http.StatusForbidden, errorResponse{Error: "access denied"})
			return
		}
		h.logger.Error("getting playlist failed", "error", err, "id", playlistID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

// Update handles PUT /api/v1/playlists/{id}.
func (h *PlaylistHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	playlistID := chi.URLParam(r, "id")

	var req updatePlaylistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	playlist, err := h.playlist.Update(r.Context(), userID, playlistID, req.Name, req.Description)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "playlist not found"})
			return
		}
		if errors.Is(err, service.ErrPlaylistForbidden) {
			writeJSON(w, http.StatusForbidden, errorResponse{Error: "access denied"})
			return
		}
		h.logger.Error("updating playlist failed", "error", err, "id", playlistID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// Delete handles DELETE /api/v1/playlists/{id}.
func (h *PlaylistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	playlistID := chi.URLParam(r, "id")

	err := h.playlist.Delete(r.Context(), userID, playlistID)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "playlist not found"})
			return
		}
		if errors.Is(err, service.ErrPlaylistForbidden) {
			writeJSON(w, http.StatusForbidden, errorResponse{Error: "access denied"})
			return
		}
		h.logger.Error("deleting playlist failed", "error", err, "id", playlistID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// AddTrack handles POST /api/v1/playlists/{id}/tracks.
func (h *PlaylistHandler) AddTrack(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	playlistID := chi.URLParam(r, "id")

	var req addTrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.TrackID == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "trackId is required"})
		return
	}

	err := h.playlist.AddTrack(r.Context(), userID, playlistID, req.TrackID)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "playlist not found"})
			return
		}
		if errors.Is(err, service.ErrPlaylistForbidden) {
			writeJSON(w, http.StatusForbidden, errorResponse{Error: "access denied"})
			return
		}
		h.logger.Error("adding track to playlist failed", "error", err, "playlistID", playlistID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RemoveTrack handles DELETE /api/v1/playlists/{id}/tracks/{trackID}.
func (h *PlaylistHandler) RemoveTrack(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	playlistID := chi.URLParam(r, "id")
	trackID := chi.URLParam(r, "trackID")

	err := h.playlist.RemoveTrack(r.Context(), userID, playlistID, trackID)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "playlist not found"})
			return
		}
		if errors.Is(err, service.ErrPlaylistForbidden) {
			writeJSON(w, http.StatusForbidden, errorResponse{Error: "access denied"})
			return
		}
		h.logger.Error("removing track from playlist failed", "error", err, "playlistID", playlistID, "trackID", trackID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
