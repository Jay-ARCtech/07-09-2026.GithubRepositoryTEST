// The mutable per-run singleton: every gameplay system reads/writes this
// instead of passing giant argument lists around. Reset fully on new run.
import { RNG, seedFromDateUTC } from "../engine/utils.js";

let nextId = 1;
export function allocId() {
  return nextId++;
}

const BULLET_POOL_SIZE = 500;
const ARENA_RADIUS = 1600; // bounded circular arena keeps pacing tight

export function createWorld(seedOverride = null) {
  const seed = seedOverride ?? (Date.now() ^ 0x9e3779b9) >>> 0;
  return {
    rng: new RNG(seed),
    seed,
    arenaRadius: ARENA_RADIUS,
    time: 0,
    kills: 0,
    coresEarned: 0,
    difficulty: 0,
    bossActive: null,
    bossesKilled: 0,
    ended: false,
    victory: false,
    player: null,
    enemies: [],
    bullets: Array.from({ length: BULLET_POOL_SIZE }, () => ({ active: false })),
    pickups: [],
    chestPending: null,
    lastSpawnAt: 0,
    nextBossAt: 4.5 * 60,
    totalBossesForVictory: 4,
    overdriveUntil: 0,
  };
}

export function dailySeedToday() {
  return seedFromDateUTC(new Date());
}

export function spawnBullet(world, opts) {
  const b = world.bullets.find((b) => !b.active);
  if (!b) return null;
  Object.assign(b, {
    active: true,
    x: opts.x,
    y: opts.y,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    dmg: opts.dmg ?? 1,
    radius: opts.radius ?? 6,
    pierce: opts.pierce ?? 0,
    life: opts.life ?? 2,
    color: opts.color ?? "#7dd3fc",
    kind: opts.kind ?? "bolt",
    homing: opts.homing ?? false,
    turnRate: opts.turnRate ?? 4,
    aoeRadius: opts.aoeRadius ?? 0,
    chain: opts.chain ?? 0,
    crit: opts.crit ?? false,
    orbit: opts.orbit ?? null, // { angle, radius, speed } for attached orbiter blades
    dot: opts.dot ?? null,
    ownerHitCooldown: opts.ownerHitCooldown ?? null, // Map<enemyId, timeUntilNextHit> for continuous-contact weapons
  });
  b._hitSet = b._hitSet || new Set();
  b._hitSet.clear();
  return b;
}

export function clampToArena(world, x, y, margin = 0) {
  const r = world.arenaRadius - margin;
  const d = Math.hypot(x, y);
  if (d > r) {
    const s = r / d;
    return { x: x * s, y: y * s };
  }
  return { x, y };
}
