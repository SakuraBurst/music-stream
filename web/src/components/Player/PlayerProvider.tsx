import { useEffect, useRef, useCallback } from 'react';

import { useAuthStore } from '../../store/authStore.ts';
import { usePlayerStore } from '../../store/playerStore.ts';
import { recordHistory } from '../../api/history.ts';
import { coverArtUrl } from '../Library/coverart.ts';
import type { TrackResponse } from '../../types/index.ts';
import { initAudioAnalyser, resumeAudioContext } from './audioAnalyser.ts';

/** Threshold in seconds: record history after this much playback. */
const HISTORY_THRESHOLD = 30;

/**
 * Mutable state for history tracking. Lives outside React's ref system
 * to avoid react-hooks/immutability lint issues, since we mutate these
 * in event handlers. Only one PlayerProvider instance is ever mounted.
 */
const historyState = {
  trackId: null as string | null,
  recorded: false,
  seconds: 0,
  lastTime: 0,
};

/**
 * PlayerProvider renders a hidden <audio> element and keeps it in sync
 * with the Zustand player store. Mount this once at the App level —
 * it must never unmount during the session.
 */
export default function PlayerProvider() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);

  // --- Build stream URL ---
  const streamUrl = useCallback(
    (trackId: string): string => {
      const token = useAuthStore.getState().accessToken ?? '';
      return `/api/v1/stream/${trackId}?token=${encodeURIComponent(token)}`;
    },
    [],
  );

  // --- Load new track when currentTrack changes ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // Lazily wire up Web Audio analyser on first play (requires user gesture).
    initAudioAnalyser(audio);
    resumeAudioContext();

    // Reset history tracking for new track
    historyState.trackId = currentTrack.id;
    historyState.recorded = false;
    historyState.seconds = 0;
    historyState.lastTime = 0;

    audio.src = streamUrl(currentTrack.id);
    audio.load();
    // play() returns a promise; browsers may reject if no user gesture yet.
    audio.play().catch(() => {
      usePlayerStore.getState()._setIsPlaying(false);
    });

    // On mobile, auto-open the full-screen player when a new track starts.
    if (window.matchMedia('(max-width: 767px)').matches) {
      usePlayerStore.getState().openExpanded();
    }
  }, [currentTrack, streamUrl]);

  // --- Sync play/pause state ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(() => {
        usePlayerStore.getState()._setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // --- Sync volume ---
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  // --- Handle seek from store ---
  useEffect(() => {
    // Subscribe to progress changes triggered by seek() action.
    const unsub = usePlayerStore.subscribe((state, prev) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Only seek when progress changes and we are NOT the source (timeupdate).
      // We detect user-initiated seeks: progress jumped to a value different
      // from what timeupdate would have set (audio.currentTime).
      if (state.progress !== prev.progress) {
        const diff = Math.abs(audio.currentTime - state.progress);
        if (diff > 0.5) {
          audio.currentTime = state.progress;
        }
      }
    });
    return unsub;
  }, []);

  // --- Audio element event handlers ---
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    usePlayerStore.getState()._setProgress(currentTime);

    // Track cumulative playback time for history recording.
    // timeupdate fires roughly every 250ms. We accumulate real time delta.
    const delta = currentTime - historyState.lastTime;
    historyState.lastTime = currentTime;

    // Only count forward playback (positive delta, small enough to not be a seek)
    if (delta > 0 && delta < 2) {
      historyState.seconds += delta;
    }

    // Record to history once we've played for HISTORY_THRESHOLD seconds
    if (
      !historyState.recorded &&
      historyState.seconds >= HISTORY_THRESHOLD &&
      historyState.trackId
    ) {
      historyState.recorded = true;
      const trackId = historyState.trackId;
      const duration = Math.floor(historyState.seconds);
      recordHistory(trackId, duration).catch(() => {
        // Silently fail — history recording is best-effort
      });
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      usePlayerStore.getState()._setDuration(audio.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    usePlayerStore.getState()._onTrackEnded();
    // After the store updates the track, the useEffect above will load + play it.
  }, []);

  const handleError = useCallback(() => {
    usePlayerStore.getState()._setIsPlaying(false);
  }, []);

  // --- Listen for sonus:play custom events from the library ---
  useEffect(() => {
    function onPlayRequest(e: Event) {
      const detail = (e as CustomEvent).detail as {
        track: TrackResponse;
        queue?: TrackResponse[];
        queueIndex?: number;
      };
      usePlayerStore.getState().play(detail.track, detail.queue, detail.queueIndex);
    }

    window.addEventListener('sonus:play', onPlayRequest);
    return () => window.removeEventListener('sonus:play', onPlayRequest);
  }, []);

  // --- Media Session API: OS "Now Playing" integration ---
  // Update metadata (title, artist, album, artwork) when track changes.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    const artSrc = coverArtUrl(currentTrack.albumId);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artistName,
      album: currentTrack.albumName ?? '',
      artwork: [
        { src: artSrc, sizes: '256x256', type: 'image/jpeg' },
        { src: artSrc, sizes: '512x512', type: 'image/jpeg' },
      ],
    });
  }, [currentTrack]);

  // Update playback state when play/pause changes.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Update position state for OS seek bar (desktop only).
  // On mobile iOS, calling setPositionState can cause the lock screen to
  // show seek controls (±15s) instead of prev/next track buttons.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {
      // setPositionState may throw if values are invalid
    }
  });

  // Register action handlers when track changes (not just on mount).
  // On iOS Safari, handlers registered before audio.play() may be ignored.
  // Re-registering on each track change ensures they're set after playback starts.
  // Important: do NOT register seekforward/seekbackward — on iOS Safari,
  // having those handlers causes the lock screen to show ±15s skip buttons
  // instead of previous/next track. We explicitly null them out.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    const store = usePlayerStore.getState;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', async () => {
        store().resume();
        const audio = audioRef.current;
        if (audio) {
          await audio.play().catch(() => {});
          navigator.mediaSession.playbackState = 'playing';
        }
      }],
      ['pause', () => {
        store().pause();
        const audio = audioRef.current;
        if (audio) audio.pause();
        navigator.mediaSession.playbackState = 'paused';
      }],
      ['nexttrack', () => store().next()],
      ['previoustrack', () => store().previous()],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers may not support all actions
      }
    }

    // Explicitly remove seek handlers so iOS doesn't show ±15s buttons
    for (const action of ['seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // ignore
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [currentTrack]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={handleError}
      style={{ display: 'none' }}
    />
  );
}
