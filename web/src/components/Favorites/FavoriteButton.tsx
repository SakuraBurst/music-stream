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
    if (!loaded) load();
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
      className={`transition-colors duration-150 cursor-pointer text-[14px] leading-none
                  ${isFavorite ? 'text-[var(--rose)]' : 'text-[var(--mute)] hover:text-[var(--ink2)]'}
                  ${className}`}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? '✦' : '✧'}
    </button>
  );
}
