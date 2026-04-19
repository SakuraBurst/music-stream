import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';
import Starfield from '../Cosmic/Starfield.tsx';
import Planetarium from '../Cosmic/Planetarium.tsx';
import Waveform from '../Cosmic/Waveform.tsx';
import { orbitColorFor, PALETTE } from '../Cosmic/palette.ts';
import { toRoman } from '../Cosmic/utils.ts';
import { useVerticalDrag } from '../../hooks/useVerticalDrag.ts';
import { haptic } from '../../utils/haptics.ts';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatLong(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function repeatLabel(mode: RepeatMode): string {
  switch (mode) {
    case 'none': return 'Repeat';
    case 'all':  return 'Repeat all';
    case 'one':  return 'Repeat one';
  }
}

// Snap thresholds (in px) for mobile swipe gestures — tuned for "feels
// responsive" rather than "must be deliberate".
const SWIPE_CLOSE_ZEN   = 70;
const SWIPE_OPEN_QUEUE  = 70;
const SWIPE_CLOSE_QUEUE = 70;
const FLICK_VELOCITY    = 0.3;  // px/ms — fast flick overrides distance threshold

export default function ZenPlayer() {
  const zenOpen = usePlayerStore((s) => s.zenOpen);
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
  const closeZen = usePlayerStore((s) => s.closeZen);
  const play = usePlayerStore((s) => s.play);

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Swipe state ----------------------------------------------------------
  const [sheetOpen, setSheetOpen] = useState(false);
  // Progress of the current drag:
  //   zenDragY > 0 means zen is being pulled down toward close.
  //   sheetPeekY < 0 means queue sheet is being pulled up into view.
  //   sheetCloseY > 0 means an open sheet is being pushed down to close.
  const [zenDragY, setZenDragY] = useState(0);
  const [sheetPeekY, setSheetPeekY] = useState(0);
  const [sheetCloseY, setSheetCloseY] = useState(0);
  const thresholdHaptic = useRef<{ zen: boolean; sheet: boolean; close: boolean }>({
    zen: false,
    sheet: false,
    close: false,
  });

  // Mount / unmount animation --------------------------------------------
  useEffect(() => {
    if (zenOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      setSheetOpen(false);
      const timer = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(timer);
    }
  }, [zenOpen]);

  // Keyboard shortcuts (desktop) -----------------------------------------
  useEffect(() => {
    if (!zenOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          closeZen();
          break;
        case ' ':
          e.preventDefault();
          if (isPlaying) pause(); else resume();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, usePlayerStore.getState().progress - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(usePlayerStore.getState().duration, usePlayerStore.getState().progress + 5));
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenOpen, isPlaying, pause, resume, seek, closeZen]);

  useEffect(() => {
    if (zenOpen && overlayRef.current) overlayRef.current.focus();
  }, [zenOpen]);

  const minors = useMemo(() => {
    if (!currentTrack) return [];
    return queue
      .filter((_, i) => i !== queueIndex)
      .slice(0, 6)
      .map((t, i) => ({
        id: t.id,
        color: orbitColorFor(t.id),
        index: i,
      }));
  }, [queue, queueIndex, currentTrack]);

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVolume(Number(e.target.value)),
    [setVolume],
  );

  const handleSeekFrac = useCallback((frac: number) => {
    if (duration <= 0) return;
    seek(frac * duration);
  }, [seek, duration]);

  // Main-stage drag (mobile): down→close zen, up→peek queue sheet.
  const stageDragRef = useVerticalDrag<HTMLDivElement>({
    enabled: mounted && !sheetOpen,
    startThreshold: 3,
    onStart: () => {
      thresholdHaptic.current.zen = false;
      thresholdHaptic.current.sheet = false;
    },
    onMove: (dy) => {
      if (dy > 0) {
        setZenDragY(dy);
        setSheetPeekY(0);
        if (!thresholdHaptic.current.zen && dy > SWIPE_CLOSE_ZEN) {
          thresholdHaptic.current.zen = true;
          haptic('selection');
        } else if (thresholdHaptic.current.zen && dy < SWIPE_CLOSE_ZEN) {
          thresholdHaptic.current.zen = false;
        }
      } else {
        setSheetPeekY(dy); // negative
        setZenDragY(0);
        if (!thresholdHaptic.current.sheet && dy < -SWIPE_OPEN_QUEUE) {
          thresholdHaptic.current.sheet = true;
          haptic('selection');
        } else if (thresholdHaptic.current.sheet && dy > -SWIPE_OPEN_QUEUE) {
          thresholdHaptic.current.sheet = false;
        }
      }
    },
    onEnd: (dy, vy) => {
      const fastDown = vy > FLICK_VELOCITY;
      const fastUp = vy < -FLICK_VELOCITY;
      if (dy > SWIPE_CLOSE_ZEN || fastDown) {
        haptic('light');
        closeZen();
      } else if (dy < -SWIPE_OPEN_QUEUE || fastUp) {
        haptic('light');
        setSheetOpen(true);
      }
      setZenDragY(0);
      setSheetPeekY(0);
    },
  });

  // Sheet-handle drag (mobile): down→close sheet.
  const sheetDragRef = useVerticalDrag<HTMLDivElement>({
    enabled: mounted && sheetOpen,
    startThreshold: 3,
    onStart: () => { thresholdHaptic.current.close = false; },
    onMove: (dy) => {
      setSheetCloseY(Math.max(0, dy));
      if (!thresholdHaptic.current.close && dy > SWIPE_CLOSE_QUEUE) {
        thresholdHaptic.current.close = true;
        haptic('selection');
      } else if (thresholdHaptic.current.close && dy < SWIPE_CLOSE_QUEUE) {
        thresholdHaptic.current.close = false;
      }
    },
    onEnd: (dy, vy) => {
      if (dy > SWIPE_CLOSE_QUEUE || vy > FLICK_VELOCITY) {
        haptic('light');
        setSheetOpen(false);
      }
      setSheetCloseY(0);
    },
  });

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeZen();
  }, [closeZen]);

  if (!mounted || !currentTrack) return null;

  const accent = orbitColorFor(currentTrack.id);
  const playProgress = duration > 0 ? progress / duration : 0;
  const thetaDeg = ((playProgress * 360) % 360).toFixed(1);
  const albumImg = coverArtUrl(currentTrack.albumId);
  const bodyLabel = toRoman(currentTrack.trackNumber ?? queueIndex + 1);

  // Derived transforms -------------------------------------------------
  const zenContentTransform = zenDragY > 0 && !sheetOpen
    ? `translateY(${zenDragY * 0.85}px) scale(${Math.max(0.92, 1 - zenDragY * 0.0005)})`
    : visible ? 'translateY(0) scale(1)' : 'translateY(0) scale(0.94)';
  const sheetMobileTranslate = sheetOpen
    ? `translateY(${Math.max(0, sheetCloseY)}px)`
    : `translateY(${100 + Math.max(-30, sheetPeekY / window.innerHeight * 100)}%)`;
  const sheetDragging = zenDragY !== 0 || sheetPeekY !== 0 || sheetCloseY !== 0;

  const upNext = queue.slice(queueIndex + 1).concat(queue.slice(0, queueIndex));

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Zen player"
      tabIndex={-1}
      className="fixed inset-0 z-[100] outline-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      onClick={handleBackdropClick}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${PALETTE.sun}26 0%, transparent 55%),
                       radial-gradient(ellipse at 30% 85%, ${accent}1F 0%, transparent 50%),
                       ${PALETTE.bg}`,
        }}
      />
      <Starfield />

      {/* ==================================================================
          DESKTOP LAYOUT
          ================================================================== */}
      <div className="hidden md:block absolute inset-0">
        <div
          className="absolute top-6 left-8 text-[10px] tracking-[3px] text-[var(--mute)] cursor-pointer leading-[1.8] z-10 hover:text-[var(--ink)]"
          onClick={closeZen}
        >
          <strong className="text-[var(--ink)] font-medium">ZEN</strong> · ESC TO EXIT<br />
          OBSERVATORY {new Date().getFullYear()}
        </div>

        <div className="absolute top-6 right-8 text-[10px] tracking-[3px] text-[var(--sun)] text-right leading-[1.8] z-10">
          BODY {bodyLabel} · {currentTrack.albumName.toUpperCase()}<br />
          <span className="text-[var(--mute)]">
            {currentTrack.format ? currentTrack.format.toUpperCase() : '—'}
            {currentTrack.bitrate ? ` · ${Math.round(currentTrack.bitrate / 1000)} KBPS` : ''}
          </span>
        </div>

        <div
          className="absolute inset-0 grid place-items-center transition-transform duration-300 ease-out"
          style={{ transform: visible ? 'scale(1)' : 'scale(0.94)' }}
        >
          <div className="w-[min(92vmin,1200px)] h-[min(82vmin,720px)]">
            <Planetarium
              title={currentTrack.artistName}
              subtitle={`${currentTrack.albumName.toUpperCase()} · SONUS · ${(new Date()).getFullYear()}`}
              accent={accent}
              initial={(currentTrack.artistName || currentTrack.title)[0]?.toUpperCase() ?? '★'}
              imageUrl={albumImg}
              bodyName={currentTrack.title}
              bodyMeta={`BODY ${bodyLabel} · ${formatLong(currentTrack.durationSeconds)}`}
              progress={playProgress}
              minors={minors}
            />
          </div>
        </div>

        <div className="absolute left-8 right-8 bottom-7 flex items-end justify-between z-10">
          <div className="text-[var(--rose)] font-mono-jb leading-tight">
            <div className="text-[22px]">{formatTime(progress)}</div>
            <div className="text-[10px] tracking-[2px] text-[var(--mute)] mt-0.5">
              / {formatLong(duration)}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-[300px] opacity-90">
              <Waveform
                progress={playProgress}
                color={PALETTE.rose}
                bars={70}
                height={32}
                onSeek={handleSeekFrac}
              />
            </div>

            <div className="flex items-center gap-4 text-[var(--ink2)]">
              <button
                onClick={toggleShuffle}
                className={`transition-colors text-[15px] cursor-pointer ${shuffle ? 'text-[var(--sun)]' : 'text-[var(--mute)] hover:text-[var(--sun)]'}`}
                aria-label="Shuffle"
              >⇌</button>
              <button
                onClick={previous}
                className="text-[var(--ink)] hover:text-[var(--sun)] transition-colors text-[17px] cursor-pointer"
                aria-label="Previous"
              >◀◀</button>
              <button
                onClick={isPlaying ? pause : resume}
                className={`btn-sun w-[52px] h-[52px] rounded-full grid place-items-center text-[15px] cursor-pointer ${isPlaying ? 'is-on' : ''}`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >{isPlaying ? '❚❚' : '▶'}</button>
              <button
                onClick={next}
                className="text-[var(--ink)] hover:text-[var(--sun)] transition-colors text-[17px] cursor-pointer"
                aria-label="Next"
              >▶▶</button>
              <button
                onClick={toggleRepeat}
                className={`transition-colors text-[15px] cursor-pointer ${repeat !== 'none' ? 'text-[var(--sun)]' : 'text-[var(--mute)] hover:text-[var(--sun)]'}`}
                aria-label={repeatLabel(repeat)}
              >{repeat === 'one' ? '⟳¹' : '⟳'}</button>
            </div>

            <div className="flex items-center gap-2 mt-1 text-[var(--mute)]">
              <span className="text-[12px]">{volume === 0 ? '⨉' : '◐'}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolume}
                className="w-24 h-px range-sun cursor-pointer"
                aria-label="Volume"
              />
            </div>
          </div>

          <div className="text-right font-mono-jb text-[11px] tracking-[2px] text-[var(--mute)] leading-[1.6]">
            θ = {thetaDeg}°<br />
            R = {duration > 0 ? Math.round(duration) : '—'}au
          </div>
        </div>
      </div>

      {/* ==================================================================
          MOBILE LAYOUT — one full-screen player; swipe-down anywhere closes,
          swipe-up reveals the queue bottom sheet. `touch-action: none` gives
          the app full control over vertical gestures across the whole
          surface (the Waveform opts back in via its own touch-action).
          ================================================================== */}
      <div
        ref={stageDragRef}
        className="md:hidden absolute inset-0 flex flex-col select-none"
        style={{
          transform: zenContentTransform,
          transition: sheetDragging ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1)',
          opacity: sheetOpen ? 0.7 : 1 - Math.min(0.3, zenDragY / 600),
          touchAction: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status-bar safe area spacer */}
        <div className="pt-safe" />

        {/* Drag handle — tall, iOS-style pull indicator. The pill sits on top
            of a full-width hit target so anywhere along the top strip starts
            a drag. Also double-tap-to-close, for people who prefer tap. */}
        <button
          type="button"
          onClick={closeZen}
          className="shrink-0 flex items-center justify-center w-full py-3 outline-none"
          aria-label="Close Zen (or swipe down)"
        >
          <span
            className="block rounded-full transition-all duration-150"
            style={{
              width: zenDragY > 10 ? '48px' : '40px',
              height: '4px',
              backgroundColor: zenDragY > SWIPE_CLOSE_ZEN ? 'var(--sun)' : 'var(--line2)',
            }}
          />
        </button>

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-1 pb-2">
          <span className="font-mono-jb text-[10px] tracking-[2.5px] text-[var(--mute)] uppercase">
            Now Playing
          </span>
          <div className="font-mono-jb text-[10px] tracking-[2px] text-right leading-[1.5]">
            <div className="text-[var(--sun)]">BODY {bodyLabel}</div>
            <div className="text-[var(--mute)]">
              {currentTrack.format ? currentTrack.format.toUpperCase() : '—'}
              {currentTrack.bitrate ? ` · ${Math.round(currentTrack.bitrate / 1000)} KBPS` : ''}
            </div>
          </div>
        </div>

        {/* System kicker */}
        <div className="text-center mt-3 font-mono-jb text-[9px] tracking-[3.5px] text-[var(--mute)] uppercase">
          <span className="text-[var(--sun)]">◉</span> {currentTrack.albumName.toUpperCase()}
        </div>

        {/* Planetarium */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-2">
          <Planetarium
            title={currentTrack.artistName}
            subtitle=""
            accent={accent}
            initial={(currentTrack.artistName || currentTrack.title)[0]?.toUpperCase() ?? '★'}
            imageUrl={albumImg}
            bodyName=""
            bodyMeta=""
            progress={playProgress}
            minors={minors}
          />
        </div>

        {/* Track title */}
        <div className="shrink-0 text-center px-6">
          <h2 className="font-serif font-light text-[28px] leading-tight text-[var(--ink)] truncate">
            {currentTrack.title}
          </h2>
          <p className="font-mono-jb text-[9px] tracking-[3px] text-[var(--mute)] uppercase mt-1.5 truncate">
            {currentTrack.albumName}
          </p>
        </div>

        {/* Waveform + timestamps */}
        <div className="shrink-0 px-6 mt-4">
          <Waveform
            progress={playProgress}
            color={PALETTE.rose}
            bars={70}
            height={26}
            onSeek={handleSeekFrac}
          />
          <div className="flex justify-between mt-1 font-mono-jb text-[10px] tabular-nums">
            <span className="text-[var(--rose)]">{formatTime(progress)}</span>
            <span className="text-[var(--mute)]">θ {thetaDeg}°</span>
            <span className="text-[var(--mute)]">{formatLong(duration)}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="shrink-0 flex items-center justify-center gap-7 mt-4">
          <button
            onClick={toggleShuffle}
            className={`text-[17px] cursor-pointer ${shuffle ? 'text-[var(--sun)]' : 'text-[var(--mute)]'}`}
            aria-label="Shuffle"
          >⇌</button>
          <button onClick={previous} className="text-[var(--ink)] text-[22px] cursor-pointer" aria-label="Previous">◀◀</button>
          <button
            onClick={isPlaying ? pause : resume}
            className={`btn-sun w-16 h-16 rounded-full grid place-items-center text-[16px] cursor-pointer ${isPlaying ? 'is-on' : ''}`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >{isPlaying ? '❚❚' : '▶'}</button>
          <button onClick={next} className="text-[var(--ink)] text-[22px] cursor-pointer" aria-label="Next">▶▶</button>
          <button
            onClick={toggleRepeat}
            className={`text-[17px] cursor-pointer ${repeat !== 'none' ? 'text-[var(--sun)]' : 'text-[var(--mute)]'}`}
            aria-label={repeatLabel(repeat)}
          >{repeat === 'one' ? '⟳¹' : '⟳'}</button>
        </div>

        {/* Coord strip + swipe-up affordance */}
        <div className="shrink-0 px-6 pt-4 pb-5 flex items-center justify-between font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase">
          <span>R = {duration > 0 ? Math.round(duration) : '—'}au</span>
          <button
            onClick={() => { haptic('light'); setSheetOpen(true); }}
            className="flex items-center gap-1.5 text-[var(--sun)] uppercase"
            aria-label="Show queue"
          >
            <span className="text-[12px] leading-none animate-pulse">⌃</span>
            SWIPE UP · NEXT
          </button>
          <span>QUEUE · {queue.length}</span>
        </div>
      </div>

      {/* ==================================================================
          QUEUE BOTTOM SHEET (mobile only)
          ================================================================== */}
      <div
        className="md:hidden absolute inset-x-0 bottom-0 top-[14%] z-[5]
                   bg-[rgba(11,13,16,0.96)] backdrop-blur-xl
                   border-t border-[var(--line2)]
                   flex flex-col"
        style={{
          transform: sheetMobileTranslate,
          transition: sheetDragging ? 'none' : 'transform 340ms cubic-bezier(0.32,0.72,0,1)',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.35)',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={sheetDragRef}
          className="shrink-0 select-none cursor-grab active:cursor-grabbing"
          role="button"
          aria-label="Drag to close queue"
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[var(--line2)]" />
          </div>
          <div className="flex items-center justify-between px-6 pb-3 border-b border-[var(--line)]">
            <span className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">
              Next Bodies
            </span>
            <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase">
              {upNext.length} · QUEUED
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {upNext.length === 0 && (
            <div className="px-6 py-8 text-center text-[var(--mute)] italic font-serif">
              — end of orbit
            </div>
          )}
          {upNext.map((track, i) => {
            const origIdx = (queueIndex + 1 + i) % queue.length;
            const c = orbitColorFor(track.id);
            const label = toRoman(origIdx + 1);
            return (
              <div
                key={`${track.id}-${origIdx}`}
                onClick={() => {
                  haptic('selection');
                  play(track, queue, origIdx);
                }}
                className="flex items-center gap-3 px-5 py-3 border-b border-[var(--line)] active:bg-[rgba(255,255,255,0.04)] cursor-pointer"
              >
                <span
                  className="font-serif italic text-[13px] w-8 text-right shrink-0"
                  style={{ color: c }}
                >
                  {label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[14px] text-[var(--ink)] truncate">{track.title}</p>
                  <p className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase truncate">
                    {track.artistName} · {track.albumName}
                  </p>
                </div>
                <span className="font-mono-jb text-[10px] text-[var(--mute)] tabular-nums shrink-0">
                  {formatTime(track.durationSeconds)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
