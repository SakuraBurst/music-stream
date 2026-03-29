import Foundation
import Observation

/// ViewModel for the artist detail screen showing the artist's albums.
@Observable
final class ArtistDetailViewModel {
    private(set) var artistDetail: ArtistDetail?
    private(set) var isLoading = false
    private(set) var error: String?

    private let apiClient: APIClient
    let artistID: String
    let artistName: String

    init(apiClient: APIClient, artistID: String, artistName: String) {
        self.apiClient = apiClient
        self.artistID = artistID
        self.artistName = artistName
    }

    /// Load the artist detail including their albums.
    func loadArtist() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            let detail: ArtistDetail = try await apiClient.request(
                endpoint: "/api/v1/artists/\(artistID)"
            )
            artistDetail = detail
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
