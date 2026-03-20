import { apiGet, apiPost, apiDelete } from './client.ts';
import type { Favorite } from '../types/index.ts';

export type FavoriteType = 'track' | 'album' | 'artist';

export function fetchFavorites(): Promise<Favorite[]> {
  return apiGet<Favorite[]>('/favorites');
}

export function addFavorite(type: FavoriteType, id: string): Promise<void> {
  return apiPost<void>('/favorites', { type, id });
}

export function removeFavorite(
  type: FavoriteType,
  id: string,
): Promise<void> {
  return apiDelete<void>(`/favorites/${type}/${id}`);
}
