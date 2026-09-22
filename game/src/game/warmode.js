// All-Out War: 2-6 empires, each with its own boss and troops, spread
// around the arena. Empire troops target the nearest hostile unit via the
// same findNearestHostile system enemies.js and bosses.js already use, but
// isHostileFaction (world.js) treats two different "empireN" factions as
// NOT hostile to each other -- every empire hunts only the player and the
// player's allies. That's a deliberate design choice: with no infighting to
// thin them out, every troop from every empire is a threat you personally
// have to deal with, which is what makes higher empire counts brutal.
import { spawnBoss, BOSS_TYPES } from "./bosses.js";
import { spawnEnemy, spawnMimicEnemy } from "./enemies.js";
import { spawnChest, spawnOverdrive } from "./pickups.js";
import { TAU } from "../engine/utils.js";

const BOSS_IDS = Object.keys(BOSS_TYPES);

export const MIN_EMPIRES = 2;
export const MAX_EMPIRES = 6;

// Hard ceiling on world.enemies.length while War Mode's directors are
// spawning troops. Bosses/allies aren't counted against it (they don't
// come from this loop), and it's checked independently per empire so a
// packed arena just pauses new spawns rather than piling up forever --
// this is what keeps 5-6 empires "a nightmare" rather than "a slideshow".
const WAR_ENEMY_CAP = 240;

export function startWarMode(world, empireCount, player) {
  world.empires = [];
  const n = Math.max(MIN_EMPIRES, Math.min(MAX_EMPIRES, empireCount));
  // Total boss HP/dmg budget stays roughly flat past 4 empires (hpScale*n
  // and dmgScale*n barely grow beyond n=4) -- the difficulty spike from
  // more empires comes from more simultaneous troop directors and more
  // fronts to manage, not from bosses turning into unkillable HP bricks.
  const hpScale = n <= 4 ? 0.55 : 0.55 * (4 / n);
  const dmgScale = n <= 4 ? 0.85 : 0.85 * Math.sqrt(4 / n);
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
      hpScale,
      dmgScale,
      name: `${BOSS_TYPES[bossType].name} (Empire ${i + 1})`,
      empireId: faction,
      silent: true, // War Mode shows every boss, not a single "active" one
      player,
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
  if (t < 120) return { grunt: 45, runner: 20, shooter: 18, gatling: 10, tank: 7, skirmisher: 10, mimic: 5 };
  return { grunt: 28, runner: 16, shooter: 16, gatling: 14, tank: 10, sniper: 8, launcher: 8, skirmisher: 10, heavyGunner: 8, mimic: 7 };
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
      if (world.enemies.length < WAR_ENEMY_CAP) {
        const table = empireWeightTable(world.time);
        const type = weightedPick(world.rng, table);
        const ang = world.rng.range(0, TAU);
        const r = world.rng.range(90, 220);
        const x = boss.x + Math.cos(ang) * r,
          y = boss.y + Math.sin(ang) * r;
        if (type === "mimic") spawnMimicEnemy(world, x, y, player, emp.id);
        else spawnEnemy(world, type, x, y, emp.id);
      }
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
