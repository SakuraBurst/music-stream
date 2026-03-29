import { Outlet } from 'react-router';

import Sidebar from './Sidebar.tsx';
import PlayerBar from '../Player/PlayerBar.tsx';
import SessionRestoreBanner from '../Player/SessionRestoreBanner.tsx';
import QueuePanel from '../Queue/QueuePanel.tsx';

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <SessionRestoreBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <div className="relative">
        <QueuePanel />
        <PlayerBar />
      </div>
    </div>
  );
}
