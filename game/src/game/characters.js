// Playable roster. "vanguard" is always unlocked; the rest are unlocked
// with meta-currency earned across runs, giving returning players a
// concrete reason to keep playing beyond a single session.

export const CHARACTERS = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    tagline: "Steady tank. Starts strong, dies slow.",
    color: "#38bdf8",
    unlock: { type: "free" },
    baseStats: { hpMult: 1.25, speedMult: 0.92, damageMult: 1, luckMult: 1 },
    startWeapon: "orbiter",
  },
  striker: {
    id: "striker",
    name: "Striker",
    tagline: "Glass cannon. Fast feet, faster trigger.",
    color: "#f472b6",
    unlock: { type: "cores", amount: 150 },
    baseStats: { hpMult: 0.85, speedMult: 1.18, damageMult: 1.15, luckMult: 1 },
    startWeapon: "blaster",
  },
  technomancer: {
    id: "technomancer",
    name: "Technomancer",
    tagline: "Lets the drones and lightning do the work.",
    color: "#c084fc",
    unlock: { type: "cores", amount: 350 },
    baseStats: { hpMult: 1, speedMult: 1, damageMult: 1, luckMult: 1.25 },
    startWeapon: "drone",
  },
  warden: {
    id: "warden",
    name: "Warden",
    tagline: "Unlocked by surviving a full boss cycle.",
    color: "#fbbf24",
    unlock: { type: "achievement", id: "boss_slayer" },
    baseStats: { hpMult: 1.4, speedMult: 0.95, damageMult: 0.95, luckMult: 1.1 },
    startWeapon: "nova",
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

export function isCharacterUnlocked(charDef, meta) {
  if (meta.unlockedCharacters?.includes(charDef.id)) return true;
  if (charDef.unlock.type === "free") return true;
  if (charDef.unlock.type === "cores") return meta.cores >= charDef.unlock.amount;
  if (charDef.unlock.type === "achievement") return !!meta.achievements[charDef.unlock.id];
  return false;
}
