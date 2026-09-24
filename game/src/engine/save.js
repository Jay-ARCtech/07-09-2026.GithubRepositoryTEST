// Versioned, defensively-parsed save data. Corrupt/foreign localStorage
// content -- or a hand-edited/malicious import string, which round-trips
// through the same migrate() path -- must never crash the game or let an
// out-of-range numeric field poison downstream arithmetic (a level far
// past a track's real max can blow stats up toward Infinity, which then
// shows as NaN in HP/XP bar scaleX() and other rendering).
import { META_UPGRADES, ALLY_META_UPGRADES } from "../game/upgrades.js";
import { MAX_ASCENSION } from "../game/ascension.js";

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
    ascensionLevel: 0, // 0-10, see ascension.js
    upgrades: {
      // permanent meta-progression, each level costs more cores
      maxHp: 0,
      damage: 0,
      moveSpeed: 0,
      pickupRadius: 0,
      cooldown: 0,
      luck: 0,
    },
    allyUpgrades: { drone: 0, medic: 0, vanguard: 0 }, // see ALLY_META_UPGRADES in upgrades.js
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
  merged.allyUpgrades = { ...base.allyUpgrades, ...(data.allyUpgrades || {}) };
  merged.settings = { ...base.settings, ...(data.settings || {}) };
  merged.achievements = { ...base.achievements, ...(data.achievements || {}) };
  merged.dailyBest = { ...base.dailyBest, ...(data.dailyBest || {}) };
  merged.version = SCHEMA_VERSION;

  // A hand-edited or corrupted import string can carry the wrong type for
  // a numeric field (e.g. a string where a number is expected); coerce
  // defensively so a bad import degrades to "reset that stat" rather than
  // poisoning downstream arithmetic (NaN comparisons, broken cost curves).
  const numericFields = ["cores", "totalCoresEverEarned", "chestsOpened", "totalRuns", "bestSurvivalSeconds", "bestKills", "ascensionLevel"];
  for (const field of numericFields) {
    const n = Number(merged[field]);
    // Non-negative, not just finite -- a negative gold/kill/time count is
    // never legitimate and a huge magnitude in either direction is exactly
    // the kind of value that later blows a stat multiplier up toward
    // Infinity, so every one of these tracks a real lower bound of 0.
    merged[field] = Number.isFinite(n) && n >= 0 ? n : base[field];
  }
  merged.ascensionLevel = Math.max(0, Math.min(MAX_ASCENSION, Math.round(merged.ascensionLevel)));
  // Each meta-upgrade level directly multiplies a live gameplay stat in
  // recomputeStats() with no cap of its own (the armory UI only *stops
  // offering new purchases* past def.max -- it never re-validates a level
  // that's already on the save). An import string with e.g.
  // upgrades.maxHp far past its real max: 10 would otherwise slip through
  // the finite-number check above unclamped and could eventually push a
  // stat to Infinity, which shows up as NaN on the HP/XP bars. Rebuilt from
  // only the keys META_UPGRADES/ALLY_META_UPGRADES actually define (not
  // whatever keys happened to survive the shallow merge above) so a made-up
  // key can't ride along with no real max to clamp against.
  const cleanUpgrades = {};
  for (const key of Object.keys(base.upgrades)) {
    const n = Number(merged.upgrades[key]);
    const max = META_UPGRADES[key].max;
    cleanUpgrades[key] = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : base.upgrades[key];
  }
  merged.upgrades = cleanUpgrades;
  const cleanAllyUpgrades = {};
  for (const key of Object.keys(base.allyUpgrades)) {
    const n = Number(merged.allyUpgrades[key]);
    const max = ALLY_META_UPGRADES[key].max;
    cleanAllyUpgrades[key] = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : base.allyUpgrades[key];
  }
  merged.allyUpgrades = cleanAllyUpgrades;
  if (!Array.isArray(merged.unlockedCharacters)) merged.unlockedCharacters = base.unlockedCharacters;
  if (!Array.isArray(merged.unlockedWeapons)) merged.unlockedWeapons = base.unlockedWeapons;

  // Volume settings feed straight into AudioParam.gain.value (audio.js) with
  // no clamp of its own -- an out-of-[0,1] value there isn't a crash, it's
  // an unexpectedly deafening one. Import strings are meant to be pasted
  // from wherever a player got them (a forum post, a friend), so a crafted
  // one setting these far past 1 is a real, cheap-to-fix nuisance to guard
  // against, not just a theoretical one.
  const volumeFields = ["masterVolume", "musicVolume", "sfxVolume"];
  for (const field of volumeFields) {
    const n = Number(merged.settings[field]);
    merged.settings[field] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : base.settings[field];
  }

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
