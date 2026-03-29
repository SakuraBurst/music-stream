import { useCallback, useEffect, useRef, useState } from 'react';
import jsmediatags from 'jsmediatags';

import { searchCoverArt } from '../../api/coverArtSearch.ts';

import TrackEditCard from './TrackEditCard.tsx';
import type { TrackEditData, TrackMetadata } from './TrackEditCard.tsx';

interface UploadEditorProps {
  files: File[];
  onUpload: (tracks: TrackEditData[]) => void;
  onCancel: () => void;
}

/** Convert jsmediatags picture data (number[]) to an object URL. */
function pictureToUrl(picture: { format: string; data: number[] }): string {
  const bytes = new Uint8Array(picture.data);
  const blob = new Blob([bytes], { type: picture.format });
  return URL.createObjectURL(blob);
}

/** Extract tags from a File using jsmediatags. */
function extractTags(
  file: File,
): Promise<{ metadata: TrackMetadata; coverArtUrl: string | null }> {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess(result) {
        const { tags } = result;
        // Parse track number — could be "3/12" format
        let trackNumber = '';
        if (tags.track) {
          const match = tags.track.match(/^(\d+)/);
          if (match) trackNumber = match[1];
        }

        let coverArtUrl: string | null = null;
        if (tags.picture) {
          coverArtUrl = pictureToUrl(tags.picture);
        }

        resolve({
          metadata: {
            title: tags.title ?? '',
            artist: tags.artist ?? '',
            album: tags.album ?? '',
            trackNumber,
          },
          coverArtUrl,
        });
      },
      onError() {
        // If tag reading fails, use empty metadata
        resolve({
          metadata: { title: '', artist: '', album: '', trackNumber: '' },
          coverArtUrl: null,
        });
      },
    });
  });
}

export default function UploadEditor({
  files,
  onUpload,
  onCancel,
}: UploadEditorProps) {
  const [tracks, setTracks] = useState<TrackEditData[]>([]);
  const [loading, setLoading] = useState(true);
  // Track active abort controllers for cover art searches
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Track debounce timers per file name
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Extract tags from all files on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const results = await Promise.all(
        files.map(async (file) => {
          const { metadata, coverArtUrl } = await extractTags(file);
          return {
            file,
            metadata,
            coverArtUrl,
            coverArtFile: null,
            coverArtLoading: false,
          } satisfies TrackEditData;
        }),
      );

      if (cancelled) return;
      setTracks(results);
      setLoading(false);

      // For tracks without embedded cover art, search MusicBrainz
      for (const track of results) {
        if (!track.coverArtUrl && track.metadata.artist && track.metadata.album) {
          searchForCoverArt(track.file.name, track.metadata.artist, track.metadata.album);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Cleanup abort controllers and timers on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    const timers = debounceTimersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const searchForCoverArt = useCallback(
    (fileName: string, artist: string, album: string) => {
      // Clear existing timer for this file
      const existingTimer = debounceTimersRef.current.get(fileName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Abort existing request for this file
      const existingController = abortControllersRef.current.get(fileName);
      if (existingController) {
        existingController.abort();
      }

      // Mark as loading
      setTracks((prev) =>
        prev.map((t) =>
          t.file.name === fileName ? { ...t, coverArtLoading: true } : t,
        ),
      );

      // Debounce the request
      const timer = setTimeout(async () => {
        const controller = new AbortController();
        abortControllersRef.current.set(fileName, controller);

        const url = await searchCoverArt(artist, album, controller.signal);

        abortControllersRef.current.delete(fileName);

        setTracks((prev) =>
          prev.map((t) => {
            if (t.file.name !== fileName) return t;
            // Only update if user hasn't already set a custom cover
            if (t.coverArtFile) return { ...t, coverArtLoading: false };
            return {
              ...t,
              coverArtUrl: url,
              coverArtLoading: false,
            };
          }),
        );
      }, 500);

      debounceTimersRef.current.set(fileName, timer);
    },
    [],
  );

  const handleTrackChange = useCallback(
    (index: number) => (updated: TrackEditData) => {
      setTracks((prev) => {
        const old = prev[index];
        const next = [...prev];
        next[index] = updated;

        // If artist or album changed and no custom cover, trigger new search
        if (
          !updated.coverArtFile &&
          (updated.metadata.artist !== old.metadata.artist ||
            updated.metadata.album !== old.metadata.album) &&
          updated.metadata.artist &&
          updated.metadata.album
        ) {
          // Schedule search (debounced) — we do this outside the state updater
          // to avoid issues. Use setTimeout(0) to defer.
          setTimeout(() => {
            searchForCoverArt(
              updated.file.name,
              updated.metadata.artist,
              updated.metadata.album,
            );
          }, 0);
        }

        return next;
      });
    },
    [searchForCoverArt],
  );

  const handleUpload = useCallback(() => {
    onUpload(tracks);
  }, [tracks, onUpload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Reading file metadata...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          {tracks.length} file{tracks.length !== 1 ? 's' : ''} selected
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="
              px-3 py-1.5 text-sm rounded
              text-zinc-400 hover:text-zinc-200
              border border-zinc-700 hover:border-zinc-500
              transition-colors
            "
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            className="
              px-4 py-1.5 text-sm rounded font-medium
              bg-indigo-600 hover:bg-indigo-500 text-white
              transition-colors
            "
          >
            Upload
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {tracks.map((track, index) => (
          <TrackEditCard
            key={track.file.name}
            track={track}
            onChange={handleTrackChange(index)}
          />
        ))}
      </div>
    </div>
  );
}

export type { TrackEditData };
