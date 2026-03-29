package model

import "time"

// PlaybackSession represents the saved playback state for a user,
// enabling cross-client session continuity (Spotify Connect-like).
type PlaybackSession struct {
	UserID          string     `json:"userId"`
	TrackID         string     `json:"trackId"`
	PositionSeconds float64    `json:"positionSeconds"`
	QueueTrackIDs   []string   `json:"queueTrackIds"`
	IsPlaying       bool       `json:"isPlaying"`
	Volume          float64    `json:"volume"`
	Shuffle         bool       `json:"shuffle"`
	RepeatMode      string     `json:"repeatMode"` // "none", "all", "one"
	UpdatedAt       time.Time  `json:"updatedAt"`
}
