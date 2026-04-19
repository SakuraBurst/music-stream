import { Outlet } from 'react-router';

import Sidebar from './Sidebar.tsx';
import MobileNav from './MobileNav.tsx';
import PlayerBar from '../Player/PlayerBar.tsx';
import SessionRestoreBanner from '../Player/SessionRestoreBanner.tsx';
import ExpandedPlayer from '../Player/ExpandedPlayer.tsx';
import QueuePanel from '../Queue/QueuePanel.tsx';
import Starfield from '../Cosmic/Starfield.tsx';
import { usePlayerStore } from '../../store/playerStore.ts';

export default function MainLayout() {
  const expandedOpen = usePlayerStore((s) => s.expandedOpen);

  return (
    <div className="relative flex flex-col h-screen cosmic-bg text-[var(--ink)]">
      <Starfield />
      <SessionRestoreBanner />

      <div className="relative z-[1] flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto px-7 py-6 max-md:px-4 max-md:py-4 max-md:pb-2">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
        <ExpandedPlayer />
      </div>

      {/* Mini player + queue — hidden on desktop when the sidebar player is
          open, because the design pushes the page instead of overlaying. */}
      <div className={`relative z-[2] ${expandedOpen ? 'md:hidden' : ''}`}>
        <QueuePanel />
        <PlayerBar />
      </div>
      <MobileNav />
    </div>
  );
}
