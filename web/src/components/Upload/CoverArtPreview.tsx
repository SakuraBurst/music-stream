import { useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';

interface CoverArtPreviewProps {
  /** Object URL or data URL for the cover art image. null means no cover. */
  imageUrl: string | null;
  /** Whether the cover art is currently being fetched from MusicBrainz. */
  loading: boolean;
  /** Called when the user selects a custom cover art image file. */
  onCustomImage: (file: File) => void;
}

/** Music note SVG placeholder shown when no cover art is available. */
function Placeholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-800 rounded">
      <svg
        className="w-8 h-8 text-zinc-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    </div>
  );
}

export default function CoverArtPreview({
  imageUrl,
  loading,
  onCustomImage,
}: CoverArtPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onCustomImage(file);
      }
      e.target.value = '';
    },
    [onCustomImage],
  );

  return (
    <div className="relative group shrink-0">
      <div className="w-20 h-20 rounded overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 rounded">
            <svg
              className="w-5 h-5 text-zinc-500 animate-spin"
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
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Cover art"
            className="w-full h-full object-cover"
          />
        ) : (
          <Placeholder />
        )}
      </div>

      {/* Overlay button to change cover art */}
      <button
        type="button"
        onClick={handleClick}
        className="
          absolute inset-0 flex items-center justify-center
          bg-black/50 opacity-0 group-hover:opacity-100
          transition-opacity rounded cursor-pointer
        "
        title="Change cover art"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159M14.25 12.75l1.659-1.659a2.25 2.25 0 013.182 0l2.659 2.659M16.5 10.5h.008v.008H16.5V10.5zm-10.5 6h15a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 003 6v8.25A2.25 2.25 0 005.25 16.5z"
          />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
