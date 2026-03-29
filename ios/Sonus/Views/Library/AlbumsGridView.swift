import SwiftUI

/// Displays a paginated grid of all albums with cover art.
/// Used as a sub-view within the Library tab.
struct AlbumsGridView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: AlbumsViewModel
    let playerService: AudioPlayerService

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    init(apiClient: APIClient, playerService: AudioPlayerService) {
        _viewModel = State(initialValue: AlbumsViewModel(apiClient: apiClient))
        self.playerService = playerService
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.albums.isEmpty {
                ProgressView("Loading albums...")
            } else if let error = viewModel.error, viewModel.albums.isEmpty {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadAlbums() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if viewModel.albums.isEmpty {
                ContentUnavailableView(
                    "No Albums",
                    systemImage: "square.stack",
                    description: Text("Your library is empty.")
                )
            } else {
                albumsGrid
            }
        }
        .navigationTitle("Albums")
        .task {
            if viewModel.albums.isEmpty {
                await viewModel.loadAlbums()
            }
        }
        .refreshable {
            await viewModel.loadAlbums()
        }
    }

    private var albumsGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 16) {
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
                        AlbumResponseGridItem(
                            album: album,
                            baseURL: appState.serverURL,
                            token: appState.apiClient?.keychain.read(key: .accessToken)
                        )
                    }
                    .buttonStyle(.plain)
                }

                if viewModel.hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .task {
                            await viewModel.loadMore()
                        }
                }
            }
            .padding()
        }
    }
}

// MARK: - Album Response Grid Item

/// Grid item for AlbumResponse (used in the all-albums grid, has artistName).
struct AlbumResponseGridItem: View {
    let album: AlbumResponse
    let baseURL: String
    let token: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CachedAsyncImage(
                albumID: album.id,
                baseURL: baseURL,
                token: token
            ) {
                ZStack {
                    Color(.systemGray5)
                    Image(systemName: "music.note")
                        .font(.system(size: 30))
                        .foregroundStyle(.secondary)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Text(album.name)
                .font(.subheadline.weight(.medium))
                .lineLimit(2)

            Text(album.artistName)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}
