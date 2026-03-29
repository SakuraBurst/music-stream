import Foundation

// MARK: - Auth

/// Request body for POST /api/v1/auth/login and /register.
struct AuthRequest: Encodable, Sendable {
    let username: String
    let password: String
}

/// Response from POST /api/v1/auth/login, /register, and /refresh.
struct AuthResponse: Decodable, Sendable {
    let accessToken: String
    let refreshToken: String
}

/// Request body for POST /api/v1/auth/refresh.
struct RefreshTokenRequest: Encodable, Sendable {
    let refreshToken: String
}

// MARK: - Error

/// Error response from the backend.
struct APIErrorResponse: Decodable, Sendable {
    let error: String
}

// MARK: - Paginated

/// Generic paginated response wrapper matching backend PaginatedResult.
struct PaginatedResponse<T: Decodable & Sendable>: Decodable, Sendable {
    let items: [T]
    let total: Int
    let limit: Int
    let offset: Int
}

// MARK: - Search

/// Response from GET /api/v1/search?q=...&type=all.
struct SearchResponse: Decodable, Sendable {
    let artists: [Artist]
    let albums: [AlbumResponse]
    let tracks: [TrackResponse]
}

// MARK: - Playlist Detail

/// Playlist with its tracks (GET /api/v1/playlists/:id).
struct PlaylistDetail: Decodable, Sendable {
    let id: String
    let userId: String
    let name: String
    let description: String?
    let createdAt: Date
    let updatedAt: Date
    let tracks: [TrackResponse]
}

/// Request body for creating a playlist.
struct CreatePlaylistRequest: Encodable, Sendable {
    let name: String
    let description: String
}

/// Request body for updating a playlist.
struct UpdatePlaylistRequest: Encodable, Sendable {
    let name: String
    let description: String
}

/// Request body for adding a track to a playlist.
struct AddTrackToPlaylistRequest: Encodable, Sendable {
    let trackId: String
}

// MARK: - Favorites

/// Request body for adding a favorite.
struct AddFavoriteRequest: Encodable, Sendable {
    let type: String
    let id: String
}

// MARK: - History

/// Request body for recording a listening history entry.
struct AddHistoryRequest: Encodable, Sendable {
    let trackId: String
    let duration: Int
}

/// Listening history entry with track metadata for display.
struct HistoryEntry: Decodable, Sendable {
    let id: Int64
    let userId: String
    let trackId: String
    let playedAt: Date
    let durationSeconds: Int?
}

// MARK: - Library detail types

/// Artist with albums included (GET /api/v1/artists/:id).
struct ArtistDetail: Decodable, Sendable {
    let id: String
    let name: String
    let sortName: String?
    let createdAt: Date
    let albums: [Album]
}

/// Album with artist name and tracks (GET /api/v1/albums/:id).
struct AlbumDetail: Decodable, Sendable {
    let id: String
    let artistId: String
    let name: String
    let year: Int?
    let genre: String?
    let trackCount: Int
    let durationSeconds: Int
    let createdAt: Date
    let artistName: String
    let tracks: [TrackResponse]
}

/// Album with artist name (used in album list).
struct AlbumResponse: Decodable, Sendable {
    let id: String
    let artistId: String
    let name: String
    let year: Int?
    let genre: String?
    let trackCount: Int
    let durationSeconds: Int
    let createdAt: Date
    let artistName: String
}

/// Track with artist and album names included.
struct TrackResponse: Decodable, Sendable {
    let id: String
    let albumId: String
    let artistId: String
    let title: String
    let trackNumber: Int?
    let discNumber: Int
    let durationSeconds: Int
    let fileSize: Int64?
    let format: String?
    let bitrate: Int?
    let sampleRate: Int?
    let createdAt: Date
    let updatedAt: Date
    let artistName: String
    let albumName: String
}
