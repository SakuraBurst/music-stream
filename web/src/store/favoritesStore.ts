import { create } from 'zustand';

import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
} from '../api/favorites.ts';
import type { FavoriteType } from '../api/favorites.ts';
import type { Favorite } from '../types/index.ts';

interface FavoritesState {
  favorites: Favorite[];
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  toggle: (type: FavoriteType, id: string) => Promise<void>;
  isFavorite: (type: FavoriteType, id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  loading: false,
  loaded: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const favorites = await fetchFavorites();
      set({ favorites, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  toggle: async (type: FavoriteType, id: string) => {
    const { favorites } = get();
    const existing = favorites.find(
      (f) => f.itemType === type && f.itemId === id,
    );

    if (existing) {
      // Optimistic removal
      set({
        favorites: favorites.filter(
          (f) => !(f.itemType === type && f.itemId === id),
        ),
      });
      try {
        await removeFavorite(type, id);
      } catch {
        // Revert on error
        set({ favorites });
      }
    } else {
      // Optimistic add
      const newFav: Favorite = {
        userId: '',
        itemType: type,
        itemId: id,
        createdAt: new Date().toISOString(),
      };
      set({ favorites: [...favorites, newFav] });
      try {
        await addFavorite(type, id);
      } catch {
        // Revert on error
        set({ favorites });
      }
    }
  },

  isFavorite: (type: FavoriteType, id: string) => {
    return get().favorites.some(
      (f) => f.itemType === type && f.itemId === id,
    );
  },
}));
