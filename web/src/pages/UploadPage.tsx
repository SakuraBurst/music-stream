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

    const coverArtFiles = new Map<string, File>();
    await Promise.all(tracks.map(async (track) => {
      if (track.coverArtFile) { coverArtFiles.set(track.file.name, track.coverArtFile); return; }
      if (!track.coverArtUrl) return;
      try {
        const resp = await fetch(track.coverArtUrl);
        const blob = await resp.blob();
        const ext = blob.type.includes('png') ? '.png' : '.jpg';
        coverArtFiles.set(track.file.name, new File([blob], `cover${ext}`, { type: blob.type }));
      } catch { /* silent */ }
    }));

    const newEntries: UploadFileEntry[] = files.map((file) => ({
      file, status: 'uploading' as const,
      progress: { loaded: 0, total: file.size, percent: 0 },
    }));
    setEntries((prev) => [...newEntries, ...prev]);
    setStage('uploading');
    setSelectedFiles([]);

    const { promise, abort } = uploadFiles({
      files, metadata,
      coverArtFiles: coverArtFiles.size > 0 ? coverArtFiles : undefined,
      onProgress(progress) {
        setEntries((prev) => prev.map((entry) => {
          const isInBatch = files.includes(entry.file);
          if (!isInBatch || entry.status !== 'uploading') return entry;
          return { ...entry, progress };
        }));
      },
    });
    abortRef.current = abort;

    promise
      .then((response) => {
        setEntries((prev) => prev.map((entry) => {
          if (!files.includes(entry.file)) return entry;
          const result = response.results.find((r) => r.filename === entry.file.name);
          if (result) {
            return {
              ...entry,
              status: 'done' as const,
              progress: { loaded: entry.file.size, total: entry.file.size, percent: 100 },
              result,
            };
          }
          return { ...entry, status: 'error' as const, progress: entry.progress };
        }));
      })
      .catch(() => {
        setEntries((prev) => prev.map((entry) =>
          !files.includes(entry.file) || entry.status !== 'uploading'
            ? entry
            : { ...entry, status: 'error' as const }
        ));
      })
      .finally(() => { setStage('dropzone'); abortRef.current = null; });
  }, []);

  const handleClear = useCallback(() => {
    if (stage === 'uploading' && abortRef.current) abortRef.current();
    setEntries([]);
    setStage('dropzone');
    setSelectedFiles([]);
  }, [stage]);

  const uploading = stage === 'uploading';

  return (
    <div>
      <header className="border-b border-[var(--line)] pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">08 · Upload</p>
          <h1 className="font-serif text-[32px] text-[var(--ink)] mt-1">
            Upload<span className="text-[var(--mute)] font-light italic"> · new bodies</span>
          </h1>
        </div>
        {entries.length > 0 && !uploading && stage !== 'editing' && (
          <button
            onClick={handleClear}
            className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] hover:text-[var(--ink)] uppercase transition-colors"
          >
            × Clear
          </button>
        )}
      </header>

      <div className="space-y-6">
        {stage === 'dropzone' && (
          <DropZone onFilesSelected={handleFilesSelected} disabled={uploading} />
        )}

        {stage === 'editing' && (
          <UploadEditor files={selectedFiles} onUpload={handleUpload} onCancel={handleCancel} />
        )}

        {uploading && (
          <div className="font-mono-jb text-[10px] tracking-[3px] text-[var(--sun)] uppercase flex items-center gap-2">
            <span className="inline-block animate-spin">◔</span>
            Uploading bodies…
          </div>
        )}

        <UploadProgressList entries={entries} />
      </div>
    </div>
  );
}
