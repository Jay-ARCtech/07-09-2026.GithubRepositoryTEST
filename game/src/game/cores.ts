/**
 * Playable cores.
 *
 * Cores are the meta layer's "characters". Each one is a genuine trade-off
 * rather than a strict upgrade - the starter core is competitive at the highest
 * level, and nothing purchasable is strictly stronger than what you begin with.
 * That is a deliberate stance against the pay-to-win pattern that dominates
 * negative reviews of casual games.
 */

export interface CoreDef {
  id: string;
  name: string;
  tagline: string;
  /** Shield half-arc in radians. Total coverage is twice this. */
  halfArc: number;
  /** Sweet-spot span as a fraction of the half-arc. */
  sweetFraction: number;
  /** Max shield angular velocity, radians/second. */
  turnRate: number;
  maxHp: number;
  energyGain: number;
  shardGain: number;
  /** Shard price. 0 = owned from the start. */
  cost: number;
  /** Plain-language summary shown in the core select screen. */
  perks: string[];
}

export const CORES: readonly CoreDef[] = [
  {
    id: 'sentinel',
    name: 'SENTINEL',
    tagline: 'The honest one',
    halfArc: 0.36,
    sweetFraction: 0.45,
    turnRate: 11,
    maxHp: 3,
    energyGain: 1,
    shardGain: 1,
    cost: 0,
    perks: ['Balanced in every direction', 'Nothing to learn around'],
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    tagline: 'Forgiving, slow',
    halfArc: 0.5,
    sweetFraction: 0.32,
    turnRate: 8.6,
    maxHp: 4,
    energyGain: 0.9,
    shardGain: 0.95,
    cost: 800,
    perks: ['+1 core integrity', 'Widest shield', 'Turns slowly, narrow sweet spot'],
  },
  {
    id: 'edge',
    name: 'EDGE',
    tagline: 'All precision',
    halfArc: 0.25,
    sweetFraction: 0.62,
    turnRate: 13.5,
    maxHp: 2,
    energyGain: 1.1,
    shardGain: 1.15,
    cost: 2000,
    perks: ['Huge sweet spot', 'Fastest turn', 'Only 2 integrity, tiny shield'],
  },
  {
    id: 'flux',
    name: 'FLUX',
    tagline: 'Overdrive engine',
    halfArc: 0.33,
    sweetFraction: 0.44,
    turnRate: 11.5,
    maxHp: 3,
    energyGain: 1.75,
    shardGain: 1,
    cost: 3600,
    perks: ['+75% energy gain', 'Overdrive constantly', 'Slightly narrower shield'],
  },
  {
    id: 'vagrant',
    name: 'VAGRANT',
    tagline: 'One mistake',
    halfArc: 0.34,
    sweetFraction: 0.55,
    turnRate: 12.5,
    maxHp: 1,
    energyGain: 1.2,
    shardGain: 1.7,
    cost: 6000,
    perks: ['+70% shards', 'Large sweet spot', 'A single hit ends the run'],
  },
] as const;

export const DEFAULT_CORE_ID = 'sentinel';

export function getCore(id: string): CoreDef {
  return CORES.find((c) => c.id === id) ?? CORES[0]!;
}

export const CORE_IDS: readonly string[] = CORES.map((c) => c.id);
