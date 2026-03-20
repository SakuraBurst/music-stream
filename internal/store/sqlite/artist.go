package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store"
)

// ArtistStore implements store.ArtistStore using SQLite.
type ArtistStore struct {
	db *DB
}

// NewArtistStore creates a new ArtistStore backed by the given SQLite database.
func NewArtistStore(db *DB) *ArtistStore {
	return &ArtistStore{db: db}
}

// Create inserts a new artist into the database.
func (s *ArtistStore) Create(ctx context.Context, artist *model.Artist) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO artists (id, name, sort_name, created_at) VALUES (?, ?, ?, ?)`,
		artist.ID, artist.Name, artist.SortName, artist.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting artist: %w", err)
	}
	return nil
}

// Update modifies an existing artist.
func (s *ArtistStore) Update(ctx context.Context, artist *model.Artist) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE artists SET name = ?, sort_name = ? WHERE id = ?`,
		artist.Name, artist.SortName, artist.ID,
	)
	if err != nil {
		return fmt.Errorf("updating artist: %w", err)
	}
	return nil
}

// Delete removes an artist by ID.
func (s *ArtistStore) Delete(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM artists WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting artist: %w", err)
	}
	return nil
}

// GetByID retrieves an artist by their ID.
func (s *ArtistStore) GetByID(ctx context.Context, id string) (*model.Artist, error) {
	var a model.Artist
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, sort_name, created_at FROM artists WHERE id = ?`, id,
	).Scan(&a.ID, &a.Name, &a.SortName, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying artist by id: %w", err)
	}
	return &a, nil
}

// GetByName retrieves an artist by normalized name (case-insensitive, trimmed).
func (s *ArtistStore) GetByName(ctx context.Context, name string) (*model.Artist, error) {
	var a model.Artist
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, sort_name, created_at FROM artists WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, name,
	).Scan(&a.ID, &a.Name, &a.SortName, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying artist by name: %w", err)
	}
	return &a, nil
}

// List returns a paginated list of artists and total count.
func (s *ArtistStore) List(ctx context.Context, opts store.ListOptions) ([]model.Artist, int, error) {
	var total int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM artists`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting artists: %w", err)
	}

	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, sort_name, created_at FROM artists ORDER BY COALESCE(NULLIF(sort_name, ''), name) LIMIT ? OFFSET ?`,
		opts.Limit, opts.Offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("listing artists: %w", err)
	}
	defer rows.Close()

	var artists []model.Artist
	for rows.Next() {
		var a model.Artist
		if err := rows.Scan(&a.ID, &a.Name, &a.SortName, &a.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning artist: %w", err)
		}
		artists = append(artists, a)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating artists: %w", err)
	}

	return artists, total, nil
}

// DeleteOrphans removes artists that have no associated albums.
func (s *ArtistStore) DeleteOrphans(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx,
		`DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM albums)`,
	)
	if err != nil {
		return 0, fmt.Errorf("deleting orphan artists: %w", err)
	}
	return result.RowsAffected()
}
