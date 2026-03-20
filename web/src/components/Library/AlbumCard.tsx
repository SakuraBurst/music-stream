import { Link } from 'react-router';

import { coverArtUrl } from './coverart.ts';

interface AlbumCardProps {
  id: string;
  name: string;
  artistName?: string;
  year?: number;
}

export default function AlbumCard({ id, name, artistName, year }: AlbumCardProps) {
  return (
    <Link
      to={`/albums/${id}`}
      className="group flex flex-col rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors overflow-hidden"
    >
      <div className="aspect-square bg-zinc-700 overflow-hidden">
        <img
          src={coverArtUrl(id)}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
          }}
        />
      </div>
      <div className="p-3 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate">{name}</p>
        {artistName && (
          <p className="text-xs text-zinc-400 truncate mt-0.5">{artistName}</p>
        )}
        {year != null && year > 0 && (
          <p className="text-xs text-zinc-500 mt-0.5">{year}</p>
        )}
      </div>
    </Link>
  );
}
