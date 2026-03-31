import { useEffect, useRef, useCallback } from 'react';

import { useAuthStore } from '../store/authStore.ts';
import { usePlayerStore } from '../store/playerStore.ts';
import { saveSession, getSession } from '../api/session.ts';
import { apiGet } from '../api/client.ts';
import type { TrackResponse } from '../types/index.ts';
import type { RepeatMode } from '../store/playerStore.ts';

/** Interval in ms between auto-saves while playing. */
const SAVE_INTERVAL_MS = 10_000;

/** Minimum ms between any two save calls (debounce). */
const DEBOUNCE_MS = 2_000;

/**
 * useSessionSync auto-saves playback state to the server and silently
 * restores it when the app first loads after authentication.
 *
 * Restored sessions are loaded in a paused state so the player is ready
 * but playback doesn't start until the user presses play.
 *
 * Mount this once, inside a component that is only rendered when
 * the user is authenticated.
 */
export function useSessionSync() {
  // --- Refs for debounce / interval tracking ---
  const lastSaveTime = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Save helper (debounced, best-effort) ---
  const doSave = useCallback(() => {
    const state = usePlayerStore.getState();
    if (!state.currentTrack) return;

    const now = Date.now();
    const elapsed = now - lastSaveTime.current;

    if (elapsed < DEBOUNCE_MS) {
      // Schedule a save after the debounce period if not already scheduled
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null;
          doSave();
        }, DEBOUNCE_MS - elapsed);
      }
      return;
    }

    lastSaveTime.current = now;

    const queueTrackIds = state.queue.map((t) => t.id);

    saveSession({
      trackId: state.currentTrack.id,
      position: state.progress,
      queueTrackIds,
      isPlaying: state.isPlaying,
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
    }).catch(() => {
      // Best-effort — errors must not disrupt playback
    });
  }, []);

  // --- Save via sendBeacon on page unload ---
  useEffect(() => {
    function handleBeforeUnload() {
      const state = usePlayerStore.getState();
      if (!state.currentTrack) return;

      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const queueTrackIds = state.queue.map((t) => t.id);
      const body = JSON.stringify({
        trackId: state.currentTrack.id,
        position: state.progress,
        queueTrackIds,
        isPlaying: false, // Page is closing — mark as not playing
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
      });

      // Use fetch with keepalive (supports PUT, unlike sendBeacon which is POST-only).
      fetch(`/api/v1/session?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // Best-effort
      });
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // --- Auto-save interval while playing ---
  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state, prev) => {
      // Start interval when playing begins
      if (state.isPlaying && !prev.isPlaying) {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(doSave, SAVE_INTERVAL_MS);
        }
      }

      // Stop interval when paused — and trigger an immediate save
      if (!state.isPlaying && prev.isPlaying) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        doSave();
      }

      // Save on track change
      if (
        state.currentTrack &&
        prev.currentTrack &&
        state.currentTrack.id !== prev.currentTrack.id
      ) {
        doSave();
      }
    });

    return () => {
      unsub();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [doSave]);

  // --- Silently restore session on mount (after auth) ---
  useEffect(() => {
    let cancelled = false;

    async function tryRestore() {
      // Only restore if nothing is currently playing
      const state = usePlayerStore.getState();
      if (state.currentTrack) return;

      try {
        const session = await getSession();
        if (cancelled || !session || !session.trackId) return;

        // Validate the track still exists
        const track = await apiGet<TrackResponse>(
          `/tracks/${session.trackId}`,
        ).catch(() => null);
        if (cancelled || !track) return;

        // Fetch full TrackResponse objects for the queue
        const queueTracks: TrackResponse[] = [];
        let currentIndex = 0;

        if (session.queueTrackIds.length > 0) {
          const fetched = await Promise.all(
            session.queueTrackIds.map((id) =>
              apiGet<TrackResponse>(`/tracks/${id}`).catch(() => null),
            ),
          );

          for (const t of fetched) {
            if (t) queueTracks.push(t);
          }

          currentIndex = queueTracks.findIndex((t) => t.id === track.id);
          if (currentIndex === -1) {
            queueTracks.unshift(track);
            currentIndex = 0;
          }
        } else {
          queueTracks.push(track);
          currentIndex = 0;
        }

        if (cancelled) return;

        // Restore paused — the user can press play when ready.
        usePlayerStore.getState().restoreSession({
          track,
          queue: queueTracks,
          queueIndex: currentIndex,
          position: session.positionSeconds,
          volume: session.volume,
          shuffle: session.shuffle,
          repeat: session.repeatMode as RepeatMode,
        });
      } catch {
        // Best-effort — silently ignore
      }
    }

    tryRestore();
    return () => {
      cancelled = true;
    };
  }, []);
}
