import { useCallback, useMemo, useRef } from 'react';

import { haptic } from '../../utils/haptics.ts';

interface WaveformProps {
  progress: number;          // 0–1
  color?: string;
  bars?: number;
  height?: number;
  /**
   * When provided, the waveform becomes interactive: tap-to-seek + press-and-
   * drag to scrub. The callback receives the seek fraction (0–1).
   */
  onSeek?: (frac: number) => void;
}

function clientXToFrac(clientX: number, target: SVGSVGElement): number {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0) return 0;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

export default function Waveform({
  progress,
  color = '#c28b8b',
  bars = 80,
  height = 40,
  onSeek,
}: WaveformProps) {
  const sticks = useMemo(
    () => Array.from({ length: bars }, (_, i) => {
      const h = 3 + Math.abs(Math.sin(i * 0.27)) * (height * 0.45)
                   + Math.abs(Math.sin(i * 0.11)) * (height * 0.20);
      return h;
    }),
    [bars, height],
  );

  const playedUpto = Math.floor(progress * bars);
  const width = 300;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrubbing = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    scrubbing.current = true;
    if (e.pointerType === 'touch') haptic('selection');
    onSeek(clientXToFrac(e.clientX, e.currentTarget));
  }, [onSeek]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!scrubbing.current || !onSeek) return;
    onSeek(clientXToFrac(e.clientX, e.currentTarget));
  }, [onSeek]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
    if (e.pointerType === 'touch') haptic('light');
  }, []);

  const interactive = !!onSeek;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
      data-no-drag={interactive ? '' : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerCancel={interactive ? handlePointerUp : undefined}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        // Disable browser scroll/zoom interpretation so pointermove keeps
        // firing during a horizontal drag — required especially on iOS.
        touchAction: interactive ? 'none' : undefined,
        userSelect: 'none',
      }}
    >
      {/* Transparent hit-target spanning the full viewBox so finger taps
          register on the gaps between bars. */}
      {interactive && (
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
      )}
      {sticks.map((h, i) => {
        const x = (i / bars) * width;
        const played = i < playedUpto;
        const atHead = i === playedUpto;
        return (
          <line
            key={i}
            x1={x} y1={(height - h) / 2}
            x2={x} y2={(height + h) / 2}
            stroke={played || atHead ? color : 'var(--line2)'}
            strokeWidth={atHead ? 1.6 : played ? 1.3 : 1}
            opacity={atHead ? 1 : played ? 1 : 0.7}
            style={played ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
          />
        );
      })}
    </svg>
  );
}
