import { useMemo, useState } from 'react';

import { useClock } from './useClock.ts';

export interface MinorBody {
  id: string;
  color: string;
  /** 0-based index used to phase the orbit. */
  index: number;
}

interface PlanetariumProps {
  /** Title of the central piece (e.g. artist name or "Sonus"). */
  title: string;
  /** Subtitle below the title (album name etc.). */
  subtitle?: string;
  /** Primary orbiting planet color. */
  accent: string;
  /** Track artist initial — shown if no image. */
  initial: string;
  /** Cover art URL — shown clipped inside the sun if available. */
  imageUrl?: string | null;
  /** Body label for the orbiting planet ("Autobahn"). */
  bodyName: string;
  /** Body sub-label (duration etc.). */
  bodyMeta?: string;
  /** Playback progress 0–1. */
  progress: number;
  /** Other tracks in the queue, rendered as minor bodies. */
  minors?: MinorBody[];
  /** When true, hide glow halos. */
  plain?: boolean;
}

const VB_W = 1000;
const VB_H = 700;
const CX = 500;
const CY = 350;
const R = 260;

export default function Planetarium({
  title,
  subtitle,
  accent,
  initial,
  imageUrl,
  bodyName,
  bodyMeta,
  progress,
  minors = [],
  plain = false,
}: PlanetariumProps) {
  const clock = useClock();
  const t = clock * 0.001;

  const angle = progress * Math.PI * 2 - Math.PI / 2;
  const px = CX + Math.cos(angle) * R;
  const py = CY + Math.sin(angle) * R;
  const arcLen = 2 * Math.PI * R;

  const minorOrbits = useMemo(() => minors.slice(0, 6).map((m, i) => {
    const radius = 120 + i * 24;
    const omega = 0.05 * ((i % 3) + 1);
    return { ...m, radius, omega };
  }), [minors]);

  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-full overflow-visible"
      aria-hidden
    >
      <defs>
        <clipPath id="planetarium-cover-clip">
          <circle cx={CX} cy={CY} r="26" />
        </clipPath>
      </defs>

      {/* Reference rings */}
      <circle cx={CX} cy={CY} r="320" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 4" />
      <circle cx={CX} cy={CY} r={R}   fill="none" stroke="var(--line2)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r="190" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 4" />
      <circle cx={CX} cy={CY} r="130" fill="none" stroke="var(--line2)" strokeWidth="1" />

      {/* Progress arc */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${progress * arcLen} ${arcLen}`}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: 'stroke-dasharray 0.1s linear' }}
      />

      {/* Tick ring */}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const major = i % 5 === 0;
        const r1 = R + 4;
        const r2 = major ? R + 16 : R + 10;
        return (
          <line
            key={i}
            x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1}
            x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2}
            stroke={major ? 'var(--ink)' : 'var(--mute)'}
            strokeWidth="1"
            opacity={major ? 0.8 : 0.45}
          />
        );
      })}

      {/* Minor planets — float lazily around the inner system */}
      {minorOrbits.map(m => {
        const a = m.index + t * m.omega;
        const x = CX + Math.cos(a) * m.radius;
        const y = CY + Math.sin(a) * m.radius;
        const size = 2.5 + (m.index % 3) * 0.8;
        return (
          <g key={m.id}>
            {!plain && <circle cx={x} cy={y} r={size + 3} fill={m.color} opacity="0.20" />}
            <circle cx={x} cy={y} r={size} fill={m.color} opacity="0.70" />
          </g>
        );
      })}

      {/* Current planet */}
      {!plain && (
        <>
          <circle cx={px} cy={py} r="36" fill={accent} opacity="0.08" />
          <circle cx={px} cy={py} r="26" fill={accent} opacity="0.16" />
          <circle cx={px} cy={py} r="18" fill={accent} opacity="0.32" />
        </>
      )}
      <circle cx={px} cy={py} r="10" fill={accent} />
      <line x1={px} y1={py} x2={CX} y2={CY}
            stroke={accent} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.4" />
      <text x={px + 20} y={py + 5}
            fontFamily="Fraunces, serif" fontStyle="italic"
            fontSize="16" fill={accent}>
        {bodyName}
      </text>
      {bodyMeta && (
        <text x={px + 20} y={py + 22}
              fontFamily="Inter, sans-serif" fontSize="9"
              letterSpacing="2" fill="var(--mute)">
          {bodyMeta}
        </text>
      )}

      {/* Sun (with optional cover image) */}
      {!plain && (
        <>
          <circle cx={CX} cy={CY} r="64" fill="var(--sun)" opacity="0.08" />
          <circle cx={CX} cy={CY} r="48" fill="var(--sun)" opacity="0.16" />
          <circle cx={CX} cy={CY} r="36" fill="var(--sun)" opacity="0.30" />
        </>
      )}
      <circle cx={CX} cy={CY} r="26" fill="var(--sun)" />
      {showImage ? (
        <image
          href={imageUrl ?? undefined}
          x={CX - 26} y={CY - 26} width={52} height={52}
          clipPath="url(#planetarium-cover-clip)"
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <text x={CX} y={CY + 8} textAnchor="middle"
              fontFamily="Fraunces, serif" fontStyle="italic"
              fontSize="22" fontWeight="500" fill="var(--bg)">
          {initial}
        </text>
      )}

      {/* Title beneath the sun */}
      <text x={CX} y={CY + 110} textAnchor="middle"
            fontFamily="Fraunces, serif" fontWeight="300"
            fontSize="42" letterSpacing="-0.5" fill="var(--ink)">
        {title}
      </text>
      {subtitle && (
        <text x={CX} y={CY + 132} textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontSize="10" letterSpacing="5" fill="var(--mute)">
          {subtitle}
        </text>
      )}
    </svg>
  );
}
