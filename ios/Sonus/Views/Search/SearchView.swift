import SwiftUI

/// Search screen with debounced text field and results grouped by type.
struct SearchView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: SearchViewModel
    let playerService: AudioPlayerService
    let favoritesViewModel: FavoritesViewModel

    init(apiClient: APIClient, playerService: AudioPlayerService, favoritesViewModel: FavoritesViewModel) {
        _viewModel = State(initialValue: SearchViewModel(apiClient: apiClient))
        self.playerService = playerService
        self.favoritesViewModel = favoritesViewModel
    }

    var body: some View {
        NavigationStack {
            Group {
                if !viewModel.hasSearched && viewModel.query.isEmpty {
                    ContentUnavailableView(
                        "Search Music",
                        systemImage: "magnifyingglass",
                        description: Text("Find artists, albums, and tracks.")
                    )
                } else if viewModel.isLoading && !viewModel.hasSearched {
                    ProgressView("Searching...")
                } else if let error = viewModel.error {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    }
                } else if viewModel.hasSearched && noResults {
                    ContentUnavailableView(
                        "No Results",
                        systemImage: "magnifyingglass",
                        description: Text("No results for \"\(viewModel.query)\".")
                    )
                } else {
                    searchResults
                }
            }
            .navigationTitle("Search")
            .searchable(
                text: Binding(
                    get: { viewModel.query },
                    set: { viewModel.query = $0 }
                ),
                prompt: "Artists, albums, tracks"
            )
            .overlay {
                if viewModel.isLoading && viewModel.hasSearched {
                    VStack {
                        HStack {
                            Spacer()
                            ProgressView()
                                .padding(8)
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    private var noResults: Bool {
        viewModel.artists.isEmpty && viewModel.albums.isEmpty && viewModel.tracks.isEmpty
    }

    private var searchResults: some View {
        List {
            // Artists section.
            if !viewModel.artists.isEmpty {
                Section("Artists") {
                    ForEach(viewModel.artists) { artist in
                        NavigationLink {
                            if let apiClient = appState.apiClient {
                                ArtistDetailView(
                                    apiClient: apiClient,
                                    artistID: artist.id,
                                    artistName: artist.name,
                                    playerService: playerService
                                )
                            }
                        } label: {
                            ArtistRow(artist: artist)
                        }
                    }
                }
            }

            // Albums section.
            if !viewModel.albums.isEmpty {
                Section("Albums") {
                    ForEach(viewModel.albums, id: \.id) { album in
                        NavigationLink {
                            if let apiClient = appState.apiClient {
                                AlbumDetailView(
                                    apiClient: apiClient,
                                    albumID: album.id,
                                    albumName: album.name,
                                    playerService: playerService
                                )
                            }
                        } label: {
                            SearchAlbumRow(
                                album: album,
                                baseURL: appState.serverURL,
                                token: appState.apiClient?.keychain.read(key: .accessToken)
                            )
                        }
                    }
                }
            }

            // Tracks section.
            if !viewModel.tracks.isEmpty {
                Section("Tracks") {
                    ForEach(viewModel.tracks, id: \.id) { track in
                        SearchTrackRow(
                            track: track,
                            baseURL: appState.serverURL,
                            token: appState.apiClient?.keychain.read(key: .accessToken),
                            isCurrentTrack: playerService.currentItem?.id == track.id,
                            isPlaying: playerService.currentItem?.id == track.id && playerService.isPlaying,
                            isFavorite: favoritesViewModel.isFavorite(type: "track", id: track.id)
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerService.playTrack(track, inContext: viewModel.tracks)
                        }
                        .swipeActions(edge: .trailing) {
                            Button {
                                Task {
                                    await favoritesViewModel.toggleFavorite(type: "track", id: track.id)
                                }
                            } label: {
                                Label(
                                    favoritesViewModel.isFavorite(type: "track", id: track.id) ? "Unfavorite" : "Favorite",
                                    systemImage: favoritesViewModel.isFavorite(type: "track", id: track.id) ? "heart.slash" : "heart"
                                )
                            }
                            .tint(.pink)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}

// MARK: - Search Album Row

struct SearchAlbumRow: View {
    let album: AlbumResponse
    let baseURL: String
    let token: String?

    var body: some View {
        HStack(spacing: 12) {
            CachedAsyncImage(
                albumID: album.id,
                baseURL: baseURL,
                token: token
            ) {
                ZStack {
                    Color(.systemGray5)
                    Image(systemName: "music.note")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(album.name)
                    .font(.body)
                    .lineLimit(1)

                Text(album.artistName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Search Track Row

struct SearchTrackRow: View {
    let track: TrackResponse
    let baseURL: String
    let token: String?
    var isCurrentTrack: Bool = false
    var isPlaying: Bool = false
    var isFavorite: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            CachedAsyncImage(
                albumID: track.albumId,
                baseURL: baseURL,
                token: token
            ) {
                ZStack {
                    Color(.systemGray5)
                    Image(systemName: "music.note")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(track.title)
                    .font(.body)
                    .foregroundStyle(isCurrentTrack ? .accentColor : .primary)
                    .lineLimit(1)

                Text("\(track.artistName) — \(track.albumName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if isFavorite {
                Image(systemName: "heart.fill")
                    .font(.caption)
                    .foregroundStyle(.pink)
            }

            if isCurrentTrack {
                Image(systemName: isPlaying ? "speaker.wave.2.fill" : "speaker.fill")
                    .font(.caption)
                    .foregroundStyle(.accentColor)
            }

            Text(formatDuration(track.durationSeconds))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    private func formatDuration(_ totalSeconds: Int) -> String {
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
