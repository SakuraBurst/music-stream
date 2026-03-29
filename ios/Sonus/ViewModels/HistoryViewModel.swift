import Foundation
import Observation

/// ViewModel for the listening history screen with pagination.
@Observable
final class HistoryViewModel {
    private(set) var entries: [HistoryEntry] = []
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
    func loadHistory() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentOffset = 0

        do {
            let response: PaginatedResponse<HistoryEntry> = try await apiClient.request(
                endpoint: "/api/v1/history?limit=\(pageSize)&offset=0"
            )
            entries = response.items
            currentOffset = response.items.count
            hasMore = currentOffset < response.total
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Load the next page.
    func loadMore() async {
        guard !isLoadingMore, !isLoading, hasMore else { return }
        isLoadingMore = true

        do {
            let response: PaginatedResponse<HistoryEntry> = try await apiClient.request(
                endpoint: "/api/v1/history?limit=\(pageSize)&offset=\(currentOffset)"
            )
            entries.append(contentsOf: response.items)
            currentOffset += response.items.count
            hasMore = currentOffset < response.total
        } catch {
            self.error = error.localizedDescription
        }

        isLoadingMore = false
    }

    /// Record a listening history entry.
    func recordPlay(trackID: String, duration: Int) async {
        do {
            try await apiClient.requestVoid(
                endpoint: "/api/v1/history",
                method: .post,
                body: AddHistoryRequest(trackId: trackID, duration: duration)
            )
        } catch {
            // Silently fail — history recording is best-effort.
        }
    }
}
