import { PASSIVES } from "./passives.js";
import { WEAPONS } from "./weapons.js";
import { applyAscensionBonuses } from "./ascension.js";

// Steeper than the original curve: playtesting (and direct player feedback)
// showed the old formula let an efficient player chain-level off a single
// AoE kill's worth of XP gems and blow through the entire weapon/passive
// pool in the first few minutes, hitting the "nothing left to offer" wall
// far earlier than the run's actual difficulty ramp justified.
export function xpToNext(level) {
  return Math.floor(8 + level * 7 + Math.pow(level, 1.85));
}

export function createPlayer(charDef, meta) {
  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 16,
    faction: "player",
    color: charDef.color,
    level: 1,
    xp: 0,
    xpNext: xpToNext(1),
    hp: 100,
    maxHp: 100,
    invuln: 0,
    dashCd: 0,
    dashing: 0,
    facingAngle: 0,
    weapons: [{ id: charDef.startWeapon, level: 1, evolved: false }],
    passives: [],
    charId: charDef.id,
    damageTakenThisBossFight: 0,
    hitFlash: 0,
    hazardSlow: 1,
    overflowLevels: { overflowDamage: 0, overflowSpeed: 0, overflowRegen: 0, overflowLuck: 0 },
  };
  recomputeStats(player, meta, charDef);
  player.hp = player.maxHp;
  return player;
}

export function recomputeStats(player, meta, charDef) {
  const up = meta.upgrades;
  const base = charDef.baseStats;
  let s = {
    maxHp: 100 * base.hpMult * (1 + up.maxHp * 0.05),
    moveSpeed: 260 * base.speedMult * (1 + up.moveSpeed * 0.04),
    damageMult: base.damageMult * (1 + up.damage * 0.05),
    cooldownMult: -up.cooldown * 0.03,
    areaMult: 0,
    pickupRadius: 90 * (1 + up.pickupRadius * 0.08),
    critChance: 0.05,
    critDamage: 0.5,
    armorFlat: 0,
    regen: 0.15,
    luck: base.luckMult - 1 + up.luck * 0.03,
  };
  for (const p of player.passives) {
    const def = PASSIVES[p.id];
    const grant = def.grant(p.level);
    for (const [k, v] of Object.entries(grant)) {
      if (k === "cooldownMult" || k === "areaMult") s[k] += v;
      else s[k] = (s[k] || 0) + v;
    }
  }

  // Endgame overflow bonuses (see levelup-options.js OVERFLOW_OPTIONS) --
  // small, uncapped stacking nudges so a maxed-out build always has
  // *something* left to grow instead of hitting a hard progression wall.
  const of = player.overflowLevels;
  if (of) {
    s.damageMult *= 1 + of.overflowDamage * 0.03;
    s.moveSpeed *= 1 + of.overflowSpeed * 0.02;
    s.regen += of.overflowRegen * 0.3;
    s.luck += of.overflowLuck * 0.02;
  }

  applyAscensionBonuses(s, meta);

  player.stats = s;
  player.maxHp = s.maxHp;
}

export function gainXp(player, amount, onLevelUp) {
  player.xp += amount;
  let leveled = false;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = xpToNext(player.level);
    leveled = true;
  }
  if (leveled) onLevelUp?.();
}

export function takeDamage(player, rawAmount) {
  if (player.invuln > 0) return 0;
  const reduced = Math.max(1, rawAmount - player.stats.armorFlat);
  player.hp -= reduced;
  player.invuln = 0.75;
  player.hitFlash = 0.2;
  player.damageTakenThisBossFight += reduced;
  return reduced;
}

export function addOrLevelWeapon(player, weaponId) {
  const existing = player.weapons.find((w) => w.id === weaponId);
  if (existing) {
    existing.level = Math.min(WEAPONS[weaponId].maxLevel, existing.level + 1);
    return existing;
  }
  const w = { id: weaponId, level: 1, evolved: false };
  player.weapons.push(w);
  return w;
}

export function addOrLevelPassive(player, passiveId) {
  const existing = player.passives.find((p) => p.id === passiveId);
  if (existing) {
    existing.level = Math.min(PASSIVES[passiveId].maxLevel, existing.level + 1);
    return existing;
  }
  const p = { id: passiveId, level: 1 };
  player.passives.push(p);
  return p;
}

export function checkEvolutions(player) {
  const evolved = [];
  for (const w of player.weapons) {
    if (w.evolved) continue;
    const def = WEAPONS[w.id];
    if (!def.evolution) continue;
    if (w.level >= (def.evolveAt ?? def.maxLevel)) {
      const passive = player.passives.find((p) => p.id === def.evolution.requires);
      if (passive && passive.level >= PASSIVES[def.evolution.requires].maxLevel) {
        w.evolved = true;
        evolved.push(w);
      }
    }
  }
  return evolved;
}
