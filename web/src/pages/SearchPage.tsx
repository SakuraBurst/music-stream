import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router';

import { fetchSearch } from '../api/search.ts';
import type { SearchResult } from '../api/search.ts';
import type { TrackResponse, Artist, AlbumResponse } from '../types/index.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import { coverArtUrl } from '../components/Library/coverart.ts';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchSearch(q.trim());
      setResult(res);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearchParams(input ? { q: input } : {}, { replace: true });
      doSearch(input);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [input, doSearch, setSearchParams]);

  // Load initial results from URL query param
  useEffect(() => {
    if (query && !result) {
      doSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autofocus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasResults =
    result &&
    (result.artists.length > 0 ||
      result.albums.length > 0 ||
      result.tracks.length > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      {/* Search input */}
      <div className="mb-6">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search artists, albums, tracks..."
          className="w-full max-w-lg px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
        />
      </div>

      {loading && (
        <p className="text-zinc-400">Searching...</p>
      )}

      {!loading && input.trim() && !hasResults && result && (
        <p className="text-zinc-500">No results found for &ldquo;{input}&rdquo;.</p>
      )}

      {!loading && !input.trim() && (
        <p className="text-zinc-500">
          Enter a search query to find artists, albums, and tracks.
        </p>
      )}

      {hasResults && result && (
        <div className="space-y-8">
          {/* Artists */}
          {result.artists.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-zinc-300">
                Artists
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {result.artists.map((artist: Artist) => (
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
            </section>
          )}

          {/* Albums */}
          {result.albums.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-zinc-300">
                Albums
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {result.albums.map((album: AlbumResponse) => (
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
            </section>
          )}

          {/* Tracks */}
          {result.tracks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-zinc-300">
                Tracks
              </h2>
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
                  {result.tracks.map((track: TrackResponse, i: number) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      index={i}
                      queue={result.tracks}
                      showArtist
                      showAlbum
                    />
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
