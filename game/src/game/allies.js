// Player-summoned allies. They live in the same world.enemies array as
// hostiles (faction "player", isAlly:true) so they get combat, contact
// damage, and rendering for free through the existing generalized systems
// -- the only bespoke code here is their own AI and the respawn scheduler.
import { allocId, spawnBullet, clampToArena, findNearestHostile } from "./world.js";
import { angleTo, dist, TAU } from "../engine/utils.js";

export const ALLY_TYPES = {
  drone: {
    name: "Combat Drone",
    icon: "⟁",
    hp: 24,
    speed: 190,
    dmg: 4,
    radius: 10,
    color: "#38bdf8",
    behavior: "allyRanged",
    desc: "Keeps its distance and auto-fires at the nearest hostile. Fragile but fast, and you can field up to 3 with a maxed Drone Bay.",
    unlockHint: "Passive: Drone Bay",
  },
  medic: {
    name: "Field Medic",
    icon: "✚",
    hp: 30,
    speed: 170,
    dmg: 0,
    radius: 11,
    color: "#4ade80",
    behavior: "allyMedic",
    desc: "Doesn't fight -- pulses healing to you and every other living ally nearby every 3s. Losing it means losing your only in-run sustain.",
    unlockHint: "Passive: Field Medic",
  },
  vanguard: {
    name: "Vanguard",
    icon: "⛨",
    hp: 70,
    speed: 150,
    dmg: 9,
    radius: 15,
    color: "#fbbf24",
    behavior: "allySeek",
    desc: "A tanky melee ally that charges the nearest hostile and soaks contact damage that would otherwise land on you.",
    unlockHint: "Passive: Vanguard Beacon",
  },
};
export const ALLY_LIST = Object.entries(ALLY_TYPES).map(([id, def]) => ({ id, ...def }));

export function spawnAlly(world, kind, x, y, powerMult = 1) {
  const def = ALLY_TYPES[kind];
  const pos = clampToArena(world, x, y);
  const ally = {
    id: allocId(),
    active: true,
    type: "ally_" + kind,
    faction: "player",
    isAlly: true,
    allyKind: kind,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp * powerMult,
    maxHp: def.hp * powerMult,
    speed: def.speed,
    dmg: def.dmg * powerMult,
    color: def.color,
    behavior: def.behavior,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    dot: null,
    contactCooldown: 0,
    rangedTimer: 0.4,
    supportTimer: 1,
    healPower: 6,
  };
  world.enemies.push(ally);
  return ally;
}

function followPlayer(e, player, dt, followRadius) {
  const d = dist(e.x, e.y, player.x, player.y);
  if (d > followRadius) {
    const dx = (player.x - e.x) / d,
      dy = (player.y - e.y) / d;
    e.vx = dx * e.speed;
    e.vy = dy * e.speed;
  } else {
    e.vx *= 0.8;
    e.vy *= 0.8;
  }
}

export function updateAlly(e, world, dt, player) {
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.dot && e.dot.time > 0) {
    e.hp -= e.dot.dps * dt;
    e.dot.time -= dt;
    if (e.dot.time <= 0) e.dot = null;
  }

  const target = findNearestHostile(world, e, player, 900);

  if (e.behavior === "allyMedic") {
    followPlayer(e, player, dt, 140);
    e.supportTimer -= dt;
    if (e.supportTimer <= 0) {
      e.supportTimer = 3;
      let healed = false;
      if (player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + e.healPower);
        healed = true;
      }
      for (const o of world.enemies) {
        if (!o.active || o.faction !== "player" || o === e) continue;
        if (dist(e.x, e.y, o.x, o.y) > 220) continue;
        if (o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + e.healPower);
          healed = true;
        }
      }
      if (healed) e._healPulse = { born: world.time };
    }
  } else if (e.behavior === "allyRanged") {
    if (target) {
      const d = dist(e.x, e.y, target.x, target.y) || 1;
      const dirX = (target.x - e.x) / d,
        dirY = (target.y - e.y) / d;
      const keep = 260;
      const move = d < keep ? -1 : d > keep + 100 ? 1 : 0;
      e.vx = dirX * e.speed * move;
      e.vy = dirY * e.speed * move;
      e.rangedTimer -= dt;
      if (e.rangedTimer <= 0 && d < 560) {
        e.rangedTimer = 0.7;
        const ang = angleTo(e.x, e.y, target.x, target.y);
        spawnBullet(world, {
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * 520,
          vy: Math.sin(ang) * 520,
          dmg: e.dmg,
          radius: 3.5,
          life: 1.3,
          color: e.color,
          sourceFaction: "player",
        });
      }
    } else {
      followPlayer(e, player, dt, 180);
    }
  } else if (e.behavior === "allySeek") {
    if (target) {
      const d = dist(e.x, e.y, target.x, target.y) || 1;
      const dirX = (target.x - e.x) / d,
        dirY = (target.y - e.y) / d;
      e.vx = dirX * e.speed;
      e.vy = dirY * e.speed;
    } else {
      followPlayer(e, player, dt, 160);
    }
  }

  e.x += (e.vx + e.knockX) * dt;
  e.y += (e.vy + e.knockY) * dt;
  e.knockX *= 0.86;
  e.knockY *= 0.86;
  const clamped = clampToArena(world, e.x, e.y, e.radius);
  e.x = clamped.x;
  e.y = clamped.y;
}

const RESPAWN_DELAY = { drone: 8, medic: 12, vanguard: 10 };

// Reconciles desired ally counts (read off player.stats, granted by the
// three ally passives, minus however many of that kind have permanently
// died this run) against what's currently alive, trickling in replacements
// on a cooldown. A dead slot is NOT refilled here -- world.allyDeadCount is
// only ever reduced by the "Revive Ally" card or the Emergency Revive
// action (see main.js), which is what makes ally deaths actually matter.
export function updateAllySystem(world, dt, player) {
  world._allyNextSpawnAt = world._allyNextSpawnAt || {};
  world.allyDeadCount = world.allyDeadCount || { drone: 0, medic: 0, vanguard: 0 };
  const stats = player.stats || {};
  const cap = {
    drone: Math.floor(stats.droneMax || 0),
    medic: Math.floor(stats.medicMax || 0),
    vanguard: Math.floor(stats.vanguardMax || 0),
  };
  const powerMult = {
    drone: (stats.droneDmgMult || 1) * (stats.allyDroneMetaMult || 1),
    medic: stats.allyMedicMetaMult || 1,
    vanguard: (stats.vanguardHpMult || 1) * (stats.allyVanguardMetaMult || 1),
  };

  for (const kind of Object.keys(cap)) {
    const wanted = Math.max(0, cap[kind] - (world.allyDeadCount[kind] || 0));
    if (wanted <= 0) continue;
    let alive = 0;
    for (const e of world.enemies) if (e.active && e.isAlly && e.allyKind === kind) alive++;
    if (alive < wanted && world.time >= (world._allyNextSpawnAt[kind] || 0)) {
      const ang = world.rng.range(0, TAU);
      const r = 70 + world.rng.range(0, 40);
      const ally = spawnAlly(world, kind, player.x + Math.cos(ang) * r, player.y + Math.sin(ang) * r, powerMult[kind]);
      if (kind === "medic") ally.healPower = (stats.healPower || 6) * (stats.allyMedicMetaMult || 1);
      world._allyNextSpawnAt[kind] = world.time + RESPAWN_DELAY[kind];
    }
  }
}
