import { PASSIVES } from "./passives.js";
import { WEAPONS } from "./weapons.js";

export function xpToNext(level) {
  return Math.floor(6 + level * 5 + Math.pow(level, 1.6));
}

export function createPlayer(charDef, meta) {
  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 16,
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
    if (w.level >= def.maxLevel) {
      const passive = player.passives.find((p) => p.id === def.evolution.requires);
      if (passive && passive.level >= PASSIVES[def.evolution.requires].maxLevel) {
        w.evolved = true;
        evolved.push(w);
      }
    }
  }
  return evolved;
}
