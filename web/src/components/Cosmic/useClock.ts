import { useEffect, useRef, useState } from 'react';

/**
 * High-frequency animation clock. Returns elapsed milliseconds since mount,
 * scaled by `speed`. Updates every animation frame.
 */
export function useClock(speed = 1): number {
  const [time, setTime] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      setTime((now - startRef.current) * speed);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return time;
}
