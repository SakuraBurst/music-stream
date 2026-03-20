import { apiGet, apiPost, apiPut, apiDelete } from './client.ts';
import type { Playlist, TrackResponse } from '../types/index.ts';

export interface PlaylistDetail extends Playlist {
  tracks: TrackResponse[];
}

export function fetchPlaylists(): Promise<Playlist[]> {
  return apiGet<Playlist[]>('/playlists');
}

export function fetchPlaylist(id: string): Promise<PlaylistDetail> {
  return apiGet<PlaylistDetail>(`/playlists/${id}`);
}

export function createPlaylist(
  name: string,
  description: string,
): Promise<Playlist> {
  return apiPost<Playlist>('/playlists', { name, description });
}

export function updatePlaylist(
  id: string,
  name: string,
  description: string,
): Promise<Playlist> {
  return apiPut<Playlist>(`/playlists/${id}`, { name, description });
}

export function deletePlaylist(id: string): Promise<void> {
  return apiDelete<void>(`/playlists/${id}`);
}

export function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  return apiPost<void>(`/playlists/${playlistId}/tracks`, { trackId });
}

export function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  return apiDelete<void>(`/playlists/${playlistId}/tracks/${trackId}`);
}
