package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
)

// PlaylistStore implements store.PlaylistStore using SQLite.
type PlaylistStore struct {
	db *DB
}

// NewPlaylistStore creates a new PlaylistStore backed by the given SQLite database.
func NewPlaylistStore(db *DB) *PlaylistStore {
	return &PlaylistStore{db: db}
}

// Create inserts a new playlist into the database.
func (s *PlaylistStore) Create(ctx context.Context, playlist *model.Playlist) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO playlists (id, user_id, name, description, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		playlist.ID, playlist.UserID, playlist.Name, playlist.Description,
		playlist.CreatedAt, playlist.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting playlist: %w", err)
	}
	return nil
}

// Update modifies an existing playlist's name, description, and updated_at.
func (s *PlaylistStore) Update(ctx context.Context, playlist *model.Playlist) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
		playlist.Name, playlist.Description, playlist.UpdatedAt, playlist.ID,
	)
	if err != nil {
		return fmt.Errorf("updating playlist: %w", err)
	}
	return nil
}

// Delete removes a playlist by ID. Cascade deletes playlist_tracks rows.
func (s *PlaylistStore) Delete(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM playlists WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting playlist: %w", err)
	}
	return nil
}

// GetByID retrieves a playlist by its ID.
func (s *PlaylistStore) GetByID(ctx context.Context, id string) (*model.Playlist, error) {
	var p model.Playlist
	err := s.db.QueryRowContext(ctx,
		`SELECT id, user_id, name, COALESCE(description, ''), created_at, updated_at
		 FROM playlists WHERE id = ?`, id,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying playlist by id: %w", err)
	}
	return &p, nil
}

// ListByUser returns all playlists for a given user, ordered by creation time (newest first).
func (s *PlaylistStore) ListByUser(ctx context.Context, userID string) ([]model.Playlist, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, name, COALESCE(description, ''), created_at, updated_at
		 FROM playlists WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing playlists by user: %w", err)
	}
	defer rows.Close()

	var playlists []model.Playlist
	for rows.Next() {
		var p model.Playlist
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning playlist: %w", err)
		}
		playlists = append(playlists, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating playlists: %w", err)
	}

	return playlists, nil
}

// AddTrack inserts a track into a playlist at the given position.
func (s *PlaylistStore) AddTrack(ctx context.Context, pt *model.PlaylistTrack) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
		 VALUES (?, ?, ?, ?)`,
		pt.PlaylistID, pt.TrackID, pt.Position, pt.AddedAt,
	)
	if err != nil {
		return fmt.Errorf("adding track to playlist: %w", err)
	}
	return nil
}

// RemoveTrack removes a track from a playlist.
func (s *PlaylistStore) RemoveTrack(ctx context.Context, playlistID, trackID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
		playlistID, trackID,
	)
	if err != nil {
		return fmt.Errorf("removing track from playlist: %w", err)
	}
	return nil
}

// ListTracks returns all tracks in a playlist, ordered by position.
func (s *PlaylistStore) ListTracks(ctx context.Context, playlistID string) ([]model.PlaylistTrack, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT playlist_id, track_id, position, added_at
		 FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`,
		playlistID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing playlist tracks: %w", err)
	}
	defer rows.Close()

	var tracks []model.PlaylistTrack
	for rows.Next() {
		var pt model.PlaylistTrack
		if err := rows.Scan(&pt.PlaylistID, &pt.TrackID, &pt.Position, &pt.AddedAt); err != nil {
			return nil, fmt.Errorf("scanning playlist track: %w", err)
		}
		tracks = append(tracks, pt)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating playlist tracks: %w", err)
	}

	return tracks, nil
}

// MaxPosition returns the current maximum position in a playlist, or 0 if empty.
func (s *PlaylistStore) MaxPosition(ctx context.Context, playlistID string) (int, error) {
	var maxPos sql.NullInt64
	err := s.db.QueryRowContext(ctx,
		`SELECT MAX(position) FROM playlist_tracks WHERE playlist_id = ?`,
		playlistID,
	).Scan(&maxPos)
	if err != nil {
		return 0, fmt.Errorf("querying max position: %w", err)
	}
	if !maxPos.Valid {
		return 0, nil
	}
	return int(maxPos.Int64), nil
}
