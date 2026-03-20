import { apiGet } from './client.ts';
import type { Artist, AlbumResponse, TrackResponse } from '../types/index.ts';

export interface SearchResult {
  artists: Artist[];
  albums: AlbumResponse[];
  tracks: TrackResponse[];
}

export type SearchType = 'all' | 'artist' | 'album' | 'track';

export function fetchSearch(
  query: string,
  type: SearchType = 'all',
): Promise<SearchResult> {
  return apiGet<SearchResult>(
    `/search?q=${encodeURIComponent(query)}&type=${type}`,
  );
}
