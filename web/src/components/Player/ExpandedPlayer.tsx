import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';
import OrbitalCover from '../Cosmic/OrbitalCover.tsx';
import Waveform from '../Cosmic/Waveform.tsx';
import { orbitColorFor, PALETTE } from '../Cosmic/palette.ts';
import { toRoman } from '../Cosmic/utils.ts';
import FavoriteButton from '../Favorites/FavoriteButton.tsx';
import AddToPlaylistButton from '../Playlist/AddToPlaylistButton.tsx';

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
  const openZen = usePlayerStore((s) => s.openZen);
  const play = usePlayerStore((s) => s.play);

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (expandedOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(timer);
    }
  }, [expandedOpen]);

  useEffect(() => {
    if (!expandedOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeExpanded();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedOpen, closeExpanded]);

  const handleSeekFrac = useCallback((frac: number) => {
    if (duration <= 0) return;
    seek(frac * duration);
  }, [seek, duration]);

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVolume(Number(e.target.value)),
    [setVolume],
  );

  const upNext = useMemo(() => {
    if (!queue.length) return [];
    const out: { track: typeof queue[number]; idx: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (queueIndex + i) % queue.length;
      if (out.find((t) => t.idx === idx)) break;
      out.push({ track: queue[idx], idx });
    }
    return out;
  }, [queue, queueIndex]);

  if (!mounted || !currentTrack) return null;

  const accent = orbitColorFor(currentTrack.id);
  const playProgress = duration > 0 ? progress / duration : 0;
  const albumImg = coverArtUrl(currentTrack.albumId);
  const totalDuration = queue.reduce((a, t) => a + t.durationSeconds, 0);

  return (
    <>
      {/* ============================================================
           DESKTOP ONLY — inline column (pushes main content).
           On mobile the Zen player is the full player; tapping the
           mini bar opens Zen directly, so ExpandedPlayer renders
           nothing on phones.
         ============================================================ */}
      <aside
        role="dialog"
        aria-label="Now Playing"
        aria-hidden={!visible}
        className="hidden md:flex md:flex-col md:h-full md:shrink-0 md:overflow-hidden
                   md:border-l md:border-[var(--line)]
                   md:bg-[rgba(11,13,16,0.72)] md:backdrop-blur-md"
        style={{
          width: visible ? '380px' : '0px',
          transition: 'width 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="min-w-[380px] w-[380px] flex flex-col h-full">
          <div className="shrink-0 px-6 pt-6 pb-3 flex items-center justify-between border-b border-[var(--line)]">
            <span className="font-mono-jb text-[9px] tracking-[3px] text-[var(--rose)] uppercase live-pulse">◉ ORBITING</span>
            <button
              onClick={closeExpanded}
              className="text-[var(--mute)] hover:text-[var(--ink)] transition-colors cursor-pointer text-[10px] tracking-[2px]"
              aria-label="Close expanded player"
            >× COLLAPSE</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-5 flex flex-col gap-4">
            <div className="w-full max-w-[280px] aspect-square mx-auto">
              <OrbitalCover
                imageUrl={albumImg}
                initial={(currentTrack.artistName || currentTrack.title)[0]?.toUpperCase() ?? '★'}
                progress={playProgress}
                accent={accent}
              />
            </div>

            <div className="text-center">
              <div className="font-serif text-[20px] text-[var(--ink)] truncate">{currentTrack.title}</div>
              <div className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-1 truncate">
                {currentTrack.artistName} · {currentTrack.albumName}
              </div>
            </div>

            <div>
              <Waveform progress={playProgress} color={accent} bars={80} height={40} onSeek={handleSeekFrac} />
              <div className="flex justify-between mt-1 font-mono-jb text-[10px] tabular-nums">
                <span className="text-[var(--rose)]">{formatTime(progress)}</span>
                <span className="text-[var(--mute)]">{formatLong(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 border-y border-[var(--line)] py-3">
              <button
                onClick={toggleShuffle}
                className={`text-[15px] cursor-pointer ${shuffle ? 'text-[var(--sun)]' : 'text-[var(--mute)] hover:text-[var(--sun)]'}`}
                aria-label="Shuffle"
                title="Shuffle"
              >⇌</button>
              <button onClick={previous} className="text-[var(--ink)] text-[16px] hover:text-[var(--sun)] transition-colors cursor-pointer" aria-label="Previous">◀◀</button>
              <button
                onClick={isPlaying ? pause : resume}
                className={`btn-sun w-[46px] h-[46px] rounded-full grid place-items-center text-[13px] cursor-pointer ${isPlaying ? 'is-on' : ''}`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >{isPlaying ? '❚❚' : '▶'}</button>
              <button onClick={next} className="text-[var(--ink)] text-[16px] hover:text-[var(--sun)] transition-colors cursor-pointer" aria-label="Next">▶▶</button>
              <button
                onClick={toggleRepeat}
                className={`text-[15px] cursor-pointer ${repeat !== 'none' ? 'text-[var(--sun)]' : 'text-[var(--mute)] hover:text-[var(--sun)]'}`}
                aria-label={repeatLabel(repeat)}
                title={repeatLabel(repeat)}
              >{repeat === 'one' ? '⟳¹' : '⟳'}</button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="text-[var(--mute)] text-[12px]">{volume === 0 ? '⨉' : '◐'}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolume}
                className="w-28 h-px range-sun cursor-pointer"
                aria-label="Volume"
              />
              <FavoriteButton type="track" id={currentTrack.id} />
              <AddToPlaylistButton trackId={currentTrack.id} />
            </div>

            <div>
              <div className="font-mono-jb text-[9px] tracking-[3px] text-[var(--mute)] uppercase mb-2">Next Bodies</div>
              {upNext.length === 0 && (
                <div className="text-[var(--mute)] text-[12px] italic">— end of orbit</div>
              )}
              {upNext.map((u) => {
                const c = orbitColorFor(u.track.id);
                return (
                  <div
                    key={`${u.track.id}-${u.idx}`}
                    onClick={() => play(u.track, queue, u.idx)}
                    className="grid items-baseline cursor-pointer py-2 border-b border-[var(--line)] hover:pl-1 transition-[padding]"
                    style={{ gridTemplateColumns: '34px 1fr 50px' }}
                  >
                    <span className="font-serif italic text-[12px]" style={{ color: c }}>
                      {toRoman(u.idx + 1)}
                    </span>
                    <span className="text-[12px] truncate">
                      {u.track.title}
                      <span className="text-[var(--mute)]"> · {u.track.artistName}</span>
                    </span>
                    <span className="font-mono-jb text-[9px] text-[var(--mute)] text-right tabular-nums">
                      {formatTime(u.track.durationSeconds)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="shrink-0 px-6 py-3 flex items-center justify-between font-mono-jb text-[9px] tracking-[2px] border-t border-[var(--line)]"
            style={{ color: PALETTE.mute }}
          >
            <span>TOTAL · {formatLong(totalDuration)}</span>
            <span
              onClick={openZen}
              className="text-[var(--sun)] cursor-pointer hover:text-[var(--ink)] transition-colors"
            >ZEN ⤢</span>
          </div>
        </div>
      </aside>
    </>
  );
}
