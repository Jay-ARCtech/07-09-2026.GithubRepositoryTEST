/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * Every run - including the Daily Challenge - is driven by a seed, so the same
 * seed always produces the same wave layout. That is what makes the daily
 * fair for everyone and what makes the simulation reproducible in tests.
 *
 * This is NOT cryptographically secure and is never used for anything that
 * needs to be: no keys, no tokens, no secrets.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to a 32-bit unsigned integer so any input (including negatives and
    // floats) yields a valid, stable starting state.
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniform pick. Throws on an empty list so bugs surface loudly in tests. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[this.int(0, items.length - 1)]!;
  }

  /**
   * Weighted pick. Entries with weight <= 0 are skipped. Falls back to the last
   * positive-weight entry if floating point drift overshoots the total.
   */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const it of items) {
      const w = weightOf(it);
      if (w > 0) total += w;
    }
    if (total <= 0) return this.pick(items);

    let roll = this.next() * total;
    let last: T | undefined;
    for (const it of items) {
      const w = weightOf(it);
      if (w <= 0) continue;
      last = it;
      roll -= w;
      if (roll <= 0) return it;
    }
    return last ?? this.pick(items);
  }

  /** In-place Fisher-Yates shuffle, deterministic for a given seed. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = items[i]!;
      items[i] = items[j]!;
      items[j] = a;
    }
    return items;
  }

  /** Snapshot / restore, used to fork sub-streams without disturbing the main one. */
  fork(salt: number): Rng {
    return new Rng((this.state ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
  }
}

/** Stable 32-bit string hash (FNV-1a). Used to turn a date into a daily seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
