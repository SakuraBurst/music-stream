package model

import "time"

// Album represents a music album in the library.
type Album struct {
	ID              string    `json:"id"`
	ArtistID        string    `json:"artistId"`
	Name            string    `json:"name"`
	Year            int       `json:"year,omitempty"`
	Genre           string    `json:"genre,omitempty"`
	CoverArtPath    string    `json:"-"`
	TrackCount      int       `json:"trackCount"`
	DurationSeconds int       `json:"durationSeconds"`
	CreatedAt       time.Time `json:"createdAt"`
}
