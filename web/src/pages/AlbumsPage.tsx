import { useEffect } from 'react';

import { useLibraryStore } from '../store/libraryStore.ts';
import AlbumCard from '../components/Library/AlbumCard.tsx';
import LoadMoreButton from '../components/Library/LoadMoreButton.tsx';

export default function AlbumsPage() {
  const albums = useLibraryStore((s) => s.albums);
  const total = useLibraryStore((s) => s.albumsTotal);
  const loading = useLibraryStore((s) => s.albumsLoading);
  const loadAlbums = useLibraryStore((s) => s.loadAlbums);
  const loadMore = useLibraryStore((s) => s.loadMoreAlbums);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Albums</h1>

      {loading && albums.length === 0 && (
        <p className="text-zinc-400">Loading albums...</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            id={album.id}
            name={album.name}
            artistName={album.artistName}
            year={album.year}
          />
        ))}
      </div>

      <LoadMoreButton
        loading={loading}
        hasMore={albums.length < total}
        onClick={loadMore}
      />
    </div>
  );
}
