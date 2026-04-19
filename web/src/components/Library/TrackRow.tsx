import { Link } from 'react-router';

import type { TrackResponse } from '../../types/index.ts';
import { requestPlayback } from './playback-events.ts';
import FavoriteButton from '../Favorites/FavoriteButton.tsx';
import AddToPlaylistButton from '../Playlist/AddToPlaylistButton.tsx';
import { toRoman } from '../Cosmic/utils.ts';
import { orbitColorFor } from '../Cosmic/palette.ts';

interface TrackRowProps {
  track: TrackResponse;
  index: number;
  queue?: TrackResponse[];
  showTrackNumber?: boolean;
  showArtist?: boolean;
  showAlbum?: boolean;
  showFavorite?: boolean;
  extraAction?: React.ReactNode;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TrackRow({
  track,
  index,
  queue,
  showTrackNumber = false,
  showArtist = true,
  showAlbum = true,
  showFavorite = true,
  extraAction,
}: TrackRowProps) {
  function handleClick() {
    requestPlayback(track, queue, index);
  }

  const displayNumber = showTrackNumber ? (track.trackNumber ?? index + 1) : index + 1;
  const label = toRoman(displayNumber);
  const accent = orbitColorFor(track.id);

  return (
    <tr
      onClick={handleClick}
      className="group cursor-pointer border-b border-[var(--line)] transition-colors hover:bg-[rgba(255,255,255,0.025)]"
    >
      <td className="px-3 py-3 w-12 text-right">
        <span
          className="group-hover:hidden font-serif italic text-[13px]"
          style={{ color: 'var(--mute)' }}
        >
          {label}
        </span>
        <span className="hidden group-hover:inline text-[13px]" style={{ color: accent }}>▶</span>
      </td>
      <td className="px-3 py-3 truncate max-w-0">
        <span className="font-serif text-[14px] text-[var(--ink)] truncate block">{track.title}</span>
      </td>
      {showArtist && (
        <td className="px-3 py-3 text-[12px] text-[var(--mute)] truncate max-w-0">
          <span className="md:hidden">{track.artistName}</span>
          <Link
            to={`/artists/${track.artistId}`}
            className="hidden md:inline hover:text-[var(--ink)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {track.artistName}
          </Link>
        </td>
      )}
      {showAlbum && (
        <td className="px-3 py-3 text-[12px] text-[var(--mute)] truncate max-w-0">
          <span className="md:hidden">{track.albumName}</span>
          <Link
            to={`/albums/${track.albumId}`}
            className="hidden md:inline hover:text-[var(--ink)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {track.albumName}
          </Link>
        </td>
      )}
      <td className="px-3 py-3 font-mono-jb text-[10px] text-[var(--mute)] w-24 text-right tabular-nums">
        <div className="flex items-center justify-end gap-2">
          {showFavorite && (
            <FavoriteButton
              type="track"
              id={track.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
          <AddToPlaylistButton
            trackId={track.id}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {extraAction}
          <span className="tabular-nums">{formatDuration(track.durationSeconds)}</span>
        </div>
      </td>
    </tr>
  );
}
