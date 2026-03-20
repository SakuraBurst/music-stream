package sqlite

import (
	"context"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store"
)

// HistoryStore implements store.HistoryStore using SQLite.
type HistoryStore struct {
	db *DB
}

// NewHistoryStore creates a new HistoryStore backed by the given SQLite database.
func NewHistoryStore(db *DB) *HistoryStore {
	return &HistoryStore{db: db}
}

// Add inserts a listening history entry.
func (s *HistoryStore) Add(ctx context.Context, entry *model.ListeningHistory) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO listening_history (user_id, track_id, played_at, duration_seconds)
		 VALUES (?, ?, ?, ?)`,
		entry.UserID, entry.TrackID, entry.PlayedAt, entry.DurationSeconds,
	)
	if err != nil {
		return fmt.Errorf("adding listening history: %w", err)
	}
	return nil
}

// ListByUser returns a paginated list of listening history for a user, ordered by played_at DESC.
func (s *HistoryStore) ListByUser(ctx context.Context, userID string, opts store.ListOptions) ([]model.ListeningHistory, int, error) {
	var total int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM listening_history WHERE user_id = ?`, userID,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting history entries: %w", err)
	}

	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, track_id, played_at, COALESCE(duration_seconds, 0)
		 FROM listening_history WHERE user_id = ?
		 ORDER BY played_at DESC
		 LIMIT ? OFFSET ?`,
		userID, opts.Limit, opts.Offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("listing history by user: %w", err)
	}
	defer rows.Close()

	var entries []model.ListeningHistory
	for rows.Next() {
		var h model.ListeningHistory
		if err := rows.Scan(&h.ID, &h.UserID, &h.TrackID, &h.PlayedAt, &h.DurationSeconds); err != nil {
			return nil, 0, fmt.Errorf("scanning history entry: %w", err)
		}
		entries = append(entries, h)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating history entries: %w", err)
	}

	return entries, total, nil
}
