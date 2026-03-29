import SwiftUI

/// Displays a paginated, pull-to-refreshable list of all artists.
/// Tapping an artist navigates to ArtistDetailView.
struct ArtistsListView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: ArtistsViewModel
    let playerService: AudioPlayerService

    init(apiClient: APIClient, playerService: AudioPlayerService) {
        _viewModel = State(initialValue: ArtistsViewModel(apiClient: apiClient))
        self.playerService = playerService
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.artists.isEmpty {
                ProgressView("Loading artists...")
            } else if let error = viewModel.error, viewModel.artists.isEmpty {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadArtists() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if viewModel.artists.isEmpty {
                ContentUnavailableView(
                    "No Artists",
                    systemImage: "music.mic",
                    description: Text("Your library is empty. Scan your music folder from the server.")
                )
            } else {
                artistsList
            }
        }
        .navigationTitle("Artists")
        .task {
            if viewModel.artists.isEmpty {
                await viewModel.loadArtists()
            }
        }
        .refreshable {
            await viewModel.loadArtists()
        }
    }

    private var artistsList: some View {
        List {
            ForEach(viewModel.artists) { artist in
                NavigationLink(value: artist) {
                    ArtistRow(artist: artist)
                }
            }

            if viewModel.hasMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowSeparator(.hidden)
                    .task {
                        await viewModel.loadMore()
                    }
            }
        }
        .listStyle(.plain)
        .navigationDestination(for: Artist.self) { artist in
            if let apiClient = appState.apiClient {
                ArtistDetailView(
                    apiClient: apiClient,
                    artistID: artist.id,
                    artistName: artist.name,
                    playerService: playerService
                )
            }
        }
    }
}

// MARK: - Artist Row

struct ArtistRow: View {
    let artist: Artist

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "music.mic")
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .background(Color(.systemGray5))
                .clipShape(Circle())

            Text(artist.name)
                .font(.body)
                .lineLimit(1)
        }
        .padding(.vertical, 2)
    }
}
