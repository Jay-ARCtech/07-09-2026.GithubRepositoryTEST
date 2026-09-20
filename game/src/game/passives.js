// Permanent-for-the-run passive items picked at level-up. Each has up to
// 5 levels; the derived stats they grant are recomputed every level-up
// (see player.js:recomputeStats) rather than incrementally applied, so
// order of acquisition never matters.

export const PASSIVES = {
  scope: {
    id: "scope",
    name: "Scope",
    icon: "◎",
    color: "#f87171",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 6}% crit chance, +${lvl * 20}% crit damage`,
    grant: (lvl) => ({ critChance: lvl * 0.06, critDamage: lvl * 0.2 }),
  },
  treads: {
    id: "treads",
    name: "Treads",
    icon: "➤",
    color: "#34d399",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 7}% move speed`,
    grant: (lvl) => ({ moveSpeed: lvl * 0.07 }),
  },
  magnet: {
    id: "magnet",
    name: "Magnet",
    icon: "⊙",
    color: "#60a5fa",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 18}% pickup radius`,
    grant: (lvl) => ({ pickupRadius: lvl * 0.18 }),
  },
  plating: {
    id: "plating",
    name: "Plating",
    icon: "▣",
    color: "#a3a3a3",
    maxLevel: 5,
    desc: (lvl) => `-${lvl} flat damage taken (min 1)`,
    grant: (lvl) => ({ armorFlat: lvl }),
  },
  vitality: {
    id: "vitality",
    name: "Vitality",
    icon: "♥",
    color: "#fb7185",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 20} max HP, +${(lvl * 0.4).toFixed(1)} HP/s regen`,
    grant: (lvl) => ({ maxHp: lvl * 20, regen: lvl * 0.4 }),
  },
  battery: {
    id: "battery",
    name: "Battery",
    icon: "⚡",
    color: "#fbbf24",
    maxLevel: 5,
    desc: (lvl) => `-${lvl * 6}% weapon cooldowns`,
    grant: (lvl) => ({ cooldownMult: -lvl * 0.06 }),
  },
  core: {
    id: "core",
    name: "Amplifier Core",
    icon: "◈",
    color: "#c084fc",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 8}% area/size of effects`,
    grant: (lvl) => ({ areaMult: lvl * 0.08 }),
  },
  fourleaf: {
    id: "fourleaf",
    name: "Four-Leaf",
    icon: "☘",
    color: "#4ade80",
    maxLevel: 5,
    desc: (lvl) => `+${lvl * 10}% luck (better drops, rarer choices)`,
    grant: (lvl) => ({ luck: lvl * 0.1 }),
  },
};

export const PASSIVE_LIST = Object.values(PASSIVES);
