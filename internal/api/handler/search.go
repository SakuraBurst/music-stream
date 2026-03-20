package handler

import (
	"log/slog"
	"net/http"

	"github.com/sakuraburst/sonus/internal/service"
)

// SearchHandler handles search HTTP endpoints.
type SearchHandler struct {
	search *service.SearchService
	logger *slog.Logger
}

// NewSearchHandler creates a new SearchHandler.
func NewSearchHandler(search *service.SearchService, logger *slog.Logger) *SearchHandler {
	return &SearchHandler{
		search: search,
		logger: logger,
	}
}

// Search handles GET /api/v1/search?q=term&type=all.
func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "query parameter 'q' is required"})
		return
	}

	searchType := r.URL.Query().Get("type")
	if searchType == "" {
		searchType = "all"
	}

	// Validate type parameter.
	switch searchType {
	case "all", "artist", "album", "track":
		// valid
	default:
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "type must be one of: all, artist, album, track"})
		return
	}

	result, err := h.search.Search(r.Context(), query, searchType)
	if err != nil {
		h.logger.Error("search failed", "error", err, "query", query, "type", searchType)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}
