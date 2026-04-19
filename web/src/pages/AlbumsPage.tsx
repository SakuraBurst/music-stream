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

  useEffect(() => { loadAlbums(); }, [loadAlbums]);

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">02 · Albums</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Albums<span className="text-[var(--mute)] font-light italic"> · collected</span>
          </h1>
        </div>
        <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)]">{total || '—'} · VOLUMES</span>
      </header>

      {loading && albums.length === 0 && (
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading albums…</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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

      <LoadMoreButton loading={loading} hasMore={albums.length < total} onClick={loadMore} />
    </div>
  );
}
