package service

import (
	"context"
	"fmt"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// ArtistDetail is an artist with its albums.
type ArtistDetail struct {
	model.Artist
	Albums []model.Album `json:"albums"`
}

// AlbumResponse is an album with the artist name included.
type AlbumResponse struct {
	model.Album
	ArtistName string `json:"artistName"`
}

// AlbumDetail is an album with its tracks and artist name.
type AlbumDetail struct {
	model.Album
	ArtistName string           `json:"artistName"`
	Tracks     []TrackResponse  `json:"tracks"`
}

// TrackResponse is a track with artist and album names included.
type TrackResponse struct {
	model.Track
	ArtistName string `json:"artistName"`
	AlbumName  string `json:"albumName"`
}

// PaginatedResult holds a paginated list result.
type PaginatedResult[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// LibraryService handles library browsing operations.
type LibraryService struct {
	artistStore *sqlite.ArtistStore
	albumStore  *sqlite.AlbumStore
	trackStore  *sqlite.TrackStore
}

// NewLibraryService creates a new LibraryService.
func NewLibraryService(
	artistStore *sqlite.ArtistStore,
	albumStore *sqlite.AlbumStore,
	trackStore *sqlite.TrackStore,
) *LibraryService {
	return &LibraryService{
		artistStore: artistStore,
		albumStore:  albumStore,
		trackStore:  trackStore,
	}
}

// ListArtists returns a paginated list of artists.
func (s *LibraryService) ListArtists(ctx context.Context, opts store.ListOptions) (*PaginatedResult[model.Artist], error) {
	artists, total, err := s.artistStore.List(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("listing artists: %w", err)
	}
	if artists == nil {
		artists = []model.Artist{}
	}
	return &PaginatedResult[model.Artist]{
		Items:  artists,
		Total:  total,
		Limit:  opts.Limit,
		Offset: opts.Offset,
	}, nil
}

// GetArtist returns an artist with their albums.
func (s *LibraryService) GetArtist(ctx context.Context, id string) (*ArtistDetail, error) {
	artist, err := s.artistStore.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getting artist: %w", err)
	}
	if artist == nil {
		return nil, nil
	}

	albums, err := s.albumStore.ListByArtist(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("listing artist albums: %w", err)
	}
	if albums == nil {
		albums = []model.Album{}
	}

	return &ArtistDetail{
		Artist: *artist,
		Albums: albums,
	}, nil
}

// ListAlbums returns a paginated list of albums with artist names.
func (s *LibraryService) ListAlbums(ctx context.Context, opts store.ListOptions) (*PaginatedResult[AlbumResponse], error) {
	albums, total, err := s.albumStore.List(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("listing albums: %w", err)
	}

	// Build artist name lookup.
	artistNames, err := s.buildArtistNameMap(ctx, albums)
	if err != nil {
		return nil, err
	}

	responses := make([]AlbumResponse, len(albums))
	for i, a := range albums {
		responses[i] = AlbumResponse{
			Album:      a,
			ArtistName: artistNames[a.ArtistID],
		}
	}

	return &PaginatedResult[AlbumResponse]{
		Items:  responses,
		Total:  total,
		Limit:  opts.Limit,
		Offset: opts.Offset,
	}, nil
}

// GetAlbum returns an album with its tracks and artist name.
func (s *LibraryService) GetAlbum(ctx context.Context, id string) (*AlbumDetail, error) {
	album, err := s.albumStore.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getting album: %w", err)
	}
	if album == nil {
		return nil, nil
	}

	artist, err := s.artistStore.GetByID(ctx, album.ArtistID)
	if err != nil {
		return nil, fmt.Errorf("getting album artist: %w", err)
	}
	artistName := ""
	if artist != nil {
		artistName = artist.Name
	}

	tracks, err := s.trackStore.ListByAlbum(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("listing album tracks: %w", err)
	}

	trackResponses := make([]TrackResponse, len(tracks))
	for i, t := range tracks {
		trackResponses[i] = TrackResponse{
			Track:      t,
			ArtistName: artistName,
			AlbumName:  album.Name,
		}
	}

	return &AlbumDetail{
		Album:      *album,
		ArtistName: artistName,
		Tracks:     trackResponses,
	}, nil
}

// ListTracks returns a paginated list of tracks with artist and album names.
func (s *LibraryService) ListTracks(ctx context.Context, opts store.ListOptions) (*PaginatedResult[TrackResponse], error) {
	tracks, total, err := s.trackStore.List(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("listing tracks: %w", err)
	}

	// Build lookups for artist and album names.
	artistIDs := make(map[string]bool)
	albumIDs := make(map[string]bool)
	for _, t := range tracks {
		artistIDs[t.ArtistID] = true
		albumIDs[t.AlbumID] = true
	}

	artistNames := make(map[string]string)
	for id := range artistIDs {
		a, err := s.artistStore.GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("getting artist %s: %w", id, err)
		}
		if a != nil {
			artistNames[id] = a.Name
		}
	}

	albumNames := make(map[string]string)
	for id := range albumIDs {
		a, err := s.albumStore.GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("getting album %s: %w", id, err)
		}
		if a != nil {
			albumNames[id] = a.Name
		}
	}

	responses := make([]TrackResponse, len(tracks))
	for i, t := range tracks {
		responses[i] = TrackResponse{
			Track:      t,
			ArtistName: artistNames[t.ArtistID],
			AlbumName:  albumNames[t.AlbumID],
		}
	}

	return &PaginatedResult[TrackResponse]{
		Items:  responses,
		Total:  total,
		Limit:  opts.Limit,
		Offset: opts.Offset,
	}, nil
}

// GetTrack returns a single track with artist and album names.
func (s *LibraryService) GetTrack(ctx context.Context, id string) (*TrackResponse, error) {
	track, err := s.trackStore.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getting track: %w", err)
	}
	if track == nil {
		return nil, nil
	}

	artistName := ""
	if a, err := s.artistStore.GetByID(ctx, track.ArtistID); err == nil && a != nil {
		artistName = a.Name
	}

	albumName := ""
	if a, err := s.albumStore.GetByID(ctx, track.AlbumID); err == nil && a != nil {
		albumName = a.Name
	}

	return &TrackResponse{
		Track:      *track,
		ArtistName: artistName,
		AlbumName:  albumName,
	}, nil
}

// buildArtistNameMap builds a map of artist ID to name for a set of albums.
func (s *LibraryService) buildArtistNameMap(ctx context.Context, albums []model.Album) (map[string]string, error) {
	ids := make(map[string]bool)
	for _, a := range albums {
		ids[a.ArtistID] = true
	}

	names := make(map[string]string)
	for id := range ids {
		a, err := s.artistStore.GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("getting artist %s: %w", id, err)
		}
		if a != nil {
			names[id] = a.Name
		}
	}

	return names, nil
}
