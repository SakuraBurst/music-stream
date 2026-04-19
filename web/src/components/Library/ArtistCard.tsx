import { Link } from 'react-router';

import type { Artist } from '../../types/index.ts';
import { orbitColorFor } from '../Cosmic/palette.ts';

interface ArtistCardProps {
  artist: Artist;
}

export default function ArtistCard({ artist }: ArtistCardProps) {
  const accent = orbitColorFor(artist.id);

  return (
    <Link
      to={`/artists/${artist.id}`}
      className="group flex flex-col items-center p-4 border border-[var(--line)]
                 bg-[rgba(20,24,32,0.4)] hover:border-[var(--line2)] transition-all duration-200"
    >
      <div className="relative w-28 h-28 lg:w-32 lg:h-32 mb-3 grid place-items-center">
        <svg viewBox="0 0 110 110" className="absolute inset-0 w-full h-full overflow-visible">
          <circle cx="55" cy="55" r="48" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 3" opacity="0.6" />
          <circle cx="55" cy="55" r="42" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="1 4" opacity="0.45" />
          <circle cx="55" cy="55" r="34" fill={accent} opacity="0.10" />
          <circle cx="55" cy="55" r="32" fill="none" stroke={accent} strokeWidth="1" />
          <circle cx="55" cy="13" r="2" fill={accent} className="sun-pulse" />
        </svg>
        <span className="font-serif italic text-[28px] text-[var(--ink)] relative z-[1]">
          {artist.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="font-serif text-[14px] text-[var(--ink)] text-center truncate w-full">{artist.name}</span>
      <span className="font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mt-1">Artist</span>
    </Link>
  );
}
