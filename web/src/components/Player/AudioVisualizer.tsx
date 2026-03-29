import { useEffect, useRef } from 'react';

import { getAnalyserNode } from './audioAnalyser.ts';
import type { RGBColor } from './useColorExtractor.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of visual bars to render. */
const BAR_COUNT = 48;

/** Canvas height in CSS pixels. */
const CANVAS_HEIGHT = 96;

/** Gap between bars in CSS pixels. */
const BAR_GAP = 2;

/** Minimum bar height so bars are always slightly visible. */
const MIN_BAR_HEIGHT = 2;

/**
 * Smoothing — bars rise/fall toward their target using exponential easing.
 * Higher = smoother & slower. Separate rise/fall speeds create a cava-like
 * feel where bars jump up quickly but sink down gently.
 */
const RISE_SPEED = 0.5; // fast attack (lower = faster)
const FALL_SPEED = 0.97; // slow decay  (higher = slower, gravity-like)

// ---------------------------------------------------------------------------
// Bin-to-bar mapping (computed once)
// ---------------------------------------------------------------------------

let cachedMapping: number[][] | null = null;
let cachedBinCount = 0;

function binToBarMapping(binCount: number, barCount: number): number[][] {
  const mapping: number[][] = [];
  for (let i = 0; i < barCount; i++) {
    const low = Math.floor(
      (binCount * (Math.pow(barCount, i / barCount) - 1)) / (barCount - 1),
    );
    const high = Math.floor(
      (binCount * (Math.pow(barCount, (i + 1) / barCount) - 1)) / (barCount - 1),
    );
    const indices: number[] = [];
    for (let j = low; j <= Math.min(high, binCount - 1); j++) {
      indices.push(j);
    }
    if (indices.length === 0) indices.push(low);
    mapping.push(indices);
  }
  return mapping;
}

function getMapping(binCount: number): number[][] {
  if (!cachedMapping || cachedBinCount !== binCount) {
    cachedMapping = binToBarMapping(binCount, BAR_COUNT);
    cachedBinCount = binCount;
  }
  return cachedMapping;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Soften a color — desaturate slightly and adjust lightness for comfort. */
function softenColor(c: RGBColor, lightness: number = 0.15): RGBColor {
  // Mix toward a gray midpoint to desaturate, then nudge lighter
  const gray = (c[0] + c[1] + c[2]) / 3;
  const desat = 0.2; // 20% desaturation
  return [
    Math.min(255, Math.round(c[0] * (1 - desat) + gray * desat + lightness * 255)),
    Math.min(255, Math.round(c[1] * (1 - desat) + gray * desat + lightness * 255)),
    Math.min(255, Math.round(c[2] * (1 - desat) + gray * desat + lightness * 255)),
  ];
}

function lerpColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudioVisualizerProps {
  primaryColor?: RGBColor;
  secondaryColor?: RGBColor;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AudioVisualizer({
  primaryColor,
  secondaryColor,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Per-bar smoothed heights (normalized 0-1), persist across frames
  const smoothedRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  // Store colors in ref to avoid re-creating the draw closure
  const colorsRef = useRef<{ primary: RGBColor; secondary: RGBColor }>({
    primary: [255, 255, 255],
    secondary: [255, 255, 255],
  });

  // Update colors ref when props change
  useEffect(() => {
    colorsRef.current = {
      primary: primaryColor ? softenColor(primaryColor) : [255, 255, 255],
      secondary: secondaryColor ? softenColor(secondaryColor) : [255, 255, 255],
    };
  }, [primaryColor, secondaryColor]);

  useEffect(() => {
    const smoothed = smoothedRef.current;

    function draw() {
      const canvas = canvasRef.current;
      const analyser = getAnalyserNode();

      if (!canvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Resize canvas to match container (DPR-aware)
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const newWidth = Math.round(rect.width * dpr);
        const newHeight = Math.round(CANVAS_HEIGHT * dpr);

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          canvas.width = newWidth;
          canvas.height = newHeight;
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Get FFT values with dB scaling and frequency compensation
      let rawValues: Float32Array | null = null;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const mapping = getMapping(analyser.frequencyBinCount);
        rawValues = new Float32Array(BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
          const bins = mapping[i];

          // Use peak (max) value in each bin group, not average.
          // This preserves the spiky, varied character like cava/kurve,
          // instead of smoothing treble peaks into nothing.
          let peak = 0;
          for (const idx of bins) {
            if (data[idx] > peak) peak = data[idx];
          }

          // Power-curve compression: sqrt-ish to tame bass without killing it
          const linear = peak / 255;
          const compressed = Math.pow(linear, 0.55);

          // Frequency tilt: gentle bass cut + treble boost
          const t = i / (BAR_COUNT - 1);
          const freqTilt = 0.75 + 0.5 * t;

          rawValues[i] = Math.min(1, compressed * freqTilt);
        }
      }

      // Apply smoothing — fast rise, slow fall (cava-like)
      for (let i = 0; i < BAR_COUNT; i++) {
        const target = rawValues ? rawValues[i] : 0;
        const current = smoothed[i];
        if (target > current) {
          // Rising — faster interpolation
          smoothed[i] = current + (target - current) * (1 - RISE_SPEED);
        } else {
          // Falling — slow gravity-like decay
          smoothed[i] = current * FALL_SPEED + target * (1 - FALL_SPEED);
        }
        // Clamp tiny values to zero to avoid endless micro-animation
        if (smoothed[i] < 0.005) smoothed[i] = 0;
      }

      drawBars(ctx, w, h, smoothed, colorsRef.current);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full" style={{ height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: CANVAS_HEIGHT, display: 'block' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  smoothed: Float32Array,
  colors: { primary: RGBColor; secondary: RGBColor },
): void {
  const dpr = window.devicePixelRatio || 1;
  const gap = BAR_GAP * dpr;
  const minH = MIN_BAR_HEIGHT * dpr;
  const totalGap = gap * (BAR_COUNT - 1);
  const barWidth = Math.max(1, (width - totalGap) / BAR_COUNT);

  for (let i = 0; i < BAR_COUNT; i++) {
    const norm = smoothed[i];
    const barH = Math.max(minH, norm * height);

    const x = i * (barWidth + gap);
    const y = height - barH;

    // Gradient: primary color on left bars → secondary on right bars
    const t = i / (BAR_COUNT - 1);
    const color = lerpColor(colors.primary, colors.secondary, t);

    // Alpha varies with amplitude — min 0.35 so bars are always softly visible
    const alpha = 0.35 + 0.65 * norm;
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

    const radius = Math.min(barWidth / 2, 3 * dpr);
    roundedRect(ctx, x, y, barWidth, barH, radius);
  }
}

/** Draw a rectangle with rounded top corners. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}
