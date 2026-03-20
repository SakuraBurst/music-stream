import type { TrackResponse } from '../../types/index.ts';

/**
 * Dispatch a custom event to request track playback.
 * The PlayerProvider (next task) will listen for this event on the window.
 *
 * If `queue` is provided, the entire list is set as the playback queue
 * and playback starts from the track at `queueIndex`.
 */
export function requestPlayback(
  track: TrackResponse,
  queue?: TrackResponse[],
  queueIndex?: number,
): void {
  window.dispatchEvent(
    new CustomEvent('sonus:play', {
      detail: { track, queue, queueIndex },
    }),
  );
}
