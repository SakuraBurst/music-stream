import { create } from 'zustand';

import type { TrackResponse } from '../types/index.ts';

export type RepeatMode = 'none' | 'all' | 'one';

export interface PlayerState {
  currentTrack: TrackResponse | null;
  queue: TrackResponse[];
  /** Index of the current track within `queue`. */
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Whether the queue side-panel is visible. */
  queueOpen: boolean;

  // --- actions ---
  /** Start playing a track. If `queue` and `queueIndex` are given, sets the full queue. */
  play: (track: TrackResponse, queue?: TrackResponse[], queueIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleQueue: () => void;
  /** Called by audio events — not intended for UI. */
  _setProgress: (seconds: number) => void;
  _setDuration: (seconds: number) => void;
  _setIsPlaying: (v: boolean) => void;
  _onTrackEnded: () => void;
}

/**
 * Fisher-Yates shuffle that returns a new array.
 * Keeps the item at `fixIndex` in place (so the current track stays put).
 */
function shuffleArray<T>(arr: T[], fixIndex: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    if (i === fixIndex) continue;
    let j = Math.floor(Math.random() * (i + 1));
    if (j === fixIndex) j = i; // don't swap the fixed item
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 1,
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: 'none',
  queueOpen: false,

  play: (track, queue, queueIndex) => {
    const newQueue = queue ?? [track];
    const idx = queueIndex ?? 0;
    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: idx,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  pause: () => set({ isPlaying: false }),

  resume: () => {
    if (get().currentTrack) {
      set({ isPlaying: true });
    }
  },

  next: () => {
    const { queue, queueIndex, repeat, shuffle } = get();
    if (queue.length === 0) return;

    let nextIndex: number;

    if (repeat === 'one') {
      // Repeat-one on explicit next still advances, matching common player UX
      nextIndex = (queueIndex + 1) % queue.length;
    } else if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        // Reached end of queue — stop
        set({ isPlaying: false, progress: 0 });
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    set({
      currentTrack: nextTrack,
      queueIndex: nextIndex,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  previous: () => {
    const { queue, queueIndex, progress } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart the current track
    if (progress > 3) {
      set({ progress: 0 });
      return;
    }

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    set({
      currentTrack: queue[prevIndex],
      queueIndex: prevIndex,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  seek: (seconds) => set({ progress: seconds }),

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  toggleShuffle: () => {
    const { shuffle, queue, queueIndex, currentTrack } = get();
    if (!shuffle && queue.length > 1 && currentTrack) {
      // Turning shuffle ON: shuffle the queue, keeping current track at its position
      const shuffled = shuffleArray(queue, queueIndex);
      set({ shuffle: true, queue: shuffled });
    } else {
      set({ shuffle: !shuffle });
    }
  },

  toggleRepeat: () => {
    const { repeat } = get();
    const cycle: RepeatMode[] = ['none', 'all', 'one'];
    const next = cycle[(cycle.indexOf(repeat) + 1) % cycle.length];
    set({ repeat: next });
  },

  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),

  _setProgress: (seconds) => set({ progress: seconds }),
  _setDuration: (seconds) => set({ duration: seconds }),
  _setIsPlaying: (v) => set({ isPlaying: v }),

  _onTrackEnded: () => {
    const { repeat, queue, queueIndex } = get();

    if (repeat === 'one') {
      // Replay same track
      set({ progress: 0, isPlaying: true });
      return;
    }

    // Advance to next
    get().next();

    // If next() stopped playback (end of queue, no repeat), ensure state is clean
    const state = get();
    if (!state.isPlaying && repeat === 'none' && queueIndex >= queue.length - 1) {
      set({ progress: 0 });
    }
  },
}));
