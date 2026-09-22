// Shared combat logic for the Mimic archetype (regular enemy in enemies.js,
// boss variant "Mimic Overlord" in bosses.js). A Mimic copies the *real*
// player's current weapon loadout (id/level/evolved) at spawn time and
// fights with all of it -- the player has to out-play a build they made
// themselves.
//
// This deliberately does NOT call into weapons.js's WEAPONS[id].update()
// directly: those functions assume `player` is the real player hunting
// world.enemies (nearestEnemy() explicitly filters out faction "player").
// A Mimic needs exactly the opposite -- something hostile to "player" that
// hunts the real player -- so each weapon is re-expressed here as a cheap
// flavor entry (damage/cooldown/range coefficients) driven off the unit's
// own already-scaled `dmg` stat, the same way every other ranged archetype
// in enemies.js derives its shot damage from `e.dmg`.
import { spawnBullet, isHostileFaction } from "./world.js";
import { angleTo, dist } from "../engine/utils.js";

const MIMIC_FLAVOR = {
  blaster: { kind: "bullet", cooldown: 0.6, dmgMult: 0.55, speed: 560, range: 900, color: "#7dd3fc" },
  missile: { kind: "homing", cooldown: 1.9, dmgMult: 0.95, speed: 340, range: 1200, aoe: 70, color: "#fb923c" },
  lightning: { kind: "bullet", cooldown: 1.2, dmgMult: 0.75, speed: 1000, range: 750, color: "#e879f9" },
  drone: { kind: "bullet", cooldown: 0.75, dmgMult: 0.4, speed: 520, range: 500, color: "#a78bfa" },
  orbiter: { kind: "pulse", cooldown: 0.55, dmgMult: 0.35, radius: 90, color: "#facc15" },
  nova: { kind: "pulse", cooldown: 2.2, dmgMult: 1.1, radius: 170, color: "#34d399" },
};

// Orbiter is the only copied weapon with no real range -- a Mimic carrying
// only Orbiter(s) has to close to melee like a "seek" enemy. Anything else
// in the loadout (including Nova's big-but-still-finite pulse) means it's
// worth kiting at range instead.
export function mimicPreferredRange(mimicWeapons) {
  const onlyMelee = mimicWeapons.length > 0 && mimicWeapons.every((w) => w.id === "orbiter" || !MIMIC_FLAVOR[w.id]);
  return onlyMelee ? 40 : 420;
}

export function updateMimicCombat(e, world, dt, player, target) {
  e._mimicCd = e._mimicCd || {};
  for (const w of e.mimicWeapons) {
    const flavor = MIMIC_FLAVOR[w.id];
    if (!flavor) continue;
    const cd = (e._mimicCd[w.id] ?? 0) - dt;
    e._mimicCd[w.id] = cd;
    if (cd > 0) continue;

    const levelMult = 1 + w.level * 0.12;
    const evoMult = w.evolved ? 1.5 : 1;
    const dmg = e.dmg * flavor.dmgMult * levelMult * evoMult;

    if (flavor.kind === "pulse") {
      e._mimicCd[w.id] = flavor.cooldown / (1 + w.level * 0.05);
      const radius = flavor.radius * (1 + w.level * 0.05);
      for (const o of world.enemies) {
        if (!o.active || o === e || !isHostileFaction(e.faction, o.faction)) continue;
        if (dist(e.x, e.y, o.x, o.y) > radius + o.radius) continue;
        o.hp -= dmg;
        o.hitFlash = 0.12;
        world._onEnemyDamaged?.(o);
      }
      if (player && isHostileFaction(e.faction, player.faction) && dist(e.x, e.y, player.x, player.y) <= radius + player.radius) {
        world._onMimicPulseHit?.(dmg);
      }
      world._spawnRing?.(e.x, e.y, radius);
      continue;
    }

    if (!target || dist(e.x, e.y, target.x, target.y) > flavor.range) continue;
    e._mimicCd[w.id] = flavor.cooldown / (1 + w.level * 0.08);
    const ang = angleTo(e.x, e.y, target.x, target.y);
    spawnBullet(world, {
      x: e.x,
      y: e.y,
      vx: Math.cos(ang) * flavor.speed,
      vy: Math.sin(ang) * flavor.speed,
      dmg,
      radius: 4.5,
      life: 2.2,
      color: flavor.color,
      kind: flavor.kind === "homing" ? "missile" : "enemyShot",
      hostile: true,
      sourceFaction: e.faction,
      homing: flavor.kind === "homing",
      aoeRadius: flavor.aoe ?? 0,
    });
  }
}
