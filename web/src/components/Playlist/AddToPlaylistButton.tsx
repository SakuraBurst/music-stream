import { useState, useEffect, useRef, useCallback } from 'react';

import { fetchPlaylists, addTrackToPlaylist } from '../../api/playlist.ts';
import type { Playlist } from '../../types/index.ts';

interface AddToPlaylistButtonProps {
  trackId: string;
  className?: string;
}

export default function AddToPlaylistButton({ trackId, className = '' }: AddToPlaylistButtonProps) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
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
        className="text-[var(--mute)] hover:text-[var(--ink2)] transition-colors text-[14px] leading-none cursor-pointer"
        title="Add to playlist"
        aria-label="Add to playlist"
      >+</button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-56
                        bg-[rgba(11,13,16,0.96)] backdrop-blur-xl border border-[var(--line2)]
                        shadow-2xl z-50 max-h-60 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--line)] font-mono-jb text-[9px] tracking-[3px] text-[var(--mute)] uppercase">
            Add to System
          </div>
          {loading && (
            <p className="px-3 py-2 text-[12px] text-[var(--mute)] italic">Loading…</p>
          )}
          {!loading && playlists.length === 0 && (
            <p className="px-3 py-2 text-[12px] text-[var(--mute)] italic">No systems yet.</p>
          )}
          {!loading && playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={(e) => { e.stopPropagation(); handleAdd(pl.id); }}
              className={`w-full text-left px-3 py-2 text-[12px] font-serif transition-colors flex items-center gap-2 border-b border-[var(--line)]
                ${addedTo === pl.id ? 'text-[var(--sun)]' : 'text-[var(--ink2)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,0.025)]'}`}
            >
              {addedTo === pl.id ? <>◉ Added</> : pl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
