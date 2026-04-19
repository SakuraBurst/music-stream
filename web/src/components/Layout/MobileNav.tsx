import { NavLink } from 'react-router';

interface NavTab {
  to: string;
  label: string;
  glyph: string;
}

const TABS: NavTab[] = [
  { to: '/artists',   label: 'Library',   glyph: '◐' },
  { to: '/search',    label: 'Search',    glyph: '⊕' },
  { to: '/playlists', label: 'Systems',   glyph: '◯' },
  { to: '/favorites', label: 'Favorites', glyph: '✦' },
  { to: '/history',   label: 'Logs',      glyph: '◔' },
];

function tabClass({ isActive }: { isActive: boolean }): string {
  const base =
    'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 transition-colors duration-150 select-none';
  return isActive
    ? `${base} text-[var(--sun)]`
    : `${base} text-[var(--mute)]`;
}

export default function MobileNav() {
  return (
    <nav
      className="md:hidden shrink-0 border-t border-[var(--line)] pb-safe
                 bg-[rgba(11,13,16,0.92)] backdrop-blur-xl"
    >
      <div className="flex">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={tabClass}>
            <span className="text-[14px] leading-none">{tab.glyph}</span>
            <span className="text-[10px] tracking-[2px] uppercase font-mono-jb">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
