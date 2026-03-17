package model

import "time"

// Playlist represents a user-created playlist.
type Playlist struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PlaylistTrack represents the association between a playlist and a track.
type PlaylistTrack struct {
	PlaylistID string    `json:"playlistId"`
	TrackID    string    `json:"trackId"`
	Position   int       `json:"position"`
	AddedAt    time.Time `json:"addedAt"`
}

// Favorite represents a user's favorited item (track, album, or artist).
type Favorite struct {
	UserID    string    `json:"userId"`
	ItemType  string    `json:"itemType"` // "track", "album", "artist"
	ItemID    string    `json:"itemId"`
	CreatedAt time.Time `json:"createdAt"`
}
