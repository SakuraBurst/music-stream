package model

import "time"

// Track represents a single audio track in the library.
type Track struct {
	ID              string    `json:"id"`
	AlbumID         string    `json:"albumId"`
	ArtistID        string    `json:"artistId"`
	Title           string    `json:"title"`
	TrackNumber     int       `json:"trackNumber,omitempty"`
	DiscNumber      int       `json:"discNumber"`
	DurationSeconds int       `json:"durationSeconds"`
	FilePath        string    `json:"-"`
	FileSize        int64     `json:"fileSize,omitempty"`
	Format          string    `json:"format,omitempty"`
	Bitrate         int       `json:"bitrate,omitempty"`
	SampleRate      int       `json:"sampleRate,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}
