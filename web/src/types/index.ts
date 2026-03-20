/** Matches Go model.Track (internal/model/track.go) */
export interface Track {
  id: string;
  albumId: string;
  artistId: string;
  title: string;
  trackNumber?: number;
  discNumber: number;
  durationSeconds: number;
  fileSize?: number;
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  createdAt: string;
  updatedAt: string;
}

/** Matches Go model.Album (internal/model/album.go) */
export interface Album {
  id: string;
  artistId: string;
  name: string;
  year?: number;
  genre?: string;
  trackCount: number;
  durationSeconds: number;
  createdAt: string;
}

/** Matches Go model.Artist (internal/model/artist.go) */
export interface Artist {
  id: string;
  name: string;
  sortName?: string;
  createdAt: string;
}

/** Matches Go model.Playlist (internal/model/playlist.go) */
export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Matches Go model.PlaylistTrack (internal/model/playlist.go) */
export interface PlaylistTrack {
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: string;
}

/** Matches Go model.Favorite (internal/model/playlist.go) */
export interface Favorite {
  userId: string;
  itemType: 'track' | 'album' | 'artist';
  itemId: string;
  createdAt: string;
}

/** Matches Go model.ListeningHistory (internal/model/history.go) */
export interface ListeningHistory {
  id: number;
  userId: string;
  trackId: string;
  playedAt: string;
  durationSeconds?: number;
}

/** Matches Go model.User (internal/model/user.go), excluding passwordHash */
export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

/** Auth response from POST /api/v1/auth/login and /api/v1/auth/register */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Matches Go service.TrackResponse — track with artist and album names */
export interface TrackResponse extends Track {
  artistName: string;
  albumName: string;
}

/** Matches Go service.AlbumResponse — album with artist name */
export interface AlbumResponse extends Album {
  artistName: string;
}

/** Matches Go service.ArtistDetail — artist with their albums */
export interface ArtistDetail extends Artist {
  albums: Album[];
}

/** Matches Go service.AlbumDetail — album with tracks and artist name */
export interface AlbumDetail extends Album {
  artistName: string;
  tracks: TrackResponse[];
}
