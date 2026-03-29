import Foundation

/// A music artist in the library.
struct Artist: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let sortName: String?
    let createdAt: Date
}
