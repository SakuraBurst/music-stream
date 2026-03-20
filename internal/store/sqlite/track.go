package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store"
)

// TrackStore implements store.TrackStore using SQLite.
type TrackStore struct {
	db *DB
}

// NewTrackStore creates a new TrackStore backed by the given SQLite database.
func NewTrackStore(db *DB) *TrackStore {
	return &TrackStore{db: db}
}

// Create inserts a new track into the database.
func (s *TrackStore) Create(ctx context.Context, track *model.Track) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO tracks (id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		track.ID, track.AlbumID, track.ArtistID, track.Title, track.TrackNumber,
		track.DiscNumber, track.DurationSeconds, track.FilePath, track.FileSize,
		track.Format, track.Bitrate, track.SampleRate, track.CreatedAt, track.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting track: %w", err)
	}
	return nil
}

// Update modifies an existing track.
func (s *TrackStore) Update(ctx context.Context, track *model.Track) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE tracks SET album_id = ?, artist_id = ?, title = ?, track_number = ?, disc_number = ?,
		 duration_seconds = ?, file_path = ?, file_size = ?, format = ?, bitrate = ?, sample_rate = ?,
		 updated_at = ? WHERE id = ?`,
		track.AlbumID, track.ArtistID, track.Title, track.TrackNumber, track.DiscNumber,
		track.DurationSeconds, track.FilePath, track.FileSize, track.Format,
		track.Bitrate, track.SampleRate, track.UpdatedAt, track.ID,
	)
	if err != nil {
		return fmt.Errorf("updating track: %w", err)
	}
	return nil
}

// Delete removes a track by ID.
func (s *TrackStore) Delete(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM tracks WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting track: %w", err)
	}
	return nil
}

// GetByID retrieves a track by its ID.
func (s *TrackStore) GetByID(ctx context.Context, id string) (*model.Track, error) {
	var t model.Track
	err := s.db.QueryRowContext(ctx,
		`SELECT id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at
		 FROM tracks WHERE id = ?`, id,
	).Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
		&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
		&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying track by id: %w", err)
	}
	return &t, nil
}

// GetByFilePath retrieves a track by its file path.
func (s *TrackStore) GetByFilePath(ctx context.Context, filePath string) (*model.Track, error) {
	var t model.Track
	err := s.db.QueryRowContext(ctx,
		`SELECT id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at
		 FROM tracks WHERE file_path = ?`, filePath,
	).Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
		&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
		&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying track by file path: %w", err)
	}
	return &t, nil
}

// List returns a paginated list of tracks and total count.
// If opts.AlbumID or opts.ArtistID are set, filters by those fields.
func (s *TrackStore) List(ctx context.Context, opts store.ListOptions) ([]model.Track, int, error) {
	var total int
	var conditions []string
	var args []any

	if opts.AlbumID != "" {
		conditions = append(conditions, "album_id = ?")
		args = append(args, opts.AlbumID)
	}
	if opts.ArtistID != "" {
		conditions = append(conditions, "artist_id = ?")
		args = append(args, opts.ArtistID)
	}

	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tracks`+where, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting tracks: %w", err)
	}

	query := `SELECT id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at
		 FROM tracks` + where + ` ORDER BY title LIMIT ? OFFSET ?`
	listArgs := append(args, opts.Limit, opts.Offset)

	rows, err := s.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tracks: %w", err)
	}
	defer rows.Close()

	var tracks []model.Track
	for rows.Next() {
		var t model.Track
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
			&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
			&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning track: %w", err)
		}
		tracks = append(tracks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating tracks: %w", err)
	}

	return tracks, total, nil
}

// ListByAlbum returns all tracks for a given album, ordered by disc and track number.
func (s *TrackStore) ListByAlbum(ctx context.Context, albumID string) ([]model.Track, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at
		 FROM tracks WHERE album_id = ? ORDER BY disc_number, track_number`,
		albumID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tracks by album: %w", err)
	}
	defer rows.Close()

	var tracks []model.Track
	for rows.Next() {
		var t model.Track
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
			&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
			&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning track: %w", err)
		}
		tracks = append(tracks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tracks: %w", err)
	}

	return tracks, nil
}

// ListByArtist returns all tracks for a given artist.
func (s *TrackStore) ListByArtist(ctx context.Context, artistID string) ([]model.Track, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, album_id, artist_id, title, track_number, disc_number,
		 duration_seconds, file_path, file_size, format, bitrate, sample_rate, created_at, updated_at
		 FROM tracks WHERE artist_id = ? ORDER BY title`,
		artistID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tracks by artist: %w", err)
	}
	defer rows.Close()

	var tracks []model.Track
	for rows.Next() {
		var t model.Track
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
			&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
			&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning track: %w", err)
		}
		tracks = append(tracks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tracks: %w", err)
	}

	return tracks, nil
}

// AllFilePaths returns all tracked file paths (for diff during scan).
func (s *TrackStore) AllFilePaths(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, file_path FROM tracks`)
	if err != nil {
		return nil, fmt.Errorf("querying all file paths: %w", err)
	}
	defer rows.Close()

	paths := make(map[string]string)
	for rows.Next() {
		var id, fp string
		if err := rows.Scan(&id, &fp); err != nil {
			return nil, fmt.Errorf("scanning file path: %w", err)
		}
		paths[fp] = id
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating file paths: %w", err)
	}

	return paths, nil
}

// SearchFTS performs a full-text search and returns matching tracks, ordered by FTS5 rank.
func (s *TrackStore) SearchFTS(ctx context.Context, ftsQuery string, limit int) ([]model.Track, error) {
	if ftsQuery == "" {
		return nil, nil
	}

	rows, err := s.db.QueryContext(ctx,
		`SELECT t.id, t.album_id, t.artist_id, t.title, t.track_number, t.disc_number,
		 t.duration_seconds, t.file_path, t.file_size, t.format, t.bitrate, t.sample_rate,
		 t.created_at, t.updated_at
		 FROM tracks_fts fts
		 JOIN tracks t ON t.rowid = fts.rowid
		 WHERE tracks_fts MATCH ?
		 ORDER BY rank
		 LIMIT ?`,
		ftsQuery, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("FTS search tracks: %w", err)
	}
	defer rows.Close()

	var tracks []model.Track
	for rows.Next() {
		var t model.Track
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.ArtistID, &t.Title, &t.TrackNumber, &t.DiscNumber,
			&t.DurationSeconds, &t.FilePath, &t.FileSize, &t.Format,
			&t.Bitrate, &t.SampleRate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning FTS track: %w", err)
		}
		tracks = append(tracks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating FTS tracks: %w", err)
	}

	return tracks, nil
}

// SearchFTSArtistIDs returns distinct artist IDs from tracks matching the FTS query.
func (s *TrackStore) SearchFTSArtistIDs(ctx context.Context, ftsQuery string, limit int) ([]string, error) {
	if ftsQuery == "" {
		return nil, nil
	}

	rows, err := s.db.QueryContext(ctx,
		`SELECT DISTINCT t.artist_id
		 FROM tracks_fts fts
		 JOIN tracks t ON t.rowid = fts.rowid
		 WHERE tracks_fts MATCH ?
		 LIMIT ?`,
		ftsQuery, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("FTS search artist IDs: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning FTS artist ID: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating FTS artist IDs: %w", err)
	}

	return ids, nil
}

// SearchFTSAlbumIDs returns distinct album IDs from tracks matching the FTS query.
func (s *TrackStore) SearchFTSAlbumIDs(ctx context.Context, ftsQuery string, limit int) ([]string, error) {
	if ftsQuery == "" {
		return nil, nil
	}

	rows, err := s.db.QueryContext(ctx,
		`SELECT DISTINCT t.album_id
		 FROM tracks_fts fts
		 JOIN tracks t ON t.rowid = fts.rowid
		 WHERE tracks_fts MATCH ?
		 LIMIT ?`,
		ftsQuery, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("FTS search album IDs: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning FTS album ID: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating FTS album IDs: %w", err)
	}

	return ids, nil
}

// ftsEntry holds data for a single FTS5 index entry.
type ftsEntry struct {
	rowid      int64
	title      string
	artistName string
	albumName  string
}

// RebuildFTS rebuilds the FTS5 index for track search.
// It reads all track data first, then does a batch insert to avoid
// holding a query cursor open while writing (which deadlocks with MaxOpenConns=1).
func (s *TrackStore) RebuildFTS(ctx context.Context) error {
	// Delete all existing FTS entries.
	if _, err := s.db.ExecContext(ctx,
		`DELETE FROM tracks_fts`,
	); err != nil {
		return fmt.Errorf("clearing FTS index: %w", err)
	}

	// Read all track data into memory first (close cursor before writing).
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.rowid, t.title, COALESCE(ar.name, ''), COALESCE(al.name, '')
		 FROM tracks t
		 LEFT JOIN artists ar ON t.artist_id = ar.id
		 LEFT JOIN albums al ON t.album_id = al.id`,
	)
	if err != nil {
		return fmt.Errorf("querying tracks for FTS rebuild: %w", err)
	}

	var entries []ftsEntry
	for rows.Next() {
		var e ftsEntry
		if err := rows.Scan(&e.rowid, &e.title, &e.artistName, &e.albumName); err != nil {
			rows.Close()
			return fmt.Errorf("scanning track for FTS: %w", err)
		}
		entries = append(entries, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating tracks for FTS: %w", err)
	}

	// Now insert into FTS without holding any cursor open.
	for _, e := range entries {
		if _, err := s.db.ExecContext(ctx,
			`INSERT INTO tracks_fts (rowid, title, artist_name, album_name) VALUES (?, ?, ?, ?)`,
			e.rowid, e.title, e.artistName, e.albumName,
		); err != nil {
			return fmt.Errorf("inserting into FTS: %w", err)
		}
	}

	return nil
}
