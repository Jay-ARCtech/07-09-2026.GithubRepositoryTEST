import { spawnEnemy, spawnMimicEnemy } from "./enemies.js";
import { spawnBoss, BOSS_TYPES } from "./bosses.js";
import { spawnChest, spawnOverdrive } from "./pickups.js";
import { TAU } from "../engine/utils.js";

const BOSS_IDS = Object.keys(BOSS_TYPES);
const BOSS_INTERVAL = 4.5 * 60;

// Every archetype is reachable within the first 2.5 minutes -- the old
// table gated roughly half the roster (sniper, launcher, heavyGunner,
// siegeCannon, summoner, engineer) behind an 8-minute wall, so a typical
// run never saw them. Tougher/rarer archetypes still start at a lower
// weight than the basics and grow in, but nothing is fully locked out of
// an early run anymore.
export function weightTableForTime(t) {
  if (t < 30) return { grunt: 55, runner: 25, shooter: 12, skirmisher: 8 };
  if (t < 75)
    return { grunt: 34, runner: 18, tank: 10, shooter: 14, skirmisher: 10, splitter: 8, gatling: 8, healer: 4, mimic: 4 };
  if (t < 150)
    return {
      grunt: 22,
      runner: 14,
      tank: 12,
      shooter: 10,
      skirmisher: 8,
      splitter: 8,
      gatling: 8,
      sniper: 6,
      launcher: 6,
      heavyGunner: 6,
      healer: 5,
      summoner: 5,
      engineer: 5,
      mimic: 6,
    };
  if (t < 300)
    return {
      grunt: 16,
      runner: 12,
      tank: 12,
      shooter: 9,
      skirmisher: 7,
      splitter: 8,
      gatling: 9,
      sniper: 8,
      launcher: 7,
      heavyGunner: 8,
      siegeCannon: 4,
      healer: 6,
      summoner: 6,
      engineer: 6,
      mimic: 8,
    };
  return {
    grunt: 14,
    runner: 10,
    tank: 12,
    shooter: 9,
    skirmisher: 7,
    splitter: 8,
    gatling: 9,
    sniper: 9,
    launcher: 8,
    heavyGunner: 8,
    siegeCannon: 6,
    healer: 6,
    summoner: 6,
    engineer: 6,
    mimic: 9,
  };
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
    const x = player.x + Math.cos(ang) * r,
      y = player.y + Math.sin(ang) * r;
    if (type === "mimic") spawnMimicEnemy(world, x, y, player);
    else spawnEnemy(world, type, x, y);
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
    spawnBoss(world, BOSS_IDS[idx], { player });
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
