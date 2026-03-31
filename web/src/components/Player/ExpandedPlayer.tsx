import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';
import AudioVisualizer from './AudioVisualizer.tsx';
import {
  darkenColor,
  relativeLuminance,
  useColorExtractor,
} from './useColorExtractor.ts';
import AmbientGlow from './AmbientGlow.tsx';
import FavoriteButton from '../Favorites/FavoriteButton.tsx';
import AddToPlaylistButton from '../Playlist/AddToPlaylistButton.tsx';

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

/** Clamp number between min and max. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// useDividerDrag — touch-based drag for the player/queue divider
// ---------------------------------------------------------------------------

/**
 * Manages a vertical divider that splits a container into two areas.
 * `ratio` is the fraction (0–1) of the container given to the TOP area.
 */
function useDividerDrag(defaultRatio: number, min: number, max: number) {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startRatio = useRef(defaultRatio);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragging.current = true;
      startY.current = e.touches[0].clientY;
      startRatio.current = ratio;
    },
    [ratio],
  );

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault(); // prevent page scroll while dragging
      const h = containerRef.current.clientHeight;
      if (h === 0) return;
      const dy = e.touches[0].clientY - startY.current;
      setRatio(clamp(startRatio.current + dy / h, min, max));
    }
    function onTouchEnd() {
      dragging.current = false;
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [min, max]);

  return { ratio, containerRef, onTouchStart };
}

// ---------------------------------------------------------------------------
// ExpandedPlayer
// ---------------------------------------------------------------------------

export default function ExpandedPlayer() {
  const expandedOpen = usePlayerStore((s) => s.expandedOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);

  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const closeExpanded = usePlayerStore((s) => s.closeExpanded);
  const play = usePlayerStore((s) => s.play);

  const artUrl = currentTrack ? coverArtUrl(currentTrack.albumId) : null;
  const colors = useColorExtractor(artUrl);

  // Adaptive color scheme for mobile ambient background
  const theme = useMemo(() => {
    const bg = darkenColor(colors[0] ?? [60, 60, 80], 0.45);
    const lum = relativeLuminance(bg);
    const light = lum > 0.5;
    return {
      textPrimary: light ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)',
      textSecondary: light ? 'rgba(0,0,0,0.7)' : 'rgba(200,200,200,1)',
      textTertiary: light ? 'rgba(0,0,0,0.5)' : 'rgba(161,161,170,1)',
      controlActive: light ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)',
      controlInactive: light ? 'rgba(0,0,0,0.45)' : 'rgba(161,161,170,1)',
      controlHover: light ? 'rgba(0,0,0,0.7)' : 'rgba(200,200,200,1)',
      closeBtn: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)',
      progressTrack: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
      progressFill: light ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
      playBg: light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,1)',
      playFg: light ? '#ffffff' : '#000000',
      textShadow: light
        ? '0 1px 3px rgba(255,255,255,0.3)'
        : '0 1px 3px rgba(0,0,0,0.3)',
      queueActive: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
      queueBorder: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
      dividerHandle: light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)',
    };
  }, [colors]);

  const ct = 'color 0.5s ease, fill 0.5s ease, background-color 0.5s ease';

  // Divider drag: player area = top, queue = bottom
  // Default 65% player / 35% queue, range 30%–85%
  const { ratio, containerRef, onTouchStart } = useDividerDrag(0.65, 0.30, 0.85);

  // Whether the player is in "compact" mode (ratio < 0.45) — hide album art
  const compact = ratio < 0.45;

  // Animation states
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentTrackRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (expandedOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [expandedOpen]);

  useEffect(() => {
    if (visible && currentTrackRef.current) {
      currentTrackRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [visible, queueIndex]);

  useEffect(() => {
    if (!expandedOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeExpanded();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedOpen, closeExpanded]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => seek(Number(e.target.value)),
    [seek],
  );
  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVolume(Number(e.target.value)),
    [setVolume],
  );
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === e.currentTarget) closeExpanded(); },
    [closeExpanded],
  );
  const handleQueueClick = useCallback(
    (index: number) => play(queue[index], queue, index),
    [queue, play],
  );

  if (!mounted || !currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end outline-none md:items-stretch"
      onClick={handleBackdropClick}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      {/* Desktop backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300 max-md:hidden"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Now Playing"
        className={
          'relative z-10 flex flex-col overflow-hidden ' +
          'transition-transform duration-300 ease-out ' +
          'max-md:w-full max-md:h-full max-md:border-0 ' +
          'md:bg-zinc-900 md:border-l md:border-zinc-800 md:w-[40vw] md:min-w-[360px] md:max-w-[480px] md:h-full'
        }
        style={{
          transform: visible
            ? 'translate(0, 0)'
            : 'var(--expanded-translate, translateX(100%))',
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            [aria-label="Now Playing"] { --expanded-translate: translateY(100%); }
          }
          @media (min-width: 768px) {
            [aria-label="Now Playing"] { --expanded-translate: translateX(100%); }
          }
        `}</style>

        {/* ============================================================
            MOBILE LAYOUT — swipeable player/queue split
            ============================================================ */}
        <div ref={containerRef} className="md:hidden flex flex-col h-full relative">
          <AmbientGlow colors={colors} />

          <div className="relative z-10 flex flex-col h-full overflow-hidden">
            {/* ---------- TOP: Player controls ---------- */}
            <div
              className="shrink-0 flex flex-col justify-center overflow-hidden"
              style={{ height: `${ratio * 100}%` }}
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-5 pt-10 pb-1">
                <button
                  onClick={closeExpanded}
                  className="p-3 -ml-2 rounded-full cursor-pointer"
                  style={{ color: theme.closeBtn, transition: ct }}
                  aria-label="Close player"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                    <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                  </svg>
                </button>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: theme.textTertiary, textShadow: theme.textShadow, transition: ct }}
                >
                  Now Playing
                </span>
                <div className="w-12" />
              </div>

              {/* Album art — hidden when compact */}
              {!compact && (
                <div className="shrink px-8 mt-1 min-h-0 flex items-center justify-center">
                  <div className="w-full max-w-[280px] aspect-square rounded-xl overflow-hidden shadow-2xl shrink">
                    <img
                      src={coverArtUrl(currentTrack.albumId)}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                      onLoad={(e) => { e.currentTarget.style.display = ''; }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}

              {/* Track info + actions */}
              <div className="shrink-0 px-8 mt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-semibold truncate ${compact ? 'text-lg' : 'text-xl'}`}
                      style={{ color: theme.textPrimary, textShadow: theme.textShadow, transition: ct }}
                    >
                      {currentTrack.title}
                    </h3>
                    <p
                      className={`mt-0.5 truncate ${compact ? 'text-sm' : 'text-base'}`}
                      style={{ color: theme.textSecondary, textShadow: theme.textShadow, transition: ct }}
                    >
                      {currentTrack.artistName}
                    </p>
                    {!compact && (
                      <p className="text-sm mt-0.5 truncate" style={{ color: theme.textTertiary, textShadow: theme.textShadow, transition: ct }}>
                        {currentTrack.albumName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-1 shrink-0">
                    <FavoriteButton type="track" id={currentTrack.id} className="!w-6 !h-6 [&_svg]:!w-6 [&_svg]:!h-6" />
                    <AddToPlaylistButton trackId={currentTrack.id} className="[&_svg]:!w-6 [&_svg]:!h-6 [&_button]:!text-zinc-400" />
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="shrink-0 px-8 mt-3">
                <div className="relative">
                  <input type="range" min={0} max={duration || 0} step={0.1} value={progress} onChange={handleSeek}
                    className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer z-10" aria-label="Seek" />
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.progressTrack, transition: ct }}>
                    <div className="h-full rounded-full transition-[width] duration-100"
                      style={{ width: `${progressPercent}%`, backgroundColor: theme.progressFill, transition: `${ct}, width 0.1s` }} />
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs tabular-nums" style={{ color: theme.textTertiary, textShadow: theme.textShadow }}>{formatTime(progress)}</span>
                  <span className="text-xs tabular-nums" style={{ color: theme.textTertiary, textShadow: theme.textShadow }}>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Transport */}
              <div className="shrink-0 flex items-center justify-center gap-5 mt-2 px-8">
                <button onClick={toggleShuffle} className="p-2"
                  style={{ color: shuffle ? theme.controlActive : theme.controlInactive, transition: ct }} aria-label="Shuffle">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </button>
                <button onClick={previous} className="p-2" style={{ color: theme.controlHover, transition: ct }} aria-label="Previous">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
                  </svg>
                </button>
                <button onClick={isPlaying ? pause : resume}
                  className="w-14 h-14 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                  style={{ backgroundColor: theme.playBg, color: theme.playFg, transition: ct }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button onClick={next} className="p-2" style={{ color: theme.controlHover, transition: ct }} aria-label="Next">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
                  </svg>
                </button>
                <button onClick={toggleRepeat} className="p-2"
                  style={{ color: repeat !== 'none' ? theme.controlActive : theme.controlInactive, transition: ct }}
                  aria-label={repeatLabel(repeat)}>
                  {repeat === 'one' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ---------- DIVIDER HANDLE ---------- */}
            <div
              onTouchStart={onTouchStart}
              className="shrink-0 flex items-center justify-center py-2 cursor-ns-resize touch-none select-none"
              style={{ borderTop: `1px solid ${theme.queueBorder}` }}
            >
              <div
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: theme.dividerHandle }}
              />
            </div>

            {/* ---------- BOTTOM: Queue ---------- */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-5 pb-2">
                <h3 className="text-sm font-semibold" style={{ color: theme.textTertiary, textShadow: theme.textShadow, transition: ct }}>
                  Queue
                  <span className="ml-2 font-normal opacity-60">{queue.length} tracks</span>
                </h3>
              </div>

              <ul className="flex-1 overflow-y-auto min-h-0 pb-20">
                {queue.map((track, i) => {
                  const isCurrent = i === queueIndex;
                  return (
                    <li
                      key={`${track.id}-${i}`}
                      ref={isCurrent ? currentTrackRef : undefined}
                      onClick={() => handleQueueClick(i)}
                      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isCurrent ? theme.queueActive : 'transparent',
                        color: isCurrent ? theme.textPrimary : theme.textSecondary,
                        transition: ct,
                      }}
                    >
                      <span className="text-xs w-6 text-right shrink-0 tabular-nums"
                        style={{ color: isCurrent ? theme.textPrimary : theme.textTertiary }}>
                        {isCurrent ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 inline"><path d="M8 5v14l11-7z" /></svg>
                        ) : (i + 1)}
                      </span>
                      <div className="w-9 h-9 shrink-0 rounded bg-black/20 overflow-hidden">
                        <img src={coverArtUrl(track.albumId)} alt="" className="w-full h-full object-cover"
                          onLoad={(e) => { e.currentTarget.style.display = ''; }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ textShadow: theme.textShadow }}>{track.title}</p>
                        <p className="text-xs truncate" style={{ color: theme.textTertiary }}>{track.artistName}</p>
                      </div>
                      <span className="text-xs tabular-nums shrink-0" style={{ color: theme.textTertiary }}>
                        {formatTime(track.durationSeconds)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* ============================================================
            DESKTOP LAYOUT — classic sidebar (unchanged)
            ============================================================ */}
        <div className="hidden md:flex md:flex-col md:h-full">
          <div className="shrink-0 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Now Playing</h2>
              <button onClick={closeExpanded} className="text-zinc-400 hover:text-white transition-colors p-1 rounded cursor-pointer" aria-label="Close expanded player">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="w-full max-w-[300px] mx-auto aspect-square rounded-lg overflow-hidden shadow-2xl bg-zinc-800">
              <img src={coverArtUrl(currentTrack.albumId)} alt={currentTrack.title} className="w-full h-full object-cover"
                onLoad={(e) => { e.currentTarget.style.display = ''; }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="mt-4 text-center min-w-0">
              <div className="flex items-center justify-center gap-3">
                <FavoriteButton type="track" id={currentTrack.id} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white truncate">{currentTrack.title}</h3>
                  <p className="text-sm text-zinc-400 mt-0.5 truncate">{currentTrack.artistName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{currentTrack.albumName}</p>
                </div>
                <AddToPlaylistButton trackId={currentTrack.id} />
              </div>
            </div>
            <div className="w-full mt-4">
              <div className="relative group">
                <input type="range" min={0} max={duration || 0} step={0.1} value={progress} onChange={handleSeek}
                  className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer z-10" aria-label="Seek" />
                <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-[width] duration-100" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-zinc-500 tabular-nums">{formatTime(progress)}</span>
                <span className="text-xs text-zinc-500 tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <button onClick={toggleShuffle} className={`transition-colors cursor-pointer ${shuffle ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`} aria-label="Shuffle">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
              </button>
              <button onClick={previous} className="text-zinc-300 hover:text-white transition-colors cursor-pointer" aria-label="Previous">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" /></svg>
              </button>
              <button onClick={isPlaying ? pause : resume}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <button onClick={next} className="text-zinc-300 hover:text-white transition-colors cursor-pointer" aria-label="Next">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" /></svg>
              </button>
              <button onClick={toggleRepeat} className={`transition-colors cursor-pointer ${repeat !== 'none' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`} aria-label={repeatLabel(repeat)}>
                {repeat === 'one' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" /></svg>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-zinc-400">
                {volume === 0 ? (
                  <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
                ) : volume < 0.5 ? (
                  <path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={handleVolume}
                className="w-28 h-1 accent-white cursor-pointer" aria-label="Volume" />
            </div>
          </div>
          <div className="shrink-0 px-5 pb-2">
            <AudioVisualizer primaryColor={colors[0]} secondaryColor={colors[1]} />
          </div>
          <div className="shrink-0 px-5 py-3 border-t border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-400">
              Queue <span className="ml-2 text-zinc-600 font-normal">{queue.length} tracks</span>
            </h3>
          </div>
          <ul className="flex-1 overflow-y-auto min-h-0 pb-4">
            {queue.map((track, i) => {
              const isCurrent = i === queueIndex;
              return (
                <li key={`${track.id}-${i}`} ref={isCurrent ? currentTrackRef : undefined}
                  onClick={() => handleQueueClick(i)}
                  className={`flex items-center gap-3 px-5 py-2 cursor-pointer transition-colors ${
                    isCurrent ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                  <span className="text-xs w-6 text-right shrink-0 tabular-nums">
                    {isCurrent ? (<svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 inline text-white"><path d="M8 5v14l11-7z" /></svg>) : (i + 1)}
                  </span>
                  <div className="w-8 h-8 shrink-0 rounded bg-zinc-800 overflow-hidden">
                    <img src={coverArtUrl(track.albumId)} alt="" className="w-full h-full object-cover"
                      onLoad={(e) => { e.currentTarget.style.display = ''; }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{track.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{track.artistName}</p>
                  </div>
                  <span className="text-xs text-zinc-600 tabular-nums shrink-0">{formatTime(track.durationSeconds)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
