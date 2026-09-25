import { spawnEnemy, spawnMimicEnemy } from "./enemies.js";
import { spawnBoss, BOSS_TYPES } from "./bosses.js";
import { spawnChest, spawnOverdrive } from "./pickups.js";
import { TAU } from "../engine/utils.js";
import { DIFFICULTIES, getDifficultyMods } from "./difficulty.js";

const BOSS_IDS = Object.keys(BOSS_TYPES);
const BOSS_INTERVAL = 4.5 * 60;

// Kept as the direct "Hard" table for any existing caller/test that still
// imports weightTableForTime by name -- difficulty.js's DIFFICULTIES.hard
// is the canonical definition now; this just forwards to it.
export function weightTableForTime(t) {
  return DIFFICULTIES.hard.weightTableForTime(t);
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
  const mods = getDifficultyMods(world);
  const table = mods.weightTableForTime(world.time, world);
  // Fractional ramp with probabilistic rounding, rather than a stepped
  // Math.floor, so the spawn rate climbs smoothly instead of visibly
  // doubling the instant a 25s bucket boundary is crossed (verified by
  // playtest: the old stepped version produced a sharp, unfair difficulty
  // spike right around the one-minute mark). mods.spawnBudgetMult scales
  // the whole ramp for difficulties like Swarm (much higher) or Siege
  // (much lower) without needing their own copy of this curve.
  const budgetFloat = Math.min(6, 1 + world.time / 45) * mods.spawnBudgetMult;
  const budget = Math.floor(budgetFloat) + (world.rng.chance(budgetFloat % 1) ? 1 : 0);
  for (let i = 0; i < budget; i++) {
    // Clone difficulty replaces the weighted pick entirely -- every spawn
    // is a fresh snapshot of the player's current build, same as the
    // ordinary Mimic type but as the *only* thing that spawns.
    const type = mods.cloneMode ? "mimic" : weightedPick(world.rng, table);
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
  const mods = getDifficultyMods(world);

  world._spawnAccum = (world._spawnAccum || 0) + dt;
  const interval = Math.max(0.4, 1.2 - world.time / 300) * mods.spawnIntervalMult;
  if (world._spawnAccum >= interval && !world.bossActive) {
    world._spawnAccum = 0;
    spawnBatch(world, player);
  }

  if (!world.bossActive && world.time >= world.nextBossAt) {
    const idx = world.bossesKilled % BOSS_IDS.length;
    spawnBoss(world, BOSS_IDS[idx], { player, hpScale: mods.hpMult, dmgScale: mods.dmgMult });
    world.nextBossAt = world.time + BOSS_INTERVAL;
  }

  world._chestAccum = (world._chestAccum || 0) + dt;
  // Signal Flare/Salvager-style chestLuck shortens the interval rather than
  // rolling a chance -- chests spawn on a fixed timer here, not an RNG
  // check, so "more chests" has to mean "sooner chests".
  if (world._chestAccum >= 45 / (1 + (player.stats.chestLuck || 0))) {
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
