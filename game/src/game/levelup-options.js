import { WEAPON_LIST, WEAPONS } from "./weapons.js";
import { PASSIVE_LIST, PASSIVES } from "./passives.js";

function evolutionCandidate(player, w) {
  const def = WEAPONS[w.id];
  if (w.evolved || !def.evolution || w.level < def.maxLevel) return null;
  const passive = player.passives.find((p) => p.id === def.evolution.requires);
  if (!passive || passive.level < PASSIVES[def.evolution.requires].maxLevel) return null;
  return { kind: "weapon", id: w.id, currentLevel: w.level, isEvolution: true, weight: 6 };
}

export function generateOptions(player, rng, count = 4) {
  const candidates = [];

  for (const w of player.weapons) {
    const evo = evolutionCandidate(player, w);
    if (evo) candidates.push(evo);
    else if (w.level < WEAPONS[w.id].maxLevel) {
      candidates.push({ kind: "weapon", id: w.id, currentLevel: w.level, isNew: false, weight: 3 });
    }
  }
  if (player.weapons.length < WEAPON_LIST.length) {
    const owned = new Set(player.weapons.map((w) => w.id));
    for (const def of WEAPON_LIST) {
      if (!owned.has(def.id)) candidates.push({ kind: "weapon", id: def.id, currentLevel: 0, isNew: true, weight: 2 });
    }
  }

  for (const p of player.passives) {
    if (p.level < PASSIVES[p.id].maxLevel) {
      candidates.push({ kind: "passive", id: p.id, currentLevel: p.level, isNew: false, weight: 3 });
    }
  }
  if (player.passives.length < PASSIVE_LIST.length) {
    const owned = new Set(player.passives.map((p) => p.id));
    for (const def of PASSIVE_LIST) {
      if (!owned.has(def.id)) candidates.push({ kind: "passive", id: def.id, currentLevel: 0, isNew: true, weight: 2 });
    }
  }

  // Weighted shuffle-and-pick without replacement.
  const pool = [...candidates];
  const picked = [];
  const luckBonus = 1 + Math.max(0, player.stats?.luck || 0);
  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((c) => c.weight * (c.isEvolution || c.isNew ? luckBonus : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.range(0, total);
    let idx = 0;
    for (; idx < weights.length; idx++) {
      if (r < weights[idx]) break;
      r -= weights[idx];
    }
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
