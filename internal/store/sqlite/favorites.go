package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
)

// FavoriteStore implements store.FavoriteStore using SQLite.
type FavoriteStore struct {
	db *DB
}

// NewFavoriteStore creates a new FavoriteStore backed by the given SQLite database.
func NewFavoriteStore(db *DB) *FavoriteStore {
	return &FavoriteStore{db: db}
}

// Add inserts a favorite entry.
func (s *FavoriteStore) Add(ctx context.Context, fav *model.Favorite) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO favorites (user_id, item_type, item_id, created_at)
		 VALUES (?, ?, ?, ?)`,
		fav.UserID, fav.ItemType, fav.ItemID, fav.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("adding favorite: %w", err)
	}
	return nil
}

// Remove deletes a favorite entry.
func (s *FavoriteStore) Remove(ctx context.Context, userID, itemType, itemID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID,
	)
	if err != nil {
		return fmt.Errorf("removing favorite: %w", err)
	}
	return nil
}

// ListByUser returns all favorites for a given user, ordered by creation time (newest first).
func (s *FavoriteStore) ListByUser(ctx context.Context, userID string) ([]model.Favorite, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT user_id, item_type, item_id, created_at
		 FROM favorites WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing favorites by user: %w", err)
	}
	defer rows.Close()

	var favorites []model.Favorite
	for rows.Next() {
		var f model.Favorite
		if err := rows.Scan(&f.UserID, &f.ItemType, &f.ItemID, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning favorite: %w", err)
		}
		favorites = append(favorites, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating favorites: %w", err)
	}

	return favorites, nil
}

// Exists checks whether a specific favorite exists.
func (s *FavoriteStore) Exists(ctx context.Context, userID, itemType, itemID string) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID,
	).Scan(&count)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("checking favorite existence: %w", err)
	}
	return count > 0, nil
}
