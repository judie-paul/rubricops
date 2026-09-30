/** Unweighted Cohen's kappa for paired ordinal labels; null when undefined. */
export function cohensKappa(
  pairs: readonly (readonly [number, number])[],
): number | null {
  if (!pairs.length) return null;
  const a = new Map<number, number>(),
    b = new Map<number, number>();
  let matches = 0;
  for (const [x, y] of pairs) {
    a.set(x, (a.get(x) ?? 0) + 1);
    b.set(y, (b.get(y) ?? 0) + 1);
    if (x === y) matches++;
  }
  const expected =
    [...a].reduce((sum, [key, n]) => sum + n * (b.get(key) ?? 0), 0) /
    pairs.length ** 2;
  return expected === 1
    ? null
    : (matches / pairs.length - expected) / (1 - expected);
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
export function rate(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}
export function sampled(id: string, seed = 42, percent = 25): boolean {
  let hash = seed >>> 0;
  for (const ch of id)
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash % 100 < percent;
}
