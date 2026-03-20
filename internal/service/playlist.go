package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

var (
	// ErrPlaylistNotFound is returned when a playlist is not found.
	ErrPlaylistNotFound = errors.New("playlist not found")
	// ErrPlaylistForbidden is returned when a user tries to access another user's playlist.
	ErrPlaylistForbidden = errors.New("access to playlist denied")
)

// PlaylistDetail is a playlist with its tracks including metadata.
type PlaylistDetail struct {
	model.Playlist
	Tracks []TrackResponse `json:"tracks"`
}

// PlaylistService handles playlist CRUD and track management.
type PlaylistService struct {
	playlistStore *sqlite.PlaylistStore
	trackStore    *sqlite.TrackStore
	artistStore   *sqlite.ArtistStore
	albumStore    *sqlite.AlbumStore
}

// NewPlaylistService creates a new PlaylistService.
func NewPlaylistService(
	playlistStore *sqlite.PlaylistStore,
	trackStore *sqlite.TrackStore,
	artistStore *sqlite.ArtistStore,
	albumStore *sqlite.AlbumStore,
) *PlaylistService {
	return &PlaylistService{
		playlistStore: playlistStore,
		trackStore:    trackStore,
		artistStore:   artistStore,
		albumStore:    albumStore,
	}
}

// Create creates a new playlist for the given user.
func (s *PlaylistService) Create(ctx context.Context, userID, name, description string) (*model.Playlist, error) {
	now := time.Now()
	playlist := &model.Playlist{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        name,
		Description: description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.playlistStore.Create(ctx, playlist); err != nil {
		return nil, fmt.Errorf("creating playlist: %w", err)
	}

	return playlist, nil
}

// List returns all playlists for a user.
func (s *PlaylistService) List(ctx context.Context, userID string) ([]model.Playlist, error) {
	playlists, err := s.playlistStore.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listing playlists: %w", err)
	}
	if playlists == nil {
		playlists = []model.Playlist{}
	}
	return playlists, nil
}

// Get returns a playlist with its tracks. Checks ownership.
func (s *PlaylistService) Get(ctx context.Context, userID, playlistID string) (*PlaylistDetail, error) {
	playlist, err := s.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return nil, fmt.Errorf("getting playlist: %w", err)
	}
	if playlist == nil {
		return nil, ErrPlaylistNotFound
	}
	if playlist.UserID != userID {
		return nil, ErrPlaylistForbidden
	}

	// Get playlist track associations.
	pts, err := s.playlistStore.ListTracks(ctx, playlistID)
	if err != nil {
		return nil, fmt.Errorf("listing playlist tracks: %w", err)
	}

	// Resolve full track data with artist/album names.
	tracks := make([]TrackResponse, 0, len(pts))
	for _, pt := range pts {
		track, err := s.trackStore.GetByID(ctx, pt.TrackID)
		if err != nil {
			return nil, fmt.Errorf("getting track %s: %w", pt.TrackID, err)
		}
		if track == nil {
			continue // Track may have been deleted from library.
		}

		artistName := ""
		if a, err := s.artistStore.GetByID(ctx, track.ArtistID); err == nil && a != nil {
			artistName = a.Name
		}
		albumName := ""
		if a, err := s.albumStore.GetByID(ctx, track.AlbumID); err == nil && a != nil {
			albumName = a.Name
		}

		tracks = append(tracks, TrackResponse{
			Track:      *track,
			ArtistName: artistName,
			AlbumName:  albumName,
		})
	}

	return &PlaylistDetail{
		Playlist: *playlist,
		Tracks:   tracks,
	}, nil
}

// Update updates a playlist's name and/or description. Checks ownership.
func (s *PlaylistService) Update(ctx context.Context, userID, playlistID, name, description string) (*model.Playlist, error) {
	playlist, err := s.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return nil, fmt.Errorf("getting playlist: %w", err)
	}
	if playlist == nil {
		return nil, ErrPlaylistNotFound
	}
	if playlist.UserID != userID {
		return nil, ErrPlaylistForbidden
	}

	if name != "" {
		playlist.Name = name
	}
	// Description can be set to empty string intentionally.
	playlist.Description = description
	playlist.UpdatedAt = time.Now()

	if err := s.playlistStore.Update(ctx, playlist); err != nil {
		return nil, fmt.Errorf("updating playlist: %w", err)
	}

	return playlist, nil
}

// Delete deletes a playlist. Checks ownership.
func (s *PlaylistService) Delete(ctx context.Context, userID, playlistID string) error {
	playlist, err := s.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("getting playlist: %w", err)
	}
	if playlist == nil {
		return ErrPlaylistNotFound
	}
	if playlist.UserID != userID {
		return ErrPlaylistForbidden
	}

	if err := s.playlistStore.Delete(ctx, playlistID); err != nil {
		return fmt.Errorf("deleting playlist: %w", err)
	}

	return nil
}

// AddTrack adds a track to a playlist at the next position. Checks ownership.
func (s *PlaylistService) AddTrack(ctx context.Context, userID, playlistID, trackID string) error {
	playlist, err := s.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("getting playlist: %w", err)
	}
	if playlist == nil {
		return ErrPlaylistNotFound
	}
	if playlist.UserID != userID {
		return ErrPlaylistForbidden
	}

	maxPos, err := s.playlistStore.MaxPosition(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("getting max position: %w", err)
	}

	pt := &model.PlaylistTrack{
		PlaylistID: playlistID,
		TrackID:    trackID,
		Position:   maxPos + 1,
		AddedAt:    time.Now(),
	}

	if err := s.playlistStore.AddTrack(ctx, pt); err != nil {
		return fmt.Errorf("adding track to playlist: %w", err)
	}

	return nil
}

// RemoveTrack removes a track from a playlist. Checks ownership.
func (s *PlaylistService) RemoveTrack(ctx context.Context, userID, playlistID, trackID string) error {
	playlist, err := s.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("getting playlist: %w", err)
	}
	if playlist == nil {
		return ErrPlaylistNotFound
	}
	if playlist.UserID != userID {
		return ErrPlaylistForbidden
	}

	if err := s.playlistStore.RemoveTrack(ctx, playlistID, trackID); err != nil {
		return fmt.Errorf("removing track from playlist: %w", err)
	}

	return nil
}
