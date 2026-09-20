// Permanent meta-progression bought with Cores earned across runs. This is
// the "reason to come back" layer every successful roguelite needs --
// research on indie flops consistently points to games with no persistent
// growth loop losing players after 1-2 sessions.
export const META_UPGRADES = {
  maxHp: { label: "Vitality Core", desc: "+5% max HP per level", icon: "♥", max: 10, baseCost: 15 },
  damage: { label: "Damage Core", desc: "+5% damage per level", icon: "⚔", max: 10, baseCost: 18 },
  moveSpeed: { label: "Servo Core", desc: "+4% move speed per level", icon: "⤳", max: 8, baseCost: 12 },
  pickupRadius: { label: "Magnet Core", desc: "+8% pickup radius per level", icon: "◎", max: 8, baseCost: 10 },
  cooldown: { label: "Coolant Core", desc: "-3% weapon cooldown per level", icon: "❄", max: 8, baseCost: 16 },
  luck: { label: "Fortune Core", desc: "+3% luck per level", icon: "☘", max: 8, baseCost: 14 },
};

export function upgradeCost(def, currentLevel) {
  return Math.round(def.baseCost * Math.pow(currentLevel + 1, 1.55));
}

export function computeCoresEarned(world) {
  const base = Math.floor(world.time / 3) + world.kills * 0.4 + world.bossesKilled * 40;
  return Math.round(base);
}
