package client

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Playlist represents a user-created playlist.
type Playlist struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PlaylistDetail is a playlist with its tracks.
type PlaylistDetail struct {
	Playlist
	Tracks []PlaylistTrack `json:"tracks"`
}

// PlaylistTrack represents a track within a playlist.
type PlaylistTrack struct {
	PlaylistID string    `json:"playlistId"`
	TrackID    string    `json:"trackId"`
	Position   int       `json:"position"`
	AddedAt    time.Time `json:"addedAt"`
}

type createPlaylistRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type addPlaylistTrackRequest struct {
	TrackID string `json:"trackId"`
}

// ListPlaylists returns all playlists for the authenticated user.
func (c *Client) ListPlaylists(ctx context.Context) ([]Playlist, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/playlists", nil)
	if err != nil {
		return nil, fmt.Errorf("list playlists: %w", err)
	}

	var playlists []Playlist
	if err := decodeResponse(resp, &playlists); err != nil {
		return nil, fmt.Errorf("list playlists: %w", err)
	}
	return playlists, nil
}

// CreatePlaylist creates a new playlist.
func (c *Client) CreatePlaylist(ctx context.Context, name, description string) (*Playlist, error) {
	resp, err := c.doRequest(ctx, http.MethodPost, "/api/v1/playlists", &createPlaylistRequest{
		Name:        name,
		Description: description,
	})
	if err != nil {
		return nil, fmt.Errorf("create playlist: %w", err)
	}

	var playlist Playlist
	if err := decodeResponse(resp, &playlist); err != nil {
		return nil, fmt.Errorf("create playlist: %w", err)
	}
	return &playlist, nil
}

// GetPlaylist returns a playlist with its tracks.
func (c *Client) GetPlaylist(ctx context.Context, id string) (*PlaylistDetail, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/playlists/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("get playlist: %w", err)
	}

	var detail PlaylistDetail
	if err := decodeResponse(resp, &detail); err != nil {
		return nil, fmt.Errorf("get playlist: %w", err)
	}
	return &detail, nil
}

// DeletePlaylist deletes a playlist.
func (c *Client) DeletePlaylist(ctx context.Context, id string) error {
	resp, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/playlists/"+id, nil)
	if err != nil {
		return fmt.Errorf("delete playlist: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}

// AddPlaylistTrack adds a track to a playlist.
func (c *Client) AddPlaylistTrack(ctx context.Context, playlistID, trackID string) error {
	resp, err := c.doRequest(ctx, http.MethodPost, "/api/v1/playlists/"+playlistID+"/tracks", &addPlaylistTrackRequest{
		TrackID: trackID,
	})
	if err != nil {
		return fmt.Errorf("add playlist track: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}

// RemovePlaylistTrack removes a track from a playlist.
func (c *Client) RemovePlaylistTrack(ctx context.Context, playlistID, trackID string) error {
	resp, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/playlists/"+playlistID+"/tracks/"+trackID, nil)
	if err != nil {
		return fmt.Errorf("remove playlist track: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	return nil
}
