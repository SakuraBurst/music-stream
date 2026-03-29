import SwiftUI

/// Displays an artist's albums in a grid layout with cover art.
/// Tapping an album navigates to AlbumDetailView.
struct ArtistDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: ArtistDetailViewModel
    let playerService: AudioPlayerService

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    init(apiClient: APIClient, artistID: String, artistName: String, playerService: AudioPlayerService) {
        _viewModel = State(initialValue: ArtistDetailViewModel(
            apiClient: apiClient,
            artistID: artistID,
            artistName: artistName
        ))
        self.playerService = playerService
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.artistDetail == nil {
                ProgressView("Loading albums...")
            } else if let error = viewModel.error, viewModel.artistDetail == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadArtist() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if let detail = viewModel.artistDetail {
                albumsContent(detail: detail)
            }
        }
        .navigationTitle(viewModel.artistName)
        .navigationBarTitleDisplayMode(.large)
        .task {
            if viewModel.artistDetail == nil {
                await viewModel.loadArtist()
            }
        }
        .refreshable {
            await viewModel.loadArtist()
        }
    }

    @ViewBuilder
    private func albumsContent(detail: ArtistDetail) -> some View {
        if detail.albums.isEmpty {
            ContentUnavailableView(
                "No Albums",
                systemImage: "square.stack",
                description: Text("No albums found for this artist.")
            )
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(detail.albums) { album in
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
                            AlbumGridItem(
                                album: album,
                                baseURL: appState.serverURL,
                                token: appState.apiClient?.keychain.read(key: .accessToken)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
    }
}

// MARK: - Album Grid Item

struct AlbumGridItem: View {
    let album: Album
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

            if let year = album.year {
                Text(String(year))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
