/** Pure math helpers. No DOM, no state - safe to unit test directly. */

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential approach. `rate` is the fraction of the
 * remaining distance covered per second, so the result is identical whether the
 * caller runs at 60fps or 120fps.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Wraps an angle into [-PI, PI). An exact half-turn resolves to -PI. */
export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

/** Wraps an angle into [0, TAU). */
export function normAngle(a: number): number {
  const x = a % TAU;
  return x < 0 ? x + TAU : x;
}

/** Shortest signed delta from angle `a` to angle `b`. */
export function angleDelta(a: number, b: number): number {
  return wrapAngle(b - a);
}

/** Absolute shortest distance between two angles, always in [0, PI]. */
export function angleDistance(a: number, b: number): number {
  return Math.abs(wrapAngle(b - a));
}

/**
 * Rotates `current` toward `target` by at most `maxStep` radians, taking the
 * short way around.
 */
export function rotateToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return normAngle(target);
  return normAngle(current + Math.sign(d) * maxStep);
}

export function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

// --- Easing -----------------------------------------------------------------
// Used for menu transitions, pop animations and hit reactions. Keeping them
// here (rather than inline) means the feel of the whole game is tunable in one
// place.

export const ease = {
  outQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  inQuad: (t: number): number => t * t,
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = TAU / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  /** Fast attack, slow decay - the shape most "pop" effects want. */
  pop: (t: number): number => Math.sin(clamp01(t) * Math.PI),
};

/** Maps v from [inMin,inMax] onto [outMin,outMax], clamped. */
export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = clamp01((v - inMin) / (inMax - inMin || 1));
  return outMin + (outMax - outMin) * t;
}

/** True when a point lies inside a circle. */
export function pointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** True when a point lies inside an axis-aligned rect. */
export function pointInRect(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
