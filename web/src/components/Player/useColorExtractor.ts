import { useState, useEffect, useRef } from 'react';

/** RGB color tuple. */
export type RGBColor = [number, number, number];

/**
 * Linearize a single sRGB channel value (0–255) to linear-light (0–1).
 * Per the WCAG 2.x relative luminance specification.
 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute WCAG relative luminance of an RGB color.
 * Returns a value between 0 (black) and 1 (white).
 */
export function relativeLuminance(color: RGBColor): number {
  return (
    0.2126 * linearize(color[0]) +
    0.7152 * linearize(color[1]) +
    0.0722 * linearize(color[2])
  );
}

/** Darken a color by mixing it toward black. */
export function darkenColor(c: RGBColor, amount: number = 0.35): RGBColor {
  return [
    Math.round(c[0] * (1 - amount)),
    Math.round(c[1] * (1 - amount)),
    Math.round(c[2] * (1 - amount)),
  ];
}

/** Default fallback colors when extraction fails. */
const FALLBACK_COLORS: RGBColor[] = [
  [60, 60, 80],
  [40, 40, 60],
  [80, 60, 80],
];

/**
 * Simple color quantization: bucket each pixel into reduced color space,
 * count occurrences, and return the top N most frequent buckets.
 */
function extractDominantColors(
  imageData: ImageData,
  count: number,
): RGBColor[] {
  const { data } = imageData;
  const bucketShift = 5; // reduce to 8 buckets per channel (256 >> 5 = 8)
  const buckets = new Map<string, { sum: [number, number, number]; count: number }>();

  // Sample every pixel of the (already small) canvas
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip mostly transparent pixels
    if (a < 128) continue;

    // Skip very dark pixels (near-black backgrounds)
    if (r + g + b < 30) continue;

    // Skip very light pixels (near-white)
    if (r > 240 && g > 240 && b > 240) continue;

    const key = `${r >> bucketShift},${g >> bucketShift},${b >> bucketShift}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sum[0] += r;
      bucket.sum[1] += g;
      bucket.sum[2] += b;
      bucket.count++;
    } else {
      buckets.set(key, { sum: [r, g, b], count: 1 });
    }
  }

  // Sort by count descending, take top N
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);

  const result: RGBColor[] = [];
  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    const { sum, count: c } = sorted[i];
    result.push([
      Math.round(sum[0] / c),
      Math.round(sum[1] / c),
      Math.round(sum[2] / c),
    ]);
  }

  // Pad with fallback if not enough colors extracted
  while (result.length < count) {
    result.push(FALLBACK_COLORS[result.length % FALLBACK_COLORS.length]);
  }

  return result;
}

/**
 * Hook that extracts dominant colors from an image URL.
 *
 * Draws the image to a small offscreen canvas, samples pixel data, and
 * returns 2-3 dominant RGB colors. Returns fallback colors immediately
 * and updates when extraction completes.
 */
export function useColorExtractor(
  imageUrl: string | null,
  count: number = 3,
): RGBColor[] {
  const [colors, setColors] = useState<RGBColor[]>(FALLBACK_COLORS);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColors(FALLBACK_COLORS);
      prevUrl.current = null;
      return;
    }

    // Don't re-extract for the same URL
    if (imageUrl === prevUrl.current) return;
    prevUrl.current = imageUrl;

    let cancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;

      try {
        // Draw to a small canvas for performance
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setColors(FALLBACK_COLORS);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const extracted = extractDominantColors(imageData, count);
        if (!cancelled) {
          setColors(extracted);
        }
      } catch {
        // Canvas tainted or other error — use fallback
        if (!cancelled) {
          setColors(FALLBACK_COLORS);
        }
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setColors(FALLBACK_COLORS);
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, count]);

  return colors;
}
