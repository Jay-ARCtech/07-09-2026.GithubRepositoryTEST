import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  angleDistance,
  clamp,
  damp,
  lerp,
  normAngle,
  remap,
  rotateToward,
  TAU,
  wrapAngle,
} from '../src/engine/math';

describe('angle helpers', () => {
  it('wraps into [-PI, PI)', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(TAU)).toBeCloseTo(0);
    // A half-turn is equidistant either way; this implementation resolves it
    // to -PI, consistently in both directions.
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
    for (let i = 0; i < 500; i++) {
      const v = wrapAngle((i / 500) * TAU * 4 - TAU * 2);
      expect(v).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(v).toBeLessThan(Math.PI + 1e-9);
    }
  });

  it('normalises into [0, TAU)', () => {
    expect(normAngle(-0.5)).toBeCloseTo(TAU - 0.5);
    expect(normAngle(TAU + 0.5)).toBeCloseTo(0.5);
    expect(normAngle(0)).toBe(0);
  });

  it('takes the short way round', () => {
    // 0.1 rad past the wrap point is 0.2 away from 0.1 rad before it, not TAU-0.2.
    expect(angleDelta(TAU - 0.1, 0.1)).toBeCloseTo(0.2, 6);
    expect(angleDelta(0.1, TAU - 0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDistance(TAU - 0.1, 0.1)).toBeCloseTo(0.2, 6);
  });

  it('never reports a distance greater than PI', () => {
    for (let i = 0; i < 400; i++) {
      const a = (i / 400) * TAU * 3 - TAU;
      const b = ((i * 7) / 400) * TAU * 2;
      expect(angleDistance(a, b)).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  it('rotates toward a target without overshooting', () => {
    expect(rotateToward(0, 1, 0.25)).toBeCloseTo(0.25);
    // A step larger than the gap snaps exactly onto the target.
    expect(rotateToward(0, 0.1, 5)).toBeCloseTo(0.1);
    // Short way around the wrap point.
    expect(rotateToward(TAU - 0.1, 0.1, 0.05)).toBeCloseTo(TAU - 0.05, 5);
  });
});

describe('numeric helpers', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('lerps and remaps', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
    expect(remap(-5, 0, 10, 100, 200)).toBe(100);
    expect(remap(50, 0, 10, 100, 200)).toBe(200);
  });

  it('damps frame-rate independently', () => {
    // Stepping 1 second as 1x1s, 2x0.5s or 100x0.01s must land in the same
    // place - this is what stops the game feeling different at 60 vs 120fps.
    const once = damp(0, 100, 3, 1);

    let twice = 0;
    for (let i = 0; i < 2; i++) twice = damp(twice, 100, 3, 0.5);

    let many = 0;
    for (let i = 0; i < 100; i++) many = damp(many, 100, 3, 0.01);

    expect(twice).toBeCloseTo(once, 6);
    expect(many).toBeCloseTo(once, 6);
  });
});
