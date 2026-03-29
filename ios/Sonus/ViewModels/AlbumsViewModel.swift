import Foundation
import Observation

/// ViewModel for the albums grid with pagination and pull-to-refresh.
/// Used when browsing all albums (not within an artist detail).
@Observable
final class AlbumsViewModel {
    private(set) var albums: [AlbumResponse] = []
    private(set) var isLoading = false
    private(set) var isLoadingMore = false
    private(set) var error: String?
    private(set) var hasMore = true

    private let apiClient: APIClient
    private let pageSize = 50
    private var currentOffset = 0

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// Load the first page. Used for initial load and pull-to-refresh.
    func loadAlbums() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentOffset = 0

        do {
            let response: PaginatedResponse<AlbumResponse> = try await apiClient.request(
                endpoint: "/api/v1/albums?limit=\(pageSize)&offset=0"
            )
            albums = response.items
            currentOffset = response.items.count
            hasMore = currentOffset < response.total
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Load the next page. Called when scrolling near the bottom.
    func loadMore() async {
        guard !isLoadingMore, !isLoading, hasMore else { return }
        isLoadingMore = true

        do {
            let response: PaginatedResponse<AlbumResponse> = try await apiClient.request(
                endpoint: "/api/v1/albums?limit=\(pageSize)&offset=\(currentOffset)"
            )
            albums.append(contentsOf: response.items)
            currentOffset += response.items.count
            hasMore = currentOffset < response.total
        } catch {
            self.error = error.localizedDescription
        }

        isLoadingMore = false
    }
}
