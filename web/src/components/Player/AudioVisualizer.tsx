import { useEffect, useRef } from 'react';

import { getAnalyserNode } from './audioAnalyser.ts';

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

// ---------------------------------------------------------------------------
// Module-level cache for the bin-to-bar mapping (computed once).
// ---------------------------------------------------------------------------

let cachedMapping: number[][] | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map FFT frequency bins into `BAR_COUNT` visual bars using a logarithmic
 * scale.  Low frequencies get fewer bins (they're musically wider) and high
 * frequencies get more, matching human perception.
 */
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

/**
 * Return the cached mapping, building it on first call.
 */
function getMapping(binCount: number): number[][] {
  if (!cachedMapping) {
    cachedMapping = binToBarMapping(binCount, BAR_COUNT);
  }
  return cachedMapping;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      const analyser = getAnalyserNode();

      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resize canvas to match container (accounts for device pixel ratio).
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

      if (!analyser) {
        drawBars(ctx, w, h, null, null);
      } else {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const mapping = getMapping(analyser.frequencyBinCount);
        drawBars(ctx, w, h, data, mapping);
      }

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
  data: Uint8Array | null,
  mapping: number[][] | null,
): void {
  const dpr = window.devicePixelRatio || 1;
  const gap = BAR_GAP * dpr;
  const minH = MIN_BAR_HEIGHT * dpr;
  const totalGap = gap * (BAR_COUNT - 1);
  const barWidth = Math.max(1, (width - totalGap) / BAR_COUNT);

  for (let i = 0; i < BAR_COUNT; i++) {
    let value = 0;

    if (data && mapping) {
      const bins = mapping[i];
      let sum = 0;
      for (const idx of bins) {
        sum += data[idx];
      }
      value = sum / bins.length;
    }

    const norm = value / 255;
    const barH = Math.max(minH, norm * height);

    const x = i * (barWidth + gap);
    const y = height - barH;

    // White bars, alpha varies with amplitude.
    const alpha = 0.3 + 0.7 * norm;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

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
