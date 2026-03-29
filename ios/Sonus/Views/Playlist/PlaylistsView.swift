import SwiftUI

/// Displays the user's playlists with create, delete, and navigation capabilities.
struct PlaylistsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: PlaylistsViewModel
    @State private var showCreateSheet = false
    @State private var newPlaylistName = ""
    let playerService: AudioPlayerService
    let favoritesViewModel: FavoritesViewModel

    init(apiClient: APIClient, playerService: AudioPlayerService, favoritesViewModel: FavoritesViewModel) {
        _viewModel = State(initialValue: PlaylistsViewModel(apiClient: apiClient))
        self.playerService = playerService
        self.favoritesViewModel = favoritesViewModel
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.playlists.isEmpty {
                    ProgressView("Loading playlists...")
                } else if let error = viewModel.error, viewModel.playlists.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") {
                            Task { await viewModel.loadPlaylists() }
                        }
                        .buttonStyle(.bordered)
                    }
                } else if viewModel.playlists.isEmpty {
                    ContentUnavailableView(
                        "No Playlists",
                        systemImage: "music.note.list",
                        description: Text("Create your first playlist to get started.")
                    )
                } else {
                    playlistsList
                }
            }
            .navigationTitle("Playlists")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        newPlaylistName = ""
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task {
                if viewModel.playlists.isEmpty {
                    await viewModel.loadPlaylists()
                }
            }
            .refreshable {
                await viewModel.loadPlaylists()
            }
            .alert("New Playlist", isPresented: $showCreateSheet) {
                TextField("Playlist name", text: $newPlaylistName)
                Button("Cancel", role: .cancel) {}
                Button("Create") {
                    let name = newPlaylistName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    Task {
                        _ = await viewModel.createPlaylist(name: name)
                    }
                }
            } message: {
                Text("Enter a name for your new playlist.")
            }
        }
    }

    private var playlistsList: some View {
        List {
            ForEach(viewModel.playlists) { playlist in
                NavigationLink {
                    if let apiClient = appState.apiClient {
                        PlaylistDetailView(
                            apiClient: apiClient,
                            playlistID: playlist.id,
                            playlistName: playlist.name,
                            playerService: playerService,
                            favoritesViewModel: favoritesViewModel
                        )
                    }
                } label: {
                    PlaylistRow(playlist: playlist)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        Task {
                            await viewModel.deletePlaylist(id: playlist.id)
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}

// MARK: - Playlist Row

struct PlaylistRow: View {
    let playlist: Playlist

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .background(Color(.systemGray5))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(playlist.name)
                    .font(.body)
                    .lineLimit(1)

                if let description = playlist.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
