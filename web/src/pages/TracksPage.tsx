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
  if (typeof av === 'string' && typeof bv === 'string') {
    cmp = av.localeCompare(bv);
  } else {
    cmp = (av as number) - (bv as number);
  }
  return dir === 'asc' ? cmp : -cmp;
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className }: SortHeaderProps) {
  const active = sortKey === currentKey;
  const arrow = active ? (currentDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <th
      className={`px-3 py-2 text-left cursor-pointer select-none hover:text-zinc-300 transition-colors ${className ?? ''} ${active ? 'text-zinc-200' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}{arrow}
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

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(
    () => [...tracks].sort((a, b) => compareTracks(a, b, sortKey, sortDir)),
    [tracks, sortKey, sortDir],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tracks</h1>

      {loading && tracks.length === 0 && (
        <p className="text-zinc-400">Loading tracks...</p>
      )}

      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
            <th className="px-3 py-2 text-right w-10">#</th>
            <SortHeader label="Title" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Artist" sortKey="artistName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Album" sortKey="albumName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader
              label="Duration"
              sortKey="durationSeconds"
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
              className="text-right w-20"
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

      <LoadMoreButton
        loading={loading}
        hasMore={tracks.length < total}
        onClick={loadMore}
      />
    </div>
  );
}
