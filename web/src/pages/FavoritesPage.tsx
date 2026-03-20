import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';

import { fetchFavorites } from '../api/favorites.ts';
import { fetchArtist } from '../api/library.ts';
import { fetchAlbum } from '../api/library.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';
import { useFavoritesStore } from '../store/favoritesStore.ts';
import type { Favorite, TrackResponse } from '../types/index.ts';
import { apiGet } from '../api/client.ts';
import TrackRow from '../components/Library/TrackRow.tsx';

interface ResolvedArtist {
  id: string;
  name: string;
}

interface ResolvedAlbum {
  id: string;
  name: string;
  artistName: string;
  artistId: string;
}

type ActiveTab = 'tracks' | 'albums' | 'artists';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracks');

  // Resolved data
  const [tracks, setTracks] = useState<TrackResponse[]>([]);
  const [albums, setAlbums] = useState<ResolvedAlbum[]>([]);
  const [artists, setArtists] = useState<ResolvedArtist[]>([]);

  const favStoreLoaded = useFavoritesStore((s) => s.loaded);
  const loadFavStore = useFavoritesStore((s) => s.load);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const favs = await fetchFavorites();
      setFavorites(favs);

      // Resolve track favorites
      const trackFavs = favs.filter((f) => f.itemType === 'track');
      const resolvedTracks: TrackResponse[] = [];
      for (const fav of trackFavs) {
        try {
          const track = await apiGet<TrackResponse>(`/tracks/${fav.itemId}`);
          resolvedTracks.push(track);
        } catch {
          // Track may have been deleted
        }
      }
      setTracks(resolvedTracks);

      // Resolve album favorites
      const albumFavs = favs.filter((f) => f.itemType === 'album');
      const resolvedAlbums: ResolvedAlbum[] = [];
      for (const fav of albumFavs) {
        try {
          const album = await fetchAlbum(fav.itemId);
          resolvedAlbums.push({
            id: album.id,
            name: album.name,
            artistName: album.artistName,
            artistId: album.artistId,
          });
        } catch {
          // Album may have been deleted
        }
      }
      setAlbums(resolvedAlbums);

      // Resolve artist favorites
      const artistFavs = favs.filter((f) => f.itemType === 'artist');
      const resolvedArtists: ResolvedArtist[] = [];
      for (const fav of artistFavs) {
        try {
          const artist = await fetchArtist(fav.itemId);
          resolvedArtists.push({ id: artist.id, name: artist.name });
        } catch {
          // Artist may have been deleted
        }
      }
      setArtists(resolvedArtists);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    if (!favStoreLoaded) {
      loadFavStore();
    }
  }, [loadFavorites, favStoreLoaded, loadFavStore]);

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    {
      key: 'tracks',
      label: 'Tracks',
      count: favorites.filter((f) => f.itemType === 'track').length,
    },
    {
      key: 'albums',
      label: 'Albums',
      count: favorites.filter((f) => f.itemType === 'album').length,
    },
    {
      key: 'artists',
      label: 'Artists',
      count: favorites.filter((f) => f.itemType === 'artist').length,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Favorites</h1>

      {loading && (
        <p className="text-zinc-400">Loading favorites...</p>
      )}

      {!loading && favorites.length === 0 && (
        <p className="text-zinc-500">
          No favorites yet. Click the heart icon on tracks, albums, or artists
          to add them here.
        </p>
      )}

      {!loading && favorites.length > 0 && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-zinc-800">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'text-white border-white'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-xs text-zinc-500">
                    ({tab.count})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tracks tab */}
          {activeTab === 'tracks' && (
            <>
              {tracks.length > 0 ? (
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="px-3 py-2 text-right w-10">#</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Artist</th>
                      <th className="px-3 py-2 text-left">Album</th>
                      <th className="px-3 py-2 text-right w-20">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track, i) => (
                      <TrackRow
                        key={track.id}
                        track={track}
                        index={i}
                        queue={tracks}
                        showArtist
                        showAlbum
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-zinc-500">No favorite tracks.</p>
              )}
            </>
          )}

          {/* Albums tab */}
          {activeTab === 'albums' && (
            <>
              {albums.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {albums.map((album) => (
                    <Link
                      key={album.id}
                      to={`/albums/${album.id}`}
                      className="group p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
                    >
                      <div className="w-full aspect-square rounded-md bg-zinc-800 mb-3 overflow-hidden">
                        <img
                          src={coverArtUrl(album.id)}
                          alt={album.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-zinc-200 truncate flex-1">
                          {album.name}
                        </p>
                        <FavoriteButton
                          type="album"
                          id={album.id}
                          className="opacity-0 group-hover:opacity-100 shrink-0"
                        />
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {album.artistName}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500">No favorite albums.</p>
              )}
            </>
          )}

          {/* Artists tab */}
          {activeTab === 'artists' && (
            <>
              {artists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {artists.map((artist) => (
                    <Link
                      key={artist.id}
                      to={`/artists/${artist.id}`}
                      className="group p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
                    >
                      <div className="w-full aspect-square rounded-full bg-zinc-800 mb-3 flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-12 h-12 text-zinc-600"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-zinc-200 truncate flex-1">
                          {artist.name}
                        </p>
                        <FavoriteButton
                          type="artist"
                          id={artist.id}
                          className="opacity-0 group-hover:opacity-100 shrink-0"
                        />
                      </div>
                      <p className="text-xs text-zinc-500">Artist</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500">No favorite artists.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
