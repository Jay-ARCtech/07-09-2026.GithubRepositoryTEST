// Versioned, defensively-parsed save data. Corrupt/foreign localStorage
// content must never crash the game -- it falls back to fresh defaults.

const KEY = "novacore.save.v1";
const SCHEMA_VERSION = 1;

function defaults() {
  return {
    version: SCHEMA_VERSION,
    cores: 0,
    totalCoresEverEarned: 0,
    chestsOpened: 0,
    totalRuns: 0,
    bestSurvivalSeconds: 0,
    bestKills: 0,
    dailyBest: {}, // { "2026-09-20": { seconds, kills } }
    unlockedCharacters: ["vanguard"],
    unlockedWeapons: ["blaster"],
    upgrades: {
      // permanent meta-progression, each level costs more cores
      maxHp: 0,
      damage: 0,
      moveSpeed: 0,
      pickupRadius: 0,
      cooldown: 0,
      luck: 0,
    },
    achievements: {},
    settings: {
      masterVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.9,
      screenShake: true,
      damageNumbers: true,
      colorblindMode: false,
      particleDensity: "high", // low | medium | high
    },
  };
}

function migrate(data) {
  const base = defaults();
  if (!data || typeof data !== "object") return base;
  // Shallow-merge one level deep so new fields introduced in later versions
  // always exist even when loading an older save.
  const merged = { ...base, ...data };
  merged.upgrades = { ...base.upgrades, ...(data.upgrades || {}) };
  merged.settings = { ...base.settings, ...(data.settings || {}) };
  merged.achievements = { ...base.achievements, ...(data.achievements || {}) };
  merged.dailyBest = { ...base.dailyBest, ...(data.dailyBest || {}) };
  merged.version = SCHEMA_VERSION;

  // A hand-edited or corrupted import string can carry the wrong type for
  // a numeric field (e.g. a string where a number is expected); coerce
  // defensively so a bad import degrades to "reset that stat" rather than
  // poisoning downstream arithmetic (NaN comparisons, broken cost curves).
  const numericFields = ["cores", "totalCoresEverEarned", "chestsOpened", "totalRuns", "bestSurvivalSeconds", "bestKills"];
  for (const field of numericFields) {
    const n = Number(merged[field]);
    merged[field] = Number.isFinite(n) ? n : base[field];
  }
  for (const key of Object.keys(merged.upgrades)) {
    const n = Number(merged.upgrades[key]);
    merged.upgrades[key] = Number.isFinite(n) ? n : base.upgrades[key];
  }
  if (!Array.isArray(merged.unlockedCharacters)) merged.unlockedCharacters = base.unlockedCharacters;
  if (!Array.isArray(merged.unlockedWeapons)) merged.unlockedWeapons = base.unlockedWeapons;

  return merged;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.warn("Save data unreadable, starting fresh.", err);
    return defaults();
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("Could not persist save (storage full or blocked).", err);
    return false;
  }
}

export function exportSaveString(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export function importSaveString(str) {
  try {
    const json = decodeURIComponent(escape(atob(str.trim())));
    const parsed = JSON.parse(json);
    return migrate(parsed);
  } catch (err) {
    console.warn("Import string invalid.", err);
    return null;
  }
}
