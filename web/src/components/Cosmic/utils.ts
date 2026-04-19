/**
 * Convert a positive integer to Roman numerals.
 * Falls back to Arabic rendering for non-finite, ≤0, or > 3999 inputs.
 */
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 3999) return String(n);
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'],  [90, 'XC'],  [50, 'L'],  [40, 'XL'],
    [10, 'X'],   [9, 'IX'],   [5, 'V'],   [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let num = Math.floor(n);
  for (const [v, s] of map) {
    while (num >= v) { out += s; num -= v; }
  }
  return out;
}
