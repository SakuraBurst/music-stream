import { apiGet } from './client.ts';
import type {
  Artist,
  ArtistDetail,
  AlbumResponse,
  AlbumDetail,
  TrackResponse,
  PaginatedResponse,
} from '../types/index.ts';

export function fetchArtists(
  limit: number,
  offset: number,
): Promise<PaginatedResponse<Artist>> {
  return apiGet<PaginatedResponse<Artist>>(
    `/artists?limit=${limit}&offset=${offset}`,
  );
}

export function fetchArtist(id: string): Promise<ArtistDetail> {
  return apiGet<ArtistDetail>(`/artists/${id}`);
}

export function fetchAlbums(
  limit: number,
  offset: number,
): Promise<PaginatedResponse<AlbumResponse>> {
  return apiGet<PaginatedResponse<AlbumResponse>>(
    `/albums?limit=${limit}&offset=${offset}`,
  );
}

export function fetchAlbum(id: string): Promise<AlbumDetail> {
  return apiGet<AlbumDetail>(`/albums/${id}`);
}

export function fetchTracks(
  limit: number,
  offset: number,
): Promise<PaginatedResponse<TrackResponse>> {
  return apiGet<PaginatedResponse<TrackResponse>>(
    `/tracks?limit=${limit}&offset=${offset}`,
  );
}
