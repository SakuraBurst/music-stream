import { useState } from 'react';

interface OrbitalCoverProps {
  /** Cover image URL (centered inside the sun). Optional fallback uses initial. */
  imageUrl?: string | null;
  /** Track / artist initial fallback. */
  initial: string;
  /** Playback progress 0–1. */
  progress: number;
  /** Color for the orbiting planet + arc. */
  accent: string;
  /** Whether to show the small orbiting planet. */
  showPlanet?: boolean;
  /** Disable glow halos. */
  plain?: boolean;
}

export default function OrbitalCover({
  imageUrl,
  initial,
  progress,
  accent,
  showPlanet = true,
  plain = false,
}: OrbitalCoverProps) {
  const cx = 130;
  const cy = 130;
  const r = 110;
  const circumference = 2 * Math.PI * r;
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  const px = cx + Math.cos(angle) * r;
  const py = cy + Math.sin(angle) * r;
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;

  return (
    <svg viewBox="0 0 260 260" className="block w-full h-full overflow-visible" aria-hidden>
      <defs>
        <clipPath id="cover-clip">
          <circle cx={cx} cy={cy} r="22" />
        </clipPath>
      </defs>

      {/* Reference rings */}
      <circle cx={cx} cy={cy} r={r}      fill="none" stroke="var(--line2)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={85}     fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 3" />
      <circle cx={cx} cy={cy} r={60}     fill="none" stroke="var(--line2)" strokeWidth="1" />

      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${progress * circumference} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.1s linear' }}
      />

      {/* 60 ticks around the arc */}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const major = i % 5 === 0;
        const r1 = r + 2;
        const r2 = major ? r + 12 : r + 8;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
            stroke={major ? 'var(--ink)' : 'var(--mute)'}
            strokeWidth="1"
            opacity={major ? 0.8 : 0.45}
          />
        );
      })}

      {/* Orbiting planet */}
      {showPlanet && (
        <g style={{ transition: 'transform 0.1s linear' }}>
          {!plain && (
            <>
              <circle cx={px} cy={py} r="14" fill={accent} opacity="0.15" />
              <circle cx={px} cy={py} r="9"  fill={accent} opacity="0.35" />
            </>
          )}
          <circle cx={px} cy={py} r="5" fill={accent} />
        </g>
      )}

      {/* Sun + cover image / initial */}
      {!plain && (
        <>
          <circle cx={cx} cy={cy} r="34" fill="var(--sun)" opacity="0.10" />
          <circle cx={cx} cy={cy} r="26" fill="var(--sun)" opacity="0.20" />
        </>
      )}
      <circle cx={cx} cy={cy} r="22" fill="var(--sun)" />

      {showImage ? (
        <image
          href={imageUrl ?? undefined}
          x={cx - 22} y={cy - 22} width={44} height={44}
          clipPath="url(#cover-clip)"
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <text
          x={cx} y={cy + 7}
          textAnchor="middle"
          fontFamily="Fraunces, serif"
          fontStyle="italic"
          fontSize="22"
          fontWeight="500"
          fill="var(--bg)"
        >
          {initial}
        </text>
      )}
    </svg>
  );
}
