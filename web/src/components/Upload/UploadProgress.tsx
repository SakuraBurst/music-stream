import type { UploadFileResult, UploadProgress as UploadProgressType } from '../../api/upload.ts';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadFileEntry {
  file: File;
  status: UploadStatus;
  progress: UploadProgressType;
  result?: UploadFileResult;
}

interface UploadProgressListProps {
  entries: UploadFileEntry[];
}

function StatusBadge({ status }: { status: UploadStatus }) {
  switch (status) {
    case 'pending':
      return <span className="text-xs text-zinc-500">Pending</span>;
    case 'uploading':
      return <span className="text-xs text-indigo-400">Uploading</span>;
    case 'done':
      return <span className="text-xs text-emerald-400">Done</span>;
    case 'error':
      return <span className="text-xs text-red-400">Error</span>;
  }
}

function FileResultCard({ entry }: { entry: UploadFileEntry }) {
  const { file, status, progress, result } = entry;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-200 truncate">{file.name}</p>
          <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Progress bar (visible during pending/uploading) */}
      {(status === 'uploading' || status === 'pending') && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {/* Success: show metadata */}
      {status === 'done' && result && !result.error && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
          {result.title && (
            <>
              <span className="text-zinc-500">Title</span>
              <span className="text-zinc-300 truncate">{result.title}</span>
            </>
          )}
          {result.artist && (
            <>
              <span className="text-zinc-500">Artist</span>
              <span className="text-zinc-300 truncate">{result.artist}</span>
            </>
          )}
          {result.album && (
            <>
              <span className="text-zinc-500">Album</span>
              <span className="text-zinc-300 truncate">{result.album}</span>
            </>
          )}
          {result.format && (
            <>
              <span className="text-zinc-500">Format</span>
              <span className="text-zinc-300 uppercase">{result.format}</span>
            </>
          )}
          {result.durationSeconds != null && result.durationSeconds > 0 && (
            <>
              <span className="text-zinc-500">Duration</span>
              <span className="text-zinc-300">{formatDuration(result.durationSeconds)}</span>
            </>
          )}
        </div>
      )}

      {/* Error from server */}
      {status === 'done' && result?.error && (
        <p className="text-xs text-red-400 mt-1">{result.error}</p>
      )}

      {/* Upload-level error (network, abort, etc.) */}
      {status === 'error' && !result && (
        <p className="text-xs text-red-400 mt-1">Upload failed</p>
      )}
    </div>
  );
}

export default function UploadProgressList({ entries }: UploadProgressListProps) {
  if (entries.length === 0) return null;

  const done = entries.filter((e) => e.status === 'done' && !e.result?.error).length;
  const errors = entries.filter(
    (e) => e.status === 'error' || (e.status === 'done' && e.result?.error),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          Uploads ({entries.length} file{entries.length !== 1 ? 's' : ''})
        </h2>
        <div className="flex gap-3 text-xs">
          {done > 0 && <span className="text-emerald-400">{done} done</span>}
          {errors > 0 && <span className="text-red-400">{errors} failed</span>}
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry, i) => (
          <FileResultCard key={`${entry.file.name}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
