import { NavLink, useNavigate } from 'react-router';

import { useAuthStore } from '../../store/authStore.ts';

interface NavItem {
  to: string;
  label: string;
  num: string;
}

const ITEMS: NavItem[] = [
  { to: '/',          label: 'Home',      num: '00' },
  { to: '/artists',   label: 'Artists',   num: '01' },
  { to: '/albums',    label: 'Albums',    num: '02' },
  { to: '/tracks',    label: 'Tracks',    num: '03' },
  { to: '/playlists', label: 'Systems',   num: '04' },
  { to: '/favorites', label: 'Favorites', num: '05' },
  { to: '/history',   label: 'Logs',      num: '06' },
  { to: '/search',    label: 'Search',    num: '07' },
  { to: '/upload',    label: 'Upload',    num: '08' },
];

function navItemClass({ isActive }: { isActive: boolean }): string {
  const base =
    'flex items-center gap-3 py-2 text-[13px] font-normal cursor-pointer ' +
    'border-b border-[var(--line)] select-none transition-[color,padding] duration-150';
  return isActive
    ? `${base} text-[var(--sun)] is-active`
    : `${base} text-[var(--ink2)] hover:text-[var(--ink)] hover:pl-[3px]`;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const today = new Date();
  const stamp = `J${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <aside
      className="hidden md:flex flex-col w-[220px] shrink-0 h-full overflow-y-auto px-6 py-6
                 border-r border-[var(--line)] bg-[rgba(11,13,16,0.6)] backdrop-blur-md sticky top-0"
    >
      {/* Logo */}
      <NavLink to="/" className="flex items-center gap-2.5 mb-6 group">
        <span className="relative w-[22px] h-[22px]">
          <svg width="22" height="22" viewBox="0 0 22 22" className="block">
            <circle cx="11" cy="11" r="10" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 3" />
            <circle cx="11" cy="11" r="3" fill="var(--sun)" className="sun-pulse" />
            <circle cx="20" cy="5" r="1.2" fill="var(--rose)" />
          </svg>
        </span>
        <span className="font-serif text-[22px] font-light tracking-tight text-[var(--ink)]">sonus</span>
      </NavLink>

      <div className="kicker mb-2">NAV · v0.4</div>

      <nav className="flex flex-col">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={navItemClass}
          >
            {({ isActive }) => (
              <>
                <span className={`font-mono-jb text-[10px] w-[22px] ${isActive ? 'text-[var(--sun)]' : 'text-[var(--mute)]'}`}>
                  {it.num}
                </span>
                <span>{it.label}</span>
                {isActive && <span className="ml-auto text-[var(--sun)]">◉</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-[var(--line)] text-[9px] tracking-[2px] text-[var(--mute)] leading-[1.8]">
        OBSERVATORY<br />
        {stamp} · EPOCH {String(today.getMonth() + 1).padStart(2, '0')}<br />
        <span className="text-[var(--sun)]">◉ CONNECTED</span>
        {user && (
          <div className="mt-2 text-[var(--ink2)] tracking-[2px] text-[9px]">
            OBS · {user.username.toUpperCase()}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="mt-3 self-start text-[10px] tracking-[2px] text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
      >
        ← LOG OUT
      </button>
    </aside>
  );
}
