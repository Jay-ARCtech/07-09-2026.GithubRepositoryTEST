import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/engine/rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 200; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const av = Array.from({ length: 20 }, () => a.next());
    const bv = Array.from({ length: 20 }, () => b.next());
    expect(av).not.toEqual(bv);
  });

  it('stays in [0, 1)', () => {
    const r = new Rng(9876);
    for (let i = 0; i < 20000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('survives a zero seed', () => {
    const r = new Rng(0);
    const v = r.next();
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });

  it('int() is inclusive at both ends and never escapes the range', () => {
    const r = new Rng(555);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it('weighted() respects weights and skips zero-weight entries', () => {
    const r = new Rng(31337);
    const items = [
      { id: 'never', w: 0 },
      { id: 'rare', w: 1 },
      { id: 'common', w: 9 },
    ];
    const counts: Record<string, number> = { never: 0, rare: 0, common: 0 };
    for (let i = 0; i < 20000; i++) counts[r.weighted(items, (x) => x.w).id]!++;

    expect(counts['never']).toBe(0);
    // 90/10 split, generous tolerance for sampling noise.
    expect(counts['common']! / 20000).toBeGreaterThan(0.86);
    expect(counts['common']! / 20000).toBeLessThan(0.94);
  });

  it('weighted() falls back cleanly when every weight is zero', () => {
    const r = new Rng(7);
    const picked = r.weighted([{ w: 0 }, { w: 0 }], (x) => x.w);
    expect(picked).toBeDefined();
  });

  it('shuffle is a permutation and is seed-stable', () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng(42).shuffle([...base]);
    const b = new Rng(42).shuffle([...base]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(base);
  });

  it('pick throws on an empty list rather than returning undefined', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it('hashString is stable and well distributed enough for daily seeds', () => {
    expect(hashString('2026-09-20')).toBe(hashString('2026-09-20'));
    expect(hashString('2026-09-20')).not.toBe(hashString('2026-09-21'));
    const seen = new Set<number>();
    for (let d = 1; d <= 28; d++) {
      seen.add(hashString(`2026-02-${String(d).padStart(2, '0')}`));
    }
    expect(seen.size).toBe(28);
  });
});
