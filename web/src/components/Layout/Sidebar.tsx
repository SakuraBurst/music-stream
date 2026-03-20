import { NavLink, useNavigate } from 'react-router';

import { useAuthStore } from '../../store/authStore.ts';

interface NavItem {
  to: string;
  label: string;
}

const libraryItems: NavItem[] = [
  { to: '/artists', label: 'Artists' },
  { to: '/albums', label: 'Albums' },
  { to: '/tracks', label: 'Tracks' },
];

const navItems: NavItem[] = [
  { to: '/playlists', label: 'Playlists' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/history', label: 'History' },
  { to: '/search', label: 'Search' },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block px-4 py-1.5 rounded-md text-sm transition-colors';
  return isActive
    ? `${base} bg-white/10 text-white font-medium`
    : `${base} text-zinc-400 hover:text-white hover:bg-white/5`;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 h-full overflow-y-auto">
      <div className="px-4 py-5">
        <NavLink to="/" className="text-xl font-bold text-white tracking-tight">
          Sonus
        </NavLink>
      </div>

      <nav className="flex-1 px-2 pb-4 space-y-4">
        <div>
          <h3 className="px-4 mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Library
          </h3>
          <ul className="space-y-0.5">
            {libraryItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-zinc-800">
        {user && (
          <p className="text-sm text-zinc-400 mb-2 truncate">{user.username}</p>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
