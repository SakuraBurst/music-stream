package model

import "time"

// ListeningHistory represents a single listening event for a user.
type ListeningHistory struct {
	ID              int64     `json:"id"`
	UserID          string    `json:"userId"`
	TrackID         string    `json:"trackId"`
	PlayedAt        time.Time `json:"playedAt"`
	DurationSeconds int       `json:"durationSeconds,omitempty"`
}
