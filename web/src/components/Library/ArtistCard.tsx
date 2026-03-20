import { Link } from 'react-router';

import type { Artist } from '../../types/index.ts';

interface ArtistCardProps {
  artist: Artist;
}

export default function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link
      to={`/artists/${artist.id}`}
      className="group flex flex-col items-center p-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      <div className="w-32 h-32 rounded-full bg-zinc-700 flex items-center justify-center mb-3 text-3xl text-zinc-400 group-hover:bg-zinc-600 transition-colors">
        {artist.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm font-medium text-zinc-100 text-center truncate w-full">
        {artist.name}
      </span>
    </Link>
  );
}
