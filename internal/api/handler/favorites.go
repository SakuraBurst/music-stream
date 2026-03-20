package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/api/middleware"
	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// FavoritesHandler handles favorites HTTP endpoints.
type FavoritesHandler struct {
	favoriteStore *sqlite.FavoriteStore
	logger        *slog.Logger
}

// NewFavoritesHandler creates a new FavoritesHandler.
func NewFavoritesHandler(favoriteStore *sqlite.FavoriteStore, logger *slog.Logger) *FavoritesHandler {
	return &FavoritesHandler{
		favoriteStore: favoriteStore,
		logger:        logger,
	}
}

type addFavoriteRequest struct {
	Type string `json:"type"` // "track", "album", "artist"
	ID   string `json:"id"`
}

// List handles GET /api/v1/favorites.
func (h *FavoritesHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	favorites, err := h.favoriteStore.ListByUser(r.Context(), userID)
	if err != nil {
		h.logger.Error("listing favorites failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	if favorites == nil {
		favorites = []model.Favorite{}
	}

	writeJSON(w, http.StatusOK, favorites)
}

// Add handles POST /api/v1/favorites.
func (h *FavoritesHandler) Add(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req addFavoriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid request body"})
		return
	}

	if req.Type == "" || req.ID == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "type and id are required"})
		return
	}

	// Validate type.
	switch req.Type {
	case "track", "album", "artist":
		// valid
	default:
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "type must be one of: track, album, artist"})
		return
	}

	fav := &model.Favorite{
		UserID:    userID,
		ItemType:  req.Type,
		ItemID:    req.ID,
		CreatedAt: time.Now(),
	}

	if err := h.favoriteStore.Add(r.Context(), fav); err != nil {
		h.logger.Error("adding favorite failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Remove handles DELETE /api/v1/favorites/{type}/{id}.
func (h *FavoritesHandler) Remove(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	itemType := chi.URLParam(r, "type")
	itemID := chi.URLParam(r, "id")

	// Validate type.
	switch itemType {
	case "track", "album", "artist":
		// valid
	default:
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "type must be one of: track, album, artist"})
		return
	}

	if err := h.favoriteStore.Remove(r.Context(), userID, itemType, itemID); err != nil {
		h.logger.Error("removing favorite failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
