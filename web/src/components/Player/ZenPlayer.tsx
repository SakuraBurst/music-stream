import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';
import {
  darkenColor,
  relativeLuminance,
  useColorExtractor,
} from './useColorExtractor.ts';
import AmbientGlow from './AmbientGlow.tsx';

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
// ZenPlayer
// ---------------------------------------------------------------------------

export default function ZenPlayer() {
  const zenOpen = usePlayerStore((s) => s.zenOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const closeZen = usePlayerStore((s) => s.closeZen);

  // Track visibility with transition state for animations
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const artUrl = currentTrack ? coverArtUrl(currentTrack.albumId) : null;
  const colors = useColorExtractor(artUrl);

  // Determine if the ambient background is light.
  // AmbientGlow darkens the primary color by 0.45, so we match that.
  const zen = useMemo(() => {
    const bg = darkenColor(colors[0] ?? [60, 60, 80], 0.45);
    const lum = relativeLuminance(bg);
    const light = lum > 0.5;
    return {
      isLight: light,
      // Primary text (track title)
      textPrimary: light ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)',
      // Secondary text (artist name)
      textSecondary: light ? 'rgba(0,0,0,0.7)' : 'rgba(200,200,200,1)',
      // Tertiary text (album name, timestamps)
      textTertiary: light ? 'rgba(0,0,0,0.5)' : 'rgba(161,161,170,1)',
      // Active control color (shuffle on, repeat on)
      controlActive: light ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)',
      // Inactive control color
      controlInactive: light
        ? 'rgba(0,0,0,0.45)'
        : 'rgba(161,161,170,1)',
      // Hovered inactive control
      controlHover: light ? 'rgba(0,0,0,0.7)' : 'rgba(200,200,200,1)',
      // Close button
      closeBtn: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)',
      // Progress bar track
      progressTrack: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
      // Progress bar fill
      progressFill: light ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
      // Play button
      playBg: light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,1)',
      playFg: light ? '#ffffff' : '#000000',
      // Text shadow for safety
      textShadow: light
        ? '0 1px 3px rgba(255,255,255,0.3)'
        : '0 1px 3px rgba(0,0,0,0.3)',
      // Volume slider accent
      volumeAccent: light ? '#000000' : '#ffffff',
    };
  }, [colors]);

  // Shared transition style for color properties
  const colorTransition = 'color 0.5s ease, fill 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease';

  // Mount/unmount with animation
  useEffect(() => {
    if (zenOpen) {
      setMounted(true);
      // Trigger transition on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [zenOpen]);

  // Keyboard handling
  useEffect(() => {
    if (!zenOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          closeZen();
          break;
        case ' ':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            resume();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, usePlayerStore.getState().progress - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(
            Math.min(
              usePlayerStore.getState().duration,
              usePlayerStore.getState().progress + 5,
            ),
          );
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenOpen, isPlaying, pause, resume, seek, closeZen]);

  // Focus trap: focus overlay when opened
  useEffect(() => {
    if (zenOpen && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [zenOpen]);

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

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeZen();
      }
    },
    [closeZen],
  );

  if (!mounted || !currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Zen player"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center outline-none transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={handleBackdropClick}
    >
      {/* Ambient background — solid primary fill + lava lamp blobs (fully opaque) */}
      <AmbientGlow colors={colors} />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center w-full max-w-xl px-6 transition-transform duration-200 ease-out"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        {/* Close button — chevron down at top center */}
        <button
          onClick={closeZen}
          className="mb-6 self-center p-2 rounded-full cursor-pointer"
          style={{ color: zen.closeBtn, transition: colorTransition }}
          aria-label="Close Zen player"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>

        {/* Album art */}
        <div className="relative w-full aspect-square max-h-[70vh] rounded-lg overflow-hidden shadow-2xl">
          <img
            src={coverArtUrl(currentTrack.albumId)}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Track info */}
        <div className="mt-2 text-center w-full min-w-0">
          <h2
            className="text-2xl font-semibold truncate"
            style={{ color: zen.textPrimary, textShadow: zen.textShadow, transition: colorTransition }}
          >
            {currentTrack.title}
          </h2>
          <p
            className="text-base mt-1 truncate"
            style={{ color: zen.textSecondary, textShadow: zen.textShadow, transition: colorTransition }}
          >
            {currentTrack.artistName}
          </p>
          <p
            className="text-sm mt-0.5 truncate"
            style={{ color: zen.textTertiary, textShadow: zen.textShadow, transition: colorTransition }}
          >
            {currentTrack.albumName}
          </p>
        </div>

        {/* Seekable progress bar */}
        <div className="w-full mt-2">
          <div className="relative group">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer z-10"
              aria-label="Seek"
            />
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: zen.progressTrack, transition: colorTransition }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{ width: `${progressPercent}%`, backgroundColor: zen.progressFill, transition: `${colorTransition}, width 0.1s` }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span
              className="text-xs tabular-nums"
              style={{ color: zen.textTertiary, textShadow: zen.textShadow, transition: colorTransition }}
            >
              {formatTime(progress)}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: zen.textTertiary, textShadow: zen.textShadow, transition: colorTransition }}
            >
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-5 mt-2">
          <button
            onClick={toggleShuffle}
            style={{
              color: shuffle ? zen.controlActive : zen.controlInactive,
              transition: colorTransition,
            }}
            aria-label="Shuffle"
            title="Shuffle"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
            </svg>
          </button>

          <button
            onClick={previous}
            style={{ color: zen.controlHover, transition: colorTransition }}
            aria-label="Previous"
            title="Previous"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button
            onClick={isPlaying ? pause : resume}
            className="w-14 h-14 flex items-center justify-center rounded-full hover:scale-105 transition-transform"
            style={{
              backgroundColor: zen.playBg,
              color: zen.playFg,
              transition: colorTransition,
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            style={{ color: zen.controlHover, transition: colorTransition }}
            aria-label="Next"
            title="Next"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
            </svg>
          </button>

          <button
            onClick={toggleRepeat}
            style={{
              color: repeat !== 'none' ? zen.controlActive : zen.controlInactive,
              transition: colorTransition,
            }}
            aria-label={repeatLabel(repeat)}
            title={repeatLabel(repeat)}
          >
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

        {/* Volume control */}
        <div className="flex items-center gap-2 mt-2">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
            style={{ color: zen.textTertiary, transition: colorTransition }}
          >
            {volume === 0 ? (
              <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
            ) : volume < 0.5 ? (
              <path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="w-28 h-1 cursor-pointer"
            style={{ accentColor: zen.volumeAccent }}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
