import { useCallback, useRef, useState } from 'react';

import { uploadFiles } from '../api/upload.ts';
import type { MetadataOverride } from '../api/upload.ts';
import DropZone from '../components/Upload/DropZone.tsx';
import UploadEditor from '../components/Upload/UploadEditor.tsx';
import type { TrackEditData } from '../components/Upload/UploadEditor.tsx';
import UploadProgressList from '../components/Upload/UploadProgress.tsx';
import type { UploadFileEntry } from '../components/Upload/UploadProgress.tsx';

type Stage = 'dropzone' | 'editing' | 'uploading';

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('dropzone');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<UploadFileEntry[]>([]);
  const abortRef = useRef<(() => void) | null>(null);

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setStage('editing');
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedFiles([]);
    setStage('dropzone');
  }, []);

  const handleUpload = useCallback(async (tracks: TrackEditData[]) => {
    const files = tracks.map((t) => t.file);

    // Build metadata overrides
    const metadata: MetadataOverride[] = tracks.map((t) => {
      const trackNum = parseInt(t.metadata.trackNumber, 10);
      return {
        filename: t.file.name,
        title: t.metadata.title || undefined,
        artist: t.metadata.artist || undefined,
        album: t.metadata.album || undefined,
        track_number: Number.isNaN(trackNum) ? undefined : trackNum,
      };
    });

    // Build cover art files map.
    // For tracks with a coverArtUrl but no coverArtFile (embedded art or
    // MusicBrainz search result), fetch the URL and convert to a File.
    const coverArtFiles = new Map<string, File>();
    await Promise.all(
      tracks.map(async (track) => {
        if (track.coverArtFile) {
          coverArtFiles.set(track.file.name, track.coverArtFile);
          return;
        }
        if (!track.coverArtUrl) return;
        try {
          const resp = await fetch(track.coverArtUrl);
          const blob = await resp.blob();
          const ext = blob.type.includes('png') ? '.png' : '.jpg';
          const file = new File([blob], `cover${ext}`, { type: blob.type });
          coverArtFiles.set(track.file.name, file);
        } catch {
          // If fetch fails (e.g. CORS on MusicBrainz URL), skip
        }
      }),
    );

    // Create entries for progress display
    const newEntries: UploadFileEntry[] = files.map((file) => ({
      file,
      status: 'uploading' as const,
      progress: { loaded: 0, total: file.size, percent: 0 },
    }));

    setEntries((prev) => [...newEntries, ...prev]);
    setStage('uploading');
    setSelectedFiles([]);

    const { promise, abort } = uploadFiles({
      files,
      metadata,
      coverArtFiles: coverArtFiles.size > 0 ? coverArtFiles : undefined,
      onProgress(progress) {
        setEntries((prev) =>
          prev.map((entry) => {
            const isInBatch = files.includes(entry.file);
            if (!isInBatch || entry.status !== 'uploading') return entry;
            return { ...entry, progress };
          }),
        );
      },
    });

    abortRef.current = abort;

    promise
      .then((response) => {
        setEntries((prev) =>
          prev.map((entry) => {
            if (!files.includes(entry.file)) return entry;
            const result = response.results.find(
              (r) => r.filename === entry.file.name,
            );
            if (result) {
              return {
                ...entry,
                status: 'done' as const,
                progress: {
                  loaded: entry.file.size,
                  total: entry.file.size,
                  percent: 100,
                },
                result,
              };
            }
            return {
              ...entry,
              status: 'error' as const,
              progress: entry.progress,
            };
          }),
        );
      })
      .catch(() => {
        setEntries((prev) =>
          prev.map((entry) => {
            if (!files.includes(entry.file) || entry.status !== 'uploading')
              return entry;
            return { ...entry, status: 'error' as const };
          }),
        );
      })
      .finally(() => {
        setStage('dropzone');
        abortRef.current = null;
      });
  }, []);

  const handleClear = useCallback(() => {
    if (stage === 'uploading' && abortRef.current) {
      abortRef.current();
    }
    setEntries([]);
    setStage('dropzone');
    setSelectedFiles([]);
  }, [stage]);

  const uploading = stage === 'uploading';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upload</h1>
        {entries.length > 0 && !uploading && stage !== 'editing' && (
          <button
            onClick={handleClear}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-6">
        {stage === 'dropzone' && (
          <DropZone onFilesSelected={handleFilesSelected} disabled={uploading} />
        )}

        {stage === 'editing' && (
          <UploadEditor
            files={selectedFiles}
            onUpload={handleUpload}
            onCancel={handleCancel}
          />
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
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
            Uploading...
          </div>
        )}

        <UploadProgressList entries={entries} />
      </div>
    </div>
  );
}
