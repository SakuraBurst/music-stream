import { useSessionSync } from '../../hooks/useSessionSync.ts';

/**
 * SessionRestoreBanner shows a non-intrusive banner when a saved playback
 * session exists on the server. The user can choose to resume or dismiss.
 *
 * Mount inside an authenticated layout so the API calls only happen
 * when the user is logged in.
 */
export default function SessionRestoreBanner() {
  const { pendingRestore, confirmRestore, dismissRestore } = useSessionSync();

  if (!pendingRestore) return null;

  const { track } = pendingRestore;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg px-5 py-3 flex items-center gap-4 max-w-md animate-in fade-in slide-in-from-top-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300">Continue listening?</p>
        <p className="text-sm font-medium text-zinc-100 truncate">
          {track.title}
          {track.artistName ? ` — ${track.artistName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={confirmRestore}
          className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
        >
          Resume
        </button>
        <button
          onClick={dismissRestore}
          className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
