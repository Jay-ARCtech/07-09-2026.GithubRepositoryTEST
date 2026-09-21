import { WEAPON_LIST, WEAPONS } from "./weapons.js";
import { PASSIVE_LIST, PASSIVES } from "./passives.js";

// Endgame fallback: once every weapon/passive is maxed and every eligible
// evolution taken, the real candidate pool runs dry. Without a fallback,
// generateOptions returns fewer options than requested -- possibly zero --
// and the level-up screen renders with no pickable cards and no dismiss
// button, hard-softlocking the run. These four always-available, infinitely
// stackable micro-bonuses guarantee there's always something to pick.
export const OVERFLOW_OPTIONS = {
  overflowDamage: { name: "Overcharge", icon: "⚔", color: "#f87171", desc: () => "+3% damage (stacks indefinitely)" },
  overflowSpeed: { name: "Slipstream", icon: "⤳", color: "#34d399", desc: () => "+2% move speed (stacks indefinitely)" },
  overflowRegen: { name: "Nanite Weave", icon: "♥", color: "#fb7185", desc: () => "+0.3 HP/s regen (stacks indefinitely)" },
  overflowLuck: { name: "Fortune Engine", icon: "☘", color: "#4ade80", desc: () => "+2% luck (stacks indefinitely)" },
};
const OVERFLOW_IDS = Object.keys(OVERFLOW_OPTIONS);

function evolutionCandidate(player, w) {
  const def = WEAPONS[w.id];
  const evolveAt = def.evolveAt ?? def.maxLevel;
  if (w.evolved || !def.evolution || w.level < evolveAt) return null;
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

  // Always-available filler so the pool never runs dry once real content
  // (weapons/passives/evolutions) is exhausted -- see OVERFLOW_OPTIONS above.
  // Low weight keeps them rare while real choices still exist.
  for (const id of OVERFLOW_IDS) {
    candidates.push({ kind: "overflow", id, currentLevel: player.overflowLevels?.[id] ?? 0, weight: 1 });
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
