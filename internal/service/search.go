package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/sakuraburst/sonus/internal/model"
	"github.com/sakuraburst/sonus/internal/store/sqlite"
)

// SearchResult holds results from a full-text search, grouped by type.
type SearchResult struct {
	Artists []model.Artist  `json:"artists"`
	Albums  []AlbumResponse `json:"albums"`
	Tracks  []TrackResponse `json:"tracks"`
}

// SearchService handles full-text search over the music library.
type SearchService struct {
	trackStore  *sqlite.TrackStore
	artistStore *sqlite.ArtistStore
	albumStore  *sqlite.AlbumStore
}

// NewSearchService creates a new SearchService.
func NewSearchService(
	trackStore *sqlite.TrackStore,
	artistStore *sqlite.ArtistStore,
	albumStore *sqlite.AlbumStore,
) *SearchService {
	return &SearchService{
		trackStore:  trackStore,
		artistStore: artistStore,
		albumStore:  albumStore,
	}
}

// Search performs a full-text search. The searchType parameter filters results:
// "all" returns tracks, artists, and albums; "track", "artist", "album" return only that type.
func (s *SearchService) Search(ctx context.Context, query string, searchType string) (*SearchResult, error) {
	if query == "" {
		return &SearchResult{
			Artists: []model.Artist{},
			Albums:  []AlbumResponse{},
			Tracks:  []TrackResponse{},
		}, nil
	}

	// Sanitize query for FTS5: escape double quotes, wrap each term with quotes.
	ftsQuery := sanitizeFTSQuery(query)

	result := &SearchResult{
		Artists: []model.Artist{},
		Albums:  []AlbumResponse{},
		Tracks:  []TrackResponse{},
	}

	switch searchType {
	case "track":
		tracks, err := s.searchTracks(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Tracks = tracks
	case "artist":
		artists, err := s.searchArtists(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Artists = artists
	case "album":
		albums, err := s.searchAlbums(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Albums = albums
	default: // "all"
		tracks, err := s.searchTracks(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Tracks = tracks

		artists, err := s.searchArtists(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Artists = artists

		albums, err := s.searchAlbums(ctx, ftsQuery)
		if err != nil {
			return nil, err
		}
		result.Albums = albums
	}

	return result, nil
}

// searchTracks finds tracks matching the FTS query.
func (s *SearchService) searchTracks(ctx context.Context, ftsQuery string) ([]TrackResponse, error) {
	tracks, err := s.trackStore.SearchFTS(ctx, ftsQuery, 50)
	if err != nil {
		return nil, fmt.Errorf("searching tracks: %w", err)
	}

	responses := make([]TrackResponse, 0, len(tracks))
	for _, t := range tracks {
		artistName := ""
		if a, err := s.artistStore.GetByID(ctx, t.ArtistID); err == nil && a != nil {
			artistName = a.Name
		}
		albumName := ""
		if a, err := s.albumStore.GetByID(ctx, t.AlbumID); err == nil && a != nil {
			albumName = a.Name
		}
		responses = append(responses, TrackResponse{
			Track:      t,
			ArtistName: artistName,
			AlbumName:  albumName,
		})
	}

	return responses, nil
}

// searchArtists finds artists whose tracks match the FTS query.
func (s *SearchService) searchArtists(ctx context.Context, ftsQuery string) ([]model.Artist, error) {
	artistIDs, err := s.trackStore.SearchFTSArtistIDs(ctx, ftsQuery, 20)
	if err != nil {
		return nil, fmt.Errorf("searching artists via FTS: %w", err)
	}

	artists := make([]model.Artist, 0, len(artistIDs))
	for _, id := range artistIDs {
		a, err := s.artistStore.GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("getting artist %s: %w", id, err)
		}
		if a != nil {
			artists = append(artists, *a)
		}
	}

	return artists, nil
}

// searchAlbums finds albums whose tracks match the FTS query.
func (s *SearchService) searchAlbums(ctx context.Context, ftsQuery string) ([]AlbumResponse, error) {
	albumIDs, err := s.trackStore.SearchFTSAlbumIDs(ctx, ftsQuery, 20)
	if err != nil {
		return nil, fmt.Errorf("searching albums via FTS: %w", err)
	}

	albums := make([]AlbumResponse, 0, len(albumIDs))
	for _, id := range albumIDs {
		a, err := s.albumStore.GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("getting album %s: %w", id, err)
		}
		if a == nil {
			continue
		}
		artistName := ""
		if ar, err := s.artistStore.GetByID(ctx, a.ArtistID); err == nil && ar != nil {
			artistName = ar.Name
		}
		albums = append(albums, AlbumResponse{
			Album:      *a,
			ArtistName: artistName,
		})
	}

	return albums, nil
}

// sanitizeFTSQuery prepares a user query for FTS5 MATCH.
// Each word gets a * suffix for prefix matching. Special FTS5 characters are removed.
func sanitizeFTSQuery(query string) string {
	// Remove FTS5 special characters that could cause syntax errors.
	replacer := strings.NewReplacer(
		`"`, "",
		`'`, "",
		`*`, "",
		`(`, "",
		`)`, "",
		`{`, "",
		`}`, "",
		`:`, "",
		`^`, "",
	)
	cleaned := replacer.Replace(query)

	words := strings.Fields(cleaned)
	if len(words) == 0 {
		return ""
	}

	// Build prefix query: each word gets * suffix for prefix matching.
	parts := make([]string, 0, len(words))
	for _, w := range words {
		if w != "" {
			parts = append(parts, `"`+w+`"*`)
		}
	}

	return strings.Join(parts, " ")
}
