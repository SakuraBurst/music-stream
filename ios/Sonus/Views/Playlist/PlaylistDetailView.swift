import SwiftUI

/// Displays a playlist's tracks with playback, swipe-to-delete, and add track capabilities.
struct PlaylistDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: PlaylistDetailViewModel
    let playerService: AudioPlayerService
    let favoritesViewModel: FavoritesViewModel

    init(
        apiClient: APIClient,
        playlistID: String,
        playlistName: String,
        playerService: AudioPlayerService,
        favoritesViewModel: FavoritesViewModel
    ) {
        _viewModel = State(initialValue: PlaylistDetailViewModel(
            apiClient: apiClient,
            playlistID: playlistID,
            playlistName: playlistName
        ))
        self.playerService = playerService
        self.favoritesViewModel = favoritesViewModel
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.detail == nil {
                ProgressView("Loading playlist...")
            } else if let error = viewModel.error, viewModel.detail == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadPlaylist() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if let detail = viewModel.detail {
                playlistContent(detail: detail)
            }
        }
        .navigationTitle(viewModel.playlistName)
        .navigationBarTitleDisplayMode(.large)
        .task {
            if viewModel.detail == nil {
                await viewModel.loadPlaylist()
            }
        }
        .refreshable {
            await viewModel.loadPlaylist()
        }
    }

    private func playlistContent(detail: PlaylistDetail) -> some View {
        Group {
            if detail.tracks.isEmpty {
                ContentUnavailableView(
                    "Empty Playlist",
                    systemImage: "music.note.list",
                    description: Text("Add tracks from the library or search.")
                )
            } else {
                List {
                    // Play All / Shuffle buttons.
                    Section {
                        HStack(spacing: 12) {
                            Button {
                                playerService.playAlbum(tracks: detail.tracks)
                            } label: {
                                Label("Play All", systemImage: "play.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.borderedProminent)

                            Button {
                                playerService.isShuffleEnabled = true
                                playerService.playAlbum(tracks: detail.tracks)
                            } label: {
                                Label("Shuffle", systemImage: "shuffle")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.bordered)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    }

                    // Track list.
                    Section {
                        ForEach(Array(detail.tracks.enumerated()), id: \.element.id) { index, track in
                            PlaylistTrackRow(
                                track: track,
                                position: index + 1,
                                baseURL: appState.serverURL,
                                token: appState.apiClient?.keychain.read(key: .accessToken),
                                isCurrentTrack: playerService.currentItem?.id == track.id,
                                isPlaying: playerService.currentItem?.id == track.id && playerService.isPlaying,
                                isFavorite: favoritesViewModel.isFavorite(type: "track", id: track.id)
                            )
                            .contentShape(Rectangle())
                            .onTapGesture {
                                playerService.playTrack(track, inContext: detail.tracks)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.removeTrack(trackID: track.id)
                                    }
                                } label: {
                                    Label("Remove", systemImage: "minus.circle")
                                }
                            }
                            .swipeActions(edge: .leading) {
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
                    } header: {
                        Text("\(detail.tracks.count) tracks")
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}

// MARK: - Playlist Track Row

struct PlaylistTrackRow: View {
    let track: TrackResponse
    let position: Int
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
