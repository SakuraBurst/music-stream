import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router';

import { fetchSearch } from '../api/search.ts';
import type { SearchResult } from '../api/search.ts';
import type { TrackResponse, Artist, AlbumResponse } from '../types/index.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import { coverArtUrl } from '../components/Library/coverart.ts';
import FavoriteButton from '../components/Favorites/FavoriteButton.tsx';
import { orbitColorFor } from '../components/Cosmic/palette.ts';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResult(null); return; }
    setLoading(true);
    try { setResult(await fetchSearch(q.trim())); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(input ? { q: input } : {}, { replace: true });
      doSearch(input);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, doSearch, setSearchParams]);

  useEffect(() => {
    if (query && !result) doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const hasResults = result &&
    (result.artists.length > 0 || result.albums.length > 0 || result.tracks.length > 0);

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">07 · Search</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Search<span className="text-[var(--mute)] font-light italic"> · scanner</span>
          </h1>
        </div>
      </header>

      <div className="mb-8 max-w-lg">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)] font-mono-jb text-[11px]">⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scan origins, systems, bodies…"
            className="w-full pl-8 pr-4 py-3 bg-[var(--bg)] border border-[var(--line2)]
                       text-[var(--ink)] placeholder-[var(--mute)]
                       focus:outline-none focus:border-[var(--sun)] transition-colors"
          />
        </div>
      </div>

      {loading && <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Scanning…</p>}

      {!loading && input.trim() && !hasResults && result && (
        <div className="text-center py-12 border border-[var(--line)]">
          <div className="font-serif italic text-[22px] text-[var(--ink2)]">No results for “{input}”</div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-2">Try another query.</p>
        </div>
      )}

      {!loading && !input.trim() && (
        <div className="text-center py-12 border border-[var(--line)]">
          <div className="font-serif italic text-[22px] text-[var(--ink2)]">Enter a query</div>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-2">
            Scanner ready · artists · systems · bodies
          </p>
        </div>
      )}

      {hasResults && result && (
        <div className="space-y-10">
          {result.artists.length > 0 && (
            <section>
              <h2 className="font-serif italic text-[20px] text-[var(--ink)] mb-3 border-b border-[var(--line)] pb-2">Stars</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {result.artists.map((artist: Artist) => {
                  const accent = orbitColorFor(artist.id);
                  return (
                    <Link
                      key={artist.id}
                      to={`/artists/${artist.id}`}
                      className="group flex flex-col items-center p-4 border border-[var(--line)]
                                 bg-[rgba(20,24,32,0.4)] hover:border-[var(--line2)] transition-colors"
                    >
                      <div className="relative w-full aspect-square mb-3 grid place-items-center">
                        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
                          <circle cx="50" cy="50" r="44" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="1 3" opacity="0.55" />
                          <circle cx="50" cy="50" r="32" fill={accent} opacity="0.10" />
                          <circle cx="50" cy="50" r="30" fill="none" stroke={accent} strokeWidth="1" />
                        </svg>
                        <span className="font-serif italic text-[28px] text-[var(--ink)] relative z-[1]">
                          {artist.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 w-full">
                        <p className="font-serif text-[13px] text-[var(--ink)] truncate flex-1 text-center">{artist.name}</p>
                        <FavoriteButton type="artist" id={artist.id} className="opacity-0 group-hover:opacity-100 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {result.albums.length > 0 && (
            <section>
              <h2 className="font-serif italic text-[20px] text-[var(--ink)] mb-3 border-b border-[var(--line)] pb-2">Systems</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {result.albums.map((album: AlbumResponse) => (
                  <Link
                    key={album.id}
                    to={`/albums/${album.id}`}
                    className="group flex flex-col border border-[var(--line)] bg-[rgba(20,24,32,0.4)]
                               hover:border-[var(--line2)] transition-colors p-3"
                  >
                    <div className="relative w-full aspect-square bg-[var(--bg2)] mb-3 overflow-hidden">
                      <img
                        src={coverArtUrl(album.id)}
                        alt={album.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="font-serif text-[14px] text-[var(--ink)] truncate flex-1">{album.name}</p>
                      <FavoriteButton type="album" id={album.id} className="opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                    <p className="font-mono-jb text-[10px] tracking-[1.5px] text-[var(--mute)] uppercase truncate mt-1">{album.artistName}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {result.tracks.length > 0 && (
            <section>
              <h2 className="font-serif italic text-[20px] text-[var(--ink)] mb-3 border-b border-[var(--line)] pb-2">Bodies</h2>
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
                  {result.tracks.map((track: TrackResponse, i: number) => (
                    <TrackRow key={track.id} track={track} index={i} queue={result.tracks} showArtist showAlbum />
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
