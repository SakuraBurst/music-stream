package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
)

// UserStore implements store.UserStore using SQLite.
type UserStore struct {
	db *DB
}

// NewUserStore creates a new UserStore backed by the given SQLite database.
func NewUserStore(db *DB) *UserStore {
	return &UserStore{db: db}
}

// Create inserts a new user into the database.
func (s *UserStore) Create(ctx context.Context, user *model.User) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.PasswordHash, user.IsAdmin, user.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting user: %w", err)
	}
	return nil
}

// GetByID retrieves a user by their ID.
func (s *UserStore) GetByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, is_admin, created_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying user by id: %w", err)
	}
	return &u, nil
}

// GetByUsername retrieves a user by their username.
func (s *UserStore) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var u model.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, is_admin, created_at FROM users WHERE username = ?`, username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying user by username: %w", err)
	}
	return &u, nil
}

// CountUsers returns the total number of users in the database.
func (s *UserStore) CountUsers(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting users: %w", err)
	}
	return count, nil
}

// CreateRefreshToken inserts a new refresh token.
func (s *UserStore) CreateRefreshToken(ctx context.Context, token *model.RefreshToken) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		token.Token, token.UserID, token.ExpiresAt, token.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting refresh token: %w", err)
	}
	return nil
}

// GetRefreshToken retrieves a refresh token by its value.
func (s *UserStore) GetRefreshToken(ctx context.Context, token string) (*model.RefreshToken, error) {
	var rt model.RefreshToken
	err := s.db.QueryRowContext(ctx,
		`SELECT token, user_id, expires_at, created_at FROM refresh_tokens WHERE token = ?`, token,
	).Scan(&rt.Token, &rt.UserID, &rt.ExpiresAt, &rt.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying refresh token: %w", err)
	}
	return &rt, nil
}

// DeleteRefreshToken removes a specific refresh token.
func (s *UserStore) DeleteRefreshToken(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE token = ?`, token,
	)
	if err != nil {
		return fmt.Errorf("deleting refresh token: %w", err)
	}
	return nil
}

// DeleteUserRefreshTokens removes all refresh tokens for a given user.
func (s *UserStore) DeleteUserRefreshTokens(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE user_id = ?`, userID,
	)
	if err != nil {
		return fmt.Errorf("deleting user refresh tokens: %w", err)
	}
	return nil
}
