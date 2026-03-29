import Foundation
import Observation

/// ViewModel for the search screen with debounced API calls.
@Observable
final class SearchViewModel {
    private(set) var artists: [Artist] = []
    private(set) var albums: [AlbumResponse] = []
    private(set) var tracks: [TrackResponse] = []
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var hasSearched = false

    var query: String = "" {
        didSet {
            guard oldValue != query else { return }
            scheduleSearch()
        }
    }

    private let apiClient: APIClient
    private var searchTask: Task<Void, Never>?

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// Cancel any pending search and schedule a new one with debounce.
    private func scheduleSearch() {
        searchTask?.cancel()

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            artists = []
            albums = []
            tracks = []
            hasSearched = false
            error = nil
            return
        }

        searchTask = Task { @MainActor in
            // Debounce: wait 400ms before searching.
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await performSearch(query: trimmed)
        }
    }

    /// Perform the actual search API call.
    @MainActor
    private func performSearch(query: String) async {
        isLoading = true
        error = nil

        do {
            let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            let result: SearchResponse = try await apiClient.request(
                endpoint: "/api/v1/search?q=\(encoded)&type=all"
            )
            // Only update if this is still the current query.
            guard !Task.isCancelled else { return }
            artists = result.artists
            albums = result.albums
            tracks = result.tracks
            hasSearched = true
        } catch {
            guard !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
