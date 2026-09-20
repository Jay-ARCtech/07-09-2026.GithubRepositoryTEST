/**
 * Save-file and progression tests.
 *
 * A save file is untrusted input. It can be truncated by a crash, written by
 * an older build, or edited by hand. None of those should be able to crash the
 * game on launch or put the player into an unreachable state - which is what a
 * selectedCore they do not own, or a NaN shard balance, would do.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Storage, bool, int, num, numMap, str, strList } from '../src/engine/storage';
import {
  META_UPGRADES,
  MISSIONS,
  Profile,
  defaultSave,
  migrateSave,
  rollMissions,
  todayKey,
} from '../src/game/meta';
import { CORE_IDS, CORES, DEFAULT_CORE_ID } from '../src/game/cores';
import { Rng } from '../src/engine/rng';
import { dailyFor, formatCountdown, secondsUntilReset } from '../src/game/daily';
import type { RunSummary } from '../src/game/run';

/** Minimal in-memory localStorage so these tests need no DOM. */
class MemoryLocalStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  raw(k: string): string | undefined {
    return this.map.get(k);
  }
}

let mem: MemoryLocalStorage;

beforeEach(() => {
  mem = new MemoryLocalStorage();
  (globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = mem;
});

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    score: 10000,
    wave: 8,
    duration: 120,
    parries: 50,
    blocks: 6,
    absorbs: 5,
    bestCombo: 22,
    turretsKilled: 2,
    shards: 100,
    daily: false,
    coreId: DEFAULT_CORE_ID,
    seed: 1,
    ...over,
  };
}

describe('validation helpers', () => {
  it('num/int coerce and clamp hostile values', () => {
    expect(num('nonsense', 5)).toBe(5);
    expect(num(NaN, 5)).toBe(5);
    expect(num(Infinity, 5)).toBe(5);
    expect(num(-Infinity, 5)).toBe(5);
    expect(num(null, 5)).toBe(5);
    expect(num(999, 5, 0, 10)).toBe(10);
    expect(int(3.9, 0)).toBe(3);
  });

  it('bool and str reject the wrong type', () => {
    expect(bool('true', false)).toBe(false);
    expect(bool(1, true)).toBe(true);
    expect(str(42, 'fallback')).toBe('fallback');
    expect(str('nope', 'fallback', ['a', 'b'])).toBe('fallback');
    expect(str('a', 'fallback', ['a', 'b'])).toBe('a');
  });

  it('strList keeps only known ids, de-duplicated', () => {
    expect(strList(['a', 'a', 'b', 'zzz', 7], ['a', 'b'])).toEqual(['a', 'b']);
    expect(strList('not-an-array', ['a'])).toEqual([]);
    expect(strList(null, ['a'])).toEqual([]);
  });

  it('numMap drops unknown keys and clamps values', () => {
    const out = numMap({ a: 5, b: -100, evil: 9 }, ['a', 'b'], 0, 3);
    expect(out).toEqual({ a: 3, b: 0 });
    expect(numMap([], ['a'], 0, 3)).toEqual({});
    expect(numMap(null, ['a'], 0, 3)).toEqual({});
  });
});

describe('save migration', () => {
  it('produces a complete save from an empty object', () => {
    const s = migrateSave({});
    expect(s).toEqual(defaultSave());
  });

  it('never leaves the player with a core they do not own', () => {
    const s = migrateSave({ selectedCore: 'vagrant', ownedCores: [] });
    expect(s.ownedCores).toContain(DEFAULT_CORE_ID);
    expect(s.ownedCores).toContain(s.selectedCore);
    expect(s.selectedCore).toBe(DEFAULT_CORE_ID);
  });

  it('strips unknown core ids', () => {
    const s = migrateSave({ ownedCores: ['sentinel', 'not-a-core', 42] });
    expect(s.ownedCores.every((c) => CORE_IDS.includes(c))).toBe(true);
  });

  it('clamps upgrade levels to their maximum', () => {
    const s = migrateSave({ upgrades: { plating: 9999, calibration: -5, bogus: 3 } });
    const plating = META_UPGRADES.find((u) => u.id === 'plating')!;
    expect(s.upgrades['plating']).toBe(plating.maxLevel);
    expect(s.upgrades['calibration']).toBe(0);
    expect(s.upgrades['bogus']).toBeUndefined();
  });

  it('rejects malformed dates', () => {
    expect(migrateSave({ daily: { date: 'yesterday' } }).daily.date).toBe('');
    expect(migrateSave({ daily: { date: '2026-09-20' } }).daily.date).toBe('2026-09-20');
    expect(migrateSave({ missions: { date: '20/09/2026' } }).missions.date).toBe('');
  });

  it('survives every field being the wrong type', () => {
    const hostile: Record<string, unknown> = {
      version: 'v1',
      shards: 'lots',
      bestScore: NaN,
      bestWave: Infinity,
      runs: -5,
      selectedCore: 12,
      ownedCores: 'sentinel',
      upgrades: 'none',
      settings: 'on',
      daily: 7,
      missions: [],
      tutorialDone: 'yes',
      supporter: 1,
    };
    const s = migrateSave(hostile);
    expect(s.shards).toBe(0);
    expect(s.bestScore).toBe(0);
    expect(s.bestWave).toBe(0);
    expect(s.runs).toBe(0);
    expect(s.selectedCore).toBe(DEFAULT_CORE_ID);
    expect(s.tutorialDone).toBe(false);
    expect(s.supporter).toBe(false);
    expect(typeof s.settings.sfx).toBe('boolean');
  });

  it('never yields a negative or non-finite shard balance', () => {
    for (const v of [-1, -1e12, NaN, Infinity, '5', null, undefined, {}]) {
      const s = migrateSave({ shards: v });
      expect(Number.isFinite(s.shards)).toBe(true);
      expect(s.shards).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Storage', () => {
  it('round-trips a value', () => {
    const st = new Storage('t.');
    st.save('k', { a: 1, b: 'two' });
    const res = st.load('k', { a: 0, b: '' }, (raw) => ({
      a: int(raw['a'], 0),
      b: str(raw['b'], ''),
    }));
    expect(res.value).toEqual({ a: 1, b: 'two' });
    expect(res.recovered).toBe(false);
  });

  it('flags a tampered value as recovered but still migrates it', () => {
    const st = new Storage('t.');
    st.save('k', { a: 1 });
    // Hand-edit the payload without fixing the checksum.
    const raw = JSON.parse(mem.raw('t.k')!) as Record<string, unknown>;
    raw['a'] = 9999;
    mem.setItem('t.k', JSON.stringify(raw));

    const res = st.load('k', { a: 0 }, (r) => ({ a: int(r['a'], 0) }));
    expect(res.recovered).toBe(true);
    // Progress is kept, not wiped - a bad checksum is not a reason to delete
    // somebody's save.
    expect(res.value.a).toBe(9999);
  });

  it('falls back cleanly on unparseable data', () => {
    const st = new Storage('t.');
    mem.setItem('t.k', '{ this is not json');
    const res = st.load('k', { a: 7 }, (r) => ({ a: int(r['a'], 7) }));
    expect(res.value).toEqual({ a: 7 });
    expect(res.recovered).toBe(true);
  });

  it('rejects a stored array or primitive', () => {
    const st = new Storage('t.');
    mem.setItem('t.k', '[1,2,3]');
    expect(st.load('k', { a: 7 }, (r) => ({ a: int(r['a'], 7) })).recovered).toBe(true);
    mem.setItem('t.k', '"hello"');
    expect(st.load('k', { a: 7 }, (r) => ({ a: int(r['a'], 7) })).recovered).toBe(true);
  });

  it('returns the fallback when nothing is stored', () => {
    const st = new Storage('t.');
    const res = st.load('missing', { a: 3 }, (r) => ({ a: int(r['a'], 3) }));
    expect(res.value).toEqual({ a: 3 });
    expect(res.recovered).toBe(false);
  });
});

describe('Profile', () => {
  it('starts with the default core owned and nothing else', () => {
    const p = new Profile(new Storage('p.'));
    expect(p.ownsCore(DEFAULT_CORE_ID)).toBe(true);
    expect(p.shards).toBe(0);
    for (const c of CORES.filter((x) => x.cost > 0)) {
      expect(p.ownsCore(c.id)).toBe(false);
    }
  });

  it('will not buy what the player cannot afford, and does not deduct', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(10);
    expect(p.buyCore('vagrant', 6000)).toBe(false);
    expect(p.shards).toBe(10);
    expect(p.ownsCore('vagrant')).toBe(false);
  });

  it('buys, deducts and equips exactly once', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(1000);
    expect(p.buyCore('bulwark', 800)).toBe(true);
    expect(p.shards).toBe(200);
    expect(p.data.selectedCore).toBe('bulwark');
    // A second purchase of the same core must not charge again.
    expect(p.buyCore('bulwark', 800)).toBe(false);
    expect(p.shards).toBe(200);
  });

  it('refuses to spend more than the balance, or a negative amount', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(100);
    expect(p.spendShards(101)).toBe(false);
    expect(p.spendShards(-50)).toBe(false);
    expect(p.shards).toBe(100);
  });

  it('walks an upgrade to max and then stops charging', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(1e6);
    const def = META_UPGRADES.find((u) => u.id === 'calibration')!;
    for (let i = 0; i < def.maxLevel; i++) {
      expect(p.upgradeCost('calibration')).toBe(def.costs[i]);
      expect(p.buyUpgrade('calibration')).toBe(true);
    }
    expect(p.upgradeLevel('calibration')).toBe(def.maxLevel);
    expect(p.upgradeCost('calibration')).toBeNull();
    const before = p.shards;
    expect(p.buyUpgrade('calibration')).toBe(false);
    expect(p.shards).toBe(before);
  });

  it('keeps permanent modifiers small enough not to trivialise the game', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(1e7);
    for (const def of META_UPGRADES) {
      for (let i = 0; i < def.maxLevel; i++) p.buyUpgrade(def.id);
    }
    const m = p.modifiers();
    // A fully-upgraded account is a nudge, not a different game.
    expect(m.bonusHp).toBeLessThanOrEqual(2);
    expect(m.sweetBonus).toBeLessThanOrEqual(0.2);
    expect(m.turnBonus).toBeLessThanOrEqual(0.2);
    expect(m.energyBonus).toBeLessThanOrEqual(0.35);
    expect(m.shardBonus).toBeLessThanOrEqual(0.4);
  });

  it('records a run into bests and totals', () => {
    const p = new Profile(new Storage('p.'));
    const res = p.recordRun(summary({ score: 12345, wave: 9, bestCombo: 30 }), []);
    expect(res.newBest).toBe(true);
    expect(p.data.bestScore).toBe(12345);
    expect(p.data.bestWave).toBe(9);
    expect(p.data.bestCombo).toBe(30);
    expect(p.shards).toBe(res.shards);

    // A worse run does not lower the bests.
    p.recordRun(summary({ score: 10, wave: 1, bestCombo: 1 }), []);
    expect(p.data.bestScore).toBe(12345);
    expect(p.data.bestWave).toBe(9);
  });

  it('doubles shards only when the reward was actually granted', () => {
    const a = new Profile(new Storage('a.'));
    const plain = a.recordRun(summary({ shards: 200 }), []);
    const b = new Profile(new Storage('b.'));
    const doubled = b.recordRun(summary({ shards: 200 }), [], { doubled: true });
    expect(doubled.shards).toBe(plain.shards * 2);
  });

  it('accumulates cumulative missions and takes the max of single-run ones', () => {
    const p = new Profile(new Storage('p.'));
    const missions = p.activeMissions((seed) => new Rng(seed));
    p.recordRun(summary({ parries: 30, wave: 5 }), missions);
    p.recordRun(summary({ parries: 30, wave: 3 }), missions);

    for (const m of missions) {
      const progress = p.data.missions.progress[m.def.id] ?? 0;
      if (m.def.id === 'parries') expect(progress).toBe(60); // cumulative
      if (m.def.id === 'wave') expect(progress).toBe(5); // best single run
    }
  });

  it('claims a mission reward exactly once', () => {
    const p = new Profile(new Storage('p.'));
    const id = MISSIONS[0]!.id;
    expect(p.claimMission(id, 120)).toBe(true);
    expect(p.shards).toBe(120);
    expect(p.claimMission(id, 120)).toBe(false);
    expect(p.shards).toBe(120);
  });

  it('rolls the daily over when the calendar day changes', () => {
    const p = new Profile(new Storage('p.'));
    p.data.daily = { date: '2020-01-01', score: 999, wave: 9, completed: true };
    p.rollDailyIfNeeded(new Date());
    expect(p.data.daily.date).toBe(todayKey());
    expect(p.data.daily.score).toBe(0);
    expect(p.data.daily.completed).toBe(false);
  });

  it('resetAll returns a pristine profile', () => {
    const p = new Profile(new Storage('p.'));
    p.addShards(5000);
    p.buyCore('bulwark', 800);
    p.resetAll();
    expect(p.shards).toBe(0);
    expect(p.ownsCore('bulwark')).toBe(false);
    expect(p.data.selectedCore).toBe(DEFAULT_CORE_ID);
  });

  it('persists across a reload', () => {
    const st = new Storage('p.');
    const a = new Profile(st);
    a.addShards(777);
    a.save();
    const b = new Profile(new Storage('p.'));
    expect(b.shards).toBe(777);
    expect(b.recovered).toBe(false);
  });
});

describe('daily challenge', () => {
  it('is the same for a given date and different across dates', () => {
    const a = dailyFor('2026-09-20');
    const b = dailyFor('2026-09-20');
    const c = dailyFor('2026-09-21');
    expect(a).toEqual(b);
    expect(a.seed).not.toBe(c.seed);
  });

  it('always names a real core', () => {
    for (let d = 1; d <= 28; d++) {
      const day = dailyFor(`2026-02-${String(d).padStart(2, '0')}`);
      expect(CORE_IDS).toContain(day.coreId);
    }
  });

  it('rotates through more than one core over a month', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      seen.add(dailyFor(`2026-02-${String(d).padStart(2, '0')}`).coreId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('counts down to local midnight', () => {
    const secs = secondsUntilReset(new Date());
    expect(secs).toBeGreaterThan(0);
    expect(secs).toBeLessThanOrEqual(24 * 3600);
    expect(formatCountdown(3661)).toBe('1h 1m');
    expect(formatCountdown(61)).toBe('1m 1s');
    expect(formatCountdown(-5)).toBe('0m 0s');
  });
});

describe('daily missions', () => {
  it('rolls three distinct missions, stable for the day', () => {
    const a = rollMissions('2026-09-20', (s) => new Rng(s));
    const b = rollMissions('2026-09-20', (s) => new Rng(s));
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
  });

  it('only ever picks targets a mission actually defines', () => {
    for (let d = 1; d <= 31; d++) {
      const rolled = rollMissions(`2026-03-${String(d).padStart(2, '0')}`, (s) => new Rng(s));
      for (const { id, target } of rolled) {
        const def = MISSIONS.find((m) => m.id === id)!;
        expect(def.targets).toContain(target);
      }
    }
  });
});
