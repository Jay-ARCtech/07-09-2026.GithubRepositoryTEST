import { allocId, spawnBullet, clampToArena } from "./world.js";
import { angleTo, dist } from "../engine/utils.js";

export const ENEMY_TYPES = {
  grunt: { hp: 12, speed: 95, dmg: 5, radius: 14, xp: 3, color: "#f87171", behavior: "seek" },
  runner: { hp: 7, speed: 165, dmg: 3.5, radius: 10, xp: 3, color: "#fb923c", behavior: "seek" },
  tank: { hp: 55, speed: 55, dmg: 12, radius: 22, xp: 9, color: "#a3a3a3", behavior: "seek" },
  shooter: { hp: 14, speed: 80, dmg: 6, radius: 13, xp: 5, color: "#e879f9", behavior: "ranged" },
  splitter: { hp: 20, speed: 85, dmg: 5, radius: 16, xp: 6, color: "#4ade80", behavior: "seek", splits: true },
};

// Difficulty scales continuously with survival time; elites are a rarer,
// tougher, better-rewarding roll layered on top of a normal spawn so the
// player always has a "juicy target" to prioritize.
export function spawnEnemy(world, typeId, x, y) {
  const def = ENEMY_TYPES[typeId];
  const t = world.time;
  const scale = 1 + t / 90; // gentle exponential-feeling ramp via linear+level curve
  const eliteRoll = world.rng.chance(Math.min(0.22, 0.03 + t / 900));
  const elite = eliteRoll;
  const mult = elite ? 1 + t / 260 : 1;
  const pos = clampToArena(world, x, y);
  world.enemies.push({
    id: allocId(),
    active: true,
    type: typeId,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    radius: def.radius * (elite ? 1.35 : 1),
    hp: def.hp * scale * mult * (elite ? 2.6 : 1),
    maxHp: def.hp * scale * mult * (elite ? 2.6 : 1),
    speed: def.speed * (elite ? 1.08 : 1),
    dmg: def.dmg * (1 + t / 400) * (elite ? 1.6 : 1),
    xpValue: Math.round(def.xp * (elite ? 5 : 1) * (1 + t / 200)),
    elite,
    color: def.color,
    behavior: def.behavior,
    splits: !!def.splits,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    rangedTimer: world.rng.range(0.5, 1.5),
    dot: null,
    contactCooldown: 0,
  });
}

export function updateEnemy(e, world, dt, player) {
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.contactCooldown > 0) e.contactCooldown -= dt;

  if (e.dot && e.dot.time > 0) {
    e.hp -= e.dot.dps * dt;
    e.dot.time -= dt;
    if (e.dot.time <= 0) e.dot = null;
  }

  const d = dist(e.x, e.y, player.x, player.y) || 1;
  const dirX = (player.x - e.x) / d;
  const dirY = (player.y - e.y) / d;

  if (e.behavior === "ranged") {
    const keepDist = 320;
    const move = d < keepDist ? -1 : d > keepDist + 80 ? 1 : 0;
    e.vx = dirX * e.speed * move;
    e.vy = dirY * e.speed * move;
    e.rangedTimer -= dt;
    if (e.rangedTimer <= 0 && d < 700) {
      e.rangedTimer = 1.8;
      const ang = angleTo(e.x, e.y, player.x, player.y);
      spawnBullet(world, {
        x: e.x,
        y: e.y,
        vx: Math.cos(ang) * 260,
        vy: Math.sin(ang) * 260,
        dmg: e.dmg,
        radius: 5,
        life: 3,
        color: "#e879f9",
        kind: "enemyShot",
        hostile: true,
      });
    }
  } else {
    e.vx = dirX * e.speed;
    e.vy = dirY * e.speed;
  }

  // knockback decays independently of movement intent
  e.x += (e.vx + e.knockX) * dt;
  e.y += (e.vy + e.knockY) * dt;
  e.knockX *= 0.86;
  e.knockY *= 0.86;

  const clamped = clampToArena(world, e.x, e.y, e.radius);
  e.x = clamped.x;
  e.y = clamped.y;
}
