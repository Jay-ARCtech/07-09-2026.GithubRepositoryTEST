// All-Out War: up to 4 empires, each with its own boss and troops, spread
// around the arena. Empire troops target the nearest hostile unit via the
// same findNearestHostile system enemies.js and bosses.js already use, so
// "empires fight each other" isn't bespoke AI -- it falls straight out of
// giving each empire its own faction tag and letting the existing combat
// resolution (faction mismatch = hostile) run.
import { spawnBoss, BOSS_TYPES } from "./bosses.js";
import { spawnEnemy } from "./enemies.js";
import { spawnChest, spawnOverdrive } from "./pickups.js";
import { TAU } from "../engine/utils.js";

const BOSS_IDS = Object.keys(BOSS_TYPES);

export function startWarMode(world, empireCount) {
  world.empires = [];
  const n = Math.max(2, Math.min(4, empireCount));
  for (let i = 0; i < n; i++) {
    const ang = (TAU / n) * i - Math.PI / 2;
    const r = world.arenaRadius * 0.72;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    const faction = `empire${i + 1}`;
    const bossType = BOSS_IDS[i % BOSS_IDS.length];
    const boss = spawnBoss(world, bossType, {
      x,
      y,
      faction,
      hpScale: 0.55,
      dmgScale: 0.85,
      name: `${BOSS_TYPES[bossType].name} (Empire ${i + 1})`,
      empireId: faction,
      silent: true, // War Mode shows every boss, not a single "active" one
    });
    world.empires.push({ id: faction, bossId: boss.id, alive: true, spawnX: x, spawnY: y, nextSpawnAt: 3 });
  }
  world.totalBossesForVictory = n;
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

function empireWeightTable(t) {
  if (t < 120) return { grunt: 45, runner: 20, shooter: 18, gatling: 10, tank: 7 };
  return { grunt: 28, runner: 16, shooter: 16, gatling: 14, tank: 10, sniper: 8, launcher: 8 };
}

export function updateWarDirector(world, dt, player) {
  world.time += dt;
  world.difficulty = world.time / 60;

  for (const emp of world.empires) {
    if (!emp.alive) continue;
    const boss = world.enemies.find((e) => e.id === emp.bossId);
    if (!boss || !boss.active) {
      emp.alive = false;
      continue;
    }
    emp.nextSpawnAt -= dt;
    if (emp.nextSpawnAt <= 0) {
      emp.nextSpawnAt = Math.max(2.2, 6 - world.time / 220);
      const table = empireWeightTable(world.time);
      const type = weightedPick(world.rng, table);
      const ang = world.rng.range(0, TAU);
      const r = world.rng.range(90, 220);
      spawnEnemy(world, type, boss.x + Math.cos(ang) * r, boss.y + Math.sin(ang) * r, emp.id);
    }
  }

  world._chestAccum = (world._chestAccum || 0) + dt;
  if (world._chestAccum >= 40) {
    world._chestAccum = 0;
    const ang = world.rng.range(0, TAU);
    spawnChest(world, player.x + Math.cos(ang) * 220, player.y + Math.sin(ang) * 220);
  }

  world._overdriveAccum = (world._overdriveAccum || 0) + dt;
  if (world._overdriveAccum >= 60) {
    world._overdriveAccum = 0;
    const ang = world.rng.range(0, TAU);
    spawnOverdrive(world, player.x + Math.cos(ang) * 260, player.y + Math.sin(ang) * 260);
  }
}
