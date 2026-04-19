import { Link } from 'react-router';

import { coverArtUrl } from './coverart.ts';
import { orbitColorFor } from '../Cosmic/palette.ts';

interface AlbumCardProps {
  id: string;
  name: string;
  artistName?: string;
  year?: number;
}

export default function AlbumCard({ id, name, artistName, year }: AlbumCardProps) {
  const accent = orbitColorFor(id);

  return (
    <Link
      to={`/albums/${id}`}
      className="group flex flex-col rounded-none border border-[var(--line)] bg-[rgba(20,24,32,0.4)]
                 hover:border-[var(--line2)] transition-all duration-200 overflow-hidden p-3"
    >
      <div className="relative aspect-square bg-[var(--bg2)] overflow-hidden mb-3">
        <img
          src={coverArtUrl(id)}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
          style={{
            background: `linear-gradient(180deg, transparent 50%, ${accent}66 100%)`,
          }}
        />
        <div className="absolute right-2 bottom-2 w-8 h-8 grid place-items-center rounded-full
                        border border-[var(--sun)] text-[var(--sun)] text-[10px] bg-[rgba(11,13,16,0.7)]
                        opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
          ▶
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-serif text-[14px] text-[var(--ink)] truncate">{name}</p>
        {artistName && (
          <p className="font-mono-jb text-[10px] tracking-[1.5px] text-[var(--mute)] uppercase truncate mt-1">
            {artistName}
          </p>
        )}
        {year != null && year > 0 && (
          <p className="font-mono-jb text-[9px] tracking-[1px] text-[var(--mute)] mt-0.5">{year}</p>
        )}
      </div>
    </Link>
  );
}
