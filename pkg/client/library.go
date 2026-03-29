package client

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// Artist represents a music artist.
type Artist struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	SortName  string    `json:"sortName,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Album represents a music album.
type Album struct {
	ID              string    `json:"id"`
	ArtistID        string    `json:"artistId"`
	Name            string    `json:"name"`
	Year            int       `json:"year,omitempty"`
	Genre           string    `json:"genre,omitempty"`
	TrackCount      int       `json:"trackCount"`
	DurationSeconds int       `json:"durationSeconds"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Track represents a single audio track.
type Track struct {
	ID              string    `json:"id"`
	AlbumID         string    `json:"albumId"`
	ArtistID        string    `json:"artistId"`
	Title           string    `json:"title"`
	TrackNumber     int       `json:"trackNumber,omitempty"`
	DiscNumber      int       `json:"discNumber"`
	DurationSeconds int       `json:"durationSeconds"`
	FileSize        int64     `json:"fileSize,omitempty"`
	Format          string    `json:"format,omitempty"`
	Bitrate         int       `json:"bitrate,omitempty"`
	SampleRate      int       `json:"sampleRate,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// AlbumResponse is an album with the artist name included.
type AlbumResponse struct {
	Album
	ArtistName string `json:"artistName"`
}

// TrackResponse is a track with artist and album names included.
type TrackResponse struct {
	Track
	ArtistName string `json:"artistName"`
	AlbumName  string `json:"albumName"`
}

// ArtistDetail is an artist with its albums.
type ArtistDetail struct {
	Artist
	Albums []Album `json:"albums"`
}

// AlbumDetail is an album with its tracks and artist name.
type AlbumDetail struct {
	Album
	ArtistName string          `json:"artistName"`
	Tracks     []TrackResponse `json:"tracks"`
}

// PaginatedResult holds a paginated list response.
type PaginatedResult[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// ListOptions specifies pagination and filter parameters for list endpoints.
type ListOptions struct {
	Limit    int
	Offset   int
	ArtistID string
	AlbumID  string
}

func (o *ListOptions) query() map[string]string {
	m := make(map[string]string)
	if o.Limit > 0 {
		m["limit"] = strconv.Itoa(o.Limit)
	}
	if o.Offset > 0 {
		m["offset"] = strconv.Itoa(o.Offset)
	}
	if o.ArtistID != "" {
		m["artist_id"] = o.ArtistID
	}
	if o.AlbumID != "" {
		m["album_id"] = o.AlbumID
	}
	return m
}

// ListArtists returns a paginated list of artists.
func (c *Client) ListArtists(ctx context.Context, opts *ListOptions) (*PaginatedResult[Artist], error) {
	if opts == nil {
		opts = &ListOptions{}
	}
	path := "/api/v1/artists" + buildQuery(opts.query())

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("list artists: %w", err)
	}

	var result PaginatedResult[Artist]
	if err := decodeResponse(resp, &result); err != nil {
		return nil, fmt.Errorf("list artists: %w", err)
	}
	return &result, nil
}

// GetArtist returns an artist with its albums.
func (c *Client) GetArtist(ctx context.Context, id string) (*ArtistDetail, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/artists/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("get artist: %w", err)
	}

	var detail ArtistDetail
	if err := decodeResponse(resp, &detail); err != nil {
		return nil, fmt.Errorf("get artist: %w", err)
	}
	return &detail, nil
}

// ListAlbums returns a paginated list of albums.
func (c *Client) ListAlbums(ctx context.Context, opts *ListOptions) (*PaginatedResult[AlbumResponse], error) {
	if opts == nil {
		opts = &ListOptions{}
	}
	path := "/api/v1/albums" + buildQuery(opts.query())

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("list albums: %w", err)
	}

	var result PaginatedResult[AlbumResponse]
	if err := decodeResponse(resp, &result); err != nil {
		return nil, fmt.Errorf("list albums: %w", err)
	}
	return &result, nil
}

// GetAlbum returns an album with its tracks and artist name.
func (c *Client) GetAlbum(ctx context.Context, id string) (*AlbumDetail, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/albums/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("get album: %w", err)
	}

	var detail AlbumDetail
	if err := decodeResponse(resp, &detail); err != nil {
		return nil, fmt.Errorf("get album: %w", err)
	}
	return &detail, nil
}

// ListTracks returns a paginated list of tracks.
func (c *Client) ListTracks(ctx context.Context, opts *ListOptions) (*PaginatedResult[TrackResponse], error) {
	if opts == nil {
		opts = &ListOptions{}
	}
	path := "/api/v1/tracks" + buildQuery(opts.query())

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("list tracks: %w", err)
	}

	var result PaginatedResult[TrackResponse]
	if err := decodeResponse(resp, &result); err != nil {
		return nil, fmt.Errorf("list tracks: %w", err)
	}
	return &result, nil
}

// GetTrack returns a single track with artist and album names.
func (c *Client) GetTrack(ctx context.Context, id string) (*TrackResponse, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/tracks/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("get track: %w", err)
	}

	var track TrackResponse
	if err := decodeResponse(resp, &track); err != nil {
		return nil, fmt.Errorf("get track: %w", err)
	}
	return &track, nil
}

// SearchResult holds results from a full-text search, grouped by type.
type SearchResult struct {
	Artists []Artist        `json:"artists"`
	Albums  []AlbumResponse `json:"albums"`
	Tracks  []TrackResponse `json:"tracks"`
}

// Search performs a full-text search across the library.
// searchType can be "all", "artist", "album", or "track".
func (c *Client) Search(ctx context.Context, query, searchType string) (*SearchResult, error) {
	params := map[string]string{
		"q":    query,
		"type": searchType,
	}
	path := "/api/v1/search" + buildQuery(params)

	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}

	var result SearchResult
	if err := decodeResponse(resp, &result); err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}
	return &result, nil
}
