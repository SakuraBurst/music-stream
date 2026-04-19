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

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const invalid = files.filter((f) => !hasValidExtension(f.name));

    if (invalid.length > 0) {
      const names = invalid.map((f) => f.name).join(', ');
      setValidationError(
        `Unsupported file${invalid.length > 1 ? 's' : ''}: ${names}. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`,
      );
      const valid = files.filter((f) => hasValidExtension(f.name));
      if (valid.length > 0) onFilesSelected(valid);
      return;
    }
    setValidationError(null);
    onFilesSelected(files);
  }, [onFilesSelected]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (disabled) return;
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!disabled) e.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [disabled, processFiles]);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative flex flex-col items-center justify-center gap-4 p-12
                   border border-dashed cursor-pointer transition-all duration-200
                   ${isDragging
                     ? 'border-[var(--sun)] bg-[rgba(217,178,90,0.08)] text-[var(--sun)]'
                     : 'border-[var(--line2)] hover:border-[var(--ink2)] text-[var(--ink2)] bg-[rgba(20,24,32,0.4)]'}
                   ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-12 h-12 rounded-full grid place-items-center border transition-colors text-[18px]
                        ${isDragging
                          ? 'border-[var(--sun)] text-[var(--sun)]'
                          : 'border-[var(--line2)] text-[var(--mute)]'}`}>
          ↑
        </div>

        <div className="text-center">
          <p className="font-serif text-[16px] text-[var(--ink)]">
            {isDragging ? 'Drop bodies here' : 'Drag and drop audio files here'}
          </p>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-1">
            or click to choose files
          </p>
        </div>

        <p className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase">
          FLAC · MP3 · OGG · WAV · AAC · M4A · ALAC · WMA · APE · OPUS
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
        <div className="mt-3 px-4 py-3 border border-[var(--rose)] text-[var(--rose)] text-[12px] font-mono-jb">
          {validationError}
        </div>
      )}
    </div>
  );
}
