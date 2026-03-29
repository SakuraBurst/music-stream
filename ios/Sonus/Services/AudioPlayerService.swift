import AVFoundation
import Foundation
import Observation

/// Repeat mode for the play queue.
enum RepeatMode: Sendable {
    case off
    case all
    case one
}

/// An item in the play queue, combining the track metadata with its stream URL.
struct QueueItem: Identifiable, Equatable {
    let id: String
    let track: TrackResponse
    let streamURL: URL

    static func == (lhs: QueueItem, rhs: QueueItem) -> Bool {
        lhs.id == rhs.id
    }
}

/// Manages audio playback using AVPlayer with play queue, shuffle, repeat, and seeking.
/// Uses @Observable (Swift 5.9+ Observation framework) for SwiftUI integration.
@Observable
@MainActor
final class AudioPlayerService {
    // MARK: - Published State

    /// The currently playing item, or nil if nothing is loaded.
    private(set) var currentItem: QueueItem?

    /// Whether playback is active.
    private(set) var isPlaying = false

    /// Current playback position in seconds.
    private(set) var currentTime: Double = 0

    /// Total duration of the current track in seconds.
    private(set) var duration: Double = 0

    /// The ordered play queue (reflects shuffle state).
    private(set) var queue: [QueueItem] = []

    /// Index of the current item in the queue.
    private(set) var currentIndex: Int = 0

    /// Whether shuffle is enabled.
    var isShuffleEnabled = false {
        didSet {
            guard oldValue != isShuffleEnabled else { return }
            reshuffleQueue()
        }
    }

    /// Current repeat mode.
    var repeatMode: RepeatMode = .off

    /// Whether the player has any content loaded.
    var hasCurrentItem: Bool { currentItem != nil }

    // MARK: - Private

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var statusObservation: NSKeyValueObservation?

    /// The original ordered queue before shuffle.
    private var originalQueue: [QueueItem] = []

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Public API

    /// Play a single track immediately, replacing the queue.
    func play(track: TrackResponse) {
        let items = makeQueueItems(from: [track])
        guard !items.isEmpty else { return }
        setQueue(items, startIndex: 0)
    }

    /// Play an album: set all tracks as the queue, starting from the given index.
    func playAlbum(tracks: [TrackResponse], startingAt index: Int = 0) {
        let items = makeQueueItems(from: tracks)
        guard !items.isEmpty else { return }
        let clampedIndex = min(index, items.count - 1)
        setQueue(items, startIndex: clampedIndex)
    }

    /// Play a specific track from an album, setting the full album as the queue.
    func playTrack(_ track: TrackResponse, inContext tracks: [TrackResponse]) {
        let items = makeQueueItems(from: tracks)
        guard !items.isEmpty else { return }
        let index = items.firstIndex(where: { $0.id == track.id }) ?? 0
        setQueue(items, startIndex: index)
    }

    /// Toggle play/pause.
    func togglePlayPause() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    /// Pause playback.
    func pause() {
        player?.pause()
        isPlaying = false
    }

    /// Resume playback.
    func resume() {
        player?.play()
        isPlaying = true
    }

    /// Skip to the next track in the queue.
    func next() {
        guard !queue.isEmpty else { return }

        if repeatMode == .one {
            // In repeat-one mode, next still advances (user explicitly asked for next).
            // Wrap around since repeat is on.
            let nextIndex = currentIndex + 1
            if nextIndex < queue.count {
                loadAndPlay(at: nextIndex)
            } else {
                loadAndPlay(at: 0)
            }
            return
        }

        let nextIndex = currentIndex + 1
        if nextIndex < queue.count {
            loadAndPlay(at: nextIndex)
        } else if repeatMode == .all {
            loadAndPlay(at: 0)
        }
        // If repeat is off and we're at the end, do nothing.
    }

    /// Skip to the previous track, or restart current track if past 3 seconds.
    func previous() {
        guard !queue.isEmpty else { return }

        // If past 3 seconds, restart current track.
        if currentTime > 3 {
            seek(to: 0)
            return
        }

        let prevIndex = currentIndex - 1
        if prevIndex >= 0 {
            loadAndPlay(at: prevIndex)
        } else if repeatMode == .all {
            loadAndPlay(at: queue.count - 1)
        } else {
            // At the beginning, just restart.
            seek(to: 0)
        }
    }

    /// Seek to a specific time in seconds.
    func seek(to time: Double) {
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        player?.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero)
        currentTime = time
    }

    /// Cycle through repeat modes: off -> all -> one -> off.
    func cycleRepeatMode() {
        switch repeatMode {
        case .off: repeatMode = .all
        case .all: repeatMode = .one
        case .one: repeatMode = .off
        }
    }

    /// Stop playback and clear the queue.
    func stop() {
        cleanupObservers()
        player?.pause()
        player = nil
        currentItem = nil
        isPlaying = false
        currentTime = 0
        duration = 0
        queue = []
        originalQueue = []
        currentIndex = 0
    }

    // MARK: - Private Methods

    private func makeQueueItems(from tracks: [TrackResponse]) -> [QueueItem] {
        tracks.compactMap { track in
            guard let url = apiClient.urlWithToken(endpoint: "/api/v1/stream/\(track.id)") else {
                return nil
            }
            return QueueItem(id: track.id, track: track, streamURL: url)
        }
    }

    private func setQueue(_ items: [QueueItem], startIndex: Int) {
        originalQueue = items

        if isShuffleEnabled {
            // Shuffle but keep the starting track first.
            var shuffled = items
            let startItem = items[startIndex]
            shuffled.remove(at: startIndex)
            shuffled.shuffle()
            shuffled.insert(startItem, at: 0)
            queue = shuffled
            loadAndPlay(at: 0)
        } else {
            queue = items
            loadAndPlay(at: startIndex)
        }
    }

    private func loadAndPlay(at index: Int) {
        guard index >= 0, index < queue.count else { return }

        cleanupObservers()

        currentIndex = index
        let item = queue[index]
        currentItem = item
        currentTime = 0
        duration = Double(item.track.durationSeconds)

        let playerItem = AVPlayerItem(url: item.streamURL)

        if player == nil {
            player = AVPlayer(playerItem: playerItem)
        } else {
            player?.replaceCurrentItem(with: playerItem)
        }

        setupObservers()
        player?.play()
        isPlaying = true
    }

    private func setupObservers() {
        guard let player else { return }

        // Periodic time observer for progress updates.
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: interval,
            queue: .main
        ) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                let seconds = time.seconds
                if seconds.isFinite && seconds >= 0 {
                    self.currentTime = seconds
                }
            }
        }

        // Observe when the current item finishes playing.
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player.currentItem,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.handleTrackEnd()
            }
        }

        // Observe item status changes to get accurate duration.
        statusObservation = player.currentItem?.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                if item.status == .readyToPlay {
                    let dur = item.duration.seconds
                    if dur.isFinite && dur > 0 {
                        self.duration = dur
                    }
                }
            }
        }
    }

    private func cleanupObservers() {
        if let timeObserver {
            player?.removeTimeObserver(timeObserver)
        }
        timeObserver = nil

        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil

        statusObservation?.invalidate()
        statusObservation = nil
    }

    private func handleTrackEnd() {
        switch repeatMode {
        case .one:
            seek(to: 0)
            player?.play()
        case .all:
            let nextIndex = currentIndex + 1
            if nextIndex < queue.count {
                loadAndPlay(at: nextIndex)
            } else {
                loadAndPlay(at: 0)
            }
        case .off:
            let nextIndex = currentIndex + 1
            if nextIndex < queue.count {
                loadAndPlay(at: nextIndex)
            } else {
                isPlaying = false
                currentTime = 0
            }
        }
    }

    private func reshuffleQueue() {
        guard !originalQueue.isEmpty else { return }

        if isShuffleEnabled {
            // Shuffle, keeping current item at the front.
            var remaining = originalQueue
            if let current = currentItem,
               let idx = remaining.firstIndex(where: { $0.id == current.id }) {
                remaining.remove(at: idx)
                remaining.shuffle()
                remaining.insert(current, at: 0)
                queue = remaining
                currentIndex = 0
            } else {
                remaining.shuffle()
                queue = remaining
                currentIndex = 0
            }
        } else {
            // Restore original order, finding current item's position.
            queue = originalQueue
            if let current = currentItem,
               let idx = queue.firstIndex(where: { $0.id == current.id }) {
                currentIndex = idx
            } else {
                currentIndex = 0
            }
        }
    }
}
