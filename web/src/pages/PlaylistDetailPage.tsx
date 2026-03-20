import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';

import {
  fetchPlaylist,
  updatePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
} from '../api/playlist.ts';
import type { PlaylistDetail } from '../api/playlist.ts';
import type { TrackResponse } from '../types/index.ts';
import TrackRow from '../components/Library/TrackRow.tsx';
import { requestPlayback } from '../components/Library/playback-events.ts';

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await fetchPlaylist(id);
      setDetail(result);
      setEditName(result.name);
      setEditDesc(result.description ?? '');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await updatePlaylist(id, editName.trim(), editDesc.trim());
      setDetail((prev) =>
        prev ? { ...prev, name: updated.name, description: updated.description } : prev,
      );
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePlaylist(id);
      navigate('/playlists', { replace: true });
    } catch {
      // Silently handle
    }
  }

  async function handleRemoveTrack(trackId: string) {
    if (!id) return;
    try {
      await removeTrackFromPlaylist(id, trackId);
      setDetail((prev) =>
        prev
          ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) }
          : prev,
      );
    } catch {
      // Silently handle
    }
  }

  function handlePlayAll() {
    if (!detail || detail.tracks.length === 0) return;
    requestPlayback(detail.tracks[0], detail.tracks, 0);
  }

  if (loading || !detail) {
    return (
      <div>
        <p className="text-zinc-400">Loading playlist...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Playlist header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-48 h-48 shrink-0 rounded-lg bg-zinc-800 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-20 h-20 text-zinc-700"
          >
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </div>
        <div className="flex flex-col justify-end min-w-0 flex-1">
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">
            Playlist
          </p>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-2 mb-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full max-w-md px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xl font-bold focus:outline-none focus:border-zinc-500"
                autoFocus
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description"
                className="w-full max-w-md px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm focus:outline-none focus:border-zinc-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!editName.trim() || saving}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-1 truncate">{detail.name}</h1>
              {detail.description && (
                <p className="text-sm text-zinc-400 mb-2">{detail.description}</p>
              )}
            </>
          )}

          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>{detail.tracks.length} tracks</span>
          </div>

          <div className="flex items-center gap-2 mt-3">
            {detail.tracks.length > 0 && (
              <button
                onClick={handlePlayAll}
                className="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                Play all
              </button>
            )}
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Track list */}
      {detail.tracks.length > 0 ? (
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Artist</th>
              <th className="px-3 py-2 text-left">Album</th>
              <th className="px-3 py-2 text-right w-20">Duration</th>
            </tr>
          </thead>
          <tbody>
            {detail.tracks.map((track: TrackResponse, i: number) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                queue={detail.tracks}
                showArtist
                showAlbum
                extraAction={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track.id);
                    }}
                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from playlist"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M19 13H5v-2h14v2z" />
                    </svg>
                  </button>
                }
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-zinc-500">
          This playlist is empty. Add tracks from the library.
        </p>
      )}
    </div>
  );
}
