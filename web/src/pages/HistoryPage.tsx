import { useState, useEffect, useCallback } from 'react';

import { fetchHistory } from '../api/history.ts';
import { apiGet } from '../api/client.ts';
import { requestPlayback } from '../components/Library/playback-events.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
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

  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

      const resolved: HistoryEntry[] = [];
      for (const entry of result.items) {
        let track: TrackResponse | undefined;
        try { track = await apiGet<TrackResponse>(`/tracks/${entry.trackId}`); }
        catch { /* silent */ }
        resolved.push({ ...entry, track });
      }
      setEntries(prev => append ? [...prev, ...resolved] : resolved);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(0, false); }, [loadHistory]);

  function handleLoadMore() { loadHistory(entries.length, true); }

  const playableTracks = entries
    .filter((e): e is HistoryEntry & { track: TrackResponse } => !!e.track)
    .map((e) => e.track);

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">06 · Logs</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Listening logs<span className="text-[var(--mute)] font-light italic"> · timeline</span>
          </h1>
        </div>
        <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)]">{total || '—'} · ENTRIES</span>
      </header>

      {loading && entries.length === 0 && (
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading logs…</p>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-16 border border-[var(--line)]">
          <div className="font-serif italic text-[26px] text-[var(--ink2)]">No logs yet</div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-2">Play something to begin recording.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div>
          {entries.map((entry, i) => {
            if (!entry.track) {
              return (
                <div
                  key={entry.id}
                  className="grid items-center gap-3 px-3 py-2.5 border-b border-[var(--line)] text-[var(--mute)]"
                  style={{ gridTemplateColumns: '28px 40px 1fr auto auto' }}
                >
                  <span className="font-mono-jb text-[9px] text-right tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                  <div className="w-10 h-10 bg-[var(--bg2)] border border-[var(--line)] grid place-items-center text-[var(--mute)]">?</div>
                  <span className="font-serif italic text-[13px]">Body unavailable</span>
                  <span className="font-mono-jb text-[9px] uppercase">{formatPlayedAt(entry.playedAt)}</span>
                  <span className="font-mono-jb text-[10px] tabular-nums">—</span>
                </div>
              );
            }

            const queueIdx = playableTracks.findIndex((t) => t.id === entry.track?.id);

            return (
              <button
                key={entry.id}
                onClick={() => {
                  if (entry.track) requestPlayback(entry.track, playableTracks, queueIdx >= 0 ? queueIdx : 0);
                }}
                className="grid items-center gap-3 w-full px-3 py-2.5 border-b border-[var(--line)]
                           hover:bg-[rgba(255,255,255,0.025)] transition-all duration-150 text-left group cursor-pointer"
                style={{ gridTemplateColumns: '28px 40px 1fr auto 56px' }}
              >
                <span className="font-mono-jb text-[10px] text-[var(--mute)] text-right tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                <div className="w-10 h-10 bg-[var(--bg2)] border border-[var(--line)] overflow-hidden">
                  <img
                    src={coverArtUrl(entry.track.albumId)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-[13px] text-[var(--ink)] truncate">{entry.track.title}</p>
                  <p className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase truncate">{entry.track.artistName}</p>
                </div>
                <span className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase">{formatPlayedAt(entry.playedAt)}</span>
                <span className="font-mono-jb text-[10px] text-[var(--mute)] tabular-nums text-right">
                  {entry.durationSeconds ? formatDuration(entry.durationSeconds) : '--:--'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <LoadMoreButton loading={loading} hasMore={entries.length < total} onClick={handleLoadMore} />
    </div>
  );
}
