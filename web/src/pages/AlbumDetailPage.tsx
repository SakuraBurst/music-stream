import { useEffect } from 'react';
import { useParams, Link } from 'react-router';

import { useLibraryStore } from '../store/libraryStore.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useLibraryStore((s) => s.albumDetail);
  const loading = useLibraryStore((s) => s.albumDetailLoading);
  const loadAlbumDetail = useLibraryStore((s) => s.loadAlbumDetail);

  useEffect(() => {
    if (id) {
      loadAlbumDetail(id);
    }
  }, [id, loadAlbumDetail]);

  if (loading || !detail) {
    return (
      <div>
        <p className="text-zinc-400">Loading album...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Album header */}
      <div className="flex gap-6 mb-8">
        <div className="w-48 h-48 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
          <img
            src={coverArtUrl(detail.id)}
            alt={detail.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Album</p>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold truncate">{detail.name}</h1>
            <FavoriteButton type="album" id={detail.id} />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Link
              to={`/artists/${detail.artistId}`}
              className="text-zinc-200 hover:underline font-medium"
            >
              {detail.artistName}
            </Link>
            {detail.year != null && detail.year > 0 && (
              <>
                <span>&middot;</span>
                <span>{detail.year}</span>
              </>
            )}
            <span>&middot;</span>
            <span>{detail.tracks.length} tracks</span>
            <span>&middot;</span>
            <span>{formatDuration(detail.durationSeconds)}</span>
          </div>
          {detail.genre && (
            <p className="text-xs text-zinc-500 mt-1">{detail.genre}</p>
          )}
        </div>
      </div>

      {/* Track list */}
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
            <th className="px-3 py-2 text-right w-10">#</th>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-right w-20">Duration</th>
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
        <p className="text-zinc-500 mt-4">No tracks in this album.</p>
      )}
    </div>
  );
}
