/**
 * In-run upgrades: pick one of three, every few waves.
 *
 * This is the roguelite hook that turns a 90-second arcade loop into a run with
 * a shape. It is also the cheapest possible source of variety - the same waves
 * feel different because your build is different.
 *
 * Every effect is a flat modifier applied in RunState. Nothing here touches
 * persistent progression, so a good run cannot be bought.
 */

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  /** Max times this can be taken in one run. */
  maxStacks: number;
  /** Relative offer weight. */
  weight: number;
  /** Only offered from this wave on. */
  minWave?: number;
  /** Offer this only if the predicate passes (e.g. below max health). */
  rarity?: 'common' | 'rare';
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'wide',
    name: 'BROAD FIELD',
    desc: '+14% shield width',
    maxStacks: 4,
    weight: 100,
  },
  {
    id: 'sweet',
    name: 'FINE EDGE',
    desc: '+16% sweet spot',
    maxStacks: 4,
    weight: 100,
  },
  {
    id: 'servo',
    name: 'SERVO BOOST',
    desc: '+18% shield turn speed',
    maxStacks: 3,
    weight: 90,
  },
  {
    id: 'plate',
    name: 'REPAIR PLATE',
    desc: '+1 max integrity, and repair 1',
    maxStacks: 3,
    weight: 80,
  },
  {
    id: 'siphon',
    name: 'SIPHON',
    desc: '+55% energy gain',
    maxStacks: 3,
    weight: 78,
  },
  {
    id: 'kinetic',
    name: 'KINETIC RETURN',
    desc: 'Parried shots hit turrets twice as hard',
    maxStacks: 2,
    weight: 70,
    minWave: 6,
  },
  {
    id: 'aftershock',
    name: 'AFTERSHOCK',
    desc: 'Each parry destroys one shot closing in beside you',
    maxStacks: 2,
    weight: 72,
  },
  {
    id: 'greed',
    name: 'SALVAGE RIG',
    desc: '+25% shards from this run',
    maxStacks: 3,
    weight: 66,
  },
  {
    id: 'adrenaline',
    name: 'ADRENALINE',
    desc: 'At 1 integrity: +30% sweet spot and +15% turn speed',
    maxStacks: 1,
    weight: 60,
    rarity: 'rare',
  },
  {
    id: 'secondwind',
    name: 'SECOND WIND',
    desc: 'Survive one fatal hit per run',
    maxStacks: 1,
    weight: 52,
    rarity: 'rare',
    minWave: 5,
  },
  {
    id: 'chain',
    name: 'CHAIN REACTION',
    desc: 'Overdrive blasts are 40% larger and grant 2s of shielding',
    maxStacks: 2,
    weight: 58,
    minWave: 5,
  },
  {
    id: 'momentum',
    name: 'MOMENTUM',
    desc: 'Every 10 chain: +4% score multiplier for the run',
    maxStacks: 3,
    weight: 62,
  },
  {
    id: 'counterweight',
    name: 'COUNTERWEIGHT',
    desc: 'Heavy shots no longer knock your shield off aim',
    maxStacks: 2,
    weight: 56,
    minWave: 4,
  },
  {
    id: 'harvest',
    name: 'VOID HARVEST',
    desc: 'Absorbed void orbs repair 1 integrity every 6th absorb',
    maxStacks: 2,
    weight: 58,
    minWave: 6,
  },
] as const;

export const UPGRADE_IDS: readonly string[] = UPGRADES.map((u) => u.id);

export function getUpgrade(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

/**
 * Chooses `count` distinct upgrades that are legal for the current run state.
 *
 * Offers are filtered, not re-rolled on collision, so a maxed-out build never
 * shows a dead option. If fewer than `count` remain legal, fewer are returned
 * and the UI narrows accordingly.
 */
export function rollUpgradeChoices(
  rng: { weighted: <T>(items: readonly T[], w: (i: T) => number) => T },
  wave: number,
  stacks: Readonly<Record<string, number>>,
  count = 3,
): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => {
    if ((stacks[u.id] ?? 0) >= u.maxStacks) return false;
    if (u.minWave !== undefined && wave < u.minWave) return false;
    return true;
  });

  const chosen: UpgradeDef[] = [];
  const remaining = [...pool];
  while (chosen.length < count && remaining.length > 0) {
    const pick = rng.weighted(remaining, (u) => {
      // Rare upgrades stay rare, but become more likely the deeper the run goes
      // - they are the ones that define a build, and a 30-wave run should get
      // to see one.
      const depthBonus = u.rarity === 'rare' ? 1 + Math.min(1.2, wave / 18) : 1;
      return u.weight * depthBonus;
    });
    chosen.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return chosen;
}
