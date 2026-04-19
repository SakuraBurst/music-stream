import { useEffect } from 'react';
import { useParams } from 'react-router';

import { useLibraryStore } from '../store/libraryStore.ts';
import AlbumCard from '../components/Library/AlbumCard.tsx';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';
import { orbitColorFor } from '../components/Cosmic/palette.ts';

export default function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useLibraryStore((s) => s.artistDetail);
  const loading = useLibraryStore((s) => s.artistDetailLoading);
  const loadArtistDetail = useLibraryStore((s) => s.loadArtistDetail);

  useEffect(() => { if (id) loadArtistDetail(id); }, [id, loadArtistDetail]);

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading origin…</p>
      </div>
    );
  }

  const accent = orbitColorFor(detail.id);

  return (
    <div>
      <header className="flex items-center gap-5 border-b border-[var(--line)] pb-5 mb-6">
        <div className="relative w-24 h-24 shrink-0 grid place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 3" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={accent} strokeWidth="1" />
            <circle cx="50" cy="50" r="30" fill={accent} opacity="0.15" />
            <circle cx="50" cy="10" r="2" fill={accent} className="sun-pulse" />
          </svg>
          <span className="font-serif italic text-[30px] text-[var(--ink)] relative z-[1]">
            {detail.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Origin</p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-serif text-[36px] text-[var(--ink)] truncate">{detail.name}</h1>
            <FavoriteButton type="artist" id={detail.id} />
          </div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-1">
            {detail.albums.length} {detail.albums.length === 1 ? 'SYSTEM' : 'SYSTEMS'}
          </p>
        </div>
        <div className="ml-auto hidden md:block font-mono-jb text-[10px] tracking-[2px] text-right uppercase leading-[1.8]" style={{ color: accent }}>
          ◉ STAR<br />
          <span className="text-[var(--mute)]">{detail.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </header>

      {detail.albums.length > 0 ? (
        <section>
          <h2 className="font-serif italic text-[20px] text-[var(--ink)] mb-3 border-b border-[var(--line)] pb-2">Systems</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {detail.albums.map((album) => (
              <AlbumCard
                key={album.id}
                id={album.id}
                name={album.name}
                artistName={detail.name}
                year={album.year}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-12 border border-[var(--line)]">
          <p className="font-serif italic text-[18px] text-[var(--ink2)]">No systems catalogued for this star.</p>
        </div>
      )}
    </div>
  );
}
