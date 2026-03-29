import SwiftUI

/// Displays an album's tracks with track number, title, and duration.
/// Shows album cover art as a header. Tapping a track starts playback with the full album as queue.
struct AlbumDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: AlbumDetailViewModel
    @State private var addToPlaylistTrackID: String?
    let playerService: AudioPlayerService
    var favoritesViewModel: FavoritesViewModel?

    init(apiClient: APIClient, albumID: String, albumName: String, playerService: AudioPlayerService, favoritesViewModel: FavoritesViewModel? = nil) {
        _viewModel = State(initialValue: AlbumDetailViewModel(
            apiClient: apiClient,
            albumID: albumID,
            albumName: albumName
        ))
        self.playerService = playerService
        self.favoritesViewModel = favoritesViewModel
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.albumDetail == nil {
                ProgressView("Loading tracks...")
            } else if let error = viewModel.error, viewModel.albumDetail == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadAlbum() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if let detail = viewModel.albumDetail {
                albumContent(detail: detail)
            }
        }
        .navigationTitle(viewModel.albumName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.albumDetail == nil {
                await viewModel.loadAlbum()
            }
        }
        .refreshable {
            await viewModel.loadAlbum()
        }
        .sheet(isPresented: Binding(
            get: { addToPlaylistTrackID != nil },
            set: { if !$0 { addToPlaylistTrackID = nil } }
        )) {
            if let trackID = addToPlaylistTrackID, let apiClient = appState.apiClient {
                AddToPlaylistSheet(trackID: trackID, apiClient: apiClient)
            }
        }
    }

    private func albumContent(detail: AlbumDetail) -> some View {
        let allTracks = sortedAlbumTracks(detail.tracks)
        let discs = Dictionary(grouping: detail.tracks, by: \.discNumber)
        let sortedDiscNumbers = discs.keys.sorted()
        let showDiscHeaders = sortedDiscNumbers.count > 1

        return List {
            // Album header with cover art, metadata, and play button.
            Section {
                AlbumHeaderView(
                    detail: detail,
                    baseURL: appState.serverURL,
                    token: appState.apiClient?.keychain.read(key: .accessToken),
                    onPlayAll: {
                        playerService.playAlbum(tracks: allTracks)
                    },
                    onShuffleAll: {
                        playerService.isShuffleEnabled = true
                        playerService.playAlbum(tracks: allTracks)
                    }
                )
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            // Tracks grouped by disc number.
            ForEach(sortedDiscNumbers, id: \.self) { discNumber in
                Section {
                    ForEach(sortedTracks(discs[discNumber] ?? []), id: \.id) { track in
                        TrackRow(
                            track: track,
                            isCurrentTrack: playerService.currentItem?.id == track.id,
                            isPlaying: playerService.currentItem?.id == track.id && playerService.isPlaying
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerService.playTrack(track, inContext: allTracks)
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
                    }
                } header: {
                    if showDiscHeaders {
                        Text("Disc \(discNumber)")
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    /// Sort all tracks in album order (disc number, then track number) for queue building.
    private func sortedAlbumTracks(_ tracks: [TrackResponse]) -> [TrackResponse] {
        tracks.sorted {
            if $0.discNumber != $1.discNumber {
                return $0.discNumber < $1.discNumber
            }
            return ($0.trackNumber ?? 0) < ($1.trackNumber ?? 0)
        }
    }

    private func sortedTracks(_ tracks: [TrackResponse]) -> [TrackResponse] {
        tracks.sorted { ($0.trackNumber ?? 0) < ($1.trackNumber ?? 0) }
    }
}

// MARK: - Album Header

struct AlbumHeaderView: View {
    let detail: AlbumDetail
    let baseURL: String
    let token: String?
    var onPlayAll: (() -> Void)?
    var onShuffleAll: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            CachedAsyncImage(
                albumID: detail.id,
                baseURL: baseURL,
                token: token
            ) {
                ZStack {
                    Color(.systemGray5)
                    Image(systemName: "music.note")
                        .font(.system(size: 50))
                        .foregroundStyle(.secondary)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: 280)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 4, y: 2)

            VStack(spacing: 4) {
                Text(detail.name)
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)

                Text(detail.artistName)
                    .font(.body)
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    if let year = detail.year {
                        Text(String(year))
                    }
                    if let genre = detail.genre, !genre.isEmpty {
                        Text(genre)
                    }
                    Text(formatDuration(detail.durationSeconds))
                }
                .font(.caption)
                .foregroundStyle(.tertiary)
            }

            // Play / Shuffle buttons.
            if onPlayAll != nil || onShuffleAll != nil {
                HStack(spacing: 12) {
                    if let onPlayAll {
                        Button {
                            onPlayAll()
                        } label: {
                            Label("Play", systemImage: "play.fill")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                    }

                    if let onShuffleAll {
                        Button {
                            onShuffleAll()
                        } label: {
                            Label("Shuffle", systemImage: "shuffle")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    private func formatDuration(_ totalSeconds: Int) -> String {
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        if hours > 0 {
            return "\(hours) hr \(minutes) min"
        }
        return "\(minutes) min"
    }
}

// MARK: - Track Row

struct TrackRow: View {
    let track: TrackResponse
    var isCurrentTrack: Bool = false
    var isPlaying: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // Track number or now-playing indicator.
            Group {
                if isCurrentTrack {
                    Image(systemName: isPlaying ? "speaker.wave.2.fill" : "speaker.fill")
                        .font(.caption)
                        .foregroundStyle(.accentColor)
                } else {
                    Text(track.trackNumber.map { String($0) } ?? "-")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 28, alignment: .trailing)

            // Title and artist.
            VStack(alignment: .leading, spacing: 2) {
                Text(track.title)
                    .font(.body)
                    .foregroundStyle(isCurrentTrack ? .accentColor : .primary)
                    .lineLimit(1)

                Text(track.artistName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Duration.
            Text(formatTrackDuration(track.durationSeconds))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    private func formatTrackDuration(_ totalSeconds: Int) -> String {
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
