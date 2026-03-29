import { darkenColor, type RGBColor } from './useColorExtractor.ts';

interface AmbientGlowProps {
  colors: RGBColor[];
}

function rgb(c: RGBColor): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgba(c: RGBColor, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

/**
 * Fullscreen ambient background for Zen mode.
 *
 * - Solid fill using the primary (dominant) color, darkened
 * - 2 secondary-color blobs that drift around like a lava lamp
 *   on independent, long-duration keyframe paths
 */
export default function AmbientGlow({ colors }: AmbientGlowProps) {
  const primary = colors[0] ?? [60, 60, 80];
  const secondary1 = colors[1] ?? [40, 40, 60];
  const secondary2 = colors[2] ?? [80, 60, 80];

  const bg = darkenColor(primary, 0.45);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Solid primary-color background — fully opaque */}
      <div
        className="absolute inset-0 transition-[background-color] duration-[1.5s] ease-in-out"
        style={{ backgroundColor: rgb(bg) }}
      />

      {/* Subtle vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, ${rgba(darkenColor(primary, 0.7), 0.6)} 100%)`,
        }}
      />

      {/* Lava blob 1 — large, slow drift */}
      <div
        className="absolute animate-[lavaBlob1_18s_ease-in-out_infinite]"
        style={{
          width: '55vmax',
          height: '55vmax',
          left: '-10%',
          top: '-10%',
          borderRadius: '45% 55% 50% 50% / 50% 45% 55% 50%',
          background: `radial-gradient(circle at 40% 40%, ${rgba(secondary1, 0.7)}, ${rgba(secondary1, 0.0)} 70%)`,
          filter: 'blur(80px)',
          transition: 'background 1.5s ease',
        }}
      />

      {/* Lava blob 2 — opposite side, different timing */}
      <div
        className="absolute animate-[lavaBlob2_22s_ease-in-out_infinite]"
        style={{
          width: '50vmax',
          height: '50vmax',
          right: '-10%',
          bottom: '-10%',
          borderRadius: '50% 45% 55% 50% / 55% 50% 45% 50%',
          background: `radial-gradient(circle at 60% 60%, ${rgba(secondary2, 0.7)}, ${rgba(secondary2, 0.0)} 70%)`,
          filter: 'blur(80px)',
          transition: 'background 1.5s ease',
        }}
      />

      {/* Lava blob 3 — smaller accent, fastest */}
      <div
        className="absolute animate-[lavaBlob3_14s_ease-in-out_infinite]"
        style={{
          width: '35vmax',
          height: '35vmax',
          left: '30%',
          top: '20%',
          borderRadius: '55% 45% 50% 50% / 45% 55% 50% 50%',
          background: `radial-gradient(circle at 50% 50%, ${rgba(secondary1, 0.35)}, ${rgba(secondary2, 0.0)} 70%)`,
          filter: 'blur(100px)',
          transition: 'background 1.5s ease',
        }}
      />
    </div>
  );
}
