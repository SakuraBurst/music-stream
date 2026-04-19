import { useEffect, useState, useMemo } from 'react';

import { useLibraryStore } from '../store/libraryStore.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import LoadMoreButton from '../components/Library/LoadMoreButton.tsx';
import type { TrackResponse } from '../types/index.ts';

type SortKey = 'title' | 'artistName' | 'albumName' | 'durationSeconds';
type SortDir = 'asc' | 'desc';

function compareTracks(a: TrackResponse, b: TrackResponse, key: SortKey, dir: SortDir): number {
  let cmp: number;
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
  else cmp = (av as number) - (bv as number);
  return dir === 'asc' ? cmp : -cmp;
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className }: SortHeaderProps) {
  const active = sortKey === currentKey;
  return (
    <th
      className={`px-3 py-2.5 text-left cursor-pointer select-none font-mono-jb text-[9px] tracking-[2.5px] transition-colors
        ${active ? 'text-[var(--sun)]' : 'text-[var(--mute)] hover:text-[var(--ink2)]'} ${className ?? ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 uppercase">
        {label}
        {active && <span>{currentDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
}

export default function TracksPage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const total = useLibraryStore((s) => s.tracksTotal);
  const loading = useLibraryStore((s) => s.tracksLoading);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const loadMore = useLibraryStore((s) => s.loadMoreTracks);

  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => { loadTracks(); }, [loadTracks]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = useMemo(
    () => [...tracks].sort((a, b) => compareTracks(a, b, sortKey, sortDir)),
    [tracks, sortKey, sortDir],
  );

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">03 · Bodies</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Tracks<span className="text-[var(--mute)] font-light italic"> · catalog</span>
          </h1>
        </div>
        <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)]">{total || '—'} · BODIES</span>
      </header>

      {loading && tracks.length === 0 && (
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading bodies…</p>
      )}

      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-[var(--line2)]">
            <th className="px-3 py-2.5 text-right w-10 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">#</th>
            <SortHeader label="Body"     sortKey="title"       currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Origin"   sortKey="artistName"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="System"   sortKey="albumName"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader
              label="Span"
              sortKey="durationSeconds"
              currentKey={sortKey} currentDir={sortDir}
              onSort={handleSort}
              className="text-right w-24"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              queue={sorted}
              showArtist
              showAlbum
            />
          ))}
        </tbody>
      </table>

      <LoadMoreButton loading={loading} hasMore={tracks.length < total} onClick={loadMore} />
    </div>
  );
}
