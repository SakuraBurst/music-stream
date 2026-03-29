import { apiGet, apiPut, ApiError } from './client.ts';
import type { RepeatMode } from '../store/playerStore.ts';

export interface PlaybackSessionResponse {
  userId: string;
  trackId: string;
  positionSeconds: number;
  queueTrackIds: string[];
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  updatedAt: string;
}

export interface SaveSessionRequest {
  trackId: string;
  position: number;
  queueTrackIds: string[];
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export function saveSession(req: SaveSessionRequest): Promise<void> {
  return apiPut<void>('/session', req);
}

export async function getSession(): Promise<PlaybackSessionResponse | null> {
  try {
    return await apiGet<PlaybackSessionResponse>('/session');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
