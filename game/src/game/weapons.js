import { spawnBullet } from "./world.js";
import { angleTo, dist2, TAU } from "../engine/utils.js";
import { audio } from "../engine/audio.js";

function nearestEnemy(world, x, y, maxRange = Infinity) {
  let best = null,
    bestD = maxRange * maxRange;
  for (const e of world.enemies) {
    if (!e.active) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function nearbyEnemies(world, x, y, range, excludeSet) {
  const out = [];
  const r2 = range * range;
  for (const e of world.enemies) {
    if (!e.active || excludeSet.has(e)) continue;
    if (dist2(x, y, e.x, e.y) <= r2) out.push(e);
  }
  return out;
}

function rollCrit(stats, rng) {
  return rng.chance(stats.critChance) ? 1 + stats.critDamage : 1;
}

// Every weapon def: id, name, icon, color, maxLevel, evolution{requires,name,desc},
// desc(level), update(ctx) where ctx = {world, player, ws, dt, stats, rng}.
export const WEAPONS = {
  blaster: {
    id: "blaster",
    name: "Blaster",
    color: "#7dd3fc",
    icon: "◆",
    maxLevel: 5,
    evolution: { requires: "scope", name: "Railgun", desc: "Piercing beam that melts anything in a line." },
    desc: (lvl) => `${lvl} shot(s), fires at nearest enemy`,
    update({ world, player, ws, dt, stats, rng }) {
      ws.cd = (ws.cd ?? 0) - dt;
      if (ws.cd > 0) return;
      const evolved = ws.evolved;
      const baseCd = evolved ? 1.4 : 0.55;
      ws.cd = baseCd * (1 + stats.cooldownMult);
      const target = nearestEnemy(world, player.x, player.y, 900);
      if (!target) return;
      const shots = evolved ? 1 : ws.level;
      const spread = evolved ? 0 : 0.12;
      for (let i = 0; i < shots; i++) {
        const baseAng = angleTo(player.x, player.y, target.x, target.y);
        const ang = baseAng + (i - (shots - 1) / 2) * spread;
        const speed = evolved ? 900 : 620;
        const crit = rollCrit(stats, rng);
        spawnBullet(world, {
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          dmg: (evolved ? 9 + ws.level * 2 : 3 + ws.level * 1.2) * stats.damageMult * crit,
          radius: evolved ? 5 : 4,
          pierce: evolved ? 99 : ws.level >= 4 ? 1 : 0,
          life: 1.4,
          color: evolved ? "#f97316" : "#7dd3fc",
          crit: crit > 1,
        });
      }
      audio.sfxShoot("blaster");
    },
  },

  orbiter: {
    id: "orbiter",
    name: "Orbiter Blades",
    color: "#facc15",
    icon: "✦",
    maxLevel: 5,
    evolution: { requires: "core", name: "Blade Storm", desc: "Massive burning blades." },
    desc: (lvl) => `${1 + Math.floor(lvl / 2)} blade(s) circling you`,
    update({ world, player, ws, dt, stats }) {
      // Damage is a proximity ring around the player (like "Garlic" in
      // Vampire Survivors), not the rotating blade points themselves --
      // a lone point-hitbox sweeping a ring statistically misses most
      // enemies that approach and park at melee range (verified by
      // simulation: ~15% catch rate), which makes the weapon feel broken.
      // The blades stay purely visual/thematic; anything that gets within
      // `coverage` of the player takes a tick of damage on its own cooldown.
      ws.angle = (ws.angle ?? 0) + dt * (evolvedSpin(ws) ? 3.2 : 2.4);
      const count = ws.evolved ? 2 + Math.floor(ws.level / 2) : 1 + Math.floor(ws.level / 2);
      const radius = (ws.evolved ? 85 : 60) * (1 + stats.areaMult);
      const coverage = radius + (ws.evolved ? 45 : 30) * (1 + stats.areaMult);
      const hitCd = Math.max(0.22, (ws.evolved ? 0.5 : 0.62) - ws.level * 0.04);
      ws.hitTimers = ws.hitTimers || new Map();
      for (const [id, t] of ws.hitTimers) ws.hitTimers.set(id, t - dt);
      for (const e of world.enemies) {
        if (!e.active) continue;
        const dx = e.x - player.x,
          dy = e.y - player.y;
        if (dx * dx + dy * dy > (coverage + e.radius) ** 2) continue;
        const cool = ws.hitTimers.get(e.id) ?? 0;
        if (cool <= 0) {
          e.hp -= (ws.evolved ? 4 + ws.level : 1.6 + ws.level * 0.7) * stats.damageMult;
          e.hitFlash = 0.08;
          e.dot = ws.evolved ? { dps: 3, time: 2 } : e.dot;
          ws.hitTimers.set(e.id, hitCd);
          world._onEnemyDamaged?.(e);
        }
      }
      ws._blades = { count, radius, angle: ws.angle, evolved: ws.evolved };
    },
  },

  nova: {
    id: "nova",
    name: "Nova Pulse",
    color: "#34d399",
    icon: "●",
    maxLevel: 5,
    evolution: { requires: "battery", name: "Supernova", desc: "Bigger, faster, knock-back pulses." },
    desc: (lvl) => `AoE pulse every ${(2.6 - lvl * 0.25).toFixed(1)}s`,
    update({ world, player, ws, dt, stats }) {
      ws.cd = (ws.cd ?? 0) - dt;
      if (ws.cd > 0) return;
      const baseCd = ws.evolved ? 1.6 - ws.level * 0.12 : 2.6 - ws.level * 0.25;
      ws.cd = Math.max(0.6, baseCd) * (1 + stats.cooldownMult);
      const radius = (ws.evolved ? 220 : 150) * (1 + stats.areaMult);
      const dmg = (ws.evolved ? 10 + ws.level * 3 : 4 + ws.level * 1.6) * stats.damageMult;
      for (const e of world.enemies) {
        if (!e.active) continue;
        const d2 = dist2(player.x, player.y, e.x, e.y);
        if (d2 <= radius * radius) {
          e.hp -= dmg;
          e.hitFlash = 0.12;
          const d = Math.sqrt(d2) || 1;
          e.knockX = ((e.x - player.x) / d) * 220;
          e.knockY = ((e.y - player.y) / d) * 220;
          world._onEnemyDamaged?.(e);
        }
      }
      ws._pulse = { radius, born: world.time };
      audio.sfxExplosion();
    },
  },

  missile: {
    id: "missile",
    name: "Homing Missiles",
    color: "#fb923c",
    icon: "▲",
    maxLevel: 5,
    evolution: { requires: "plating", name: "Bunker Buster", desc: "Armor-piercing, bigger blast." },
    desc: (lvl) => `${1 + Math.floor(lvl / 2)} missile(s) per volley`,
    update({ world, player, ws, dt, stats, rng }) {
      ws.cd = (ws.cd ?? 0) - dt;
      if (ws.cd > 0) return;
      ws.cd = 1.8 * (1 + stats.cooldownMult);
      const count = ws.evolved ? 2 + Math.floor(ws.level / 2) : 1 + Math.floor(ws.level / 2);
      for (let i = 0; i < count; i++) {
        const target = nearestEnemy(world, player.x, player.y, 1200);
        const ang = target ? angleTo(player.x, player.y, target.x, target.y) : rng.range(0, TAU);
        const crit = rollCrit(stats, rng);
        spawnBullet(world, {
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * 340,
          vy: Math.sin(ang) * 340,
          dmg: (ws.evolved ? 14 + ws.level * 4 : 6 + ws.level * 2) * stats.damageMult * crit,
          radius: 5,
          life: 3,
          homing: true,
          kind: "missile",
          aoeRadius: (ws.evolved ? 110 : 70) * (1 + stats.areaMult),
          color: "#fb923c",
          crit: crit > 1,
        });
      }
      audio.sfxShoot("missile");
    },
  },

  lightning: {
    id: "lightning",
    name: "Chain Lightning",
    color: "#e879f9",
    icon: "⚡",
    maxLevel: 5,
    evolution: { requires: "fourleaf", name: "Storm Call", desc: "Jumps further, hits harder." },
    desc: (lvl) => `Chains to ${1 + lvl} enemies`,
    update({ world, player, ws, dt, stats, rng }) {
      ws.cd = (ws.cd ?? 0) - dt;
      if (ws.cd > 0) return;
      ws.cd = 1.1 * (1 + stats.cooldownMult);
      const first = nearestEnemy(world, player.x, player.y, 750);
      if (!first) return;
      const chainCount = (ws.evolved ? 3 : 1) + ws.level;
      const dmg = (ws.evolved ? 5 + ws.level * 2 : 2.5 + ws.level) * stats.damageMult;
      const hit = new Set();
      let current = first;
      const path = [{ x: player.x, y: player.y }];
      for (let i = 0; i < chainCount && current; i++) {
        current.hp -= dmg;
        current.hitFlash = 0.1;
        world._onEnemyDamaged?.(current);
        hit.add(current);
        path.push({ x: current.x, y: current.y });
        const range = ws.evolved ? 380 : 260;
        const candidates = nearbyEnemies(world, current.x, current.y, range, hit);
        const from = path[path.length - 1];
        current = candidates.length
          ? candidates.reduce((a, b) => (dist2(from.x, from.y, a.x, a.y) < dist2(from.x, from.y, b.x, b.y) ? a : b))
          : null;
      }
      ws._bolt = { path, born: world.time };
      audio.sfxShoot("lightning");
    },
  },

  drone: {
    id: "drone",
    name: "Turret Drone",
    color: "#a78bfa",
    icon: "◈",
    maxLevel: 5,
    evolution: { requires: "treads", name: "Twin Turret", desc: "Drones orbit faster and fire twice as often." },
    desc: (lvl) => `${1 + Math.floor(lvl / 3)} drone(s) auto-firing`,
    update({ world, player, ws, dt, stats, rng }) {
      const droneCount = 1 + Math.floor(ws.level / 3);
      ws.angle = (ws.angle ?? 0) + dt * (ws.evolved ? 1.6 : 1);
      ws.timers = ws.timers || [];
      while (ws.timers.length < droneCount) ws.timers.push(0);
      const orbitR = 110;
      for (let i = 0; i < droneCount; i++) {
        const ang = ws.angle + (TAU / droneCount) * i;
        const dx = player.x + Math.cos(ang) * orbitR;
        const dy = player.y + Math.sin(ang) * orbitR;
        ws.timers[i] -= dt;
        if (ws.timers[i] <= 0) {
          const target = nearestEnemy(world, dx, dy, 500);
          const fireCd = (ws.evolved ? 0.45 : 0.9) * (1 + stats.cooldownMult);
          ws.timers[i] = fireCd;
          if (target) {
            const crit = rollCrit(stats, rng);
            const ang2 = angleTo(dx, dy, target.x, target.y);
            spawnBullet(world, {
              x: dx,
              y: dy,
              vx: Math.cos(ang2) * 560,
              vy: Math.sin(ang2) * 560,
              dmg: (2 + ws.level) * stats.damageMult * crit,
              radius: 3.5,
              life: 1.2,
              color: "#a78bfa",
              crit: crit > 1,
            });
          }
        }
      }
      ws._drones = { count: droneCount, radius: orbitR, angle: ws.angle };
    },
  },
};

function evolvedSpin(ws) {
  return !!ws.evolved;
}

export const WEAPON_LIST = Object.values(WEAPONS);
