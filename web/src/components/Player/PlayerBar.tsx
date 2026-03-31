import { useCallback } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function repeatLabel(mode: RepeatMode): string {
  switch (mode) {
    case 'none':
      return 'Repeat';
    case 'all':
      return 'Repeat all';
    case 'one':
      return 'Repeat one';
  }
}

// ---------------------------------------------------------------------------
// Icons (shared between layouts)
// ---------------------------------------------------------------------------

function PreviousIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-5 h-5'}>
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  );
}

function NextIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-5 h-5'}>
      <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
    </svg>
  );
}

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  if (mode === 'one') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  );
}

function VolumeIcon({ volume }: { volume: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-zinc-400">
      {volume === 0 ? (
        <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
      ) : volume < 0.5 ? (
        <path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
      ) : (
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar (shared)
// ---------------------------------------------------------------------------

function ProgressBar({
  progress,
  duration,
  onSeek,
  className,
}: {
  progress: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const percent = duration > 0 ? (progress / duration) * 100 : 0;
  return (
    <div className={`relative group ${className ?? ''}`}>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={progress}
        onChange={onSeek}
        className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer z-10"
        aria-label="Seek"
      />
      <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-[width] duration-100"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerBar
// ---------------------------------------------------------------------------

export default function PlayerBar() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const expandedOpen = usePlayerStore((s) => s.expandedOpen);

  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const toggleExpanded = usePlayerStore((s) => s.toggleExpanded);
  const openZen = usePlayerStore((s) => s.openZen);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seek(Number(e.target.value));
    },
    [seek],
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.target.value));
    },
    [setVolume],
  );

  // Don't render if nothing has ever played
  if (!currentTrack) return null;

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900">
      {/* ============================================================
          MOBILE LAYOUT (< md)
          Compact bar: progress on top, then cover + info + play/next.
          Tapping the track info area opens the expanded player.
          ============================================================ */}
      <div className="md:hidden">
        {/* Thin progress bar at the very top */}
        <ProgressBar progress={progress} duration={duration} onSeek={handleSeek} />

        <div className="flex items-center gap-3 px-3 py-2">
          {/* Cover art + track info — opens expanded player */}
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
            aria-label="Open Now Playing"
          >
            <div className="w-10 h-10 shrink-0 rounded-md bg-zinc-800 overflow-hidden">
              <img
                src={coverArtUrl(currentTrack.albumId)}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                onLoad={(e) => { e.currentTarget.style.display = ''; }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-100 truncate">{currentTrack.title}</p>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artistName}</p>
            </div>
          </button>

          {/* Play/Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              isPlaying ? pause() : resume();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>

          {/* Next */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="text-zinc-400 active:text-white p-1 shrink-0"
            aria-label="Next"
          >
            <NextIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ============================================================
          DESKTOP LAYOUT (>= md)
          Full controls: progress bar, transport, shuffle/repeat, volume,
          expanded player toggle, queue toggle.
          ============================================================ */}
      <div className="hidden md:block px-4 py-2">
        {/* Progress bar (full width) */}
        <ProgressBar progress={progress} duration={duration} onSeek={handleSeek} className="mb-1" />

        <div className="flex items-center gap-4">
          {/* Track info — click to open Zen player */}
          <button
            onClick={openZen}
            className="flex items-center gap-3 min-w-0 w-1/4 text-left hover:bg-white/5 rounded-md -ml-2 pl-2 pr-2 py-1 transition-colors cursor-pointer"
            aria-label="Open fullscreen player"
            title="Open fullscreen player"
          >
            <div className="w-10 h-10 shrink-0 rounded bg-zinc-800 overflow-hidden">
              <img
                src={coverArtUrl(currentTrack.albumId)}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                onLoad={(e) => { e.currentTarget.style.display = ''; }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-zinc-100 truncate">{currentTrack.title}</p>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artistName}</p>
            </div>
          </button>

          {/* Transport controls (center) */}
          <div className="flex items-center justify-center gap-3 flex-1">
            <button
              onClick={previous}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label="Previous"
              title="Previous"
            >
              <PreviousIcon />
            </button>

            <button
              onClick={isPlaying ? pause : resume}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              onClick={next}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label="Next"
              title="Next"
            >
              <NextIcon />
            </button>

            <span className="text-xs text-zinc-500 tabular-nums ml-1">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 w-1/4 justify-end">
            <button
              onClick={toggleShuffle}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                shuffle
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="Shuffle"
              title="Shuffle"
            >
              <ShuffleIcon />
            </button>

            <button
              onClick={toggleRepeat}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                repeat !== 'none'
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label={repeatLabel(repeat)}
              title={repeatLabel(repeat)}
            >
              <RepeatIcon mode={repeat} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1">
              <VolumeIcon volume={volume} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolume}
                className="w-20 h-1 accent-white cursor-pointer"
                aria-label="Volume"
              />
            </div>

            {/* Expanded player toggle */}
            <button
              onClick={toggleExpanded}
              className={`text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
                expandedOpen
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="Now Playing"
              title="Now Playing"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v2H5zm0-4h14v2H5zm0-4h14v2H5z" />
              </svg>
            </button>

            {/* Queue toggle */}
            <button
              onClick={toggleQueue}
              className={`text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
                queueOpen
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="Queue"
              title="Queue"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
