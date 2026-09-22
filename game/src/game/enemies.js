import { allocId, spawnBullet, clampToArena, findNearestHostile, spawnHazard } from "./world.js";
import { angleTo, dist, TAU } from "../engine/utils.js";
import { updateMimicCombat, mimicPreferredRange } from "./mimic.js";

// Every non-boss hostile archetype. `behavior` selects the AI routine in
// updateEnemy below. Support types (heal/summon/hazard) deliberately have
// low or zero dmg -- their threat is what they do to the fight around
// them, not their own hitbox, which is the whole point of adding them:
// a horde that's only "things that chase and touch you" has no reason to
// reward positioning or target prioritization.
export const ENEMY_TYPES = {
  grunt: {
    name: "Grunt",
    icon: "◆",
    hp: 12,
    speed: 95,
    dmg: 5,
    radius: 14,
    xp: 3,
    color: "#f87171",
    behavior: "seek",
    desc: "The core of the horde. Walks straight at you and hits on contact. Cheap alone, dangerous in numbers.",
  },
  runner: {
    name: "Runner",
    icon: "➤",
    hp: 7,
    speed: 165,
    dmg: 3.5,
    radius: 10,
    xp: 3,
    color: "#fb923c",
    behavior: "seek",
    desc: "Fragile but fast -- outruns careless positioning. Also what Splitters leave behind when they die.",
  },
  tank: {
    name: "Tank",
    icon: "▣",
    hp: 55,
    speed: 55,
    dmg: 12,
    radius: 22,
    xp: 9,
    color: "#a3a3a3",
    behavior: "seek",
    desc: "Slow, heavy, hits hard on contact. Worth focusing down before it catches up to you.",
  },
  shooter: {
    name: "Shooter",
    icon: "●",
    hp: 14,
    speed: 80,
    dmg: 6,
    radius: 13,
    xp: 5,
    color: "#e879f9",
    behavior: "ranged",
    desc: "Basic all-rounder ranged enemy. Keeps its distance and fires single shots at you.",
  },
  splitter: {
    name: "Splitter",
    icon: "✳",
    hp: 20,
    speed: 85,
    dmg: 5,
    radius: 16,
    xp: 6,
    color: "#4ade80",
    behavior: "seek",
    splits: true,
    desc: "Breaks into two weaker Runners on death. Killing it doesn't end the fight, just changes its shape.",
  },

  gatling: {
    name: "Gatling Gunner",
    icon: "≡",
    hp: 18,
    speed: 70,
    dmg: 2.2,
    radius: 13,
    xp: 6,
    color: "#fb7185",
    behavior: "gatling",
    desc: "Fires fast 3-round bursts at close-to-mid range. Low damage per hit, but it adds up if you linger.",
  },
  sniper: {
    name: "Sniper",
    icon: "╱",
    hp: 16,
    speed: 55,
    dmg: 17,
    radius: 13,
    xp: 8,
    color: "#facc15",
    behavior: "sniper",
    desc: "Telegraphs a long-range shot with a visible laser line, then fires one very hard hit. Break line of sight or move during the wind-up.",
  },
  launcher: {
    name: "Launcher",
    icon: "◉",
    hp: 24,
    speed: 60,
    dmg: 11,
    radius: 15,
    xp: 8,
    color: "#f97316",
    behavior: "launcher",
    desc: "Lobs a slow grenade that explodes in an area on impact. Dangerous to stand still near.",
  },
  skirmisher: {
    name: "Skirmisher",
    icon: "∴",
    hp: 8,
    speed: 120,
    dmg: 3,
    radius: 9,
    xp: 4,
    color: "#67e8f9",
    behavior: "ranged",
    desc: "The smallest ranged unit in the horde -- quick and cheap, but its bolts are the weakest and slowest around. Size cuts both ways.",
  },
  heavyGunner: {
    name: "Heavy Gunner",
    icon: "▤",
    hp: 34,
    speed: 50,
    dmg: 9,
    radius: 22,
    xp: 10,
    color: "#fb7185",
    behavior: "gatling",
    desc: "A bulked-up gatling unit. Bigger than the standard Gatling Gunner, so its bursts fly noticeably faster and hit much harder -- size is a direct threat multiplier for ranged units.",
  },
  siegeCannon: {
    name: "Siege Cannon",
    icon: "◙",
    hp: 46,
    speed: 38,
    dmg: 20,
    radius: 30,
    xp: 15,
    color: "#fbbf24",
    behavior: "launcher",
    desc: "The largest ranged unit in the horde. Slow and lumbering, but its shells travel almost hitscan-fast and land devastating hits. Never let one sit still and line you up.",
  },

  healer: {
    name: "Healer",
    icon: "✚",
    hp: 22,
    speed: 95,
    dmg: 0,
    radius: 13,
    xp: 7,
    color: "#86efac",
    behavior: "healSupport",
    desc: "Keeps its distance and periodically heals nearby hostiles. Kill it first or the fight drags on forever.",
  },
  summoner: {
    name: "Summoner",
    icon: "☍",
    hp: 26,
    speed: 65,
    dmg: 0,
    radius: 15,
    xp: 9,
    color: "#fbbf24",
    behavior: "summonSupport",
    desc: "Calls in more Grunts and Shooters on a timer. Left alive, it snowballs the swarm.",
  },
  engineer: {
    name: "Engineer",
    icon: "⛭",
    hp: 22,
    speed: 78,
    dmg: 2,
    radius: 14,
    xp: 8,
    color: "#f472b6",
    behavior: "hazardSupport",
    desc: "Drops timed hazard zones that damage and slow you if you walk through them. Watch for the warning ring.",
  },

  mimic: {
    name: "Mimic",
    icon: "☻",
    hp: 24,
    speed: 100,
    dmg: 6,
    radius: 15,
    xp: 11,
    color: "#22d3ee",
    behavior: "mimic",
    desc: "A copy of you, spawned wearing whatever weapons you're currently running. It fights with every one of them at once -- you have to out-play your own build.",
  },
};
export const ENEMY_LIST = Object.entries(ENEMY_TYPES).map(([id, def]) => ({ id, ...def }));

// Difficulty scales continuously with survival time; elites are a rarer,
// tougher, better-rewarding roll layered on top of a normal spawn so the
// player always has a "juicy target" to prioritize.
export function spawnEnemy(world, typeId, x, y, faction = "horde") {
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
    faction,
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
    burstCount: 0,
    telegraph: null,
    supportTimer: world.rng.range(1.5, 3),
    dot: null,
    contactCooldown: 0,
    slowUntil: 0,
  });
  return world.enemies[world.enemies.length - 1];
}

// Ranged enemies fire faster, harder shots the bigger their hitbox is.
// REF_RANGED_RADIUS is the Shooter's radius -- the baseline ranged unit --
// so anything at or below that size fires at "normal" speed/power, and
// every bigger ranged archetype (Heavy Gunner, Siege Cannon, an elite's
// enlarged radius, ...) scales up from there. This is a single, generic
// rule applied at the point every hostile bolt is fired, rather than
// hand-tuning per-archetype bullet stats.
const REF_RANGED_RADIUS = 13;

// The Mimic can't come from the generic spawnEnemy() above -- it needs the
// real player's current weapon loadout to copy, which spawnEnemy has no
// access to. Callers (director.js, warmode.js) special-case the "mimic"
// type to call this instead, the same way they already have `player` in
// scope for positioning spawns.
export function spawnMimicEnemy(world, x, y, player, faction = "horde") {
  const def = ENEMY_TYPES.mimic;
  const t = world.time;
  const scale = 1 + t / 90;
  const weapons = (player.weapons && player.weapons.length ? player.weapons : [{ id: "blaster", level: 1, evolved: false }]).map((w) => ({
    id: w.id,
    level: w.level,
    evolved: w.evolved,
  }));
  const passiveBoost = 1 + (player.passives?.length || 0) * 0.05;
  const pos = clampToArena(world, x, y);
  const mimic = {
    id: allocId(),
    active: true,
    type: "mimic",
    faction,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp * scale * passiveBoost,
    maxHp: def.hp * scale * passiveBoost,
    speed: def.speed * (1 + Math.min(0.3, (player.passives?.length || 0) * 0.02)),
    dmg: def.dmg * (1 + t / 400) * passiveBoost,
    xpValue: Math.round(def.xp * (1 + t / 200)),
    elite: false,
    color: player.color || def.color,
    behavior: "mimic",
    mimicWeapons: weapons,
    splits: false,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    rangedTimer: 0,
    burstCount: 0,
    telegraph: null,
    supportTimer: 0,
    dot: null,
    contactCooldown: 0,
    slowUntil: 0,
  };
  world.enemies.push(mimic);
  return mimic;
}

function fireHostileBolt(world, e, target, opts) {
  const ang = angleTo(e.x, e.y, target.x, target.y);
  const sizeScale = Math.max(1, e.radius / REF_RANGED_RADIUS);
  const speedBoost = 1 + (sizeScale - 1) * 0.5;
  const dmgBoost = 1 + (sizeScale - 1) * 0.35;
  spawnBullet(world, {
    x: e.x,
    y: e.y,
    vx: Math.cos(ang) * (opts.speed ?? 260) * speedBoost,
    vy: Math.sin(ang) * (opts.speed ?? 260) * speedBoost,
    dmg: (opts.dmg ?? e.dmg) * dmgBoost,
    radius: opts.radius ?? 5,
    life: opts.life ?? 3,
    color: opts.color ?? e.color,
    kind: opts.kind ?? "enemyShot",
    hostile: true,
    sourceFaction: e.faction,
    aoeRadius: opts.aoeRadius ?? 0,
  });
}

function keepDistanceMove(e, target, d, dirX, dirY, keepDist, band = 80) {
  const move = d < keepDist ? -1 : d > keepDist + band ? 1 : 0;
  e.vx = dirX * e.speed * move;
  e.vy = dirY * e.speed * move;
}

export function updateEnemy(e, world, dt, player) {
  if (e.hitFlash > 0) e.hitFlash -= dt;
  // contactCooldown is decremented centrally in main.js's contact-resolution
  // pass, which handles every unit type (enemy/boss/ally) uniformly.

  if (e.dot && e.dot.time > 0) {
    e.hp -= e.dot.dps * dt;
    e.dot.time -= dt;
    if (e.dot.time <= 0) e.dot = null;
  }

  const target = findNearestHostile(world, e, player, 1400);
  if (!target) {
    // nothing to fight -- drift gently rather than freeze in place
    e.x += Math.sin(world.time + e.id) * 6 * dt;
    return;
  }
  const d = dist(e.x, e.y, target.x, target.y) || 1;
  const dirX = (target.x - e.x) / d;
  const dirY = (target.y - e.y) / d;
  const speedMult = world.time < e.slowUntil ? 0.5 : 1;

  if (e.behavior === "ranged") {
    keepDistanceMove(e, target, d, dirX, dirY, 320);
    e.rangedTimer -= dt;
    if (e.rangedTimer <= 0 && d < 700) {
      e.rangedTimer = 1.8;
      fireHostileBolt(world, e, target, { speed: 260, color: "#e879f9" });
    }
  } else if (e.behavior === "gatling") {
    keepDistanceMove(e, target, d, dirX, dirY, 260);
    e.rangedTimer -= dt;
    if (e.rangedTimer <= 0 && d < 560) {
      e.burstCount = 3;
      e.rangedTimer = 1.3;
    }
    if (e.burstCount > 0) {
      e._burstGap = (e._burstGap ?? 0) - dt;
      if (e._burstGap <= 0) {
        e._burstGap = 0.11;
        e.burstCount -= 1;
        fireHostileBolt(world, e, target, { speed: 380, radius: 3.5, life: 2, color: "#fb7185" });
      }
    }
  } else if (e.behavior === "sniper") {
    keepDistanceMove(e, target, d, dirX, dirY, 620, 160);
    if (e.telegraph) {
      e.telegraph.t -= dt;
      e.telegraph.x = target.x;
      e.telegraph.y = target.y;
      if (e.telegraph.t <= 0) {
        fireHostileBolt(world, e, target, { speed: 1100, radius: 5, life: 1.4, color: "#facc15", dmg: e.dmg });
        e.telegraph = null;
        e.rangedTimer = 3.2;
      }
    } else {
      e.rangedTimer -= dt;
      if (e.rangedTimer <= 0 && d < 1100) {
        e.telegraph = { kind: "snipe", t: 1.1, x: target.x, y: target.y };
      }
    }
  } else if (e.behavior === "launcher") {
    keepDistanceMove(e, target, d, dirX, dirY, 480, 140);
    e.rangedTimer -= dt;
    if (e.rangedTimer <= 0 && d < 700) {
      e.rangedTimer = 2.4;
      fireHostileBolt(world, e, target, {
        speed: 180,
        radius: 8,
        life: 4,
        color: "#f97316",
        kind: "grenade",
        aoeRadius: 90,
        dmg: e.dmg,
      });
    }
  } else if (e.behavior === "healSupport") {
    keepDistanceMove(e, target, d, dirX, dirY, 400, 160);
    e.supportTimer -= dt;
    if (e.supportTimer <= 0) {
      e.supportTimer = 2.5;
      let healed = false;
      for (const o of world.enemies) {
        if (!o.active || o.faction !== e.faction || o === e) continue;
        if (dist(e.x, e.y, o.x, o.y) > 260) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.18 + 6);
        healed = true;
      }
      if (healed) world._onSupportPulse?.(e, "#86efac");
    }
  } else if (e.behavior === "summonSupport") {
    keepDistanceMove(e, target, d, dirX, dirY, 420, 160);
    e.supportTimer -= dt;
    if (e.supportTimer <= 0 && world.enemies.length < 220) {
      e.supportTimer = 4.5;
      const summonType = world.rng.chance(0.5) ? "grunt" : "shooter";
      for (let i = 0; i < 2; i++) {
        const ang = world.rng.range(0, TAU);
        spawnEnemy(world, summonType, e.x + Math.cos(ang) * 40, e.y + Math.sin(ang) * 40, e.faction);
      }
      world._onSupportPulse?.(e, "#fbbf24");
    }
  } else if (e.behavior === "hazardSupport") {
    keepDistanceMove(e, target, d, dirX, dirY, 380, 140);
    e.supportTimer -= dt;
    if (e.supportTimer <= 0 && d < 700) {
      e.supportTimer = 3.5;
      const dropX = target.x + world.rng.range(-60, 60);
      const dropY = target.y + world.rng.range(-60, 60);
      spawnHazard(world, dropX, dropY, { radius: 85, dps: 9, slowMult: 0.5, duration: 6, color: "#f472b6" });
    }
  } else if (e.behavior === "mimic") {
    const preferred = mimicPreferredRange(e.mimicWeapons);
    if (preferred <= 60) {
      e.vx = dirX * e.speed * speedMult;
      e.vy = dirY * e.speed * speedMult;
    } else {
      keepDistanceMove(e, target, d, dirX, dirY, preferred, 130);
    }
    updateMimicCombat(e, world, dt, player, target);
  } else {
    e.vx = dirX * e.speed * speedMult;
    e.vy = dirY * e.speed * speedMult;
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
