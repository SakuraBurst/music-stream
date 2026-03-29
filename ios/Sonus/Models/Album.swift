import Foundation

/// A music album in the library.
struct Album: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let artistId: String
    let name: String
    let year: Int?
    let genre: String?
    let trackCount: Int
    let durationSeconds: Int
    let createdAt: Date
}
