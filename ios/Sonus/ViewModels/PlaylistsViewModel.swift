import Foundation
import Observation

/// ViewModel for the playlists list screen.
@Observable
final class PlaylistsViewModel {
    private(set) var playlists: [Playlist] = []
    private(set) var isLoading = false
    private(set) var error: String?

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// Load all playlists for the current user.
    func loadPlaylists() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            let result: [Playlist] = try await apiClient.request(
                endpoint: "/api/v1/playlists"
            )
            playlists = result
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Create a new playlist.
    func createPlaylist(name: String, description: String = "") async -> Bool {
        do {
            let _: Playlist = try await apiClient.request(
                endpoint: "/api/v1/playlists",
                method: .post,
                body: CreatePlaylistRequest(name: name, description: description)
            )
            await loadPlaylists()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Delete a playlist by ID.
    func deletePlaylist(id: String) async {
        do {
            try await apiClient.requestVoid(
                endpoint: "/api/v1/playlists/\(id)",
                method: .delete
            )
            playlists.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
