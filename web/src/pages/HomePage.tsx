import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';

import { useAuthStore } from '../store/authStore.ts';
import { fetchAlbums, fetchArtists, fetchTracks } from '../api/library.ts';
import { fetchHistory } from '../api/history.ts';
import { apiGet } from '../api/client.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
import { requestPlayback } from '../components/Library/playback-events.ts';
import AlbumCard from '../components/Library/AlbumCard.tsx';
import type { AlbumResponse, TrackResponse, ListeningHistory } from '../types/index.ts';

interface RecentPlay {
  history: ListeningHistory;
  track: TrackResponse;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'Quiet hours';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [recentAlbums, setRecentAlbums] = useState<AlbumResponse[]>([]);
  const [stats, setStats] = useState({ artists: 0, albums: 0, tracks: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, albumsRes, artistsRes, tracksRes] = await Promise.all([
        fetchHistory(8, 0).catch(() => ({ items: [], total: 0 })),
        fetchAlbums(12, 0).catch(() => ({ items: [], total: 0 })),
        fetchArtists(1, 0).catch(() => ({ items: [], total: 0 })),
        fetchTracks(1, 0).catch(() => ({ items: [], total: 0 })),
      ]);

      setStats({
        artists: artistsRes.total,
        albums: albumsRes.total,
        tracks: tracksRes.total,
      });
      setRecentAlbums(albumsRes.items);

      const plays: RecentPlay[] = [];
      const seen = new Set<string>();
      for (const entry of historyRes.items) {
        if (seen.has(entry.trackId)) continue;
        seen.add(entry.trackId);
        try {
          const track = await apiGet<TrackResponse>(`/tracks/${entry.trackId}`);
          plays.push({ history: entry, track });
        } catch { /* track may have been deleted */ }
      }
      setRecentPlays(plays);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-[var(--line)] pb-4">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">
            ◉ OBSERVATORY · {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
          </p>
          <h1 className="font-serif text-[36px] text-[var(--ink)] mt-1">
            {getGreeting()}{user ? <span className="text-[var(--mute)] italic font-light">, {user.username}</span> : ''}
          </h1>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-1">
            {loading ? 'CHARTING SYSTEMS…' : 'YOUR LIBRARY · BELOW'}
          </p>
        </div>
        <div className="text-right text-[10px] tracking-[2px] text-[var(--mute)] uppercase font-mono-jb leading-[1.7] hidden md:block">
          <div className="text-[var(--sun)]">★ HOME</div>
          {user && <div>OBS · {user.username.toUpperCase()}</div>}
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <Link to="/artists" className="border border-[var(--line)] hover:border-[var(--line2)] bg-[rgba(20,24,32,0.4)] p-5 transition-colors group">
          <div className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">01 · Artists</div>
          <div className="font-serif text-[34px] text-[var(--ink)] mt-1">{loading ? '—' : stats.artists}</div>
          <div className="font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            view →
          </div>
        </Link>
        <Link to="/albums" className="border border-[var(--line)] hover:border-[var(--line2)] bg-[rgba(20,24,32,0.4)] p-5 transition-colors group">
          <div className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">02 · Albums</div>
          <div className="font-serif text-[34px] text-[var(--ink)] mt-1">{loading ? '—' : stats.albums}</div>
          <div className="font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            view →
          </div>
        </Link>
        <Link to="/tracks" className="border border-[var(--line)] hover:border-[var(--line2)] bg-[rgba(20,24,32,0.4)] p-5 transition-colors group">
          <div className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">03 · Bodies</div>
          <div className="font-serif text-[34px] text-[var(--ink)] mt-1">{loading ? '—' : stats.tracks}</div>
          <div className="font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            view →
          </div>
        </Link>
      </section>

      {/* Recently played */}
      {recentPlays.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4 border-b border-[var(--line)] pb-2">
            <h2 className="font-serif italic text-[20px] text-[var(--ink)]">Recently played</h2>
            <Link to="/history" className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] hover:text-[var(--sun)] uppercase transition-colors">
              VIEW ALL →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentPlays.slice(0, 8).map((rp) => (
              <button
                key={rp.history.id}
                onClick={() => {
                  const allTracks = recentPlays.map((r) => r.track);
                  const idx = allTracks.findIndex((t) => t.id === rp.track.id);
                  requestPlayback(rp.track, allTracks, idx >= 0 ? idx : 0);
                }}
                className="flex items-center gap-3 p-3 border border-[var(--line)]
                           bg-[rgba(20,24,32,0.4)] hover:border-[var(--line2)]
                           transition-all duration-150 text-left group cursor-pointer"
              >
                <div className="w-12 h-12 shrink-0 bg-[var(--bg2)] overflow-hidden relative">
                  <img
                    src={coverArtUrl(rp.track.albumId)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="absolute inset-0 grid place-items-center text-[var(--sun)] opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 text-[14px]">▶</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[13px] text-[var(--ink)] truncate">{rp.track.title}</p>
                  <p className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase truncate">{rp.track.artistName}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Albums */}
      {recentAlbums.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4 border-b border-[var(--line)] pb-2">
            <h2 className="font-serif italic text-[20px] text-[var(--ink)]">Albums</h2>
            <Link to="/albums" className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] hover:text-[var(--sun)] uppercase transition-colors">
              VIEW ALL →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recentAlbums.slice(0, 6).map((album) => (
              <AlbumCard
                key={album.id}
                id={album.id}
                name={album.name}
                artistName={album.artistName}
                year={album.year}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && stats.tracks === 0 && (
        <div className="text-center py-16 border border-[var(--line)]">
          <div className="font-serif italic text-[28px] text-[var(--ink2)]">Empty observatory</div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-2">
            UPLOAD MUSIC TO BEGIN MAPPING THE LIBRARY
          </p>
          <Link
            to="/upload"
            className="inline-block mt-6 font-mono-jb text-[10px] tracking-[3px] uppercase
                       px-4 py-2 border border-[var(--sun)] text-[var(--sun)]
                       hover:bg-[rgba(217,178,90,0.08)] transition-colors"
          >
            ↑ Upload music
          </Link>
        </div>
      )}
    </div>
  );
}
