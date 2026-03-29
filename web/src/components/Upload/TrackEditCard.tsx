import { useCallback } from 'react';
import type { ChangeEvent } from 'react';

import CoverArtPreview from './CoverArtPreview.tsx';

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  trackNumber: string;
}

export interface TrackEditData {
  file: File;
  metadata: TrackMetadata;
  /** Object URL for cover art preview (embedded, fetched, or custom). */
  coverArtUrl: string | null;
  /** Custom cover art File selected by the user (to be sent to server). */
  coverArtFile: File | null;
  /** Whether cover art is being fetched from MusicBrainz. */
  coverArtLoading: boolean;
}

interface TrackEditCardProps {
  track: TrackEditData;
  onChange: (updated: TrackEditData) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TrackEditCard({ track, onChange }: TrackEditCardProps) {
  const handleFieldChange = useCallback(
    (field: keyof TrackMetadata) => (e: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...track,
        metadata: { ...track.metadata, [field]: e.target.value },
      });
    },
    [track, onChange],
  );

  const handleCustomCoverArt = useCallback(
    (file: File) => {
      // Revoke old custom URL if it was a custom one
      if (track.coverArtFile && track.coverArtUrl) {
        URL.revokeObjectURL(track.coverArtUrl);
      }
      const url = URL.createObjectURL(file);
      onChange({
        ...track,
        coverArtUrl: url,
        coverArtFile: file,
        coverArtLoading: false,
      });
    },
    [track, onChange],
  );

  return (
    <div className="flex gap-4 rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      <CoverArtPreview
        imageUrl={track.coverArtUrl}
        loading={track.coverArtLoading}
        onCustomImage={handleCustomCoverArt}
      />

      <div className="flex-1 min-w-0 space-y-2">
        {/* File info */}
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-zinc-500 truncate">{track.file.name}</p>
          <p className="text-xs text-zinc-600 shrink-0">{formatSize(track.file.size)}</p>
        </div>

        {/* Metadata fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-zinc-500">Title</span>
            <input
              type="text"
              value={track.metadata.title}
              onChange={handleFieldChange('title')}
              placeholder="Title"
              className="
                mt-0.5 block w-full rounded bg-zinc-800 border border-zinc-700
                px-2 py-1.5 text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
              "
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Artist</span>
            <input
              type="text"
              value={track.metadata.artist}
              onChange={handleFieldChange('artist')}
              placeholder="Artist"
              className="
                mt-0.5 block w-full rounded bg-zinc-800 border border-zinc-700
                px-2 py-1.5 text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
              "
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Album</span>
            <input
              type="text"
              value={track.metadata.album}
              onChange={handleFieldChange('album')}
              placeholder="Album"
              className="
                mt-0.5 block w-full rounded bg-zinc-800 border border-zinc-700
                px-2 py-1.5 text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
              "
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Track #</span>
            <input
              type="text"
              value={track.metadata.trackNumber}
              onChange={handleFieldChange('trackNumber')}
              placeholder="1"
              className="
                mt-0.5 block w-full rounded bg-zinc-800 border border-zinc-700
                px-2 py-1.5 text-sm text-zinc-200
                placeholder:text-zinc-600
                focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
              "
            />
          </label>
        </div>
      </div>
    </div>
  );
}
