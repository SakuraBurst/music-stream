import Foundation
import Observation

/// ViewModel that manages the user's favorites state.
/// Designed to be shared across the app so heart buttons can reflect favorite status anywhere.
@Observable
final class FavoritesViewModel {
    /// Set of favorited item keys in the form "type:id" (e.g., "track:abc123").
    private(set) var favoriteKeys: Set<String> = []
    private(set) var favorites: [Favorite] = []
    private(set) var isLoading = false
    private(set) var error: String?

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// Load all favorites for the current user.
    func loadFavorites() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            let result: [Favorite] = try await apiClient.request(
                endpoint: "/api/v1/favorites"
            )
            favorites = result
            favoriteKeys = Set(result.map { "\($0.itemType):\($0.itemId)" })
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Check if an item is favorited.
    func isFavorite(type: String, id: String) -> Bool {
        favoriteKeys.contains("\(type):\(id)")
    }

    /// Toggle favorite status for an item with haptic feedback.
    func toggleFavorite(type: String, id: String) async {
        let key = "\(type):\(id)"

        if favoriteKeys.contains(key) {
            // Optimistic remove.
            favoriteKeys.remove(key)
            favorites.removeAll { $0.itemType == type && $0.itemId == id }

            do {
                try await apiClient.requestVoid(
                    endpoint: "/api/v1/favorites/\(type)/\(id)",
                    method: .delete
                )
            } catch {
                // Revert on failure.
                favoriteKeys.insert(key)
                self.error = error.localizedDescription
                await loadFavorites()
            }
        } else {
            // Optimistic add.
            favoriteKeys.insert(key)

            do {
                try await apiClient.requestVoid(
                    endpoint: "/api/v1/favorites",
                    method: .post,
                    body: AddFavoriteRequest(type: type, id: id)
                )
            } catch {
                // Revert on failure.
                favoriteKeys.remove(key)
                self.error = error.localizedDescription
                await loadFavorites()
            }
        }
    }

    /// Filtered list of favorite track IDs.
    var favoriteTrackIDs: [String] {
        favorites.filter { $0.itemType == "track" }.map(\.itemId)
    }

    /// Filtered list of favorite album IDs.
    var favoriteAlbumIDs: [String] {
        favorites.filter { $0.itemType == "album" }.map(\.itemId)
    }

    /// Filtered list of favorite artist IDs.
    var favoriteArtistIDs: [String] {
        favorites.filter { $0.itemType == "artist" }.map(\.itemId)
    }
}
