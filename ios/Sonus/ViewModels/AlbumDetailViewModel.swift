import Foundation
import Observation

/// ViewModel for the album detail screen showing the album's tracks.
@Observable
final class AlbumDetailViewModel {
    private(set) var albumDetail: AlbumDetail?
    private(set) var isLoading = false
    private(set) var error: String?

    private let apiClient: APIClient
    let albumID: String
    let albumName: String

    init(apiClient: APIClient, albumID: String, albumName: String) {
        self.apiClient = apiClient
        self.albumID = albumID
        self.albumName = albumName
    }

    /// Load the album detail including its tracks.
    func loadAlbum() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            let detail: AlbumDetail = try await apiClient.request(
                endpoint: "/api/v1/albums/\(albumID)"
            )
            albumDetail = detail
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
