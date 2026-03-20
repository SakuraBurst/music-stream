package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sakuraburst/sonus/internal/auth"
)

type contextKey string

const (
	// UserIDKey is the context key for the authenticated user's ID.
	UserIDKey contextKey = "userID"
	// UsernameKey is the context key for the authenticated user's username.
	UsernameKey contextKey = "username"
	// IsAdminKey is the context key for the authenticated user's admin status.
	IsAdminKey contextKey = "isAdmin"
)

// UserIDFromContext extracts the user ID from the request context.
func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(UserIDKey).(string)
	return v
}

// UsernameFromContext extracts the username from the request context.
func UsernameFromContext(ctx context.Context) string {
	v, _ := ctx.Value(UsernameKey).(string)
	return v
}

// IsAdminFromContext extracts the admin flag from the request context.
func IsAdminFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(IsAdminKey).(bool)
	return v
}

// Auth returns middleware that validates JWT tokens from the Authorization header
// or from a "token" query parameter (for stream/coverart endpoints).
func Auth(tm *auth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				writeUnauthorized(w, "missing or malformed authorization token")
				return
			}

			claims, err := tm.ValidateAccessToken(tokenStr)
			if err != nil {
				writeUnauthorized(w, "invalid or expired token")
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, UsernameKey, claims.Username)
			ctx = context.WithValue(ctx, IsAdminKey, claims.IsAdmin)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractToken gets the JWT from the Authorization header or the "token" query param.
func extractToken(r *http.Request) string {
	// 1. Check Authorization header: "Bearer <token>"
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			return strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	// 2. Fallback: check "token" query param (for HTML5 audio/img src).
	if token := r.URL.Query().Get("token"); token != "" {
		return token
	}

	return ""
}

// AdminOnly returns middleware that requires the authenticated user to be an admin.
// Must be used after the Auth middleware.
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsAdminFromContext(r.Context()) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "admin access required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeUnauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
