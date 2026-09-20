/**
 * Every tuning number in the game lives here.
 *
 * Balance is an iterative process and it is much cheaper to iterate when the
 * numbers are in one file instead of scattered through the simulation. Nothing
 * in here depends on the DOM, so tests can import it freely.
 */

export const PALETTE = {
  bg: '#05060d',
  bgGrid: 'rgba(77, 226, 255, 0.045)',
  ink: '#e8f0ff',
  inkDim: 'rgba(232, 240, 255, 0.52)',
  inkFaint: 'rgba(232, 240, 255, 0.24)',
  accent: '#4de2ff',
  accentDim: 'rgba(77, 226, 255, 0.28)',
  shield: '#4de2ff',
  sweet: '#ffffff',
  energy: '#7cffb2',
  danger: '#ff4d6d',
  gold: '#ffd75e',
  panel: 'rgba(10, 14, 28, 0.92)',
  panelEdge: 'rgba(77, 226, 255, 0.22)',
} as const;

/** Per-projectile visual identity. Colour is the primary readability channel. */
export const PROJ_COLORS = {
  basic: '#56d6ff',
  swift: '#ffd75e',
  heavy: '#ff8a3d',
  splitter: '#ff5ea8',
  void: '#a56bff',
  armored: '#e8f0ff',
} as const;

export type ProjKind = keyof typeof PROJ_COLORS;

export const ARENA = {
  /** Radius of the shield's orbit, as a fraction of the playfield radius. */
  shieldOrbit: 0.46,
  /** Radius of the core, as a fraction of the playfield radius. */
  coreRadius: 0.135,
  /** Where projectiles enter, as a fraction of the playfield radius. */
  spawnRadius: 1.12,
  /** Past this, a parried projectile has left the arena. */
  despawnRadius: 1.45,
  /** Turrets sit just inside the spawn ring. */
  turretRadius: 1.0,
  /** Shield band half-thickness, as a fraction of the playfield radius.
   *  Used for collision; the drawn thickness is derived from it. */
  shieldHalfThickness: 0.024,
} as const;

export const SHIELD = {
  /** Sweet spot as a fraction of the shield's half-arc. */
  baseSweetFraction: 0.45,
  /** Hard ceiling so upgrades can never make the whole shield a sweet spot. */
  maxSweetFraction: 0.82,
  maxHalfArc: 0.72,
  /** Seconds the shield is disabled after mis-blocking a void orb. */
  stunDuration: 0.55,
  /** Radians of angular recoil from blocking (not parrying) a heavy shot. */
  heavyRecoil: 0.42,
  recoilDecay: 9,
} as const;

export const COMBO = {
  /** Seconds of inactivity before the chain drops. */
  window: 3.2,
  /** Parries per multiplier step. */
  step: 5,
  multiplierPerStep: 0.5,
  maxMultiplier: 8,
  /**
   * Every Nth unbroken parry repairs one point of integrity, at most once per
   * wave.
   *
   * This is the run-extender, and it is deliberately skill-gated rather than
   * an HP buff: raising starting health would flatten the difference between a
   * careless player and a good one, which is exactly what makes an arcade game
   * feel pointless. A 30-chain is earned, and earning it is what buys runway.
   */
  repairAt: 30,
} as const;

export const SCORE = {
  parry: 100,
  block: 20,
  absorb: 60,
  turret: 750,
  waveClear: 250,
  /** Score per second of survival, to reward pace over turtling. */
  perSecond: 5,
} as const;

export const ENERGY = {
  max: 100,
  perParry: 2.2,
  perAbsorb: 14,
  /** Overdrive shockwave expands to this fraction of the playfield radius. */
  blastRadius: 1.15,
  blastDuration: 0.55,
} as const;

export const HEALTH = {
  /** Seconds of invulnerability after taking a hit. */
  invulnAfterHit: 1.1,
  /** After a hit, every inbound projectile inside this radius (as a fraction
   *  of the playfield) is cleared, so a cluster can never take two lives in
   *  one beat. Being chain-killed by shots already past the shield is the
   *  single most-reported unfairness in this genre. */
  clearRadius: 0.62,
} as const;

export const WAVES = {
  firstWaveDelay: 1.6,
  /** Seconds of breathing room between waves. */
  intermission: 2.4,
  baseDuration: 11,
  durationGrowth: 0.55,
  maxDuration: 24,
  /** Seconds between spawns at wave 1, and the floor it decays toward. */
  baseInterval: 1.5,
  minInterval: 0.3,
  intervalDecay: 0.945,
  /** An upgrade choice is offered after every Nth wave. */
  upgradeEvery: 4,
  /** Waves at which each projectile type is introduced. */
  unlocks: {
    basic: 1,
    swift: 2,
    heavy: 3,
    void: 5,
    splitter: 8,
    armored: 10,
  } as Record<ProjKind, number>,
  /** First wave that can contain turrets, and the cap on how many. */
  turretFirstWave: 6,
  turretMax: 4,
  /** Waves per additional concurrent turret. */
  turretWavesPerSlot: 4,
} as const;

export interface ProjSpec {
  kind: ProjKind;
  /** World units per second at the reference playfield size. */
  speed: number;
  radius: number;
  /** Damage dealt to the core on contact. */
  damage: number;
  /** Radians per second of lateral curve (sign randomised at spawn). */
  curve: number;
  /** Relative spawn weight once unlocked. */
  weight: number;
  hp: number;
}

/**
 * Speeds are expressed as a fraction of the playfield radius per second, so the
 * game plays identically on a small phone and a tablet. A "1.0" projectile
 * crosses from the spawn ring to the core in roughly one second.
 */
export const PROJ_SPECS: Record<ProjKind, ProjSpec> = {
  basic: { kind: 'basic', speed: 0.30, radius: 0.033, damage: 1, curve: 0, weight: 100, hp: 1 },
  swift: { kind: 'swift', speed: 0.46, radius: 0.028, damage: 1, curve: 0.26, weight: 55, hp: 1 },
  heavy: { kind: 'heavy', speed: 0.19, radius: 0.055, damage: 1, curve: 0, weight: 44, hp: 1 },
  void: { kind: 'void', speed: 0.26, radius: 0.040, damage: 0, curve: 0.15, weight: 34, hp: 1 },
  splitter: { kind: 'splitter', speed: 0.27, radius: 0.045, damage: 1, curve: 0, weight: 32, hp: 1 },
  armored: { kind: 'armored', speed: 0.22, radius: 0.046, damage: 1, curve: 0, weight: 26, hp: 1 },
};

export const TURRET = {
  hp: 3,
  radius: 0.062,
  /** Seconds between shots; scales down slightly with wave number. */
  fireInterval: 3.4,
  minFireInterval: 1.5,
  shardReward: 6,
} as const;

export const ECONOMY = {
  /** Shards awarded per 1000 points of final score. */
  shardsPerKScore: 6,
  /** Flat shards for each wave cleared. */
  shardsPerWave: 4,
  /** Rewarded-video multiplier on end-of-run shards (fully optional). */
  rewardedMultiplier: 2,
  dailyCompletionBonus: 60,
} as const;

/** Speed ramp applied to every projectile as the run goes on. */
export function waveSpeedScale(wave: number): number {
  // Asymptotic rather than linear: difficulty should come mostly from
  // projectile variety and arrival density, not from speeds that eventually
  // outrun human reaction time. Caps at just over +100%.
  return 1 + 1.05 * (1 - Math.exp(-(wave - 1) / 11));
}

/** Seconds a wave lasts. */
export function waveDuration(wave: number): number {
  return Math.min(WAVES.maxDuration, WAVES.baseDuration + (wave - 1) * WAVES.durationGrowth);
}

/** Seconds between spawns during a wave. */
export function waveInterval(wave: number): number {
  return Math.max(WAVES.minInterval, WAVES.baseInterval * Math.pow(WAVES.intervalDecay, wave - 1));
}

/** How many projectiles a single spawn event queues up. */
export function waveBurstSize(wave: number): number {
  if (wave < 6) return 1;
  if (wave < 14) return 2;
  if (wave < 22) return 3;
  return 4;
}

/**
 * Minimum seconds between two shots *arriving* at the shield at different
 * angles.
 *
 * This is the fairness guarantee of the whole game. The shield needs
 * PI / turnRate seconds (about 0.29s on the default core) to cross the arena,
 * plus human reaction time. If two shots from opposite sides land closer
 * together than that, one of them is unavoidable - and an unavoidable hit is
 * the difference between "hard" and "cheap".
 *
 * Note this gates ARRIVAL, not spawning. Spacing spawns is not enough: a swift
 * shot released 0.7s after a heavy one overtakes it and they land together.
 * Every shot in the game - wave shots and turret shots alike - is scheduled
 * against its own predicted flight time.
 *
 * The gap tightens with the wave number but never drops below what is
 * physically reachable.
 */
export function minArrivalGap(wave: number): number {
  return Math.max(0.32, 0.82 - wave * 0.032);
}

/**
 * Seconds until a shot of `kind`, travelling at `speed` from `fromRadius`,
 * first makes contact with the shield.
 *
 * Contact begins at the OUTER EDGE of the shield band, not at the shield's
 * centre line: a projectile touches when `r - radius` reaches
 * `shieldOrbit + shieldHalfThickness`. Measuring to the centre line instead
 * looks almost right and is badly wrong in practice - a fat, slow heavy shot
 * lands 0.37s earlier than a centre-line estimate while a thin, fast swift
 * lands only 0.08s early, so scheduling on the centre line lets two shots
 * arrive ~0.3s closer together than intended. That is exactly the gap between
 * a hit the player could have reached and one they could not.
 */
export function flightTime(kind: ProjKind, speed: number, fromRadius: number): number {
  const contactRadius = ARENA.shieldOrbit + ARENA.shieldHalfThickness + PROJ_SPECS[kind].radius;
  return Math.max(0, (fromRadius - contactRadius) / Math.max(speed, 1e-4));
}

/** Nominal speed of a projectile kind at a given wave, before per-shot jitter. */
export function baseSpeed(kind: ProjKind, wave: number): number {
  return PROJ_SPECS[kind].speed * waveSpeedScale(wave);
}

/**
 * Probability that a queued shot arrives as a *twin* - a second shot at almost
 * the same angle, released simultaneously. Twins are free density: one correct
 * shield position covers both, so they raise the intensity without breaking
 * the reachability rule above.
 */
export function twinChance(wave: number): number {
  if (wave < 3) return 0;
  return Math.min(0.8, (wave - 2) * 0.06);
}

/**
 * Chance that a twin becomes a *triplet*. Same reasoning as twins: three shots
 * inside one shield width is dense and loud but still a single correct answer.
 */
export function tripletChance(wave: number): number {
  if (wave < 9) return 0;
  return Math.min(0.5, (wave - 8) * 0.04);
}
