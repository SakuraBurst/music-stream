import Foundation

/// A single audio track in the library.
struct Track: Codable, Identifiable, Hashable, Sendable {
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
}
