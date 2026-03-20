import { apiGet, apiPost } from './client.ts';
import type { ListeningHistory, PaginatedResponse } from '../types/index.ts';

export function fetchHistory(
  limit: number,
  offset: number,
): Promise<PaginatedResponse<ListeningHistory>> {
  return apiGet<PaginatedResponse<ListeningHistory>>(
    `/history?limit=${limit}&offset=${offset}`,
  );
}

export function recordHistory(
  trackId: string,
  duration: number,
): Promise<void> {
  return apiPost<void>('/history', { trackId, duration });
}
