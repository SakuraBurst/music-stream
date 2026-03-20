package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/sakuraburst/sonus/internal/api/middleware"
	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/service"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// HistoryHandler handles listening history HTTP endpoints.
type HistoryHandler struct {
	historyStore *sqlite.HistoryStore
	logger       *slog.Logger
}

// NewHistoryHandler creates a new HistoryHandler.
func NewHistoryHandler(historyStore *sqlite.HistoryStore, logger *slog.Logger) *HistoryHandler {
	return &HistoryHandler{
		historyStore: historyStore,
		logger:       logger,
	}
}

type addHistoryRequest struct {
	TrackID  string `json:"trackId"`
	Duration int    `json:"duration"` // duration in seconds
}

// List handles GET /api/v1/history.
func (h *HistoryHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	opts := parsePagination(r)

	entries, total, err := h.historyStore.ListByUser(r.Context(), userID, opts)
	if err != nil {
		h.logger.Error("listing history failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	if entries == nil {
		entries = []model.ListeningHistory{}
	}

	writeJSON(w, http.StatusOK, &service.PaginatedResult[model.ListeningHistory]{
		Items:  entries,
		Total:  total,
		Limit:  opts.Limit,
		Offset: opts.Offset,
	})
}

// Add handles POST /api/v1/history.
func (h *HistoryHandler) Add(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req addHistoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.TrackID == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "trackId is required"})
		return
	}

	entry := &model.ListeningHistory{
		UserID:          userID,
		TrackID:         req.TrackID,
		PlayedAt:        time.Now(),
		DurationSeconds: req.Duration,
	}

	if err := h.historyStore.Add(r.Context(), entry); err != nil {
		h.logger.Error("adding history entry failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
