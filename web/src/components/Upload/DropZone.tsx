import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

const ACCEPTED_EXTENSIONS = [
  '.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a', '.alac', '.wma', '.ape', '.opus',
];

const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

function hasValidExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function DropZone({ onFilesSelected, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const invalid = files.filter((f) => !hasValidExtension(f.name));

      if (invalid.length > 0) {
        const names = invalid.map((f) => f.name).join(', ');
        setValidationError(
          `Unsupported file${invalid.length > 1 ? 's' : ''}: ${names}. Accepted formats: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        );
        // Still allow valid files through
        const valid = files.filter((f) => hasValidExtension(f.name));
        if (valid.length > 0) {
          onFilesSelected(valid);
        }
        return;
      }

      setValidationError(null);
      onFilesSelected(files);
    },
    [onFilesSelected],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current += 1;
      if (dragCounter.current === 1) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      if (disabled) return;

      const { files } = e.dataTransfer;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [disabled, processFiles],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset the input so selecting the same file(s) again triggers onChange
      e.target.value = '';
    },
    [processFiles],
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-lg border-2 border-dashed p-10 cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
            : 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Upload icon */}
        <svg
          className="w-10 h-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging ? 'Drop files here' : 'Drag and drop audio files here'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">or click to choose files</p>
        </div>

        <p className="text-xs text-zinc-600">
          FLAC, MP3, OGG, WAV, AAC, M4A, ALAC, WMA, APE, Opus
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_STRING}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {validationError && (
        <p className="mt-2 text-sm text-red-400">{validationError}</p>
      )}
    </div>
  );
}
