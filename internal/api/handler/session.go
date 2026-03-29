package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/sakuraburst/sonus/internal/api/middleware"
	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// SessionHandler handles playback session sync HTTP endpoints.
type SessionHandler struct {
	sessionStore *sqlite.SessionStore
	logger       *slog.Logger
}

// NewSessionHandler creates a new SessionHandler.
func NewSessionHandler(sessionStore *sqlite.SessionStore, logger *slog.Logger) *SessionHandler {
	return &SessionHandler{
		sessionStore: sessionStore,
		logger:       logger,
	}
}

type saveSessionRequest struct {
	TrackID       string   `json:"trackId"`
	Position      float64  `json:"position"`
	QueueTrackIDs []string `json:"queueTrackIds"`
	IsPlaying     bool     `json:"isPlaying"`
	Volume        float64  `json:"volume"`
	Shuffle       bool     `json:"shuffle"`
	Repeat        string   `json:"repeat"` // "none", "all", "one"
}

// Save handles PUT /api/v1/session — upserts the playback session for the authenticated user.
func (h *SessionHandler) Save(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req saveSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.TrackID == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "trackId is required"})
		return
	}

	repeatMode := req.Repeat
	if repeatMode == "" {
		repeatMode = "none"
	}
	if repeatMode != "none" && repeatMode != "all" && repeatMode != "one" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "repeat must be one of: none, all, one"})
		return
	}

	queueIDs := req.QueueTrackIDs
	if queueIDs == nil {
		queueIDs = []string{}
	}

	session := &model.PlaybackSession{
		UserID:          userID,
		TrackID:         req.TrackID,
		PositionSeconds: req.Position,
		QueueTrackIDs:   queueIDs,
		IsPlaying:       req.IsPlaying,
		Volume:          req.Volume,
		Shuffle:         req.Shuffle,
		RepeatMode:      repeatMode,
	}

	if err := h.sessionStore.Upsert(r.Context(), session); err != nil {
		h.logger.Error("saving playback session failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Get handles GET /api/v1/session — returns the saved playback session for the authenticated user.
func (h *SessionHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	session, err := h.sessionStore.GetByUserID(r.Context(), userID)
	if err != nil {
		h.logger.Error("getting playback session failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	if session == nil {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "no playback session found"})
		return
	}

	writeJSON(w, http.StatusOK, session)
}
