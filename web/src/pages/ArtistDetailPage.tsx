import { useEffect } from 'react';
import { useParams } from 'react-router';

import { useLibraryStore } from '../store/libraryStore.ts';
import AlbumCard from '../components/Library/AlbumCard.tsx';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';

export default function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useLibraryStore((s) => s.artistDetail);
  const loading = useLibraryStore((s) => s.artistDetailLoading);
  const loadArtistDetail = useLibraryStore((s) => s.loadArtistDetail);

  useEffect(() => {
    if (id) {
      loadArtistDetail(id);
    }
  }, [id, loadArtistDetail]);

  if (loading || !detail) {
    return (
      <div>
        <p className="text-zinc-400">Loading artist...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold">{detail.name}</h1>
        <FavoriteButton type="artist" id={detail.id} />
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        {detail.albums.length} {detail.albums.length === 1 ? 'album' : 'albums'}
      </p>

      <h2 className="text-lg font-semibold mb-4">Albums</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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

      {detail.albums.length === 0 && (
        <p className="text-zinc-500">No albums found for this artist.</p>
      )}
    </div>
  );
}
