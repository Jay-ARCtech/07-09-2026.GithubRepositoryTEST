// Prestige loop: voluntarily ending a run early ("Overload Core") banks
// permanent power instead of losing everything the way a normal death
// does. Directly answers the "I capped out and couldn't progress" problem
// -- once a run's build is fully maxed, cashing out for a permanent tier is
// the intended next move rather than a dead end.
//
// Each tier requires reaching a minimum player level in the run you're
// ascending from, so it can't be farmed by self-destructing at second one.
export const ASCENSION_TIERS = [
  { tier: 1, name: "Extra Ammo Reserves", desc: "Level-up screens offer 5 choices instead of 4.", levelRequirement: 6 },
  { tier: 2, name: "Reinforced Rerolls", desc: "+1 reroll per run.", levelRequirement: 9 },
  { tier: 3, name: "Veteran's Kit", desc: "Every run starts with one random passive already at level 1.", levelRequirement: 12 },
  { tier: 4, name: "Command Presence", desc: "+1 max Combat Drone ally slot.", levelRequirement: 15 },
  { tier: 5, name: "Hardened Plating", desc: "+10% max HP, permanently.", levelRequirement: 18 },
  { tier: 6, name: "Overclocked Trigger", desc: "-5% weapon cooldowns, permanently.", levelRequirement: 22 },
  { tier: 7, name: "Fortune's Favor", desc: "+15% luck, permanently.", levelRequirement: 26 },
  { tier: 8, name: "Iron Will", desc: "+1 flat armor, permanently.", levelRequirement: 30 },
  { tier: 9, name: "Extended Overdrive", desc: "Overdrive pickups last +5s and grant +10% extra damage.", levelRequirement: 35 },
  { tier: 10, name: "Ascendant", desc: "+15% damage, permanently, and an Ascendant aura.", levelRequirement: 40 },
];
export const MAX_ASCENSION = ASCENSION_TIERS.length;

export function nextAscensionTier(meta) {
  const level = meta.ascensionLevel || 0;
  return level < MAX_ASCENSION ? ASCENSION_TIERS[level] : null;
}

export function canAscend(meta, playerLevel) {
  const next = nextAscensionTier(meta);
  return !!next && playerLevel >= next.levelRequirement;
}

// Returns the tier just unlocked, or null if the run didn't qualify.
export function ascend(meta, playerLevel) {
  if (!canAscend(meta, playerLevel)) return null;
  const tier = nextAscensionTier(meta);
  meta.ascensionLevel = (meta.ascensionLevel || 0) + 1;
  return tier;
}

// Applied inside player.js:recomputeStats, mutating the in-progress stats
// object -- the numeric tiers (5/6/7/8/10). Non-numeric tiers (1/2/3/4/9)
// are read directly off meta.ascensionLevel at their own call sites.
export function applyAscensionBonuses(s, meta) {
  const lvl = meta.ascensionLevel || 0;
  if (lvl >= 4) s.droneMax = (s.droneMax || 0) + 1;
  if (lvl >= 5) s.maxHp *= 1.1;
  if (lvl >= 6) s.cooldownMult -= 0.05;
  if (lvl >= 7) s.luck += 0.15;
  if (lvl >= 8) s.armorFlat += 1;
  if (lvl >= 10) s.damageMult *= 1.15;
}
