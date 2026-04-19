import { useCallback, useRef } from 'react';

import { usePlayerStore } from '../../store/playerStore.ts';
import type { RepeatMode } from '../../store/playerStore.ts';
import { coverArtUrl } from '../Library/coverart.ts';

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

function VolumeGlyph({ volume }: { volume: number }) {
  if (volume === 0)    return <span aria-hidden>⨉</span>;
  if (volume < 0.5)    return <span aria-hidden>◔</span>;
  return <span aria-hidden>◐</span>;
}

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

  const barRef = useRef<HTMLDivElement>(null);
  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const r = barRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seek(frac * duration);
  }, [seek, duration]);

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVolume(Number(e.target.value)),
    [setVolume],
  );

  if (!currentTrack) return null;

  const percent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="shrink-0 border-t border-[var(--line)]
                 bg-[rgba(11,13,16,0.92)] backdrop-blur-xl
                 text-[var(--ink)]"
    >
      {/* MOBILE — compact strip */}
      <div className="md:hidden px-3 py-2.5">
        <div
          ref={barRef}
          onClick={handleSeekClick}
          className="relative h-px bg-[var(--line2)] cursor-pointer mb-2.5"
        >
          <div
            className="absolute left-0 top-[-0.5px] h-[2px] bg-[var(--rose)]"
            style={{
              width: `${percent}%`,
              boxShadow: '0 0 6px var(--rose)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openZen}
            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
            aria-label="Open Now Playing"
          >
            <div className="w-10 h-10 shrink-0 rounded-sm bg-[var(--bg2)] border border-[var(--line)] overflow-hidden">
              <img
                src={coverArtUrl(currentTrack.albumId)}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[14px] truncate text-[var(--ink)]">
                {currentTrack.title}
              </p>
              <p className="text-[10px] tracking-[2px] text-[var(--rose)] uppercase truncate">
                ◉ ORBITING · {currentTrack.artistName}
              </p>
            </div>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : resume(); }}
            className={`btn-sun w-10 h-10 rounded-full grid place-items-center text-[12px] cursor-pointer ${isPlaying ? 'is-on' : ''}`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="text-[var(--ink2)] active:text-[var(--sun)] p-1 shrink-0 cursor-pointer text-[14px]"
            aria-label="Next"
          >
            ▶▶
          </button>
        </div>
      </div>

      {/* DESKTOP — orbital strip */}
      <div
        className="hidden md:grid items-center gap-5 px-6 py-3"
        style={{ gridTemplateColumns: 'auto minmax(220px, 1.2fr) minmax(260px, 2fr) auto' }}
      >
        <button
          onClick={isPlaying ? pause : resume}
          className={`btn-sun w-7 h-7 rounded-full grid place-items-center text-[9px] cursor-pointer ${isPlaying ? 'is-on' : ''}`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        <button
          onClick={openZen}
          className="flex flex-col gap-[3px] min-w-0 text-left cursor-pointer group"
          aria-label="Enter Zen"
          title="Enter Zen"
        >
          <p className="font-serif text-[14px] truncate">
            {currentTrack.title}
            <span className="text-[var(--mute)]"> · {currentTrack.artistName}</span>
          </p>
          <p className="text-[9px] tracking-[2px] text-[var(--rose)] uppercase truncate">
            ◉ ORBITING · BODY {currentTrack.trackNumber ?? '01'} · {currentTrack.albumName.toUpperCase()}
          </p>
        </button>

        <div className="flex items-center gap-3">
          <span className="font-mono-jb text-[10px] text-[var(--rose)] min-w-[38px] tabular-nums">
            {formatTime(progress)}
          </span>
          <div
            ref={barRef}
            onClick={handleSeekClick}
            className="relative flex-1 h-px bg-[var(--line2)] cursor-pointer group"
          >
            <div
              className="absolute left-0 top-[-0.5px] h-[2px] bg-[var(--rose)]"
              style={{
                width: `${percent}%`,
                transition: 'width 0.1s linear',
              }}
            />
            {percent > 0 && (
              <div
                className="absolute top-[-2.5px] w-[6px] h-[6px] -translate-x-1/2 rounded-full bg-[var(--rose)]"
                style={{
                  left: `${percent}%`,
                  boxShadow: '0 0 8px var(--rose)',
                }}
              />
            )}
          </div>
          <span className="font-mono-jb text-[10px] text-[var(--mute)] min-w-[42px] tabular-nums text-right">
            {formatLong(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[var(--ink2)] text-[13px]">
          <button
            onClick={previous}
            className="hover:text-[var(--sun)] transition-colors cursor-pointer"
            aria-label="Previous"
            title="Previous"
          >
            ◀◀
          </button>
          <button
            onClick={next}
            className="hover:text-[var(--sun)] transition-colors cursor-pointer"
            aria-label="Next"
            title="Next"
          >
            ▶▶
          </button>
          <button
            onClick={toggleShuffle}
            className={`transition-colors cursor-pointer ${shuffle ? 'text-[var(--sun)]' : 'hover:text-[var(--sun)]'}`}
            aria-label="Shuffle"
            title="Shuffle"
          >
            ⇌
          </button>
          <button
            onClick={toggleRepeat}
            className={`transition-colors cursor-pointer ${repeat !== 'none' ? 'text-[var(--sun)]' : 'hover:text-[var(--sun)]'}`}
            aria-label={repeatLabel(repeat)}
            title={repeatLabel(repeat)}
          >
            {repeat === 'one' ? '⟳¹' : '⟳'}
          </button>

          <span className="flex items-center gap-2 ml-1">
            <span className="text-[14px] text-[var(--mute)]">
              <VolumeGlyph volume={volume} />
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolume}
              className="w-20 h-px range-sun cursor-pointer"
              aria-label="Volume"
            />
          </span>

          <button
            onClick={toggleExpanded}
            className={`pl-3 ml-1 border-l border-[var(--line2)] transition-colors cursor-pointer ${expandedOpen ? 'text-[var(--sun)]' : 'hover:text-[var(--sun)]'}`}
            aria-label="Now Playing"
            title="Now Playing"
          >
            ◉
          </button>
          <button
            onClick={toggleQueue}
            className={`transition-colors cursor-pointer ${queueOpen ? 'text-[var(--sun)]' : 'hover:text-[var(--sun)]'}`}
            aria-label="Queue"
            title="Queue"
          >
            ☰
          </button>
          <button
            onClick={openZen}
            className="text-[var(--sun)] hover:text-[var(--ink)] transition-colors cursor-pointer text-[15px]"
            aria-label="Enter Zen"
            title="Enter Zen"
          >
            ⤢
          </button>
        </div>
      </div>
    </div>
  );
}
