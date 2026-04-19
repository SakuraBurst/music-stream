import { useEffect } from 'react';

import { useLibraryStore } from '../store/libraryStore.ts';
import ArtistCard from '../components/Library/ArtistCard.tsx';
import LoadMoreButton from '../components/Library/LoadMoreButton.tsx';

export default function ArtistsPage() {
  const artists = useLibraryStore((s) => s.artists);
  const total = useLibraryStore((s) => s.artistsTotal);
  const loading = useLibraryStore((s) => s.artistsLoading);
  const loadArtists = useLibraryStore((s) => s.loadArtists);
  const loadMore = useLibraryStore((s) => s.loadMoreArtists);

  useEffect(() => { loadArtists(); }, [loadArtists]);

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">01 · Artists</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Artists<span className="text-[var(--mute)] font-light italic"> · orbit map</span>
          </h1>
        </div>
        <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)]">{total || '—'} · STELLAR</span>
      </header>

      {loading && artists.length === 0 && (
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading artists…</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
      </div>

      <LoadMoreButton loading={loading} hasMore={artists.length < total} onClick={loadMore} />
    </div>
  );
}
