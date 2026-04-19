export const PALETTE = {
  bg: '#0b0d10',
  bg2: '#141820',
  bg3: '#1b2029',
  ink: '#ebe6d8',
  ink2: '#b6b0a0',
  mute: '#6f6a5f',
  line: '#242932',
  line2: '#343a44',
  sun: '#d9b25a',
  rose: '#c28b8b',
  sage: '#7b9585',
  lav: '#8a86a8',
  ochre: '#c19a52',
  sand: '#b8a88c',
  slate: '#6c7a85',
  teal: '#5a8a8a',
} as const;

const ORBIT_COLORS = [
  PALETTE.sage,
  PALETTE.slate,
  PALETTE.lav,
  PALETTE.ochre,
  PALETTE.rose,
  PALETTE.sand,
  PALETTE.teal,
];

export function orbitColorFor(seed: string | number): string {
  if (typeof seed === 'number') {
    return ORBIT_COLORS[((seed % ORBIT_COLORS.length) + ORBIT_COLORS.length) % ORBIT_COLORS.length];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = ((hash % ORBIT_COLORS.length) + ORBIT_COLORS.length) % ORBIT_COLORS.length;
  return ORBIT_COLORS[index];
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}
