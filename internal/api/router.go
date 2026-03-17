package api

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/api/middleware"
)

// NewRouter creates and configures the chi router with middleware and routes.
func NewRouter(logger *slog.Logger) http.Handler {
	r := chi.NewRouter()

	// Middleware chain
	r.Use(middleware.Logging(logger))
	r.Use(middleware.CORS)

	// Health check - outside /api/v1 for simplicity
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// API v1 routes will be registered here as handlers are implemented
	r.Route("/api/v1", func(r chi.Router) {
		// Placeholder: routes will be added in subsequent tasks
	})

	return r
}
