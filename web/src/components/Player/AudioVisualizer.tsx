import { useEffect, useRef } from 'react';

import { getAnalyserNode } from './audioAnalyser.ts';
import type { RGBColor } from './useColorExtractor.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * ============================== TUNING GUIDE ==============================
 *
 * Signal flow (per frame, per bar):
 *
 *   FFT bin data (0-255)
 *     → pick PEAK value in the bar's bin group
 *     → normalize to 0..1           linear = peak / 255
 *     → subtract NOISE_FLOOR        floored = (linear - floor) / (1 - floor), or 0
 *     → apply EXPANSION_POWER       expanded = floored ^ power
 *     → apply FREQ_TILT             final = expanded * (TILT_LOW + (TILT_HIGH-TILT_LOW) * barIndex/count)
 *     → clamp to [0, 1]
 *     → per-bar smoothing           if rising: lerp with RISE_SPEED
 *                                   if falling: lerp with FALL_SPEED
 *     → draw bar                    height = final * canvasHeight
 *                                   alpha  = BAR_ALPHA_MIN + (1-BAR_ALPHA_MIN) * final
 *
 * How each knob affects the look:
 *
 *   NOISE_FLOOR      Higher → deeper valleys between peaks (quiet bins → 0).
 *                     0 = no cutoff, 0.2 = aggressive. Start: 0.12
 *
 *   EXPANSION_POWER  >1 = contrast UP (loud louder, quiet quieter).
 *                     <1 = compression (everything similar height).
 *                     1.0 = linear (no change). Start: 1.4
 *
 *   TILT_LOW / HIGH  Multiplier for the leftmost / rightmost bar.
 *                     Increase HIGH to boost treble, decrease LOW to cut bass.
 *                     Both 1.0 = flat. Start: 0.8 / 1.2
 *
 *   RISE_SPEED       How fast bars jump UP to a new peak.
 *                     0 = instant, 1 = frozen. Start: 0.5
 *
 *   FALL_SPEED       How slowly bars sink DOWN after a peak.
 *                     0 = instant drop, 0.99 = very slow gravity. Start: 0.97
 *
 * ========================================================================== */

/** Total number of visual bars. More = finer detail, fewer = chunkier. */
const BAR_COUNT = 48;

/** Canvas height in CSS pixels. */
const CANVAS_HEIGHT = 96;

/** Gap between bars in CSS pixels. */
const BAR_GAP = 2;

/** Minimum bar height so silent bars are still faintly visible. */
const MIN_BAR_HEIGHT = 2;

/**
 * Noise floor — values below this threshold are zeroed out.
 * Creates visible "valleys" between active frequency peaks.
 * Range: 0 (disabled) .. ~0.25 (aggressive).
 */
const NOISE_FLOOR = 0.12;

/**
 * Expansion power — controls contrast between loud and quiet.
 *   < 1  → compression (flattens everything toward similar height)
 *   = 1  → linear (raw values)
 *   > 1  → expansion (peaks go higher, quiet sinks lower)
 *
 * Formula: output = input ^ EXPANSION_POWER
 *   pow=0.5: input 0.3 → 0.55 (compressed)
 *   pow=1.0: input 0.3 → 0.30 (linear)
 *   pow=1.4: input 0.3 → 0.14 (expanded — valleys deepen)
 *   pow=2.0: input 0.3 → 0.09 (very deep valleys)
 */
const EXPANSION_POWER = 1.4;

/**
 * Frequency tilt — multiplier applied per bar, linearly from
 * TILT_LOW (bar 0, lowest bass) to TILT_HIGH (last bar, highest treble).
 *
 * Use this to rebalance if bass dominates or treble is invisible.
 *   Both 1.0 = flat (no correction)
 *   LOW=0.6, HIGH=1.4 = strong bass cut + treble boost
 */
const TILT_LOW = 0.8;
const TILT_HIGH = 1.2;

/**
 * Automatic Gain Control (AGC) — normalizes bars to the recent peak level
 * so the visualizer looks similar regardless of volume.
 *
 *   AGC_ATTACK:  How fast the gain adapts UP when signal gets louder.
 *                0 = instant, 0.99 = very slow. Start: 0.3
 *   AGC_RELEASE: How fast the gain adapts DOWN when signal gets quieter.
 *                0 = instant, 0.99 = very slow (holds peaks longer). Start: 0.985
 *   AGC_MIN:     Minimum reference level (prevents divide-by-near-zero
 *                during silence). Start: 0.05
 */
const AGC_ATTACK = 0.3;
const AGC_RELEASE = 0.985;
const AGC_MIN = 0.05;

/**
 * Smoothing — how fast bars track changes (exponential easing).
 *   RISE: 0 = instant jump up, 0.9 = very sluggish rise.
 *   FALL: 0 = instant drop, 0.99 = very slow gravity decay.
 *
 * Formula (each frame):
 *   rising:  smoothed = current + (target - current) * (1 - RISE_SPEED)
 *   falling: smoothed = current * FALL_SPEED + target * (1 - FALL_SPEED)
 */
const RISE_SPEED = 0.5;
const FALL_SPEED = 0.97;

/** Minimum alpha for drawn bars. Higher = quiet bars more visible. */
const BAR_ALPHA_MIN = 0.35;

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
  // AGC: tracked peak level for normalization (persists across frames)
  const agcPeakRef = useRef<number>(AGC_MIN);
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

          const linear = peak / 255;

          // 1) Noise floor → valleys between peaks
          const floored = linear > NOISE_FLOOR
            ? (linear - NOISE_FLOOR) / (1 - NOISE_FLOOR)
            : 0;

          // 2) Expansion → contrast between loud and quiet
          const expanded = Math.pow(floored, EXPANSION_POWER);

          // 3) Frequency tilt → bass/treble balance
          const t = i / (BAR_COUNT - 1);
          const tilt = TILT_LOW + (TILT_HIGH - TILT_LOW) * t;

          rawValues[i] = expanded * tilt;
        }

        // AGC: find current frame peak, update tracked reference level
        let framePeak = 0;
        for (let i = 0; i < BAR_COUNT; i++) {
          if (rawValues[i] > framePeak) framePeak = rawValues[i];
        }

        const prevPeak = agcPeakRef.current;
        if (framePeak > prevPeak) {
          // Signal got louder → adapt up quickly
          agcPeakRef.current = prevPeak + (framePeak - prevPeak) * (1 - AGC_ATTACK);
        } else {
          // Signal got quieter → release slowly (hold the peak)
          agcPeakRef.current = prevPeak * AGC_RELEASE + framePeak * (1 - AGC_RELEASE);
        }
        agcPeakRef.current = Math.max(agcPeakRef.current, AGC_MIN);

        // Normalize all bars by the tracked peak
        const ref = agcPeakRef.current;
        for (let i = 0; i < BAR_COUNT; i++) {
          rawValues[i] = Math.min(1, rawValues[i] / ref);
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

    const alpha = BAR_ALPHA_MIN + (1 - BAR_ALPHA_MIN) * norm;
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
