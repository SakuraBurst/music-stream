package api

import (
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"
)

// frontendHandler serves the embedded React frontend with SPA fallback.
// Static files (JS, CSS, images, etc.) are served with cache headers.
// Non-API routes that don't match a static file return index.html so
// that React Router can handle client-side routing.
func frontendHandler(distFS fs.FS, logger *slog.Logger) http.Handler {
	// Strip the "dist" prefix so files are served from /.
	stripped, err := fs.Sub(distFS, "dist")
	if err != nil {
		logger.Error("failed to create sub-FS for web/dist", "error", err)
		// Return a handler that always 500s rather than panicking.
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "frontend not available", http.StatusInternalServerError)
		})
	}

	fileServer := http.FileServer(http.FS(stripped))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Clean the URL path.
		upath := r.URL.Path
		if !strings.HasPrefix(upath, "/") {
			upath = "/" + upath
		}
		upath = path.Clean(upath)

		// Try to open the file in the embedded FS.
		// If it exists, serve it (with cache headers for hashed assets).
		name := strings.TrimPrefix(upath, "/")
		if name == "" {
			name = "."
		}

		f, err := stripped.Open(name)
		if err == nil {
			f.Close()

			// Hashed asset files (e.g., assets/index-D-5vUMrZ.js) are
			// immutable — cache aggressively. index.html must never be cached
			// because it references the hashed assets.
			if strings.HasPrefix(upath, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else if upath == "/" || upath == "/index.html" {
				w.Header().Set("Cache-Control", "no-cache")
			}

			fileServer.ServeHTTP(w, r)
			return
		}

		// File not found in the embedded FS — serve index.html (SPA fallback).
		// React Router will handle the route on the client side.
		w.Header().Set("Cache-Control", "no-cache")
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
