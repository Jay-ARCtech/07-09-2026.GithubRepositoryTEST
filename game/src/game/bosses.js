import { allocId, spawnBullet, clampToArena, findNearestHostile, isHostileFaction } from "./world.js";
import { angleTo, TAU } from "../engine/utils.js";
import { bus } from "../engine/bus.js";
import { audio } from "../engine/audio.js";
import { updateMimicCombat, mimicPreferredRange } from "./mimic.js";

// Three boss templates with distinct, telegraphed attack patterns so
// fights read as fair -- every big hit gives the player a visible
// wind-up window to react to, which is the single biggest "feels cheap
// vs feels fair" lever in this genre.
export const BOSS_TYPES = {
  colossus: {
    name: "Colossus",
    icon: "⬢",
    color: "#f87171",
    radius: 46,
    hpBase: 900,
    speed: 60,
    pattern: "slam",
    desc: "Charges in and telegraphs a heavy ground slam with a visible radius warning. Get out of the circle before it lands.",
  },
  swarmQueen: {
    name: "Swarm Queen",
    icon: "⬡",
    color: "#4ade80",
    radius: 38,
    hpBase: 700,
    speed: 75,
    pattern: "summon",
    desc: "Kites at range while periodically summoning waves of Grunts. Kill it fast or the arena fills up.",
  },
  voidLancer: {
    name: "Void Lancer",
    icon: "⬣",
    color: "#c084fc",
    radius: 40,
    hpBase: 800,
    speed: 90,
    pattern: "spread",
    desc: "Fires a full-circle spread of bolts on a short cooldown. Keep moving; there's no safe spot that stays safe.",
  },
  mimic: {
    name: "Mimic Overlord",
    icon: "☻",
    color: "#22d3ee",
    radius: 40,
    hpBase: 750,
    speed: 80,
    pattern: "mimic",
    desc: "A boss-scale copy of you, wielding every weapon you're currently running all at once. It's basically a mirror match -- except it never misses a beat.",
  },
};
export const BOSS_LIST = Object.entries(BOSS_TYPES).map(([id, def]) => ({ id, ...def }));

export function spawnBoss(world, typeId, opts = {}) {
  const def = BOSS_TYPES[typeId];
  const scale = (opts.hpScale ?? 1) * (1 + world.bossesKilled * 0.5 + world.time / 400);
  const faction = opts.faction ?? "horde";
  const boss = {
    id: allocId(),
    active: true,
    type: typeId,
    faction,
    isBoss: true,
    x: opts.x ?? 0,
    y: opts.y ?? -world.arenaRadius * 0.7,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hpBase * scale,
    maxHp: def.hpBase * scale,
    speed: def.speed,
    dmg: 16 * (1 + world.bossesKilled * 0.3) * (opts.dmgScale ?? 1),
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
    name: opts.name ?? def.name,
    empireId: opts.empireId ?? null,
  };
  if (def.pattern === "mimic") {
    // Same idea as spawnMimicEnemy() in enemies.js, boss-scale: snapshot the
    // real player's current weapon loadout at spawn time so the fight is a
    // mirror match against the build the player actually made.
    const srcPlayer = opts.player;
    boss.mimicWeapons = (srcPlayer?.weapons?.length ? srcPlayer.weapons : [{ id: "blaster", level: 1, evolved: false }]).map((w) => ({
      id: w.id,
      level: w.level,
      evolved: w.evolved,
    }));
    boss.color = srcPlayer?.color || def.color;
  }
  world.enemies.push(boss);
  if (!opts.silent) world.bossActive = boss;
  audio.sfxBossRoar();
  bus.emit("bossSpawned", boss);
  return boss;
}

export function updateBoss(e, world, dt, player) {
  if (e.hitFlash > 0) e.hitFlash -= dt;
  e.phaseTimer -= dt;

  const target = findNearestHostile(world, e, player, 2200) ?? player;
  const ang = angleTo(e.x, e.y, target.x, target.y);
  const d = Math.hypot(target.x - e.x, target.y - e.y);

  if (e.pattern === "slam") {
    if (!e.telegraph && e.phaseTimer <= 0) {
      e.telegraph = { kind: "slam", t: 0.9, x: target.x, y: target.y, radius: 190 };
      e.phaseTimer = 3.2;
    }
    if (e.telegraph) {
      e.telegraph.t -= dt;
      if (e.telegraph.t <= 0) {
        const dmg = e.dmg * 1.6;
        const dd = Math.hypot(player.x - e.telegraph.x, player.y - e.telegraph.y);
        if (isHostileFaction(player.faction, e.faction) && dd <= e.telegraph.radius) {
          bus.emit("bossSlam", { x: e.telegraph.x, y: e.telegraph.y, dmg });
        }
        for (const o of world.enemies) {
          if (!o.active || o === e || !isHostileFaction(e.faction, o.faction)) continue;
          const od = Math.hypot(o.x - e.telegraph.x, o.y - e.telegraph.y);
          if (od <= e.telegraph.radius) {
            o.hp -= dmg;
            o.hitFlash = 0.15;
          }
        }
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
      bus.emit("bossSummon", { x: e.x, y: e.y, faction: e.faction });
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
          sourceFaction: e.faction,
        });
      }
      audio.sfxShoot("lightning");
    }
  } else if (e.pattern === "mimic") {
    const preferred = mimicPreferredRange(e.mimicWeapons);
    if (preferred <= 60) {
      if (d > 20) {
        e.vx = Math.cos(ang) * e.speed;
        e.vy = Math.sin(ang) * e.speed;
      }
    } else {
      const move = d < preferred ? -1 : d > preferred + 150 ? 1 : 0.3;
      e.vx = Math.cos(ang) * e.speed * move;
      e.vy = Math.sin(ang) * e.speed * move;
    }
    updateMimicCombat(e, world, dt, player, target);
  }

  e.x += (e.vx + e.knockX) * dt;
  e.y += (e.vy + e.knockY) * dt;
  e.knockX *= 0.9;
  e.knockY *= 0.9;
  const clamped = clampToArena(world, e.x, e.y, e.radius);
  e.x = clamped.x;
  e.y = clamped.y;
}
