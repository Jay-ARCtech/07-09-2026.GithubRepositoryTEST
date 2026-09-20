import { spawnEnemy } from "./enemies.js";
import { spawnBoss, BOSS_TYPES } from "./bosses.js";
import { spawnChest, spawnOverdrive } from "./pickups.js";
import { TAU } from "../engine/utils.js";

const BOSS_IDS = Object.keys(BOSS_TYPES);
const BOSS_INTERVAL = 4.5 * 60;

function weightTableForTime(t) {
  if (t < 60) return { grunt: 70, runner: 30 };
  if (t < 150) return { grunt: 50, runner: 25, tank: 15, shooter: 10 };
  if (t < 300) return { grunt: 35, runner: 20, tank: 20, shooter: 15, splitter: 10 };
  return { grunt: 25, runner: 20, tank: 20, shooter: 20, splitter: 15 };
}

function weightedPick(rng, table) {
  const entries = Object.entries(table);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.range(0, total);
  for (const [k, w] of entries) {
    if (r < w) return k;
    r -= w;
  }
  return entries[0][0];
}

function spawnBatch(world, player) {
  const table = weightTableForTime(world.time);
  // Fractional ramp with probabilistic rounding, rather than a stepped
  // Math.floor, so the spawn rate climbs smoothly instead of visibly
  // doubling the instant a 25s bucket boundary is crossed (verified by
  // playtest: the old stepped version produced a sharp, unfair difficulty
  // spike right around the one-minute mark).
  const budgetFloat = Math.min(6, 1 + world.time / 45);
  const budget = Math.floor(budgetFloat) + (world.rng.chance(budgetFloat % 1) ? 1 : 0);
  for (let i = 0; i < budget; i++) {
    const type = weightedPick(world.rng, table);
    const ang = world.rng.range(0, TAU);
    const r = world.rng.range(650, 850);
    spawnEnemy(world, type, player.x + Math.cos(ang) * r, player.y + Math.sin(ang) * r);
  }
}

export function updateDirector(world, dt, player) {
  world.time += dt;
  world.difficulty = world.time / 60;

  world._spawnAccum = (world._spawnAccum || 0) + dt;
  const interval = Math.max(0.4, 1.2 - world.time / 300);
  if (world._spawnAccum >= interval && !world.bossActive) {
    world._spawnAccum = 0;
    spawnBatch(world, player);
  }

  if (!world.bossActive && world.time >= world.nextBossAt) {
    const idx = world.bossesKilled % BOSS_IDS.length;
    spawnBoss(world, BOSS_IDS[idx]);
    world.nextBossAt = world.time + BOSS_INTERVAL;
  }

  world._chestAccum = (world._chestAccum || 0) + dt;
  if (world._chestAccum >= 45) {
    world._chestAccum = 0;
    const ang = world.rng.range(0, TAU);
    spawnChest(world, player.x + Math.cos(ang) * 220, player.y + Math.sin(ang) * 220);
  }

  world._overdriveAccum = (world._overdriveAccum || 0) + dt;
  if (world._overdriveAccum >= 75) {
    world._overdriveAccum = 0;
    const ang = world.rng.range(0, TAU);
    spawnOverdrive(world, player.x + Math.cos(ang) * 260, player.y + Math.sin(ang) * 260);
  }
}
