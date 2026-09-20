import { allocId, spawnBullet, clampToArena } from "./world.js";
import { angleTo, TAU } from "../engine/utils.js";
import { bus } from "../engine/bus.js";
import { audio } from "../engine/audio.js";

// Three boss templates with distinct, telegraphed attack patterns so
// fights read as fair -- every big hit gives the player a visible
// wind-up window to react to, which is the single biggest "feels cheap
// vs feels fair" lever in this genre.
export const BOSS_TYPES = {
  colossus: {
    name: "Colossus",
    color: "#f87171",
    radius: 46,
    hpBase: 900,
    speed: 60,
    pattern: "slam",
  },
  swarmQueen: {
    name: "Swarm Queen",
    color: "#4ade80",
    radius: 38,
    hpBase: 700,
    speed: 75,
    pattern: "summon",
  },
  voidLancer: {
    name: "Void Lancer",
    color: "#c084fc",
    radius: 40,
    hpBase: 800,
    speed: 90,
    pattern: "spread",
  },
};

export function spawnBoss(world, typeId) {
  const def = BOSS_TYPES[typeId];
  const scale = 1 + world.bossesKilled * 0.5 + world.time / 400;
  const boss = {
    id: allocId(),
    active: true,
    type: typeId,
    isBoss: true,
    x: 0,
    y: -world.arenaRadius * 0.7,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hpBase * scale,
    maxHp: def.hpBase * scale,
    speed: def.speed,
    dmg: 16 * (1 + world.bossesKilled * 0.3),
    xpValue: 120,
    elite: false,
    color: def.color,
    behavior: "boss",
    pattern: def.pattern,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    dot: null,
    contactCooldown: 0,
    phaseTimer: 2,
    telegraph: null,
    name: def.name,
  };
  world.enemies.push(boss);
  world.bossActive = boss;
  audio.sfxBossRoar();
  bus.emit("bossSpawned", boss);
  return boss;
}

export function updateBoss(e, world, dt, player) {
  if (e.hitFlash > 0) e.hitFlash -= dt;
  e.phaseTimer -= dt;

  const ang = angleTo(e.x, e.y, player.x, player.y);
  const d = Math.hypot(player.x - e.x, player.y - e.y);

  if (e.pattern === "slam") {
    if (!e.telegraph && e.phaseTimer <= 0) {
      e.telegraph = { kind: "slam", t: 0.9, x: player.x, y: player.y, radius: 190 };
      e.phaseTimer = 3.2;
    }
    if (e.telegraph) {
      e.telegraph.t -= dt;
      if (e.telegraph.t <= 0) {
        const dd = Math.hypot(player.x - e.telegraph.x, player.y - e.telegraph.y);
        if (dd <= e.telegraph.radius) bus.emit("bossSlam", { x: e.telegraph.x, y: e.telegraph.y, dmg: e.dmg * 1.6 });
        world._spawnRing?.(e.telegraph.x, e.telegraph.y, e.telegraph.radius);
        audio.sfxExplosion();
        e.telegraph = null;
      }
    }
    if (d > 20) {
      e.vx = Math.cos(ang) * e.speed;
      e.vy = Math.sin(ang) * e.speed;
    }
  } else if (e.pattern === "summon") {
    e.vx = Math.cos(ang) * e.speed * (d < 260 ? -1 : 1);
    e.vy = Math.sin(ang) * e.speed * (d < 260 ? -1 : 1);
    if (e.phaseTimer <= 0) {
      e.phaseTimer = 5;
      bus.emit("bossSummon", { x: e.x, y: e.y });
    }
  } else if (e.pattern === "spread") {
    e.vx = Math.cos(ang) * e.speed * (d < 320 ? -1 : 0.4);
    e.vy = Math.sin(ang) * e.speed * (d < 320 ? -1 : 0.4);
    if (e.phaseTimer <= 0) {
      e.phaseTimer = 2.4;
      const bolts = 10;
      for (let i = 0; i < bolts; i++) {
        const a = (TAU / bolts) * i;
        spawnBullet(world, {
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * 220,
          vy: Math.sin(a) * 220,
          dmg: e.dmg * 0.7,
          radius: 6,
          life: 3.5,
          color: "#c084fc",
          kind: "enemyShot",
          hostile: true,
        });
      }
      audio.sfxShoot("lightning");
    }
  }

  e.x += (e.vx + e.knockX) * dt;
  e.y += (e.vy + e.knockY) * dt;
  e.knockX *= 0.9;
  e.knockY *= 0.9;
  const clamped = clampToArena(world, e.x, e.y, e.radius);
  e.x = clamped.x;
  e.y = clamped.y;
}
