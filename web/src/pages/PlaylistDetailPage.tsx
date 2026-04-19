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
import { orbitColorFor } from '../components/Cosmic/palette.ts';
import SideViewDiagram from '../components/Cosmic/SideViewDiagram.tsx';
import { usePlayerStore } from '../store/playerStore.ts';

function fmtLong(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);

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

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await updatePlaylist(id, editName.trim(), editDesc.trim());
      setDetail((prev) =>
        prev ? { ...prev, name: updated.name, description: updated.description } : prev);
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
    } catch { /* silent */ }
  }

  async function handleRemoveTrack(trackId: string) {
    if (!id) return;
    try {
      await removeTrackFromPlaylist(id, trackId);
      setDetail((prev) =>
        prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev);
    } catch { /* silent */ }
  }

  function handlePlayAll() {
    if (!detail || detail.tracks.length === 0) return;
    requestPlayback(detail.tracks[0], detail.tracks, 0);
  }

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">Loading system…</p>
      </div>
    );
  }

  const accent = orbitColorFor(detail.id);
  const totalDuration = detail.tracks.reduce((a, t) => a + t.durationSeconds, 0);

  return (
    <div>
      <button
        onClick={() => navigate('/playlists')}
        className="font-mono-jb text-[10px] tracking-[2px] uppercase text-[var(--mute)] hover:text-[var(--ink)] transition-colors py-1 cursor-pointer"
      >
        ← BACK TO SYSTEMS
      </button>

      <header className="flex items-baseline justify-between border-b border-[var(--line)] py-4 mt-2 max-md:flex-col max-md:gap-3 max-md:items-start">
        <div>
          <div className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">
            SYSTEM · {detail.id.slice(0, 8).toUpperCase()}
          </div>
          {editing ? (
            <form onSubmit={handleSave} className="mt-2 space-y-2 max-w-md">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)]
                           text-[var(--ink)] font-serif text-[26px]
                           focus:outline-none focus:border-[var(--sun)] transition-colors"
                autoFocus
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)]
                           text-[var(--ink2)] text-[12px]
                           focus:outline-none focus:border-[var(--sun)] transition-colors"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!editName.trim() || saving}
                  className="font-mono-jb text-[10px] tracking-[3px] uppercase
                             px-3 py-1.5 border border-[var(--sun)] text-[var(--sun)]
                             hover:bg-[rgba(217,178,90,0.08)] disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : '◉ Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="font-mono-jb text-[10px] tracking-[3px] uppercase
                             px-3 py-1.5 border border-[var(--line2)] text-[var(--mute)] hover:text-[var(--ink2)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="font-serif text-[38px] text-[var(--ink)] leading-tight mt-1">
                {detail.name}
                {detail.description && (
                  <span className="font-light italic text-[var(--mute)] text-[24px]"> // {detail.description}</span>
                )}
              </h1>
              <div className="font-mono-jb text-[10px] tracking-[1.5px] text-[var(--mute)] uppercase mt-1">
                {detail.tracks.length} BODIES · ORBITAL PERIOD {fmtLong(totalDuration)}
              </div>
            </>
          )}
        </div>
        <div className="font-mono-jb text-[10px] tracking-[2px] text-right uppercase leading-[1.8]" style={{ color: accent }}>
          ◉ ACTIVE<br />
          <span className="text-[var(--mute)]">EPOCH J{new Date().getFullYear()}</span>
        </div>
      </header>

      <div className="flex items-center gap-2 my-4">
        {detail.tracks.length > 0 && (
          <button
            onClick={handlePlayAll}
            className="font-mono-jb text-[10px] tracking-[3px] uppercase
                       px-3 py-2 border border-[var(--sun)] text-[var(--sun)]
                       hover:bg-[rgba(217,178,90,0.08)] transition-colors"
          >
            ▶ PLAY ORBIT
          </button>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="font-mono-jb text-[10px] tracking-[3px] uppercase
                       px-3 py-2 border border-[var(--line2)] text-[var(--ink2)]
                       hover:border-[var(--ink2)] transition-colors"
          >
            ✎ EDIT
          </button>
        )}
        <button
          onClick={handleDelete}
          className="font-mono-jb text-[10px] tracking-[3px] uppercase
                     px-3 py-2 border border-[var(--line2)] text-[var(--mute)]
                     hover:text-[var(--rose)] hover:border-[var(--rose)] transition-colors"
        >
          × DELETE
        </button>
      </div>

      {detail.tracks.length > 0 && (
        <div className="mb-5 px-4 py-4 border border-[var(--line)] bg-[rgba(20,24,32,0.4)]">
          <div className="flex justify-between font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)] uppercase mb-2">
            <span>SIDE VIEW · FIRST {Math.min(detail.tracks.length, 12)} BODIES</span>
            <span>RADIUS ∝ SEQUENCE · CLICK TO PLAY</span>
          </div>
          <SideViewDiagram
            tracks={detail.tracks.map((t) => ({
              id: t.id,
              trackNumber: t.trackNumber,
              durationSeconds: t.durationSeconds,
            }))}
            currentId={currentTrackId}
            onSelect={(selected) => {
              const idx = detail.tracks.findIndex((x) => x.id === selected.id);
              if (idx >= 0) requestPlayback(detail.tracks[idx], detail.tracks, idx);
            }}
          />
        </div>
      )}

      {detail.tracks.length > 0 ? (
        <div>
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-[var(--line2)]">
                <th className="px-3 py-2.5 text-right w-12 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">#</th>
                <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">BODY</th>
                <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">ORIGIN</th>
                <th className="px-3 py-2.5 text-left font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">SYSTEM</th>
                <th className="px-3 py-2.5 text-right w-24 font-mono-jb text-[9px] tracking-[2.5px] text-[var(--mute)]">SPAN</th>
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
                      onClick={(e) => { e.stopPropagation(); handleRemoveTrack(track.id); }}
                      className="text-[var(--mute)] hover:text-[var(--rose)] opacity-0 group-hover:opacity-100 transition-all px-1 cursor-pointer"
                      title="Remove from system"
                    >×</button>
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border border-[var(--line)] mt-4">
          <p className="font-serif italic text-[20px] text-[var(--ink2)]">This system has no bodies</p>
          <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase mt-1">Add tracks from the library</p>
        </div>
      )}
    </div>
  );
}
