/**
 * Cross-platform haptic feedback.
 *
 * Uses the Web Vibration API. Works on Android Chrome/Firefox; silently
 * no-ops on iOS Safari (Apple has never implemented the API). The iOS
 * `<input switch>` workaround has been removed — it was unreliable in our
 * context and we'll revisit haptics later with a different approach.
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

const DURATIONS: Record<HapticIntensity, number> = {
  selection: 4,
  light: 8,
  medium: 14,
  heavy: 22,
};

export function haptic(intensity: HapticIntensity = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(DURATIONS[intensity]); } catch { /* silently ignore */ }
}
