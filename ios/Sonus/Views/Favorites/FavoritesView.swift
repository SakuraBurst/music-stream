import SwiftUI

/// Displays the user's favorites grouped by type (tracks, albums, artists).
struct FavoritesView: View {
    @Environment(AppState.self) private var appState
    let favoritesViewModel: FavoritesViewModel
    let playerService: AudioPlayerService

    /// Tracks loaded by resolving favorite track IDs.
    @State private var favoriteTracks: [TrackResponse] = []
    @State private var favoriteAlbums: [AlbumResponse] = []
    @State private var favoriteArtists: [Artist] = []
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && favoriteTracks.isEmpty && favoriteAlbums.isEmpty && favoriteArtists.isEmpty {
                    ProgressView("Loading favorites...")
                } else if favoritesViewModel.favorites.isEmpty {
                    ContentUnavailableView(
                        "No Favorites",
                        systemImage: "heart",
                        description: Text("Tap the heart icon on tracks, albums, or artists to add them here.")
                    )
                } else {
                    favoritesList
                }
            }
            .navigationTitle("Favorites")
            .task {
                await loadFavoriteDetails()
            }
            .refreshable {
                await favoritesViewModel.loadFavorites()
                await loadFavoriteDetails()
            }
            .onChange(of: favoritesViewModel.favorites.count) { _, _ in
                Task {
                    await loadFavoriteDetails()
                }
            }
        }
    }

    private var favoritesList: some View {
        List {
            // Favorite Tracks.
            if !favoriteTracks.isEmpty {
                Section("Tracks") {
                    ForEach(favoriteTracks, id: \.id) { track in
                        AllTracksRow(
                            track: track,
                            baseURL: appState.serverURL,
                            token: appState.apiClient?.keychain.read(key: .accessToken),
                            isCurrentTrack: playerService.currentItem?.id == track.id,
                            isPlaying: playerService.currentItem?.id == track.id && playerService.isPlaying
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            playerService.playTrack(track, inContext: favoriteTracks)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await favoritesViewModel.toggleFavorite(type: "track", id: track.id)
                                }
                            } label: {
                                Label("Unfavorite", systemImage: "heart.slash")
                            }
                            .tint(.pink)
                        }
                    }
                }
            }

            // Favorite Albums.
            if !favoriteAlbums.isEmpty {
                Section("Albums") {
                    ForEach(favoriteAlbums, id: \.id) { album in
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
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await favoritesViewModel.toggleFavorite(type: "album", id: album.id)
                                }
                            } label: {
                                Label("Unfavorite", systemImage: "heart.slash")
                            }
                            .tint(.pink)
                        }
                    }
                }
            }

            // Favorite Artists.
            if !favoriteArtists.isEmpty {
                Section("Artists") {
                    ForEach(favoriteArtists) { artist in
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
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await favoritesViewModel.toggleFavorite(type: "artist", id: artist.id)
                                }
                            } label: {
                                Label("Unfavorite", systemImage: "heart.slash")
                            }
                            .tint(.pink)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    /// Load detailed data for each favorited item by resolving IDs through the API.
    private func loadFavoriteDetails() async {
        guard let apiClient = appState.apiClient else { return }
        isLoading = true

        // Load favorite tracks.
        let trackIDs = favoritesViewModel.favoriteTrackIDs
        var loadedTracks: [TrackResponse] = []
        for trackID in trackIDs {
            do {
                let track: TrackResponse = try await apiClient.request(
                    endpoint: "/api/v1/tracks/\(trackID)"
                )
                loadedTracks.append(track)
            } catch {
                // Track may have been deleted from library; skip.
            }
        }
        favoriteTracks = loadedTracks

        // Load favorite albums.
        let albumIDs = favoritesViewModel.favoriteAlbumIDs
        var loadedAlbums: [AlbumResponse] = []
        for albumID in albumIDs {
            do {
                let album: AlbumResponse = try await apiClient.request(
                    endpoint: "/api/v1/albums/\(albumID)"
                )
                loadedAlbums.append(album)
            } catch {
                // Album may have been deleted; skip.
            }
        }
        favoriteAlbums = loadedAlbums

        // Load favorite artists.
        let artistIDs = favoritesViewModel.favoriteArtistIDs
        var loadedArtists: [Artist] = []
        for artistID in artistIDs {
            do {
                let detail: ArtistDetail = try await apiClient.request(
                    endpoint: "/api/v1/artists/\(artistID)"
                )
                loadedArtists.append(Artist(
                    id: detail.id,
                    name: detail.name,
                    sortName: detail.sortName,
                    createdAt: detail.createdAt
                ))
            } catch {
                // Artist may have been deleted; skip.
            }
        }
        favoriteArtists = loadedArtists

        isLoading = false
    }
}
