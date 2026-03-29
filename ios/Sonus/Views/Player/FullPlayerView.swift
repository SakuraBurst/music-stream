import MediaPlayer
import SwiftUI

/// Full-screen player view presented as a sheet.
/// Shows album art, track info, seekable progress bar, playback controls,
/// volume slider, and shuffle/repeat toggles.
struct FullPlayerView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let playerService: AudioPlayerService

    @State private var isSeeking = false
    @State private var seekTime: Double = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Spacer()

                // Album artwork.
                albumArtwork
                    .padding(.horizontal, 40)

                Spacer()
                    .frame(height: 32)

                // Track info.
                trackInfo
                    .padding(.horizontal, 24)

                Spacer()
                    .frame(height: 24)

                // Progress bar.
                progressSection
                    .padding(.horizontal, 24)

                Spacer()
                    .frame(height: 24)

                // Playback controls.
                playbackControls
                    .padding(.horizontal, 24)

                Spacer()
                    .frame(height: 24)

                // Volume slider.
                volumeSlider
                    .padding(.horizontal, 24)

                Spacer()
                    .frame(height: 16)

                // Shuffle and repeat.
                bottomControls
                    .padding(.horizontal, 24)

                Spacer()
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.body.weight(.medium))
                    }
                }
            }
        }
    }

    // MARK: - Album Artwork

    @ViewBuilder
    private var albumArtwork: some View {
        if let item = playerService.currentItem {
            CachedAsyncImage(
                albumID: item.track.albumId,
                baseURL: appState.serverURL,
                token: appState.apiClient?.keychain.read(key: .accessToken)
            ) {
                ZStack {
                    Color(.systemGray5)
                    Image(systemName: "music.note")
                        .font(.system(size: 60))
                        .foregroundStyle(.secondary)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(radius: 8, y: 4)
        }
    }

    // MARK: - Track Info

    @ViewBuilder
    private var trackInfo: some View {
        if let item = playerService.currentItem {
            VStack(spacing: 4) {
                Text(item.track.title)
                    .font(.title3.bold())
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(item.track.artistName)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Progress

    private var progressSection: some View {
        VStack(spacing: 4) {
            Slider(
                value: Binding(
                    get: { isSeeking ? seekTime : playerService.currentTime },
                    set: { newValue in
                        isSeeking = true
                        seekTime = newValue
                    }
                ),
                in: 0...max(playerService.duration, 1),
                onEditingChanged: { editing in
                    if !editing {
                        playerService.seek(to: seekTime)
                        isSeeking = false
                    }
                }
            )
            .tint(.primary)

            HStack {
                Text(formatTime(isSeeking ? seekTime : playerService.currentTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)

                Spacer()

                Text("-\(formatTime(max(playerService.duration - (isSeeking ? seekTime : playerService.currentTime), 0)))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Playback Controls

    private var playbackControls: some View {
        HStack(spacing: 0) {
            Spacer()

            // Previous.
            Button {
                playerService.previous()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title2)
                    .frame(width: 56, height: 56)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer()

            // Play/Pause.
            Button {
                playerService.togglePlayPause()
            } label: {
                Image(systemName: playerService.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 64))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer()

            // Next.
            Button {
                playerService.next()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .frame(width: 56, height: 56)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer()
        }
    }

    // MARK: - Volume

    private var volumeSlider: some View {
        HStack(spacing: 8) {
            Image(systemName: "speaker.fill")
                .font(.caption)
                .foregroundStyle(.secondary)

            // We use the system volume view for proper volume control.
            // A custom slider here controls AVPlayer volume (app-level).
            SystemVolumeView()
                .frame(height: 32)

            Image(systemName: "speaker.wave.3.fill")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Bottom Controls

    private var bottomControls: some View {
        HStack {
            // Shuffle.
            Button {
                playerService.isShuffleEnabled.toggle()
            } label: {
                Image(systemName: "shuffle")
                    .font(.body)
                    .foregroundStyle(playerService.isShuffleEnabled ? .accentColor : .secondary)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer()

            // Repeat.
            Button {
                playerService.cycleRepeatMode()
            } label: {
                repeatIcon
                    .font(.body)
                    .foregroundStyle(playerService.repeatMode != .off ? .accentColor : .secondary)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var repeatIcon: some View {
        switch playerService.repeatMode {
        case .off, .all:
            Image(systemName: "repeat")
        case .one:
            Image(systemName: "repeat.1")
        }
    }

    // MARK: - Helpers

    private func formatTime(_ totalSeconds: Double) -> String {
        let total = Int(max(totalSeconds, 0))
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - System Volume View

/// Wraps MPVolumeView for system volume control (hardware volume buttons sync).
struct SystemVolumeView: UIViewRepresentable {
    func makeUIView(context: Context) -> MPVolumeView {
        let view = MPVolumeView()
        view.showsRouteButton = false
        return view
    }

    func updateUIView(_ uiView: MPVolumeView, context: Context) {}
}
