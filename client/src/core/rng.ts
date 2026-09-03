/**
 * Seeded randomness. The app owns one global stream (so `utils/math`'s
 * randomBetween & friends are reproducible for a given seed) plus one
 * independent stream per plot instance, derived from the global seed.
 */
export type Rng = {
  /** [0,1) */
  random: () => number
  between: (a: number, b: number) => number
  int: (n: number) => number
  bool: (p?: number) => boolean
  pick: <T>(list: T[]) => T
  /** normal-ish, mean 0 sd 1 */
  gauss: () => number
  fork: (salt?: string | number) => Rng
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeRng(seed: number | string): Rng {
  const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0
  const next = mulberry32(s)
  const rng: Rng = {
    random: next,
    between: (a, b) => next() * (b - a) + a,
    int: n => Math.floor(next() * n),
    bool: (p = 0.5) => next() < p,
    pick: list => list[Math.floor(next() * list.length)],
    gauss: () => {
      // Box-Muller
      const u = 1 - next()
      const v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    fork: (salt = '') => makeRng(`${s}:${salt}`),
  }
  return rng
}

/** The stream shared by utils/* helpers. Reseeded by the Sketch on rebuild. */
let global: Rng = makeRng(1)

export function seedGlobalRng(seed: number | string) {
  global = makeRng(seed)
}
/** Drop-in replacement for Math.random(), but seeded. */
export const rnd = () => global.random()
export const globalRng = () => global
