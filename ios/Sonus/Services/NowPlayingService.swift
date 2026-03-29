import Foundation
import MediaPlayer
import UIKit

/// Manages the MPNowPlayingInfoCenter and MPRemoteCommandCenter for lock screen controls,
/// Control Center, and CarPlay integration.
@MainActor
final class NowPlayingService {
    private let playerService: AudioPlayerService
    private let commandCenter = MPRemoteCommandCenter.shared()
    private var isConfigured = false

    init(playerService: AudioPlayerService) {
        self.playerService = playerService
    }

    /// Configure remote command targets. Call once after the audio session is set up.
    func configure() {
        guard !isConfigured else { return }
        isConfigured = true

        // Play
        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                self.playerService.resume()
            }
            return .success
        }

        // Pause
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                self.playerService.pause()
            }
            return .success
        }

        // Toggle play/pause
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                self.playerService.togglePlayPause()
            }
            return .success
        }

        // Next track
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                self.playerService.next()
            }
            return .success
        }

        // Previous track
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in
                self.playerService.previous()
            }
            return .success
        }

        // Seek (change playback position)
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self,
                  let posEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            Task { @MainActor in
                self.playerService.seek(to: posEvent.positionTime)
            }
            return .success
        }
    }

    /// Update the Now Playing info center with the current track metadata.
    /// Call this whenever the current track changes or playback state updates.
    func updateNowPlaying() {
        guard let item = playerService.currentItem else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        let track = item.track
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artistName,
            MPMediaItemPropertyAlbumTitle: track.albumName,
            MPMediaItemPropertyPlaybackDuration: playerService.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: playerService.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: playerService.isPlaying ? 1.0 : 0.0,
        ]

        if let trackNumber = track.trackNumber {
            info[MPMediaItemPropertyAlbumTrackNumber] = trackNumber
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    /// Update Now Playing info with artwork loaded from the ImageCache.
    func updateArtwork(baseURL: String, token: String?) async {
        guard let item = playerService.currentItem else { return }

        let image = await ImageCache.shared.image(
            for: item.track.albumId,
            baseURL: baseURL,
            token: token
        )

        guard let image else { return }

        let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }

        if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
            info[MPMediaItemPropertyArtwork] = artwork
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }

    /// Update just the playback position and rate (called frequently during playback).
    func updatePlaybackPosition() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = playerService.currentTime
        info[MPNowPlayingInfoPropertyPlaybackRate] = playerService.isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
