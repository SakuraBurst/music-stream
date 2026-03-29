import SwiftUI

/// A sheet that lets the user pick a playlist to add a track to.
struct AddToPlaylistSheet: View {
    let trackID: String
    let apiClient: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var playlists: [Playlist] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var addedToPlaylist: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading playlists...")
                } else if let error {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    }
                } else if playlists.isEmpty {
                    ContentUnavailableView(
                        "No Playlists",
                        systemImage: "music.note.list",
                        description: Text("Create a playlist first from the Playlists tab.")
                    )
                } else {
                    List {
                        ForEach(playlists) { playlist in
                            Button {
                                Task {
                                    await addTrack(to: playlist.id)
                                    addedToPlaylist = playlist.name
                                    try? await Task.sleep(nanoseconds: 500_000_000)
                                    dismiss()
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "music.note.list")
                                        .foregroundStyle(.secondary)
                                    Text(playlist.name)
                                    Spacer()
                                    if addedToPlaylist == playlist.name {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Add to Playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .task {
                await loadPlaylists()
            }
        }
    }

    private func loadPlaylists() async {
        do {
            let result: [Playlist] = try await apiClient.request(
                endpoint: "/api/v1/playlists"
            )
            playlists = result
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func addTrack(to playlistID: String) async {
        do {
            try await apiClient.requestVoid(
                endpoint: "/api/v1/playlists/\(playlistID)/tracks",
                method: .post,
                body: AddTrackToPlaylistRequest(trackId: trackID)
            )
        } catch {
            self.error = error.localizedDescription
        }
    }
}
