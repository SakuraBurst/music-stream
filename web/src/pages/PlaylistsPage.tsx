import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { fetchPlaylists, createPlaylist, deletePlaylist } from '../api/playlist.ts';
import type { Playlist } from '../types/index.ts';
import OrbitMap from '../components/Cosmic/OrbitMap.tsx';
import type { OrbitSystem } from '../components/Cosmic/OrbitMap.tsx';
import { orbitColorFor } from '../components/Cosmic/palette.ts';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface SystemRow extends OrbitSystem {
  description?: string;
  createdAt: string;
}

function buildSystems(playlists: Playlist[]): SystemRow[] {
  // Distribute orbits between r=110 and r=360 so they don't pile up
  const n = Math.max(playlists.length, 1);
  return playlists.map((p, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const radius = 110 + Math.round(t * 250);
    return {
      id: p.id,
      name: p.name,
      subtitle: p.description ?? 'auto · system',
      trackCount: undefined,
      color: orbitColorFor(p.id),
      radius,
      phase: (i * 137.5) % 360,         // golden-angle distribution
      period: 320 + i * 60,
      planetSize: 4 + (i % 3),
      current: false,
      description: p.description,
      createdAt: p.createdAt,
    };
  });
}

export default function PlaylistsPage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

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
    } catch { /* silent */ }
  }

  const systems = useMemo(() => buildSystems(playlists), [playlists]);
  const decorated = useMemo(
    () => systems.map((s) => ({ ...s, current: s.id === hoverId })),
    [systems, hoverId],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left — orbit map */}
      <section className="relative min-h-[520px] border border-[var(--line)] bg-[rgba(20,24,32,0.30)] overflow-hidden">
        <div className="absolute top-5 left-6 right-6 z-[5] flex justify-between text-[10px] tracking-[2.5px] text-[var(--mute)] leading-[1.7] pointer-events-none">
          <div>
            <span className="text-[var(--sun)]">◉</span> SECTOR · LIBRARY<br />
            <span className="text-[var(--ink)] font-medium">
              {playlists.length} SYSTEMS
            </span>
          </div>
          <div className="text-right">
            EPOCH J{new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}<br />
            <span className="text-[var(--ink)] font-medium">SCALE · 1:∞</span>
          </div>
        </div>

        <div className="absolute inset-0 grid place-items-center">
          {playlists.length > 0 ? (
            <div className="w-full h-full max-w-[680px] max-h-[680px]">
              <OrbitMap
                systems={decorated}
                onOpen={(s) => navigate(`/playlists/${s.id}`)}
              />
            </div>
          ) : (
            <div className="text-center px-6">
              <div className="font-serif italic text-[26px] text-[var(--ink2)] mb-2">No systems charted</div>
              <p className="font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase">
                Create your first playlist to begin mapping
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Right — legend + create */}
      <aside className="flex flex-col">
        <header className="flex items-baseline justify-between mb-3">
          <h1 className="font-serif text-[28px] text-[var(--ink)]">
            Systems<span className="text-[var(--mute)] font-light italic"> · index</span>
          </h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="font-mono-jb text-[10px] tracking-[3px] uppercase
                       px-3 py-1.5 border border-[var(--line2)] text-[var(--ink2)]
                       hover:border-[var(--sun)] hover:text-[var(--sun)] transition-colors"
          >
            {showCreate ? '× CANCEL' : '+ NEW'}
          </button>
        </header>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-5 p-4 border border-[var(--line)] bg-[rgba(20,24,32,0.4)] space-y-3"
          >
            <div>
              <label className="block font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mb-1">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="System name"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)]
                           text-[var(--ink)] font-serif text-[14px]
                           focus:outline-none focus:border-[var(--sun)] transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mb-1">
                Description
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)]
                           text-[var(--ink2)] text-[12px]
                           focus:outline-none focus:border-[var(--sun)] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="font-mono-jb text-[10px] tracking-[3px] uppercase
                         px-3 py-2 border border-[var(--sun)] text-[var(--sun)]
                         hover:bg-[rgba(217,178,90,0.08)]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating…' : '◉ Create'}
            </button>
          </form>
        )}

        <div className="font-mono-jb text-[9px] tracking-[3px] text-[var(--mute)] flex items-center justify-between pb-2 border-b border-[var(--line)] uppercase">
          <span>Legend · Systems</span>
          <span>{loading ? '◔' : '◉'}</span>
        </div>

        <div className="flex flex-col">
          {decorated.map((s) => (
            <div
              key={s.id}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => navigate(`/playlists/${s.id}`)}
              className="grid items-center gap-3 px-2 py-3 cursor-pointer border-b border-[var(--line)]
                         hover:bg-[rgba(255,255,255,0.025)] hover:pl-3 transition-[padding,background] group"
              style={{ gridTemplateColumns: '28px 1fr 38px' }}
            >
              <svg width="24" height="24" viewBox="0 0 22 22">
                <circle cx="11" cy="11" r="9" fill="none" stroke={s.color} strokeWidth="1"
                        strokeDasharray="1 2" opacity="0.6" />
                <circle cx="20" cy="11" r="2" fill={s.color} />
              </svg>
              <div>
                <div className="font-serif text-[14px] text-[var(--ink)]">{s.name}</div>
                <div className="font-mono-jb text-[9px] tracking-[1.3px] text-[var(--mute)]">
                  R={String(s.radius).padStart(3, '0')} · θ={String(Math.round(s.phase)).padStart(3, '0')}° · {formatDate(s.createdAt)}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--mute)] hover:text-[var(--rose)]
                           transition-all text-[14px] text-right cursor-pointer"
                title="Delete system"
              >×</button>
            </div>
          ))}
        </div>

        <div className="mt-3 font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase">
          Tap a system to enter its orbit.
        </div>
      </aside>
    </div>
  );
}
