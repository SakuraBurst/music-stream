package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/sakuraburst/sonus/internal/model"
)

// SessionStore implements store.SessionStore using SQLite.
type SessionStore struct {
	db *DB
}

// NewSessionStore creates a new SessionStore backed by the given SQLite database.
func NewSessionStore(db *DB) *SessionStore {
	return &SessionStore{db: db}
}

// Upsert inserts or replaces the playback session for a user.
func (s *SessionStore) Upsert(ctx context.Context, session *model.PlaybackSession) error {
	queueJSON, err := json.Marshal(session.QueueTrackIDs)
	if err != nil {
		return fmt.Errorf("marshaling queue track IDs: %w", err)
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO playback_sessions (user_id, track_id, position_seconds, queue_track_ids, is_playing, volume, shuffle, repeat_mode, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET
		   track_id = excluded.track_id,
		   position_seconds = excluded.position_seconds,
		   queue_track_ids = excluded.queue_track_ids,
		   is_playing = excluded.is_playing,
		   volume = excluded.volume,
		   shuffle = excluded.shuffle,
		   repeat_mode = excluded.repeat_mode,
		   updated_at = excluded.updated_at`,
		session.UserID,
		session.TrackID,
		session.PositionSeconds,
		string(queueJSON),
		session.IsPlaying,
		session.Volume,
		session.Shuffle,
		session.RepeatMode,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("upserting playback session: %w", err)
	}
	return nil
}

// GetByUserID returns the playback session for a user, or nil if none exists.
func (s *SessionStore) GetByUserID(ctx context.Context, userID string) (*model.PlaybackSession, error) {
	var session model.PlaybackSession
	var queueJSON string

	err := s.db.QueryRowContext(ctx,
		`SELECT user_id, track_id, position_seconds, queue_track_ids, is_playing, volume, shuffle, repeat_mode, updated_at
		 FROM playback_sessions WHERE user_id = ?`,
		userID,
	).Scan(
		&session.UserID,
		&session.TrackID,
		&session.PositionSeconds,
		&queueJSON,
		&session.IsPlaying,
		&session.Volume,
		&session.Shuffle,
		&session.RepeatMode,
		&session.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("getting playback session: %w", err)
	}

	if err := json.Unmarshal([]byte(queueJSON), &session.QueueTrackIDs); err != nil {
		return nil, fmt.Errorf("unmarshaling queue track IDs: %w", err)
	}

	return &session, nil
}
