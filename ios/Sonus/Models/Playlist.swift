import Foundation

/// A user-created playlist.
struct Playlist: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userId: String
    let name: String
    let description: String?
    let createdAt: Date
    let updatedAt: Date
}

/// Association between a playlist and a track.
struct PlaylistTrack: Codable, Hashable, Sendable {
    let playlistId: String
    let trackId: String
    let position: Int
    let addedAt: Date
}

/// A user's favorited item (track, album, or artist).
struct Favorite: Codable, Hashable, Sendable {
    let userId: String
    let itemType: String
    let itemId: String
    let createdAt: Date
}

/// A single listening history event.
struct ListeningHistory: Codable, Identifiable, Hashable, Sendable {
    let id: Int64
    let userId: String
    let trackId: String
    let playedAt: Date
    let durationSeconds: Int?
}
