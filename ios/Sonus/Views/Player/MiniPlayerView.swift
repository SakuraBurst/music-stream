import SwiftUI

/// A compact player bar displayed at the bottom of the screen on all tabs.
/// Shows cover art, track title/artist, and play/pause + next controls.
/// Tapping the bar opens the full player sheet.
struct MiniPlayerView: View {
    @Environment(AppState.self) private var appState
    let playerService: AudioPlayerService
    let onTap: () -> Void

    var body: some View {
        if let item = playerService.currentItem {
            VStack(spacing: 0) {
                // Progress bar at the top of the mini player.
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color(.systemGray5))

                        Rectangle()
                            .fill(Color.accentColor)
                            .frame(width: progressWidth(in: geometry.size.width))
                    }
                }
                .frame(height: 2)

                HStack(spacing: 12) {
                    // Cover art.
                    CachedAsyncImage(
                        albumID: item.track.albumId,
                        baseURL: appState.serverURL,
                        token: appState.apiClient?.keychain.read(key: .accessToken)
                    ) {
                        ZStack {
                            Color(.systemGray5)
                            Image(systemName: "music.note")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                    // Track info.
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.track.title)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)

                        Text(item.track.artistName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    // Play/Pause button.
                    Button {
                        playerService.togglePlayPause()
                    } label: {
                        Image(systemName: playerService.isPlaying ? "pause.fill" : "play.fill")
                            .font(.title3)
                            .frame(width: 36, height: 36)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    // Next button.
                    Button {
                        playerService.next()
                    } label: {
                        Image(systemName: "forward.fill")
                            .font(.body)
                            .frame(width: 36, height: 36)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(.ultraThinMaterial)
            .contentShape(Rectangle())
            .onTapGesture {
                onTap()
            }
        }
    }

    private func progressWidth(in totalWidth: CGFloat) -> CGFloat {
        guard playerService.duration > 0 else { return 0 }
        let fraction = playerService.currentTime / playerService.duration
        return totalWidth * CGFloat(min(max(fraction, 0), 1))
    }
}
