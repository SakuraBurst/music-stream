import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';

import { fetchFavorites } from '../api/favorites.ts';
import { fetchArtist, fetchAlbum } from '../api/library.ts';
import { coverArtUrl } from '../components/Library/coverart.ts';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';
import { useFavoritesStore } from '../store/favoritesStore.ts';
import type { Favorite, TrackResponse } from '../types/index.ts';
import { apiGet } from '../api/client.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import { orbitColorFor } from '../components/Cosmic/palette.ts';

interface ResolvedArtist { id: string; name: string; }
interface ResolvedAlbum { id: string; name: string; artistName: string; artistId: string; }

type ActiveTab = 'tracks' | 'albums' | 'artists';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracks');
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

      const trackFavs = favs.filter((f) => f.itemType === 'track');
      const resolvedTracks: TrackResponse[] = [];
      for (const fav of trackFavs) {
        try { resolvedTracks.push(await apiGet<TrackResponse>(`/tracks/${fav.itemId}`)); }
        catch { /* silent */ }
      }
      setTracks(resolvedTracks);

      const albumFavs = favs.filter((f) => f.itemType === 'album');
      const resolvedAlbums: ResolvedAlbum[] = [];
      for (const fav of albumFavs) {
        try {
          const album = await fetchAlbum(fav.itemId);
          resolvedAlbums.push({ id: album.id, name: album.name, artistName: album.artistName, artistId: album.artistId });
        } catch { /* silent */ }
      }
      setAlbums(resolvedAlbums);

      const artistFavs = favs.filter((f) => f.itemType === 'artist');
      const resolvedArtists: ResolvedArtist[] = [];
      for (const fav of artistFavs) {
        try {
          const artist = await fetchArtist(fav.itemId);
          resolvedArtists.push({ id: artist.id, name: artist.name });
        } catch { /* silent */ }
      }
      setArtists(resolvedArtists);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    if (!favStoreLoaded) loadFavStore();
  }, [loadFavorites, favStoreLoaded, loadFavStore]);

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'tracks',  label: 'Bodies',  count: favorites.filter((f) => f.itemType === 'track').length },
    { key: 'albums',  label: 'Systems', count: favorites.filter((f) => f.itemType === 'album').length },
    { key: 'artists', label: 'Stars',   count: favorites.filter((f) => f.itemType === 'artist').length },
  ];

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-5 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">05 · Favorites</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Favorites<span className="text-[var(--mute)] font-light italic"> · pinned</span>
          </h1>
        </div>
        <span className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)]">{favorites.length} · PINNED</span>
      </header>

      {loading && <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading…</p>}

      {!loading && favorites.length === 0 && (
        <div className="text-center py-16 border border-[var(--line)]">
          <div className="font-serif italic text-[26px] text-[var(--ink2)]">No favorites yet</div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-2">
            Pin tracks, systems, or stars to map them here.
          </p>
        </div>
      )}

      {!loading && favorites.length > 0 && (
        <>
          <div className="flex gap-1 mb-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`font-mono-jb text-[10px] tracking-[2.5px] uppercase px-3 py-1.5 border transition-colors
                  ${activeTab === tab.key
                    ? 'border-[var(--sun)] text-[var(--sun)]'
                    : 'border-[var(--line2)] text-[var(--mute)] hover:text-[var(--ink2)] hover:border-[var(--ink2)]'}`}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-2 opacity-70">{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'tracks' && (
            tracks.length > 0 ? (
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-[var(--line2)]">
                    <th className="px-3 py-2.5 text-right w-10 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">#</th>
                    <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">BODY</th>
                    <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">ORIGIN</th>
                    <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">SYSTEM</th>
                    <th className="px-3 py-2.5 text-right w-24 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">SPAN</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track, i) => (
                    <TrackRow key={track.id} track={track} index={i} queue={tracks} showArtist showAlbum />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] py-8 text-center uppercase">No favorite bodies.</p>
            )
          )}

          {activeTab === 'albums' && (
            albums.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {albums.map((album) => {
                  const accent = orbitColorFor(album.id);
                  return (
                    <Link
                      key={album.id}
                      to={`/albums/${album.id}`}
                      className="group flex flex-col border border-[var(--line)] bg-[rgba(20,24,32,0.4)] hover:border-[var(--line2)] transition-all duration-200 p-3"
                    >
                      <div className="w-full aspect-square bg-[var(--bg2)] mb-3 overflow-hidden relative">
                        <img
                          src={coverArtUrl(album.id)}
                          alt={album.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div
                          className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                          style={{ background: `linear-gradient(180deg, transparent 50%, ${accent}66 100%)` }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="font-serif text-[14px] text-[var(--ink)] truncate flex-1">{album.name}</p>
                        <FavoriteButton type="album" id={album.id} className="opacity-0 group-hover:opacity-100 shrink-0" />
                      </div>
                      <p className="font-mono-jb text-[10px] tracking-[1.5px] text-[var(--mute)] uppercase truncate mt-1">{album.artistName}</p>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] py-8 text-center uppercase">No favorite systems.</p>
            )
          )}

          {activeTab === 'artists' && (
            artists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {artists.map((artist) => {
                  const accent = orbitColorFor(artist.id);
                  return (
                    <Link
                      key={artist.id}
                      to={`/artists/${artist.id}`}
                      className="group flex flex-col items-center p-4 border border-[var(--line)]
                                 bg-[rgba(20,24,32,0.4)] hover:border-[var(--line2)] transition-all duration-200"
                    >
                      <div className="relative w-full aspect-square mb-3 grid place-items-center">
                        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
                          <circle cx="50" cy="50" r="44" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="1 3" opacity="0.55" />
                          <circle cx="50" cy="50" r="32" fill={accent} opacity="0.10" />
                          <circle cx="50" cy="50" r="30" fill="none" stroke={accent} strokeWidth="1" />
                        </svg>
                        <span className="font-serif italic text-[30px] text-[var(--ink)] relative z-[1]">
                          {artist.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 w-full">
                        <p className="font-serif text-[14px] text-[var(--ink)] truncate flex-1 text-center">{artist.name}</p>
                        <FavoriteButton type="artist" id={artist.id} className="opacity-0 group-hover:opacity-100 shrink-0" />
                      </div>
                      <p className="font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mt-1">Star</p>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] py-8 text-center uppercase">No favorite stars.</p>
            )
          )}
        </>
      )}
    </div>
  );
}
