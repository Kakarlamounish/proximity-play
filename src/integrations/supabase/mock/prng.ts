// Deterministic pseudo-random number generator used for seed data generation.
//
// We deliberately avoid Math.random() anywhere in the seed generator so that
// every fresh `npm run dev`/`npm run build` with VITE_USE_MOCK_BACKEND=true
// produces byte-for-byte identical seed data. This makes QA bug reports
// reproducible ("row #214 in bubbles" means the same bubble every time).
//
// mulberry32 is a small, fast, well-distributed 32-bit PRNG. It is NOT
// cryptographically secure and must never be used for anything security
// sensitive — it exists purely to make fixture data deterministic.

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Float in [min, max). */
export function randFloat(rng: RNG, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** True with the given probability (0..1). */
export function chance(rng: RNG, probability: number): boolean {
  return rng() < probability;
}

/** Pick one element from a non-empty array. */
export function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick `count` distinct elements from an array (no replacement). */
export function pickMany<T>(rng: RNG, arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

/** Fisher-Yates shuffle using the seeded RNG (does not mutate input). */
export function shuffle<T>(rng: RNG, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic UUID-v4-shaped string derived from the seeded RNG. */
export function seededUuid(rng: RNG): string {
  const hex = () => Math.floor(rng() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, hex).join('');
  return `${s(8)}-${s(4)}-4${s(3)}-${(8 + Math.floor(rng() * 4)).toString(16)}${s(3)}-${s(12)}`;
}

/** Non-deterministic id for rows created at runtime (not part of the seed). */
export function runtimeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers/SSR).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
