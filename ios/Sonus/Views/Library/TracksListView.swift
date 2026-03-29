import SwiftUI

/// Displays a paginated, pull-to-refreshable list of all tracks.
/// Shows track number, title, artist, album, and duration.
/// Tapping a track starts playback.
struct TracksListView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: TracksViewModel
    @State private var addToPlaylistTrackID: String?
    let playerService: AudioPlayerService
    var favoritesViewModel: FavoritesViewModel?

    init(apiClient: APIClient, playerService: AudioPlayerService, favoritesViewModel: FavoritesViewModel? = nil) {
        _viewModel = State(initialValue: TracksViewModel(apiClient: apiClient))
        self.playerService = playerService
        self.favoritesViewModel = favoritesViewModel
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.tracks.isEmpty {
                ProgressView("Loading tracks...")
            } else if let error = viewModel.error, viewModel.tracks.isEmpty {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadTracks() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if viewModel.tracks.isEmpty {
                ContentUnavailableView(
                    "No Tracks",
                    systemImage: "music.note",
                    description: Text("Your library is empty.")
                )
            } else {
                tracksList
            }
        }
        .navigationTitle("Tracks")
        .task {
            if viewModel.tracks.isEmpty {
                await viewModel.loadTracks()
            }
        }
        .refreshable {
            await viewModel.loadTracks()
        }
    }

    private var tracksList: some View {
        List {
            ForEach(viewModel.tracks, id: \.id) { track in
                AllTracksRow(
                    track: track,
                    baseURL: appState.serverURL,
                    token: appState.apiClient?.keychain.read(key: .accessToken),
                    isCurrentTrack: playerService.currentItem?.id == track.id,
                    isPlaying: playerService.currentItem?.id == track.id && playerService.isPlaying
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    // Play the tapped track with the current visible list as context.
                    playerService.playTrack(track, inContext: viewModel.tracks)
                }
                .contextMenu {
                    Button {
                        addToPlaylistTrackID = track.id
                    } label: {
                        Label("Add to Playlist", systemImage: "text.badge.plus")
                    }
                    if let favoritesViewModel {
                        Button {
                            let generator = UIImpactFeedbackGenerator(style: .medium)
                            generator.impactOccurred()
                            Task {
                                await favoritesViewModel.toggleFavorite(type: "track", id: track.id)
                            }
                        } label: {
                            Label(
                                favoritesViewModel.isFavorite(type: "track", id: track.id) ? "Remove from Favorites" : "Add to Favorites",
                                systemImage: favoritesViewModel.isFavorite(type: "track", id: track.id) ? "heart.slash" : "heart"
                            )
                        }
                    }
                }
                .swipeActions(edge: .trailing) {
                    if let favoritesViewModel {
                        Button {
                            let generator = UIImpactFeedbackGenerator(style: .medium)
                            generator.impactOccurred()
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
        .sheet(isPresented: Binding(
            get: { addToPlaylistTrackID != nil },
            set: { if !$0 { addToPlaylistTrackID = nil } }
        )) {
            if let trackID = addToPlaylistTrackID, let apiClient = appState.apiClient {
                AddToPlaylistSheet(trackID: trackID, apiClient: apiClient)
            }
        }
    }
}

// MARK: - All Tracks Row

/// A track row that shows cover art, title, artist, album, and duration.
/// Used in the all-tracks listing (not album detail where context is already known).
struct AllTracksRow: View {
    let track: TrackResponse
    let baseURL: String
    let token: String?
    var isCurrentTrack: Bool = false
    var isPlaying: Bool = false

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
