import { useState, useEffect, useCallback } from 'react';

import { fetchHistory } from '../api/history.ts';
import { apiGet } from '../api/client.ts';
import { requestPlayback } from '../components/Library/playback-events.ts';
import LoadMoreButton from '../components/Library/LoadMoreButton.tsx';
import type { ListeningHistory, TrackResponse } from '../types/index.ts';

const PAGE_SIZE = 50;

interface HistoryEntry extends ListeningHistory {
  track?: TrackResponse;
}

function formatPlayedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async (offset: number, append: boolean) => {
    setLoading(true);
    try {
      const result = await fetchHistory(PAGE_SIZE, offset);
      setTotal(result.total);

      // Resolve track data for each entry
      const resolved: HistoryEntry[] = [];
      for (const entry of result.items) {
        let track: TrackResponse | undefined;
        try {
          track = await apiGet<TrackResponse>(`/tracks/${entry.trackId}`);
        } catch {
          // Track may have been deleted
        }
        resolved.push({ ...entry, track });
      }

      if (append) {
        setEntries((prev) => [...prev, ...resolved]);
      } else {
        setEntries(resolved);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(0, false);
  }, [loadHistory]);

  function handleLoadMore() {
    loadHistory(entries.length, true);
  }

  // Build a list of resolved tracks for queue playback
  const playableTracks = entries
    .filter((e): e is HistoryEntry & { track: TrackResponse } => !!e.track)
    .map((e) => e.track);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Listening History</h1>

      {loading && entries.length === 0 && (
        <p className="text-zinc-400">Loading history...</p>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-zinc-500">
          No listening history yet. Play some music to see it here.
        </p>
      )}

      {entries.length > 0 && (
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Artist</th>
              <th className="px-3 py-2 text-left w-28">Played</th>
              <th className="px-3 py-2 text-right w-20">Listened</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              if (!entry.track) {
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-3 py-2 text-sm text-zinc-500 text-right">
                      {i + 1}
                    </td>
                    <td
                      className="px-3 py-2 text-sm text-zinc-600 italic"
                      colSpan={2}
                    >
                      Track unavailable
                    </td>
                    <td className="px-3 py-2 text-sm text-zinc-600">
                      {formatPlayedAt(entry.playedAt)}
                    </td>
                    <td className="px-3 py-2 text-sm text-zinc-600 text-right">
                      {entry.durationSeconds
                        ? formatDuration(entry.durationSeconds)
                        : '--:--'}
                    </td>
                  </tr>
                );
              }

              const queueIdx = playableTracks.findIndex(
                (t) => t.id === entry.track?.id,
              );

              return (
                <tr
                  key={entry.id}
                  onClick={() => {
                    if (entry.track) {
                      requestPlayback(
                        entry.track,
                        playableTracks,
                        queueIdx >= 0 ? queueIdx : 0,
                      );
                    }
                  }}
                  className="group cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <td className="px-3 py-2 text-sm text-zinc-500 text-right">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-100 truncate max-w-0">
                    {entry.track.title}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-400 truncate max-w-0">
                    {entry.track.artistName}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-500">
                    {formatPlayedAt(entry.playedAt)}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-500 text-right">
                    {entry.durationSeconds
                      ? formatDuration(entry.durationSeconds)
                      : '--:--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <LoadMoreButton
        loading={loading}
        hasMore={entries.length < total}
        onClick={handleLoadMore}
      />
    </div>
  );
}
