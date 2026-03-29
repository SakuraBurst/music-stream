import Foundation
import Observation

/// ViewModel for a single playlist's detail screen.
@Observable
final class PlaylistDetailViewModel {
    private(set) var detail: PlaylistDetail?
    private(set) var isLoading = false
    private(set) var error: String?

    let playlistID: String
    let playlistName: String
    private let apiClient: APIClient

    init(apiClient: APIClient, playlistID: String, playlistName: String) {
        self.apiClient = apiClient
        self.playlistID = playlistID
        self.playlistName = playlistName
    }

    /// Load the playlist detail including tracks.
    func loadPlaylist() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            let result: PlaylistDetail = try await apiClient.request(
                endpoint: "/api/v1/playlists/\(playlistID)"
            )
            detail = result
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Remove a track from the playlist.
    func removeTrack(trackID: String) async {
        do {
            try await apiClient.requestVoid(
                endpoint: "/api/v1/playlists/\(playlistID)/tracks/\(trackID)",
                method: .delete
            )
            // Reload to get updated track list and positions.
            await loadPlaylist()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Add a track to the playlist.
    func addTrack(trackID: String) async {
        do {
            try await apiClient.requestVoid(
                endpoint: "/api/v1/playlists/\(playlistID)/tracks",
                method: .post,
                body: AddTrackToPlaylistRequest(trackId: trackID)
            )
            await loadPlaylist()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
