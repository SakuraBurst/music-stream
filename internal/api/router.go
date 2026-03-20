package api

import (
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/sakuraburst/sonus/internal/api/handler"
	"github.com/sakuraburst/sonus/internal/api/middleware"
	"github.com/sakuraburst/sonus/internal/auth"
	"github.com/sakuraburst/sonus/internal/service"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// Deps holds all dependencies required by the HTTP router.
type Deps struct {
	Logger             *slog.Logger
	DevMode            bool
	FrontendFS         fs.FS // embedded web/dist FS; nil in dev mode
	AuthService        *service.AuthService
	TokenManager       *auth.TokenManager
	ScannerService     *service.ScannerService
	LibraryService     *service.LibraryService
	StreamService      *service.StreamService
	TranscoderService  *service.TranscoderService
	CoverArtService    *service.CoverArtService
	SearchService      *service.SearchService
	PlaylistService    *service.PlaylistService
	FavoriteStore      *sqlite.FavoriteStore
	HistoryStore       *sqlite.HistoryStore
}

// NewRouter creates and configures the chi router with middleware and routes.
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	// Middleware chain
	r.Use(middleware.Logging(deps.Logger))
	r.Use(middleware.CORS)

	// Health check - outside /api/v1 for simplicity
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	authHandler := handler.NewAuthHandler(deps.AuthService, deps.Logger)
	adminHandler := handler.NewAdminHandler(deps.ScannerService, deps.Logger)
	libraryHandler := handler.NewLibraryHandler(deps.LibraryService, deps.Logger)
	streamHandler := handler.NewStreamHandler(deps.StreamService, deps.TranscoderService, deps.Logger)
	coverArtHandler := handler.NewCoverArtHandler(deps.CoverArtService, deps.Logger)
	searchHandler := handler.NewSearchHandler(deps.SearchService, deps.Logger)
	playlistHandler := handler.NewPlaylistHandler(deps.PlaylistService, deps.Logger)
	favoritesHandler := handler.NewFavoritesHandler(deps.FavoriteStore, deps.Logger)
	historyHandler := handler.NewHistoryHandler(deps.HistoryStore, deps.Logger)
	authMiddleware := middleware.Auth(deps.TokenManager)

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public auth routes
		r.Post("/auth/register", authHandler.Register)
		r.Post("/auth/login", authHandler.Login)
		r.Post("/auth/refresh", authHandler.Refresh)

		// Protected routes (require valid JWT)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)

			// Library browsing
			r.Get("/artists", libraryHandler.ListArtists)
			r.Get("/artists/{id}", libraryHandler.GetArtist)
			r.Get("/albums", libraryHandler.ListAlbums)
			r.Get("/albums/{id}", libraryHandler.GetAlbum)
			r.Get("/tracks", libraryHandler.ListTracks)
			r.Get("/tracks/{id}", libraryHandler.GetTrack)

			// Search
			r.Get("/search", searchHandler.Search)

			// Playlists
			r.Get("/playlists", playlistHandler.List)
			r.Post("/playlists", playlistHandler.Create)
			r.Get("/playlists/{id}", playlistHandler.Get)
			r.Put("/playlists/{id}", playlistHandler.Update)
			r.Delete("/playlists/{id}", playlistHandler.Delete)
			r.Post("/playlists/{id}/tracks", playlistHandler.AddTrack)
			r.Delete("/playlists/{id}/tracks/{trackID}", playlistHandler.RemoveTrack)

			// Favorites
			r.Get("/favorites", favoritesHandler.List)
			r.Post("/favorites", favoritesHandler.Add)
			r.Delete("/favorites/{type}/{id}", favoritesHandler.Remove)

			// History
			r.Get("/history", historyHandler.List)
			r.Post("/history", historyHandler.Add)

			// Streaming
			r.Get("/stream/{trackID}", streamHandler.Stream)

			// Cover art
			r.Get("/coverart/{albumID}", coverArtHandler.GetCoverArt)

			// Admin-only routes
			r.Route("/admin", func(r chi.Router) {
				r.Use(middleware.AdminOnly)
				r.Post("/scan", adminHandler.StartScan)
				r.Get("/scan/status", adminHandler.ScanStatus)
			})
		})
	})

	// Serve the embedded React frontend in production mode.
	// In dev mode (SONUS_DEV=true), the frontend runs on a separate Vite
	// dev server and proxies API calls to this backend, so we skip mounting.
	if !deps.DevMode && deps.FrontendFS != nil {
		fe := frontendHandler(deps.FrontendFS, deps.Logger)
		r.NotFound(fe.ServeHTTP)
		deps.Logger.Info("serving embedded frontend")
	}

	return r
}
