import { useEffect } from 'react';
import { useParams, Link } from 'react-router';

import { useLibraryStore } from '../store/libraryStore.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';
import { requestPlayback } from '../components/Library/playback-events.ts';
import { orbitColorFor } from '../components/Cosmic/palette.ts';
import SideViewDiagram from '../components/Cosmic/SideViewDiagram.tsx';
import { usePlayerStore } from '../store/playerStore.ts';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} HR ${minutes} MIN`;
  return `${minutes} MIN`;
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useLibraryStore((s) => s.albumDetail);
  const loading = useLibraryStore((s) => s.albumDetailLoading);
  const loadAlbumDetail = useLibraryStore((s) => s.loadAlbumDetail);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);

  useEffect(() => { if (id) loadAlbumDetail(id); }, [id, loadAlbumDetail]);

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading album…</p>
      </div>
    );
  }

  function handlePlayAll() {
    if (detail && detail.tracks.length > 0) requestPlayback(detail.tracks[0], detail.tracks, 0);
  }

  const accent = orbitColorFor(detail.id);

  return (
    <div>
      <div className="flex gap-6 border-b border-[var(--line)] pb-5 mb-6 max-md:flex-col max-md:items-center">
        <div className="w-48 h-48 max-md:w-56 max-md:h-56 shrink-0 overflow-hidden bg-[var(--bg2)] border border-[var(--line)]">
          <img
            src={coverArtUrl(detail.id)}
            alt={detail.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col justify-end min-w-0 max-md:text-center max-md:items-center">
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Album</p>
          <div className="flex items-center gap-3 mt-1 max-md:justify-center">
            <h1 className="font-serif text-[36px] text-[var(--ink)] truncate">{detail.name}</h1>
            <FavoriteButton type="album" id={detail.id} />
          </div>
          <div className="flex items-center gap-2 font-mono-jb text-[10px] tracking-[1.5px] text-[var(--mute)] uppercase mt-1 flex-wrap max-md:justify-center">
            <Link
              to={`/artists/${detail.artistId}`}
              className="text-[var(--ink2)] hover:text-[var(--ink)] font-serif italic text-[14px] normal-case tracking-normal transition-colors"
            >
              {detail.artistName}
            </Link>
            {detail.year != null && detail.year > 0 && <><span>·</span><span>{detail.year}</span></>}
            <span>·</span><span>{detail.tracks.length} BODIES</span>
            <span>·</span><span>{formatDuration(detail.durationSeconds)}</span>
          </div>
          {detail.genre && (
            <span className="mt-2 w-fit font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase border border-[var(--line2)] px-2 py-0.5">
              {detail.genre}
            </span>
          )}
          {detail.tracks.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="mt-4 w-fit font-mono-jb text-[10px] tracking-[3px] uppercase
                         px-3 py-2 border border-[var(--sun)] text-[var(--sun)]
                         hover:bg-[rgba(217,178,90,0.08)] transition-colors"
            >
              ▶ PLAY SYSTEM
            </button>
          )}
        </div>
        <div className="ml-auto hidden md:block font-mono-jb text-[10px] tracking-[2px] text-right uppercase leading-[1.8]" style={{ color: accent }}>
          ◉ SYSTEM<br />
          <span className="text-[var(--mute)]">
            {detail.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </div>

      {detail.tracks.length > 0 && (
        <div className="mb-5 px-4 py-4 border border-[var(--line)] bg-[rgba(20,24,32,0.4)]">
          <div className="flex justify-between font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)] uppercase mb-2">
            <span>SIDE VIEW · FIRST {Math.min(detail.tracks.length, 12)} BODIES</span>
            <span>RADIUS ∝ SEQUENCE · CLICK TO PLAY</span>
          </div>
          <SideViewDiagram
            tracks={detail.tracks.map((t) => ({
              id: t.id,
              trackNumber: t.trackNumber,
              durationSeconds: t.durationSeconds,
            }))}
            currentId={currentTrackId}
            onSelect={(selected) => {
              const idx = detail.tracks.findIndex((x) => x.id === selected.id);
              if (idx >= 0) requestPlayback(detail.tracks[idx], detail.tracks, idx);
            }}
          />
        </div>
      )}

      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-[var(--line2)]">
            <th className="px-3 py-2.5 text-right w-12 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">#</th>
            <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">BODY</th>
            <th className="px-3 py-2.5 text-right w-24 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">SPAN</th>
          </tr>
        </thead>
        <tbody>
          {detail.tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              queue={detail.tracks}
              showTrackNumber
              showArtist={false}
              showAlbum={false}
            />
          ))}
        </tbody>
      </table>

      {detail.tracks.length === 0 && (
        <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] text-center py-8 uppercase">No bodies in this system.</p>
      )}
    </div>
  );
}
