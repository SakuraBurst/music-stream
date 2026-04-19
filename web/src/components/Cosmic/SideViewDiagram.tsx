import { useMemo } from 'react';

import { useClock } from './useClock.ts';
import { orbitColorFor } from './palette.ts';
import { toRoman } from './utils.ts';

export interface DiagramTrack {
  id: string;
  trackNumber?: number;
  durationSeconds: number;
}

interface SideViewDiagramProps {
  tracks: DiagramTrack[];
  currentId?: string | null;
  onSelect?: (track: DiagramTrack) => void;
  plain?: boolean;
  /** Maximum number of tracks to render (default 12). */
  limit?: number;
}

const VB_W = 580;
const VB_H = 140;
const SUN_X = 28;
const FIRST_X = 70;
const LAST_X = VB_W - 30;
const HORIZON_Y = 100;

function sizeFor(i: number): number {
  if (i === 0) return 8;
  if (i === 1) return 7;
  if (i === 2) return 6;
  if (i < 6)   return 5;
  return 4;
}

export default function SideViewDiagram({
  tracks,
  currentId,
  onSelect,
  plain = false,
  limit = 12,
}: SideViewDiagramProps) {
  const clock = useClock();
  const t = clock * 0.001;

  const visible = useMemo(() => tracks.slice(0, limit), [tracks, limit]);
  const n = visible.length;
  if (n === 0) return null;

  const span = LAST_X - FIRST_X;
  const step = n > 1 ? span / (n - 1) : 0;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block w-full h-[140px] overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* horizon */}
      <line x1="0" y1={HORIZON_Y} x2={VB_W} y2={HORIZON_Y}
            stroke="var(--line2)" strokeWidth="1" strokeDasharray="2 4" />

      {/* sun */}
      {!plain && (
        <>
          <circle cx={SUN_X} cy={HORIZON_Y} r="16" fill="var(--sun)" opacity="0.18" />
          <circle cx={SUN_X} cy={HORIZON_Y} r="10" fill="var(--sun)" opacity="0.35" />
        </>
      )}
      <circle cx={SUN_X} cy={HORIZON_Y} r="5" fill="var(--sun)" />

      {visible.map((track, i) => {
        const xc = n === 1 ? (FIRST_X + LAST_X) / 2 : FIRST_X + i * step;
        const size = sizeFor(i);
        const bob = Math.sin(t * 0.3 + i) * 3;
        const y = HORIZON_Y - size - 4 + bob;
        const isCurrent = track.id === currentId;
        const color = orbitColorFor(track.id);
        const label = toRoman(track.trackNumber ?? i + 1);

        return (
          <g
            key={track.id}
            onClick={onSelect ? () => onSelect(track) : undefined}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            {/* invisible hit target for easier clicking */}
            {onSelect && (
              <rect
                x={xc - step / 2}
                y={0}
                width={Math.max(step, 40)}
                height={VB_H}
                fill="transparent"
              />
            )}
            <line x1={xc} y1={HORIZON_Y} x2={xc} y2={y + size}
                  stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.55" />
            {isCurrent && !plain && (
              <>
                <circle cx={xc} cy={y} r={size + 8} fill={color} opacity="0.14" />
                <circle cx={xc} cy={y} r={size + 4} fill={color} opacity="0.28" />
              </>
            )}
            <circle
              cx={xc} cy={y} r={size}
              fill={isCurrent ? color : 'none'}
              stroke={color}
              strokeWidth="1"
            />
            <text
              x={xc} y={126}
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontStyle="italic"
              fontSize="11"
              fill={isCurrent ? color : 'var(--mute)'}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
