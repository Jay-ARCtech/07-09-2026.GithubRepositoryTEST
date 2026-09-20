/**
 * The Daily Challenge.
 *
 * One fixed seed per calendar day, the same for every player, with all
 * permanent upgrades switched off and a fixed core. It is the only mode where
 * two scores are directly comparable, and it is the reason to open the app
 * tomorrow - which is the single hardest retention problem in this genre.
 *
 * The date is the *local* date. Resetting on the player's midnight rather than
 * UTC is worth the small unfairness at the edges; the alternative is a daily
 * that rolls over at 4pm for a third of the world.
 */
import { Rng, hashString } from '../engine/rng';
import { CORES } from './cores';
import { todayKey } from './meta';

export interface DailyChallenge {
  date: string;
  seed: number;
  coreId: string;
  /** Short human-readable label, e.g. "EDGE - no upgrades". */
  label: string;
}

export function dailyFor(date: string = todayKey()): DailyChallenge {
  const seed = hashString(`parry-core/daily/${date}`);
  const rng = new Rng(seed);
  // Rotate through the cores regardless of what the player owns: the daily is
  // also a free trial of everything in the shop.
  const core = CORES[rng.int(0, CORES.length - 1)]!;
  return {
    date,
    seed,
    coreId: core.id,
    label: `${core.name} - no upgrades`,
  };
}

/** Seconds until the local day rolls over. */
export function secondsUntilReset(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, (next.getTime() - now.getTime()) / 1000);
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const sec = s % 60;
  return `${m}m ${sec}s`;
}
