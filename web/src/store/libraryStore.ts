import { create } from 'zustand';

import {
  fetchArtists,
  fetchArtist,
  fetchAlbums,
  fetchAlbum,
  fetchTracks,
} from '../api/library.ts';
import type {
  Artist,
  ArtistDetail,
  AlbumResponse,
  AlbumDetail,
  TrackResponse,
} from '../types/index.ts';

const PAGE_SIZE = 50;

interface LibraryState {
  // Artists list
  artists: Artist[];
  artistsTotal: number;
  artistsLoading: boolean;

  // Artist detail
  artistDetail: ArtistDetail | null;
  artistDetailLoading: boolean;

  // Albums list
  albums: AlbumResponse[];
  albumsTotal: number;
  albumsLoading: boolean;

  // Album detail
  albumDetail: AlbumDetail | null;
  albumDetailLoading: boolean;

  // Tracks list
  tracks: TrackResponse[];
  tracksTotal: number;
  tracksLoading: boolean;

  // Actions
  loadArtists: () => Promise<void>;
  loadMoreArtists: () => Promise<void>;
  loadArtistDetail: (id: string) => Promise<void>;
  loadAlbums: () => Promise<void>;
  loadMoreAlbums: () => Promise<void>;
  loadAlbumDetail: (id: string) => Promise<void>;
  loadTracks: () => Promise<void>;
  loadMoreTracks: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  artists: [],
  artistsTotal: 0,
  artistsLoading: false,

  artistDetail: null,
  artistDetailLoading: false,

  albums: [],
  albumsTotal: 0,
  albumsLoading: false,

  albumDetail: null,
  albumDetailLoading: false,

  tracks: [],
  tracksTotal: 0,
  tracksLoading: false,

  loadArtists: async () => {
    set({ artistsLoading: true });
    try {
      const result = await fetchArtists(PAGE_SIZE, 0);
      set({
        artists: result.items,
        artistsTotal: result.total,
      });
    } finally {
      set({ artistsLoading: false });
    }
  },

  loadMoreArtists: async () => {
    const { artists, artistsTotal, artistsLoading } = get();
    if (artistsLoading || artists.length >= artistsTotal) return;
    set({ artistsLoading: true });
    try {
      const result = await fetchArtists(PAGE_SIZE, artists.length);
      set({
        artists: [...artists, ...result.items],
        artistsTotal: result.total,
      });
    } finally {
      set({ artistsLoading: false });
    }
  },

  loadArtistDetail: async (id: string) => {
    set({ artistDetailLoading: true, artistDetail: null });
    try {
      const detail = await fetchArtist(id);
      set({ artistDetail: detail });
    } finally {
      set({ artistDetailLoading: false });
    }
  },

  loadAlbums: async () => {
    set({ albumsLoading: true });
    try {
      const result = await fetchAlbums(PAGE_SIZE, 0);
      set({
        albums: result.items,
        albumsTotal: result.total,
      });
    } finally {
      set({ albumsLoading: false });
    }
  },

  loadMoreAlbums: async () => {
    const { albums, albumsTotal, albumsLoading } = get();
    if (albumsLoading || albums.length >= albumsTotal) return;
    set({ albumsLoading: true });
    try {
      const result = await fetchAlbums(PAGE_SIZE, albums.length);
      set({
        albums: [...albums, ...result.items],
        albumsTotal: result.total,
      });
    } finally {
      set({ albumsLoading: false });
    }
  },

  loadAlbumDetail: async (id: string) => {
    set({ albumDetailLoading: true, albumDetail: null });
    try {
      const detail = await fetchAlbum(id);
      set({ albumDetail: detail });
    } finally {
      set({ albumDetailLoading: false });
    }
  },

  loadTracks: async () => {
    set({ tracksLoading: true });
    try {
      const result = await fetchTracks(PAGE_SIZE, 0);
      set({
        tracks: result.items,
        tracksTotal: result.total,
      });
    } finally {
      set({ tracksLoading: false });
    }
  },

  loadMoreTracks: async () => {
    const { tracks, tracksTotal, tracksLoading } = get();
    if (tracksLoading || tracks.length >= tracksTotal) return;
    set({ tracksLoading: true });
    try {
      const result = await fetchTracks(PAGE_SIZE, tracks.length);
      set({
        tracks: [...tracks, ...result.items],
        tracksTotal: result.total,
      });
    } finally {
      set({ tracksLoading: false });
    }
  },
}));
