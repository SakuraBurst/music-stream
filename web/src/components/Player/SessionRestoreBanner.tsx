import { useSessionSync } from '../../hooks/useSessionSync.ts';

/**
 * SessionSync mounts the useSessionSync hook which auto-saves playback
 * state and silently restores it on load (paused, ready for the user
 * to press play).
 *
 * Mount inside an authenticated layout so the API calls only happen
 * when the user is logged in.
 *
 * This component renders nothing — kept as a component rather than
 * moving the hook into MainLayout to avoid coupling layout with session logic.
 */
export default function SessionRestoreBanner() {
  useSessionSync();
  return null;
}
