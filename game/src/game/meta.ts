/**
 * Persistent progression.
 *
 * Design stance, stated plainly because it drove every number here:
 *
 *  - Everything is earnable by playing. There is no currency you can only buy.
 *  - The starter core is competitive at the highest level. Nothing unlockable
 *    is strictly better - each is a trade.
 *  - Permanent upgrades are capped at a combined effect small enough that a
 *    fully-upgraded account is maybe 15-20% stronger, not twice as strong.
 *    They exist to give a reason to come back, not to sell a shortcut past the
 *    game.
 *  - The Daily Challenge ignores all of it, so the one competitive mode is
 *    identical for a day-one player and a day-300 player.
 *
 * "Pay-to-win" and "progression locked behind a paywall" are the two most
 * common complaints in negative reviews of games in this category. The cheapest
 * way to not have those reviews is to not do those things.
 */
import { Storage, bool, int, num, str, strList, numMap } from '../engine/storage';
import { CORE_IDS, DEFAULT_CORE_ID } from './cores';
import type { RunModifiers } from './run';
import type { RunSummary } from './run';

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  /** Cost of going from level i to level i+1. */
  costs: readonly number[];
  /** Effect per level, applied additively. */
  perLevel: number;
  unit: string;
}

export const META_UPGRADES: readonly MetaUpgradeDef[] = [
  {
    id: 'plating',
    name: 'CORE PLATING',
    desc: 'Start every run with more integrity',
    maxLevel: 2,
    costs: [1200, 4000],
    perLevel: 1,
    unit: 'integrity',
  },
  {
    id: 'calibration',
    name: 'CALIBRATION',
    desc: 'Widen the shield sweet spot',
    maxLevel: 4,
    costs: [500, 1100, 2200, 4200],
    perLevel: 0.04,
    unit: '% sweet spot',
  },
  {
    id: 'servos',
    name: 'SERVOS',
    desc: 'Turn the shield faster',
    maxLevel: 3,
    costs: [600, 1500, 3200],
    perLevel: 0.05,
    unit: '% turn speed',
  },
  {
    id: 'capacitor',
    name: 'CAPACITOR',
    desc: 'Build overdrive energy faster',
    maxLevel: 3,
    costs: [450, 1200, 2600],
    perLevel: 0.1,
    unit: '% energy',
  },
  {
    id: 'salvage',
    name: 'SALVAGE',
    desc: 'Recover more shards from every run',
    maxLevel: 4,
    costs: [400, 950, 2000, 3800],
    perLevel: 0.08,
    unit: '% shards',
  },
] as const;

export const META_UPGRADE_IDS: readonly string[] = META_UPGRADES.map((u) => u.id);

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  /** Mirrors the HUD for left-thumb players. */
  leftHanded: boolean;
}

export interface DailyRecord {
  /** YYYY-MM-DD in the device's local time. */
  date: string;
  score: number;
  wave: number;
  completed: boolean;
}

export interface MissionState {
  date: string;
  /** Mission id -> progress. */
  progress: Record<string, number>;
  claimed: string[];
}

export interface SaveData {
  version: number;
  shards: number;
  totalShardsEarned: number;
  bestScore: number;
  bestWave: number;
  bestCombo: number;
  runs: number;
  totalParries: number;
  totalTurrets: number;
  selectedCore: string;
  ownedCores: string[];
  upgrades: Record<string, number>;
  settings: Settings;
  daily: DailyRecord;
  missions: MissionState;
  /** True once the player has seen the how-to-play card. */
  tutorialDone: boolean;
  /** Optional one-time purchase that turns off every ad prompt. */
  supporter: boolean;
}

const SAVE_KEY = 'save';
export const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  music: true,
  haptics: true,
  reducedMotion: false,
  leftHanded: false,
};

function emptyDaily(): DailyRecord {
  return { date: '', score: 0, wave: 0, completed: false };
}

function emptyMissions(): MissionState {
  return { date: '', progress: {}, claimed: [] };
}

export function defaultSave(): SaveData {
  // Upgrade levels are spelled out rather than left as an empty map so that a
  // fresh save and a migrated one have exactly the same shape.
  const upgrades: Record<string, number> = {};
  for (const def of META_UPGRADES) upgrades[def.id] = 0;

  return {
    version: SAVE_VERSION,
    shards: 0,
    totalShardsEarned: 0,
    bestScore: 0,
    bestWave: 0,
    bestCombo: 0,
    runs: 0,
    totalParries: 0,
    totalTurrets: 0,
    selectedCore: DEFAULT_CORE_ID,
    ownedCores: [DEFAULT_CORE_ID],
    upgrades,
    settings: { ...DEFAULT_SETTINGS },
    daily: emptyDaily(),
    missions: emptyMissions(),
    tutorialDone: false,
    supporter: false,
  };
}

/** Local calendar date as YYYY-MM-DD. Local, not UTC: the daily should reset
 *  at the player's midnight, not at a timezone they have never visited. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rebuilds a SaveData from whatever was on disk.
 *
 * Every field is validated and clamped. A save file is untrusted input: it can
 * be truncated by a crash, written by an older build, or hand-edited. The game
 * must boot from any of those without throwing.
 */
export function migrateSave(raw: Record<string, unknown>): SaveData {
  const base = defaultSave();
  const settingsRaw = (raw['settings'] ?? {}) as Record<string, unknown>;
  const dailyRaw = (raw['daily'] ?? {}) as Record<string, unknown>;
  const missionsRaw = (raw['missions'] ?? {}) as Record<string, unknown>;

  const owned = strList(raw['ownedCores'], CORE_IDS, CORE_IDS.length);
  if (!owned.includes(DEFAULT_CORE_ID)) owned.push(DEFAULT_CORE_ID);

  const upgrades: Record<string, number> = {};
  const rawUpgrades = numMap(raw['upgrades'], META_UPGRADE_IDS, 0, 99);
  for (const def of META_UPGRADES) {
    upgrades[def.id] = Math.min(def.maxLevel, rawUpgrades[def.id] ?? 0);
  }

  const selected = str(raw['selectedCore'], DEFAULT_CORE_ID, CORE_IDS);

  const dailyDate = str(dailyRaw['date'], '');
  const missionDate = str(missionsRaw['date'], '');

  return {
    version: SAVE_VERSION,
    shards: int(raw['shards'], 0, 0, 1e12),
    totalShardsEarned: int(raw['totalShardsEarned'], 0, 0, 1e12),
    bestScore: int(raw['bestScore'], 0, 0, 1e15),
    bestWave: int(raw['bestWave'], 0, 0, 100000),
    bestCombo: int(raw['bestCombo'], 0, 0, 1e9),
    runs: int(raw['runs'], 0, 0, 1e9),
    totalParries: int(raw['totalParries'], 0, 0, 1e12),
    totalTurrets: int(raw['totalTurrets'], 0, 0, 1e12),
    // A selected core the player does not own would soft-lock the menu.
    selectedCore: owned.includes(selected) ? selected : DEFAULT_CORE_ID,
    ownedCores: owned,
    upgrades,
    settings: {
      sfx: bool(settingsRaw['sfx'], base.settings.sfx),
      music: bool(settingsRaw['music'], base.settings.music),
      haptics: bool(settingsRaw['haptics'], base.settings.haptics),
      reducedMotion: bool(settingsRaw['reducedMotion'], base.settings.reducedMotion),
      leftHanded: bool(settingsRaw['leftHanded'], base.settings.leftHanded),
    },
    daily: {
      date: DATE_RE.test(dailyDate) ? dailyDate : '',
      score: int(dailyRaw['score'], 0, 0, 1e15),
      wave: int(dailyRaw['wave'], 0, 0, 100000),
      completed: bool(dailyRaw['completed'], false),
    },
    missions: {
      date: DATE_RE.test(missionDate) ? missionDate : '',
      progress: numMap(missionsRaw['progress'], MISSION_IDS, 0, 1e9),
      claimed: strList(missionsRaw['claimed'], MISSION_IDS, MISSION_IDS.length),
    },
    tutorialDone: bool(raw['tutorialDone'], false),
    supporter: bool(raw['supporter'], false),
  };
}

// --- Daily missions ---------------------------------------------------------

export interface MissionDef {
  id: string;
  label: (target: number) => string;
  targets: readonly number[];
  reward: number;
  /** Pulls the day's progress out of a finished run. */
  measure: (s: RunSummary) => number;
  /** True when progress accumulates across runs rather than resetting. */
  cumulative: boolean;
}

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'parries',
    label: (t) => `Parry ${t} shots today`,
    targets: [60, 90, 140],
    reward: 120,
    measure: (s) => s.parries,
    cumulative: true,
  },
  {
    id: 'wave',
    label: (t) => `Reach wave ${t} in a single run`,
    targets: [8, 11, 14],
    reward: 150,
    measure: (s) => s.wave,
    cumulative: false,
  },
  {
    id: 'combo',
    label: (t) => `Hit a ${t} chain`,
    targets: [20, 30, 45],
    reward: 140,
    measure: (s) => s.bestCombo,
    cumulative: false,
  },
  {
    id: 'turrets',
    label: (t) => `Destroy ${t} turrets today`,
    targets: [3, 6, 10],
    reward: 160,
    measure: (s) => s.turretsKilled,
    cumulative: true,
  },
  {
    id: 'absorb',
    label: (t) => `Absorb ${t} void orbs today`,
    targets: [10, 16, 24],
    reward: 130,
    measure: (s) => s.absorbs,
    cumulative: true,
  },
  {
    id: 'score',
    label: (t) => `Score ${t.toLocaleString()} in a single run`,
    targets: [25000, 45000, 80000],
    reward: 170,
    measure: (s) => s.score,
    cumulative: false,
  },
] as const;

export const MISSION_IDS: readonly string[] = MISSIONS.map((m) => m.id);

export interface ActiveMission {
  def: MissionDef;
  target: number;
  progress: number;
  claimed: boolean;
  complete: boolean;
}

/**
 * Picks the day's three missions from the date seed, so they are stable for the
 * whole day and identical across a reinstall.
 */
export function rollMissions(dateKey: string, rngFactory: (seed: number) => {
  int: (a: number, b: number) => number;
  shuffle: <T>(x: T[]) => T[];
}): Array<{ id: string; target: number }> {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const rng = rngFactory(h >>> 0);
  const pool = rng.shuffle([...MISSIONS]);
  return pool.slice(0, 3).map((m) => ({
    id: m.id,
    target: m.targets[rng.int(0, m.targets.length - 1)] ?? m.targets[0]!,
  }));
}

// --- The live profile -------------------------------------------------------

export class Profile {
  private storage: Storage;
  data: SaveData;
  /** True when the loaded save failed its checksum and was repaired. */
  readonly recovered: boolean;

  constructor(storage: Storage) {
    this.storage = storage;
    const res = storage.load<SaveData>(SAVE_KEY, defaultSave(), migrateSave);
    this.data = res.value;
    this.recovered = res.recovered;
    this.rollDailyIfNeeded();
  }

  save(): void {
    this.storage.save(SAVE_KEY, this.data);
  }

  /** Resets the daily record and missions when the calendar day turns over. */
  rollDailyIfNeeded(now: Date = new Date()): void {
    const key = todayKey(now);
    if (this.data.daily.date !== key) {
      this.data.daily = { date: key, score: 0, wave: 0, completed: false };
    }
    if (this.data.missions.date !== key) {
      this.data.missions = { date: key, progress: {}, claimed: [] };
    }
  }

  get shards(): number {
    return this.data.shards;
  }

  addShards(n: number): void {
    if (n <= 0) return;
    this.data.shards += n;
    this.data.totalShardsEarned += n;
  }

  spendShards(n: number): boolean {
    if (n <= 0 || this.data.shards < n) return false;
    this.data.shards -= n;
    return true;
  }

  ownsCore(id: string): boolean {
    return this.data.ownedCores.includes(id);
  }

  buyCore(id: string, cost: number): boolean {
    if (this.ownsCore(id) || !this.spendShards(cost)) return false;
    this.data.ownedCores.push(id);
    this.data.selectedCore = id;
    this.save();
    return true;
  }

  upgradeLevel(id: string): number {
    return this.data.upgrades[id] ?? 0;
  }

  /** Cost of the next level, or null when maxed. */
  upgradeCost(id: string): number | null {
    const def = META_UPGRADES.find((u) => u.id === id);
    if (!def) return null;
    const level = this.upgradeLevel(id);
    if (level >= def.maxLevel) return null;
    return def.costs[level] ?? null;
  }

  buyUpgrade(id: string): boolean {
    const cost = this.upgradeCost(id);
    if (cost === null || !this.spendShards(cost)) return false;
    this.data.upgrades[id] = this.upgradeLevel(id) + 1;
    this.save();
    return true;
  }

  /** Turns permanent levels into the modifier block the simulation consumes. */
  modifiers(): RunModifiers {
    const lvl = (id: string): number => this.upgradeLevel(id);
    const per = (id: string): number =>
      META_UPGRADES.find((u) => u.id === id)?.perLevel ?? 0;
    return {
      bonusHp: lvl('plating') * per('plating'),
      sweetBonus: lvl('calibration') * per('calibration'),
      turnBonus: lvl('servos') * per('servos'),
      energyBonus: lvl('capacitor') * per('capacitor'),
      shardBonus: lvl('salvage') * per('salvage'),
    };
  }

  activeMissions(rngFactory: (seed: number) => { int: (a: number, b: number) => number; shuffle: <T>(x: T[]) => T[] }): ActiveMission[] {
    this.rollDailyIfNeeded();
    const rolled = rollMissions(this.data.missions.date, rngFactory);
    return rolled.map(({ id, target }) => {
      const def = MISSIONS.find((m) => m.id === id)!;
      const progress = this.data.missions.progress[id] ?? 0;
      return {
        def,
        target,
        progress,
        claimed: this.data.missions.claimed.includes(id),
        complete: progress >= target,
      };
    });
  }

  claimMission(id: string, reward: number): boolean {
    if (this.data.missions.claimed.includes(id)) return false;
    this.data.missions.claimed.push(id);
    this.addShards(reward);
    this.save();
    return true;
  }

  /**
   * Folds a finished run into the profile. Returns the shards granted so the
   * results screen can animate them.
   */
  recordRun(
    summary: RunSummary,
    missions: ActiveMission[],
    opts: { doubled?: boolean } = {},
  ): { shards: number; newBest: boolean } {
    this.rollDailyIfNeeded();
    const newBest = summary.score > this.data.bestScore;

    this.data.runs += 1;
    this.data.totalParries += summary.parries;
    this.data.totalTurrets += summary.turretsKilled;
    if (summary.score > this.data.bestScore) this.data.bestScore = summary.score;
    if (summary.wave > this.data.bestWave) this.data.bestWave = summary.wave;
    if (summary.bestCombo > this.data.bestCombo) this.data.bestCombo = summary.bestCombo;

    const shards = Math.max(0, Math.floor(summary.shards * (opts.doubled ? 2 : 1)));
    this.addShards(shards);

    if (summary.daily) {
      if (summary.score > this.data.daily.score) {
        this.data.daily.score = summary.score;
        this.data.daily.wave = summary.wave;
      }
      this.data.daily.completed = true;
    }

    for (const m of missions) {
      const value = m.def.measure(summary);
      const prev = this.data.missions.progress[m.def.id] ?? 0;
      this.data.missions.progress[m.def.id] = m.def.cumulative
        ? prev + value
        : Math.max(prev, value);
    }

    this.save();
    return { shards, newBest };
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  /** Wipes everything. Exposed in Settings because players ask for it, and
   *  because a save they can delete is a save they trust. */
  resetAll(): void {
    this.data = defaultSave();
    this.storage.remove(SAVE_KEY);
    this.save();
  }
}

export { num as clampNumber };
