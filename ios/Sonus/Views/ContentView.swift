import SwiftUI

/// Main tab-based root view shown after authentication.
struct ContentView: View {
    @Environment(AppState.self) private var appState
    let playerService: AudioPlayerService
    let favoritesViewModel: FavoritesViewModel

    var body: some View {
        TabView {
            LibraryTab(playerService: playerService, favoritesViewModel: favoritesViewModel)
                .tabItem {
                    Label("Library", systemImage: "music.note.house")
                }

            if let apiClient = appState.apiClient {
                SearchView(
                    apiClient: apiClient,
                    playerService: playerService,
                    favoritesViewModel: favoritesViewModel
                )
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }

                PlaylistsView(
                    apiClient: apiClient,
                    playerService: playerService,
                    favoritesViewModel: favoritesViewModel
                )
                .tabItem {
                    Label("Playlists", systemImage: "music.note.list")
                }

                FavoritesView(
                    favoritesViewModel: favoritesViewModel,
                    playerService: playerService
                )
                .tabItem {
                    Label("Favorites", systemImage: "heart")
                }
            }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        // Add bottom padding when mini player is visible so tab content isn't obscured.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if playerService.hasCurrentItem {
                // Reserve space for the mini player that's rendered in the ZStack above.
                Color.clear.frame(height: 56)
            }
        }
        .task {
            await favoritesViewModel.loadFavorites()
        }
    }
}

// MARK: - Library Tab

/// The Library tab wraps the artists list in a NavigationStack for drill-down.
/// Also provides access to History via toolbar.
struct LibraryTab: View {
    @Environment(AppState.self) private var appState
    let playerService: AudioPlayerService
    let favoritesViewModel: FavoritesViewModel

    var body: some View {
        NavigationStack {
            if let apiClient = appState.apiClient {
                ArtistsListView(apiClient: apiClient, playerService: playerService)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            NavigationLink {
                                HistoryView(apiClient: apiClient, playerService: playerService)
                            } label: {
                                Image(systemName: "clock")
                            }
                        }
                    }
            } else {
                ContentUnavailableView(
                    "Not Connected",
                    systemImage: "wifi.slash",
                    description: Text("Please log in to browse your library.")
                )
            }
        }
    }
}

// MARK: - Settings

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                Section("Server") {
                    LabeledContent("URL", value: appState.serverURL)
                }

                Section {
                    Button("Clear Image Cache", role: .destructive) {
                        Task {
                            await ImageCache.shared.clearAll()
                        }
                    }
                }

                Section {
                    Button("Logout", role: .destructive) {
                        Task {
                            await appState.logout()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
