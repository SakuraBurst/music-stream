package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/sakuraburst/sonus/internal/api"
	"github.com/sakuraburst/sonus/internal/auth"
	"github.com/sakuraburst/sonus/internal/config"
	"github.com/sakuraburst/sonus/internal/service"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
	"github.com/sakuraburst/sonus/web"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Auto-generate JWT secret if not provided.
	if cfg.Auth.JWTSecret == "" {
		secret, err := auth.GenerateSecret()
		if err != nil {
			logger.Error("failed to generate JWT secret", "error", err)
			os.Exit(1)
		}
		cfg.Auth.JWTSecret = secret
		logger.Warn("JWT secret auto-generated; set auth.jwt_secret in config for stable tokens across restarts")
	}

	cfg.LogSafe(logger)

	// Open SQLite database and run migrations.
	db, err := sqlite.Open(cfg.Server.DataDir, logger)
	if err != nil {
		logger.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create stores.
	userStore := sqlite.NewUserStore(db)
	artistStore := sqlite.NewArtistStore(db)
	albumStore := sqlite.NewAlbumStore(db)
	trackStore := sqlite.NewTrackStore(db)
	playlistStore := sqlite.NewPlaylistStore(db)
	favoriteStore := sqlite.NewFavoriteStore(db)
	historyStore := sqlite.NewHistoryStore(db)
	sessionStore := sqlite.NewSessionStore(db)

	// Create services.
	tokenManager := auth.NewTokenManager(cfg.Auth.JWTSecret, cfg.Auth.ParsedAccessTokenTTL())

	authService := service.NewAuthService(
		userStore,
		tokenManager,
		cfg.Auth.ParsedRefreshTokenTTL(),
		cfg.Auth.RegistrationEnabled,
		logger,
	)

	coverArtDir := filepath.Join(cfg.Server.DataDir, "coverart")
	coverArtService := service.NewCoverArtService(albumStore, trackStore, coverArtDir, logger)

	scannerService := service.NewScannerService(
		artistStore,
		albumStore,
		trackStore,
		coverArtService,
		cfg.Library.MusicDirs,
		4, // default worker count
		logger,
	)

	uploadsDir := filepath.Join(cfg.Server.DataDir, "uploads")
	uploadService := service.NewUploadService(artistStore, albumStore, trackStore, coverArtService, uploadsDir, logger)

	libraryService := service.NewLibraryService(artistStore, albumStore, trackStore)
	streamService := service.NewStreamService(trackStore)
	cacheMaxSize := cfg.Transcoding.ParsedCacheMaxSize()
	transcoderService := service.NewTranscoderService(cfg.Transcoding.FFmpegPath, cfg.Server.DataDir, cacheMaxSize, logger)
	searchService := service.NewSearchService(trackStore, artistStore, albumStore)
	playlistService := service.NewPlaylistService(playlistStore, trackStore, artistStore, albumStore)

	router := api.NewRouter(api.Deps{
		Logger:            logger,
		DevMode:           cfg.Dev,
		FrontendFS:        web.DistFS,
		AuthService:       authService,
		TokenManager:      tokenManager,
		ScannerService:    scannerService,
		LibraryService:    libraryService,
		StreamService:     streamService,
		TranscoderService: transcoderService,
		CoverArtService:   coverArtService,
		SearchService:     searchService,
		PlaylistService:   playlistService,
		UploadService:     uploadService,
		FavoriteStore:     favoriteStore,
		HistoryStore:      historyStore,
		SessionStore:      sessionStore,
	})

	// Start transcode cache evictor.
	transcoderService.StartCacheEvictor(context.Background())

	// Start scan on startup if configured.
	if cfg.Library.ScanOnStartup && len(cfg.Library.MusicDirs) > 0 {
		go func() {
			logger.Info("starting library scan on startup")
			if _, err := scannerService.Scan(context.Background()); err != nil {
				logger.Error("startup scan failed", "error", err)
			}
		}()
	}

	// Start periodic library scanning.
	scanInterval := cfg.Library.ParsedScanInterval()
	scannerService.StartPeriodicScan(context.Background(), scanInterval)

	srv := &http.Server{
		Addr:         cfg.Server.Address,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("starting HTTP server", "address", cfg.Server.Address)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	logger.Info("shutting down server", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("server shutdown error", "error", err)
		os.Exit(1)
	}

	// Stop periodic scanner and wait for any in-progress scan to finish.
	scannerService.StopPeriodicScan()

	// Stop the transcode cache evictor.
	transcoderService.StopCacheEvictor()

	logger.Info("server stopped gracefully")
}
