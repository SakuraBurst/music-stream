import { useCallback, useEffect } from 'react';

import { useFavoritesStore } from '../../store/favoritesStore.ts';
import type { FavoriteType } from '../../api/favorites.ts';

interface FavoriteButtonProps {
  type: FavoriteType;
  id: string;
  className?: string;
}

export default function FavoriteButton({ type, id, className = '' }: FavoriteButtonProps) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(type, id));
  const toggle = useFavoritesStore((s) => s.toggle);
  const loaded = useFavoritesStore((s) => s.loaded);
  const load = useFavoritesStore((s) => s.load);

  useEffect(() => {
    if (!loaded) {
      load();
    }
  }, [loaded, load]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle(type, id);
    },
    [toggle, type, id],
  );

  return (
    <button
      onClick={handleClick}
      className={`transition-colors ${
        isFavorite
          ? 'text-red-500 hover:text-red-400'
          : 'text-zinc-600 hover:text-zinc-400'
      } ${className}`}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
        </svg>
      )}
    </button>
  );
}
