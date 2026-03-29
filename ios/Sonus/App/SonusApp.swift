import AVFoundation
import SwiftUI

@main
struct SonusApp: App {
    @State private var appState = AppState()

    init() {
        configureAudioSession()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }

    /// Configure AVAudioSession for background audio playback.
    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }
}

/// RootView switches between auth flow and main content based on authentication state.
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            switch appState.authState {
            case .loading:
                ProgressView("Loading...")
            case .unauthenticated:
                LoginView()
            case .authenticated:
                if let apiClient = appState.apiClient {
                    AuthenticatedRootView(apiClient: apiClient)
                } else {
                    ProgressView("Connecting...")
                }
            }
        }
        .task {
            await appState.checkExistingAuth()
        }
    }
}

/// The root view shown when authenticated.
/// Owns the AudioPlayerService, NowPlayingService, and FavoritesViewModel.
/// Displays ContentView with MiniPlayerView overlay.
struct AuthenticatedRootView: View {
    @Environment(AppState.self) private var appState
    @State private var playerService: AudioPlayerService
    @State private var nowPlayingService: NowPlayingService
    @State private var favoritesViewModel: FavoritesViewModel
    @State private var showFullPlayer = false

    /// Track the last item ID we updated Now Playing for, so we re-fetch artwork on track change.
    @State private var lastNowPlayingItemID: String?

    init(apiClient: APIClient) {
        let player = AudioPlayerService(apiClient: apiClient)
        _playerService = State(initialValue: player)
        _nowPlayingService = State(initialValue: NowPlayingService(playerService: player))
        _favoritesViewModel = State(initialValue: FavoritesViewModel(apiClient: apiClient))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ContentView(playerService: playerService, favoritesViewModel: favoritesViewModel)

            MiniPlayerView(playerService: playerService) {
                showFullPlayer = true
            }
        }
        .sheet(isPresented: $showFullPlayer) {
            FullPlayerView(playerService: playerService)
        }
        .onAppear {
            nowPlayingService.configure()
        }
        .onChange(of: playerService.currentItem?.id) { _, newID in
            nowPlayingService.updateNowPlaying()
            if newID != lastNowPlayingItemID {
                lastNowPlayingItemID = newID
                Task {
                    await nowPlayingService.updateArtwork(
                        baseURL: appState.serverURL,
                        token: appState.apiClient?.keychain.read(key: .accessToken)
                    )
                }
            }
        }
        .onChange(of: playerService.isPlaying) { _, _ in
            nowPlayingService.updatePlaybackPosition()
        }
        .onChange(of: playerService.currentTime) { _, _ in
            // Throttle: only update every ~5 seconds to avoid excessive updates.
            let rounded = Int(playerService.currentTime)
            if rounded % 5 == 0 {
                nowPlayingService.updatePlaybackPosition()
            }
        }
    }
}
