// The mutable per-run singleton: every gameplay system reads/writes this
// instead of passing giant argument lists around. Reset fully on new run.
import { RNG, seedFromDateUTC } from "../engine/utils.js";

let nextId = 1;
export function allocId() {
  return nextId++;
}

const BULLET_POOL_SIZE = 500;
const ARENA_RADIUS = 1600; // bounded circular arena keeps pacing tight

export function createWorld(seedOverride = null, mode = "survival") {
  const seed = seedOverride ?? (Date.now() ^ 0x9e3779b9) >>> 0;
  return {
    rng: new RNG(seed),
    seed,
    mode, // "survival" | "war"
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
    enemies: [], // hostile units AND player allies, distinguished by .faction / .isAlly
    hazards: [],
    bullets: Array.from({ length: BULLET_POOL_SIZE }, () => ({ active: false })),
    pickups: [],
    chestPending: null,
    lastSpawnAt: 0,
    nextBossAt: 4.5 * 60,
    totalBossesForVictory: 4,
    overdriveUntil: 0,
    // war mode only:
    empires: [],
    // Ally permadeath: once a slot dies it stays empty (no auto-respawn)
    // until revived by a "Revive Ally" card or the Emergency Revive action.
    allyDeadCount: { drone: 0, medic: 0, vanguard: 0 },
  };
}

// Two factions are hostile only if one of them is "player" (the player and
// every player-summoned ally share faction "player"). Non-player factions
// -- "horde", and each War Mode empire's "empireN" -- are never hostile to
// one another, so multiple empires never fight each other; they only ever
// target the player and the player's allies.
export function isHostileFaction(a, b) {
  return a !== b && (a === "player" || b === "player");
}

// Faction-aware targeting shared by enemy AI, boss AI, and ally AI. Returns
// the nearest active unit (the player, or any world.enemies entry) that is
// hostile to `unit.faction` per isHostileFaction, within maxRange. This one
// function is what makes cross-faction combat (allies vs horde, every
// empire vs the player in War Mode) fall out of a single code path instead
// of needing bespoke AI per matchup.
export function findNearestHostile(world, unit, player, maxRange = Infinity) {
  let best = null;
  let bestD = maxRange * maxRange;
  if (player && player.hp > 0 && isHostileFaction(unit.faction, player.faction)) {
    const d = (player.x - unit.x) ** 2 + (player.y - unit.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = player;
    }
  }
  for (const o of world.enemies) {
    if (o === unit || !o.active || !isHostileFaction(unit.faction, o.faction)) continue;
    const d = (o.x - unit.x) ** 2 + (o.y - unit.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

export function spawnHazard(world, x, y, opts) {
  world.hazards.push({
    id: allocId(),
    active: true,
    x,
    y,
    radius: opts.radius ?? 90,
    dps: opts.dps ?? 8,
    slowMult: opts.slowMult ?? 0.55,
    color: opts.color ?? "#f472b6",
    createdAt: world.time,
    expiresAt: world.time + (opts.duration ?? 6),
  });
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
    hostile: opts.hostile ?? false,
    // Every bullet is "owned" by a faction; collision resolution hits
    // anything whose faction differs from this, rather than hardcoding
    // "player bullets hit world.enemies" -- that's what lets ally-fired
    // shots, horde shots, and (in War Mode) empire-vs-empire shots all
    // reuse the same collision code.
    sourceFaction: opts.sourceFaction ?? (opts.hostile ? "horde" : "player"),
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
