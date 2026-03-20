import { useAuthStore } from '../../store/authStore.ts';

/** Build a cover art URL that includes the JWT as a query param. */
export function coverArtUrl(albumId: string): string {
  const token = useAuthStore.getState().accessToken ?? '';
  return `/api/v1/coverart/${albumId}?token=${encodeURIComponent(token)}`;
}
