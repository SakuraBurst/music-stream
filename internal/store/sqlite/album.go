package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store"
)

// AlbumStore implements store.AlbumStore using SQLite.
type AlbumStore struct {
	db *DB
}

// NewAlbumStore creates a new AlbumStore backed by the given SQLite database.
func NewAlbumStore(db *DB) *AlbumStore {
	return &AlbumStore{db: db}
}

// Create inserts a new album into the database.
func (s *AlbumStore) Create(ctx context.Context, album *model.Album) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO albums (id, artist_id, name, year, genre, cover_art_path, track_count, duration_seconds, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		album.ID, album.ArtistID, album.Name, album.Year, album.Genre,
		album.CoverArtPath, album.TrackCount, album.DurationSeconds, album.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting album: %w", err)
	}
	return nil
}

// Update modifies an existing album.
func (s *AlbumStore) Update(ctx context.Context, album *model.Album) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE albums SET artist_id = ?, name = ?, year = ?, genre = ?, cover_art_path = ?,
		 track_count = ?, duration_seconds = ? WHERE id = ?`,
		album.ArtistID, album.Name, album.Year, album.Genre,
		album.CoverArtPath, album.TrackCount, album.DurationSeconds, album.ID,
	)
	if err != nil {
		return fmt.Errorf("updating album: %w", err)
	}
	return nil
}

// Delete removes an album by ID.
func (s *AlbumStore) Delete(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM albums WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting album: %w", err)
	}
	return nil
}

// GetByID retrieves an album by its ID.
func (s *AlbumStore) GetByID(ctx context.Context, id string) (*model.Album, error) {
	var a model.Album
	err := s.db.QueryRowContext(ctx,
		`SELECT id, artist_id, name, year, genre, cover_art_path, track_count, duration_seconds, created_at
		 FROM albums WHERE id = ?`, id,
	).Scan(&a.ID, &a.ArtistID, &a.Name, &a.Year, &a.Genre,
		&a.CoverArtPath, &a.TrackCount, &a.DurationSeconds, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying album by id: %w", err)
	}
	return &a, nil
}

// GetByArtistAndName retrieves an album by artist ID and album name (case-insensitive).
func (s *AlbumStore) GetByArtistAndName(ctx context.Context, artistID, name string) (*model.Album, error) {
	var a model.Album
	err := s.db.QueryRowContext(ctx,
		`SELECT id, artist_id, name, year, genre, cover_art_path, track_count, duration_seconds, created_at
		 FROM albums WHERE artist_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`, artistID, name,
	).Scan(&a.ID, &a.ArtistID, &a.Name, &a.Year, &a.Genre,
		&a.CoverArtPath, &a.TrackCount, &a.DurationSeconds, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying album by artist and name: %w", err)
	}
	return &a, nil
}

// List returns a paginated list of albums and total count.
// If opts.ArtistID is set, filters by artist.
func (s *AlbumStore) List(ctx context.Context, opts store.ListOptions) ([]model.Album, int, error) {
	var total int
	var args []any

	countQuery := `SELECT COUNT(*) FROM albums`
	listQuery := `SELECT id, artist_id, name, year, genre, cover_art_path, track_count, duration_seconds, created_at FROM albums`

	if opts.ArtistID != "" {
		countQuery += ` WHERE artist_id = ?`
		listQuery += ` WHERE artist_id = ?`
		args = append(args, opts.ArtistID)
	}

	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting albums: %w", err)
	}

	listQuery += ` ORDER BY name LIMIT ? OFFSET ?`
	listArgs := append(args, opts.Limit, opts.Offset)

	rows, err := s.db.QueryContext(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing albums: %w", err)
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		if err := rows.Scan(&a.ID, &a.ArtistID, &a.Name, &a.Year, &a.Genre,
			&a.CoverArtPath, &a.TrackCount, &a.DurationSeconds, &a.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning album: %w", err)
		}
		albums = append(albums, a)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating albums: %w", err)
	}

	return albums, total, nil
}

// ListByArtist returns all albums for a given artist.
func (s *AlbumStore) ListByArtist(ctx context.Context, artistID string) ([]model.Album, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, artist_id, name, year, genre, cover_art_path, track_count, duration_seconds, created_at
		 FROM albums WHERE artist_id = ? ORDER BY year, name`,
		artistID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing albums by artist: %w", err)
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		if err := rows.Scan(&a.ID, &a.ArtistID, &a.Name, &a.Year, &a.Genre,
			&a.CoverArtPath, &a.TrackCount, &a.DurationSeconds, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning album: %w", err)
		}
		albums = append(albums, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating albums: %w", err)
	}

	return albums, nil
}

// DeleteOrphans removes albums that have no associated tracks.
func (s *AlbumStore) DeleteOrphans(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx,
		`DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)`,
	)
	if err != nil {
		return 0, fmt.Errorf("deleting orphan albums: %w", err)
	}
	return result.RowsAffected()
}

// RecalcStats recalculates track_count and duration_seconds for an album.
func (s *AlbumStore) RecalcStats(ctx context.Context, albumID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE albums SET
			track_count = (SELECT COUNT(*) FROM tracks WHERE album_id = ?),
			duration_seconds = (SELECT COALESCE(SUM(duration_seconds), 0) FROM tracks WHERE album_id = ?)
		 WHERE id = ?`,
		albumID, albumID, albumID,
	)
	if err != nil {
		return fmt.Errorf("recalculating album stats: %w", err)
	}
	return nil
}
