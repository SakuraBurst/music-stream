import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';

import {
  fetchPlaylists,
  createPlaylist,
  deletePlaylist,
} from '../api/playlist.ts';
import type { Playlist } from '../types/index.ts';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPlaylists();
      setPlaylists(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const playlist = await createPlaylist(newName.trim(), newDesc.trim());
      setPlaylists((prev) => [playlist, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Silently handle
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          {showCreate ? 'Cancel' : 'New playlist'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 rounded-lg bg-zinc-900 border border-zinc-800 max-w-md"
        >
          <div className="mb-3">
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description"
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="px-4 py-2 text-sm font-medium rounded-md bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {loading && playlists.length === 0 && (
        <p className="text-zinc-400">Loading playlists...</p>
      )}

      {!loading && playlists.length === 0 && (
        <p className="text-zinc-500">
          No playlists yet. Create one to get started.
        </p>
      )}

      {/* Playlists list */}
      <div className="space-y-2">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 hover:bg-zinc-800/80 transition-colors group"
          >
            <div className="w-12 h-12 shrink-0 rounded-md bg-zinc-800 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-zinc-600"
              >
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </div>
            <Link
              to={`/playlists/${playlist.id}`}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-medium text-zinc-200 truncate hover:underline">
                {playlist.name}
              </p>
              {playlist.description && (
                <p className="text-xs text-zinc-500 truncate">
                  {playlist.description}
                </p>
              )}
              <p className="text-xs text-zinc-600 mt-0.5">
                Created {formatDate(playlist.createdAt)}
              </p>
            </Link>
            <button
              onClick={() => handleDelete(playlist.id)}
              className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete playlist"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
