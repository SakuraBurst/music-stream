import { useEffect, useRef } from 'react';

interface VerticalDragCallbacks {
  onStart?: () => void;
  onMove?: (dy: number, velocity: number) => void;
  /** Called on touchend/cancel. `dy` is final offset (px), `velocity` is px/ms at release. */
  onEnd?: (dy: number, velocity: number) => void;
}

interface VerticalDragOptions extends VerticalDragCallbacks {
  /** Enable/disable listeners without remounting. */
  enabled?: boolean;
  /** When set, ignore drags that start less than this many px from touchstart. */
  startThreshold?: number;
  /** When true, prevent default touch behavior (e.g. pull-to-refresh). */
  preventScroll?: boolean;
}

/**
 * Attach vertical touch-drag tracking to an element.
 *
 * Usage:
 *   const ref = useVerticalDrag<HTMLDivElement>({ onMove, onEnd });
 *   return <div ref={ref}>…</div>;
 */
export function useVerticalDrag<E extends HTMLElement = HTMLElement>(
  options: VerticalDragOptions,
) {
  const ref = useRef<E | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (latest.current.enabled === false) return;

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let active = false;
    let started = false;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      // If the gesture starts inside an opt-out zone (e.g. the waveform),
      // skip it so the outer handler doesn't hijack horizontal scrubbing
      // or tap interactions.
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-no-drag]')) {
        active = false;
        started = false;
        return;
      }
      startY = e.touches[0].clientY;
      lastY = startY;
      lastT = performance.now();
      velocity = 0;
      active = true;
      started = false;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!active) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = now;

      const threshold = latest.current.startThreshold ?? 4;
      if (!started && Math.abs(dy) < threshold) return;

      if (!started) {
        started = true;
        latest.current.onStart?.();
      }

      if (latest.current.preventScroll && e.cancelable) e.preventDefault();
      latest.current.onMove?.(dy, velocity);
    }

    function handleTouchEnd() {
      if (!active) return;
      active = false;
      const dy = lastY - startY;
      if (started) latest.current.onEnd?.(dy, velocity);
      started = false;
    }

    const moveOpts: AddEventListenerOptions = { passive: !latest.current.preventScroll };
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, moveOpts);
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [options.enabled]);

  return ref;
}
