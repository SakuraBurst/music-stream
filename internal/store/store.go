package store

import (
	"context"

	"github.com/sakuraburst/sonus/internal/model"
)

// UserStore provides access to user data.
type UserStore interface {
	Create(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByUsername(ctx context.Context, username string) (*model.User, error)

	CreateRefreshToken(ctx context.Context, token *model.RefreshToken) error
	GetRefreshToken(ctx context.Context, token string) (*model.RefreshToken, error)
	DeleteRefreshToken(ctx context.Context, token string) error
	DeleteUserRefreshTokens(ctx context.Context, userID string) error
}

// TrackStore provides access to track data.
type TrackStore interface {
	Create(ctx context.Context, track *model.Track) error
	Update(ctx context.Context, track *model.Track) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*model.Track, error)
	GetByFilePath(ctx context.Context, filePath string) (*model.Track, error)
	List(ctx context.Context, opts ListOptions) ([]model.Track, int, error)
	ListByAlbum(ctx context.Context, albumID string) ([]model.Track, error)
	ListByArtist(ctx context.Context, artistID string) ([]model.Track, error)
}

// AlbumStore provides access to album data.
type AlbumStore interface {
	Create(ctx context.Context, album *model.Album) error
	Update(ctx context.Context, album *model.Album) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*model.Album, error)
	List(ctx context.Context, opts ListOptions) ([]model.Album, int, error)
	ListByArtist(ctx context.Context, artistID string) ([]model.Album, error)
}

// ArtistStore provides access to artist data.
type ArtistStore interface {
	Create(ctx context.Context, artist *model.Artist) error
	Update(ctx context.Context, artist *model.Artist) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*model.Artist, error)
	GetByName(ctx context.Context, name string) (*model.Artist, error)
	List(ctx context.Context, opts ListOptions) ([]model.Artist, int, error)
}

// PlaylistStore provides access to playlist data.
type PlaylistStore interface {
	Create(ctx context.Context, playlist *model.Playlist) error
	Update(ctx context.Context, playlist *model.Playlist) error
	Delete(ctx context.Context, id string) error
	GetByID(ctx context.Context, id string) (*model.Playlist, error)
	ListByUser(ctx context.Context, userID string) ([]model.Playlist, error)

	AddTrack(ctx context.Context, pt *model.PlaylistTrack) error
	RemoveTrack(ctx context.Context, playlistID, trackID string) error
	ListTracks(ctx context.Context, playlistID string) ([]model.PlaylistTrack, error)
}

// FavoriteStore provides access to user favorites.
type FavoriteStore interface {
	Add(ctx context.Context, fav *model.Favorite) error
	Remove(ctx context.Context, userID, itemType, itemID string) error
	ListByUser(ctx context.Context, userID string) ([]model.Favorite, error)
	Exists(ctx context.Context, userID, itemType, itemID string) (bool, error)
}

// HistoryStore provides access to listening history.
type HistoryStore interface {
	Add(ctx context.Context, entry *model.ListeningHistory) error
	ListByUser(ctx context.Context, userID string, opts ListOptions) ([]model.ListeningHistory, int, error)
}

// ListOptions defines common pagination and sorting parameters.
type ListOptions struct {
	Offset int
	Limit  int
}
