import { useState } from 'react';

import { useClock } from './useClock.ts';

export interface OrbitSystem {
  id: string;
  name: string;
  subtitle?: string;
  trackCount?: number;
  color: string;
  /** Radius in viewBox units (the SVG is 800×800). Suggested 90 – 360. */
  radius: number;
  /** Phase offset in degrees, randomises starting position. */
  phase: number;
  /** Period in seconds for one full orbit at speed = 1. */
  period: number;
  /** Visual size of the planet body. */
  planetSize: number;
  /** Whether this is the current/active system. */
  current?: boolean;
}

interface OrbitMapProps {
  systems: OrbitSystem[];
  onOpen?: (system: OrbitSystem) => void;
  /** Hide stars/glow when true. */
  plain?: boolean;
  /** Speed multiplier for orbits. */
  speed?: number;
}

const VB = 800;
const CX = VB / 2;
const CY = VB / 2;

export default function OrbitMap({ systems, onOpen, plain = false, speed = 1 }: OrbitMapProps) {
  const clock = useClock();
  const t = clock * 0.001 * speed;
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-full overflow-visible"
      style={{ padding: '40px' }}
    >
      <circle cx={CX} cy={CY} r={380} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" opacity="0.5" />

      {systems.map(s => {
        const angle = (s.phase + (t / s.period) * 360) * Math.PI / 180;
        const x = CX + Math.cos(angle) * s.radius;
        const y = CY + Math.sin(angle) * s.radius;
        const hovered = hoverId === s.id;
        const highlight = !!s.current || hovered;

        return (
          <g
            key={s.id}
            onMouseEnter={() => setHoverId(s.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onOpen?.(s)}
            style={{ cursor: 'pointer', transition: 'filter 0.2s' }}
          >
            <circle
              cx={CX} cy={CY} r={s.radius}
              fill="none"
              stroke={highlight ? s.color : 'var(--line2)'}
              strokeOpacity={highlight ? 0.85 : 0.45}
              strokeDasharray={s.current ? '' : '1 3'}
              strokeWidth={s.current ? 1.2 : 1}
            />
            {s.current && !plain && (
              <>
                <circle cx={x} cy={y} r={s.planetSize + 10} fill={s.color} opacity="0.12" />
                <circle cx={x} cy={y} r={s.planetSize + 5}  fill={s.color} opacity="0.25" />
              </>
            )}
            <circle
              cx={x} cy={y} r={s.planetSize}
              fill={highlight ? s.color : 'none'}
              stroke={s.color}
              strokeWidth="1"
            />
            <text
              x={x + s.planetSize + 12} y={y + 4}
              fontFamily="Fraunces, serif" fontStyle="italic"
              fontSize="14"
              fill={highlight ? s.color : 'var(--ink)'}
              opacity={highlight ? 1 : 0.8}
            >
              {s.name}
            </text>
            {s.subtitle && (
              <text
                x={x + s.planetSize + 12} y={y + 18}
                fontFamily="JetBrains Mono, monospace"
                fontSize="9" letterSpacing="1" fill="var(--mute)"
              >
                {(s.trackCount != null ? `${String(s.trackCount).padStart(3, '0')} TR · ` : '')}{s.subtitle}
              </text>
            )}
          </g>
        );
      })}

      {/* Sun in the center */}
      {!plain && (
        <>
          <circle cx={CX} cy={CY} r="36" fill="var(--sun)" opacity="0.10" />
          <circle cx={CX} cy={CY} r="26" fill="var(--sun)" opacity="0.22" />
        </>
      )}
      <circle cx={CX} cy={CY} r="16" fill="var(--sun)" className="sun-pulse" />
      <text x={CX} y={CY + 5} textAnchor="middle"
            fontFamily="Fraunces, serif" fontStyle="italic"
            fontSize="18" fontWeight="500" fill="var(--bg)">★</text>
      <text x={CX} y={CY + 58} textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize="9" letterSpacing="3" fill="var(--sun)" opacity="0.8">
        ★ YOU
      </text>
    </svg>
  );
}
