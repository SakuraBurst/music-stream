import { Link } from 'react-router';

import type { TrackResponse } from '../../types/index.ts';
import { requestPlayback } from './playback-events.ts';
import FavoriteButton from '../Favorites/FavoriteButton.tsx';
import AddToPlaylistButton from '../Playlist/AddToPlaylistButton.tsx';

interface TrackRowProps {
  track: TrackResponse;
  index: number;
  /** If provided, clicking the row sets the full queue and starts from this track. */
  queue?: TrackResponse[];
  /** Show the track number column (for album view). */
  showTrackNumber?: boolean;
  /** Show artist name column. */
  showArtist?: boolean;
  /** Show album name column. */
  showAlbum?: boolean;
  /** Show the favorite heart button. Defaults to true. */
  showFavorite?: boolean;
  /** Extra action element (e.g. remove from playlist button). */
  extraAction?: React.ReactNode;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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

  return (
    <tr
      onClick={handleClick}
      className="group cursor-pointer hover:bg-white/5 transition-colors"
    >
      <td className="px-3 py-2 text-sm text-zinc-500 w-10 text-right">
        {showTrackNumber ? (track.trackNumber ?? index + 1) : index + 1}
      </td>
      <td className="px-3 py-2 text-sm text-zinc-100 truncate max-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{track.title}</span>
        </div>
      </td>
      {showArtist && (
        <td className="px-3 py-2 text-sm text-zinc-400 truncate max-w-0">
          {/* Plain text on mobile (prevent false taps), link on desktop */}
          <span className="md:hidden">{track.artistName}</span>
          <Link
            to={`/artists/${track.artistId}`}
            className="hidden md:inline hover:text-white hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {track.artistName}
          </Link>
        </td>
      )}
      {showAlbum && (
        <td className="px-3 py-2 text-sm text-zinc-400 truncate max-w-0">
          <span className="md:hidden">{track.albumName}</span>
          <Link
            to={`/albums/${track.albumId}`}
            className="hidden md:inline hover:text-white hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {track.albumName}
          </Link>
        </td>
      )}
      <td className="px-3 py-2 text-sm text-zinc-500 w-20 text-right">
        <div className="flex items-center justify-end gap-1">
          {showFavorite && (
            <FavoriteButton
              type="track"
              id={track.id}
              className="opacity-0 group-hover:opacity-100"
            />
          )}
          <AddToPlaylistButton
            trackId={track.id}
            className="opacity-0 group-hover:opacity-100"
          />
          {extraAction}
          <span>{formatDuration(track.durationSeconds)}</span>
        </div>
      </td>
    </tr>
  );
}
