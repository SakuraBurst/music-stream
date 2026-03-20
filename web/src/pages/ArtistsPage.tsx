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

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Artists</h1>

      {loading && artists.length === 0 && (
        <p className="text-zinc-400">Loading artists...</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </div>

      <LoadMoreButton
        loading={loading}
        hasMore={artists.length < total}
        onClick={loadMore}
      />
    </div>
  );
}
