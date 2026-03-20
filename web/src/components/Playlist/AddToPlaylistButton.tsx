import { useState, useEffect, useRef, useCallback } from 'react';

import { fetchPlaylists, addTrackToPlaylist } from '../../api/playlist.ts';
import type { Playlist } from '../../types/index.ts';

interface AddToPlaylistButtonProps {
  trackId: string;
  className?: string;
}

export default function AddToPlaylistButton({
  trackId,
  className = '',
}: AddToPlaylistButtonProps) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!open) {
        setLoading(true);
        setAddedTo(null);
        fetchPlaylists()
          .then(setPlaylists)
          .finally(() => setLoading(false));
      }
      setOpen(!open);
    },
    [open],
  );

  async function handleAdd(playlistId: string) {
    try {
      await addTrackToPlaylist(playlistId, trackId);
      setAddedTo(playlistId);
      setTimeout(() => setOpen(false), 600);
    } catch {
      // Silently handle
    }
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={handleToggle}
        className="text-zinc-600 hover:text-zinc-400 transition-colors"
        title="Add to playlist"
        aria-label="Add to playlist"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-zinc-500">Loading...</p>
          )}
          {!loading && playlists.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-500">
              No playlists. Create one first.
            </p>
          )}
          {!loading &&
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdd(pl.id);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  addedTo === pl.id
                    ? 'text-green-400'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {addedTo === pl.id ? 'Added!' : pl.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
