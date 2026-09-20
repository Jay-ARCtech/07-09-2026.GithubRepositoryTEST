/**
 * PARRY CORE - the simulation.
 *
 * This module is deliberately free of any DOM, canvas, audio or timing API. It
 * takes input, advances by a fixed dt, and emits a queue of events describing
 * what happened. The presentation layer drains that queue and turns it into
 * particles, sound, haptics and screen shake.
 *
 * Separating the two this way means the entire game can be simulated headlessly
 * in a unit test - including a full 30-wave run - which is how the balance
 * numbers in config.ts were sanity-checked.
 *
 * All positions are polar and expressed as a *fraction of the playfield radius*
 * (r = 1.0 is the arena boundary). Nothing here knows about pixels, so the game
 * plays identically on a 4.7" phone and a 13" tablet.
 */
import { Rng } from '../engine/rng';
import { TAU, angleDelta, angleDistance, clamp, normAngle, rotateToward } from '../engine/math';
import {
  ARENA,
  COMBO,
  ECONOMY,
  ENERGY,
  HEALTH,
  PROJ_SPECS,
  SCORE,
  SHIELD,
  TURRET,
  WAVES,
  type ProjKind,
  baseSpeed,
  flightTime,
  minArrivalGap,
  tripletChance,
  twinChance,
  waveBurstSize,
  waveDuration,
  waveInterval,
  waveSpeedScale,
} from './config';
import { getCore, type CoreDef } from './cores';
import { UPGRADES, rollUpgradeChoices, type UpgradeDef } from './upgrades';

export type RunPhase = 'intro' | 'wave' | 'intermission' | 'upgrade' | 'over';

export interface Projectile {
  active: boolean;
  kind: ProjKind;
  /** Radius as a fraction of the playfield radius. */
  r: number;
  /** Radius at the start of the step - used for swept collision. */
  prevR: number;
  /** Angle in radians. */
  a: number;
  /** Inward speed in radius-fractions per second (always positive). */
  speed: number;
  /** Lateral drift, radians per second. */
  curve: number;
  radius: number;
  damage: number;
  /** True once parried: now travelling outward and dangerous to turrets. */
  outbound: boolean;
  /** Damage this projectile deals to a turret. */
  power: number;
  /** Armoured shots bounce outward on a plain block and come back. */
  returning: boolean;
  /** 0..1 fade-in telegraph. */
  telegraph: number;
  age: number;
  /** True once the shield has touched this shot during its contact window. */
  touched: boolean;
  /** Best (smallest) normalised angular offset seen while in contact. */
  bestOffset: number;
  id: number;
}

export interface Turret {
  active: boolean;
  a: number;
  hp: number;
  maxHp: number;
  fireT: number;
  spawnT: number;
  hitFlash: number;
  id: number;
}

/** Everything the presentation layer needs to react to. Positions are polar. */
export type RunEvent =
  | { t: 'parry'; r: number; a: number; kind: ProjKind; combo: number; multiplier: number }
  | { t: 'block'; r: number; a: number; kind: ProjKind }
  | { t: 'absorb'; r: number; a: number }
  | { t: 'stun'; r: number; a: number }
  | { t: 'recoil'; dir: number }
  | { t: 'shockwave'; r: number; a: number }
  | { t: 'hurt'; r: number; a: number; hp: number }
  | { t: 'heal'; hp: number }
  | { t: 'secondWind' }
  | { t: 'turretHit'; r: number; a: number }
  | { t: 'turretDead'; r: number; a: number }
  | { t: 'turretSpawn'; a: number }
  | { t: 'overdriveReady' }
  | { t: 'overdrive' }
  | { t: 'spawn'; r: number; a: number; kind: ProjKind }
  | { t: 'waveStart'; wave: number }
  | { t: 'waveEnd'; wave: number }
  | { t: 'upgradeOffer' }
  | { t: 'upgradeTaken'; id: string }
  | { t: 'comboBreak'; combo: number }
  | { t: 'gameOver'; score: number }
  | { t: 'firstSight'; kind: ProjKind };

/** Permanent (meta) modifiers. Small on purpose - see docs/DESIGN.md. */
export interface RunModifiers {
  bonusHp: number;
  sweetBonus: number;
  turnBonus: number;
  energyBonus: number;
  shardBonus: number;
}

export const NO_MODIFIERS: RunModifiers = {
  bonusHp: 0,
  sweetBonus: 0,
  turnBonus: 0,
  energyBonus: 0,
  shardBonus: 0,
};

export interface RunOptions {
  seed: number;
  coreId: string;
  modifiers?: RunModifiers;
  /** Daily runs ignore meta modifiers so every player faces the same run. */
  daily?: boolean;
  /** Skips the opening tutorial callouts. */
  skipTutorial?: boolean;
}

export interface RunSummary {
  score: number;
  wave: number;
  duration: number;
  parries: number;
  blocks: number;
  absorbs: number;
  bestCombo: number;
  turretsKilled: number;
  shards: number;
  daily: boolean;
  coreId: string;
  seed: number;
}

const MAX_PROJECTILES = 96;
const MAX_TURRETS = 8;
const TELEGRAPH_TIME = 0.32;
/** Hard cap on the spawn queue; beyond this the wave director stops adding. */
const MAX_QUEUED = 12;

/** A shot waiting for its turn at the spawn gate. */
interface PendingSpawn {
  kind: ProjKind;
  angle: number;
  radius: number;
  /**
   * The exact speed this shot will fly at, decided here rather than at spawn.
   *
   * The gate schedules on predicted arrival, so the prediction has to use the
   * real speed. Deciding it at spawn instead - with a per-shot jitter the gate
   * never saw - let two shots land up to 0.1s closer together than the shield
   * could travel.
   */
  speed: number;
  /** Extra shots released at the same instant, at nearly the same angle. */
  extra: number;
}

export class Run {
  readonly rng: Rng;
  readonly core: CoreDef;
  readonly mods: RunModifiers;
  readonly daily: boolean;
  readonly seed: number;

  phase: RunPhase = 'intro';
  phaseT = 0;
  time = 0;

  wave = 0;
  waveT = 0;
  waveLength = 0;
  spawnT = 0;

  /** Player-facing shield angle, already including recoil. */
  shieldAngle = -Math.PI / 2;
  targetAngle = -Math.PI / 2;
  recoil = 0;
  stunT = 0;

  hp = 3;
  maxHp = 3;
  invulnT = 0;
  energy = 0;
  overdriveReady = false;

  blastActive = false;
  blastR = 0;
  blastT = 0;
  private blastHitTurrets = new Set<number>();

  combo = 0;
  comboT = 0;
  bestCombo = 0;
  scoreBonus = 0;
  private momentumTier = 0;
  private repairsThisWave = 0;

  score = 0;
  parries = 0;
  blocks = 0;
  absorbs = 0;
  turretsKilled = 0;

  /** Upgrade id -> stack count. */
  stacks: Record<string, number> = {};
  pendingChoices: UpgradeDef[] = [];
  private secondWindUsed = false;

  projectiles: Projectile[] = [];
  turrets: Turret[] = [];
  events: RunEvent[] = [];

  /**
   * Every shot in the game passes through this queue and is released by a
   * single rate-limited gate. See `minSpawnGap` in config.ts: this is what
   * guarantees the player can physically reach every threat.
   */
  private queue: PendingSpawn[] = [];
  /** Sim time at which the last released shot is predicted to reach the shield. */
  private lastArrival = -99;

  /** Kinds the player has already met, for one-time tutorial callouts. */
  private seen = new Set<ProjKind>();
  private nextId = 1;
  private absorbCount = 0;

  constructor(opts: RunOptions) {
    this.rng = new Rng(opts.seed);
    this.seed = opts.seed;
    this.core = getCore(opts.coreId);
    this.daily = opts.daily === true;
    this.mods = opts.daily ? NO_MODIFIERS : (opts.modifiers ?? NO_MODIFIERS);

    this.maxHp = this.core.maxHp + this.mods.bonusHp;
    this.hp = this.maxHp;
    this.phaseT = WAVES.firstWaveDelay;

    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push({
        active: false,
        kind: 'basic',
        r: 0,
        prevR: 0,
        a: 0,
        speed: 0,
        curve: 0,
        radius: 0,
        damage: 1,
        outbound: false,
        power: 1,
        returning: false,
        telegraph: 0,
        age: 0,
        touched: false,
        bestOffset: 99,
        id: 0,
      });
    }
    for (let i = 0; i < MAX_TURRETS; i++) {
      this.turrets.push({
        active: false,
        a: 0,
        hp: 0,
        maxHp: TURRET.hp,
        fireT: 0,
        spawnT: 0,
        hitFlash: 0,
        id: 0,
      });
    }
    if (opts.skipTutorial) {
      for (const k of Object.keys(PROJ_SPECS) as ProjKind[]) this.seen.add(k);
    }
  }

  // --- Derived stats --------------------------------------------------------

  private stack(id: string): number {
    return this.stacks[id] ?? 0;
  }

  /** Shield half-arc in radians, after every modifier. */
  get halfArc(): number {
    const widened = this.core.halfArc * (1 + 0.14 * this.stack('wide'));
    return Math.min(SHIELD.maxHalfArc, widened);
  }

  /** Sweet-spot span as a fraction of the half-arc. */
  get sweetFraction(): number {
    let f = this.core.sweetFraction;
    f *= 1 + 0.16 * this.stack('sweet');
    f *= 1 + this.mods.sweetBonus;
    if (this.stack('adrenaline') > 0 && this.hp <= 1) f *= 1.3;
    return Math.min(SHIELD.maxSweetFraction, f);
  }

  get turnRate(): number {
    let t = this.core.turnRate;
    t *= 1 + 0.18 * this.stack('servo');
    t *= 1 + this.mods.turnBonus;
    if (this.stack('adrenaline') > 0 && this.hp <= 1) t *= 1.15;
    return t;
  }

  get energyGain(): number {
    return this.core.energyGain * (1 + 0.55 * this.stack('siphon')) * (1 + this.mods.energyBonus);
  }

  get multiplier(): number {
    const steps = Math.floor(this.combo / COMBO.step);
    const m = 1 + steps * COMBO.multiplierPerStep + this.scoreBonus;
    return Math.min(COMBO.maxMultiplier, m);
  }

  get isOver(): boolean {
    return this.phase === 'over';
  }

  get waitingForUpgrade(): boolean {
    return this.phase === 'upgrade';
  }

  /** Effective shield centre, recoil included. */
  get shieldCenter(): number {
    return normAngle(this.shieldAngle + this.recoil);
  }

  // --- Input ----------------------------------------------------------------

  setAim(angle: number | null): void {
    if (angle !== null) this.targetAngle = angle;
  }

  /** Applies the chosen upgrade and resumes the run. */
  chooseUpgrade(id: string): void {
    if (this.phase !== 'upgrade') return;
    const def = UPGRADES.find((u) => u.id === id);
    if (!def || !this.pendingChoices.some((c) => c.id === id)) return;

    this.stacks[id] = this.stack(id) + 1;
    this.events.push({ t: 'upgradeTaken', id });

    if (id === 'plate') {
      this.maxHp += 1;
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.events.push({ t: 'heal', hp: this.hp });
    }
    this.pendingChoices = [];
    this.beginIntermission();
  }

  /** Skips the offer without taking anything (used by the back button). */
  declineUpgrade(): void {
    if (this.phase !== 'upgrade') return;
    this.pendingChoices = [];
    this.beginIntermission();
  }

  // --- Main step ------------------------------------------------------------

  update(dt: number): void {
    if (this.phase === 'over' || this.phase === 'upgrade') return;

    this.time += dt;
    this.score += SCORE.perSecond * dt;

    this.updateShield(dt);
    this.updateTimers(dt);
    this.updatePhase(dt);
    this.updateSpawnGate();
    this.updateProjectiles(dt);
    this.updateTurrets(dt);
    this.updateBlast(dt);
  }

  private updateShield(dt: number): void {
    if (this.stunT > 0) {
      this.stunT -= dt;
    } else {
      this.shieldAngle = rotateToward(this.shieldAngle, this.targetAngle, this.turnRate * dt);
    }
    if (this.recoil !== 0) {
      const decay = Math.exp(-SHIELD.recoilDecay * dt);
      this.recoil *= decay;
      if (Math.abs(this.recoil) < 0.0015) this.recoil = 0;
    }
  }

  private updateTimers(dt: number): void {
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) {
        this.events.push({ t: 'comboBreak', combo: this.combo });
        this.combo = 0;
      }
    }
  }

  private updatePhase(dt: number): void {
    this.phaseT -= dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT <= 0) this.startWave();
        break;
      case 'intermission':
        if (this.phaseT <= 0) this.startWave();
        break;
      case 'wave': {
        this.waveT += dt;
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.waveT < this.waveLength) {
          this.queueBurst();
          this.spawnT = waveInterval(this.wave) * this.rng.range(0.82, 1.18);
        }
        if (this.waveT >= this.waveLength) this.endWave();
        break;
      }
      default:
        break;
    }
  }

  private startWave(): void {
    this.wave += 1;
    this.phase = 'wave';
    this.waveT = 0;
    this.repairsThisWave = 0;
    this.waveLength = waveDuration(this.wave);
    this.spawnT = 0.35;
    this.events.push({ t: 'waveStart', wave: this.wave });
    this.maybeSpawnTurret();
  }

  private endWave(): void {
    this.score += SCORE.waveClear * this.multiplier;
    this.events.push({ t: 'waveEnd', wave: this.wave });

    if (this.wave % WAVES.upgradeEvery === 0) {
      this.pendingChoices = rollUpgradeChoices(this.rng, this.wave, this.stacks, 3);
      if (this.pendingChoices.length > 0) {
        this.phase = 'upgrade';
        this.events.push({ t: 'upgradeOffer' });
        return;
      }
    }
    this.beginIntermission();
  }

  private beginIntermission(): void {
    this.phase = 'intermission';
    this.phaseT = WAVES.intermission;
    // Drop anything still queued: the intermission is meant to be a breather,
    // and a backlog draining into it would quietly delete that breather.
    this.queue.length = 0;
  }

  // --- Spawning -------------------------------------------------------------

  private unlockedKinds(): ProjKind[] {
    const out: ProjKind[] = [];
    for (const kind of Object.keys(PROJ_SPECS) as ProjKind[]) {
      if (this.wave >= WAVES.unlocks[kind]) out.push(kind);
    }
    return out;
  }

  /** Queues a wave's worth of shots. Release timing is the gate's job. */
  private queueBurst(): void {
    const kinds = this.unlockedKinds();
    if (kinds.length === 0) return;

    const count = waveBurstSize(this.wave);
    for (let i = 0; i < count; i++) {
      if (this.queue.length >= MAX_QUEUED) return;
      const kind = this.rng.weighted(kinds, (k) => {
        const spec = PROJ_SPECS[k];
        // Newly unlocked kinds are over-represented for two waves so the player
        // actually gets to learn them instead of meeting one every 40 seconds.
        const recent = this.wave - WAVES.unlocks[k];
        const freshness = recent <= 2 ? 1.9 : 1;
        return spec.weight * freshness;
      });
      this.queue.push({
        kind,
        angle: this.rng.next() * TAU,
        radius: ARENA.spawnRadius,
        speed: baseSpeed(kind, this.wave) * this.rng.range(0.94, 1.06),
        // Twins never apply to void orbs: a void twin next to a real threat
        // would punish the correct read, which is the opposite of the point.
        extra:
          kind === 'void' || !this.rng.chance(twinChance(this.wave))
            ? 0
            : this.rng.chance(tripletChance(this.wave))
              ? 2
              : 1,
      });
    }
  }

  /**
   * The spawn gate.
   *
   * Releases a queued shot only once its *predicted arrival* at the shield is
   * at least `minArrivalGap` after the previous shot's. Holding a shot back
   * costs nothing - time advances, its predicted arrival advances with it, and
   * it goes out on a later step. What this buys is the invariant that no two
   * separately-angled threats ever land closer together than the shield can
   * travel.
   */
  private updateSpawnGate(): void {
    const next = this.queue[0];
    if (!next) return;

    const arrival = this.time + flightTime(next.kind, next.speed, next.radius);
    if (arrival < this.lastArrival + minArrivalGap(this.wave)) return;

    this.queue.shift();
    this.lastArrival = arrival;

    const lead = this.spawnProjectile(next.kind, next.angle, next.radius, next.speed);
    for (let i = 0; i < next.extra; i++) {
      // Within 80% of the shield's half-arc: one correct position covers the
      // whole cluster, so extras add intensity without breaking reachability.
      const side = i % 2 === 0 ? 1 : -1;
      const offset = this.rng.range(0.35, 0.8) * this.halfArc * side;
      const extra = this.spawnProjectile(next.kind, next.angle + offset, next.radius, next.speed);
      // Extras inherit the lead shot's speed and curve. Without this they get
      // their own random curve sign and drift apart in flight, so a cluster
      // that was coverable at spawn arrives spread across an arc the shield
      // cannot span - an unavoidable hit dressed up as a twin.
      if (extra && lead) {
        extra.speed = lead.speed;
        extra.curve = lead.curve;
      }
    }
  }

  /** Turret shots use the same gate, so they cannot ambush a wave shot. */
  private queueTurretShot(kind: ProjKind, angle: number): void {
    if (this.queue.length >= MAX_QUEUED) return;
    this.queue.push({
      kind,
      angle,
      radius: ARENA.turretRadius - 0.04,
      speed: baseSpeed(kind, this.wave) * this.rng.range(0.94, 1.06),
      extra: 0,
    });
  }

  /**
   * Puts a bounced-out shot back at the head of the queue. It jumps the line
   * because it has already been in flight once; the cap is bypassed for the
   * same reason - the number of shots that can be in the bounce state is
   * bounded by the projectile pool, and silently deleting one would make a
   * blocked armoured shell vanish.
   */
  private requeue(kind: ProjKind, angle: number): void {
    this.queue.unshift({
      kind,
      angle,
      radius: ARENA.spawnRadius,
      // A returning shot comes back a little faster - it is the price of
      // blocking instead of parrying.
      speed: baseSpeed(kind, this.wave) * this.rng.range(1.02, 1.12),
      extra: 0,
    });
  }

  spawnProjectile(
    kind: ProjKind,
    angle: number,
    fromRadius: number = ARENA.spawnRadius,
    speed?: number,
  ): Projectile | null {
    const p = this.projectiles.find((x) => !x.active);
    if (!p) return null; // pool saturated - dropping a shot beats a stutter

    const spec = PROJ_SPECS[kind];
    p.active = true;
    p.kind = kind;
    p.r = fromRadius;
    p.prevR = fromRadius;
    p.a = normAngle(angle);
    p.speed = speed ?? baseSpeed(kind, this.wave) * this.rng.range(0.94, 1.06);
    p.curve = spec.curve === 0 ? 0 : spec.curve * (this.rng.chance(0.5) ? 1 : -1);
    p.radius = spec.radius;
    p.damage = spec.damage;
    p.outbound = false;
    p.power = 1;
    p.returning = false;
    p.telegraph = 0;
    p.age = 0;
    p.touched = false;
    p.bestOffset = 99;
    p.id = this.nextId++;

    this.events.push({ t: 'spawn', r: p.r, a: p.a, kind });
    if (!this.seen.has(kind)) {
      this.seen.add(kind);
      this.events.push({ t: 'firstSight', kind });
    }
    return p;
  }

  private maybeSpawnTurret(): void {
    if (this.wave < WAVES.turretFirstWave) return;
    const live = this.turrets.filter((t) => t.active).length;
    const slots = Math.min(
      WAVES.turretMax,
      1 + Math.floor((this.wave - WAVES.turretFirstWave) / WAVES.turretWavesPerSlot),
    );
    if (live >= slots) return;
    if (!this.rng.chance(0.75)) return;

    const slot = this.turrets.find((t) => !t.active);
    if (!slot) return;

    // Keep turrets apart so the player is not pinned into one arc.
    let angle = this.rng.next() * TAU;
    for (let attempt = 0; attempt < 10; attempt++) {
      angle = this.rng.next() * TAU;
      const clash = this.turrets.some(
        (t) => t.active && angleDistance(t.a, angle) < 1.1,
      );
      if (!clash) break;
    }

    slot.active = true;
    slot.a = angle;
    slot.maxHp = TURRET.hp + Math.floor(this.wave / 12);
    slot.hp = slot.maxHp;
    slot.spawnT = 1.2;
    slot.fireT = 2.2;
    slot.hitFlash = 0;
    slot.id = this.nextId++;
    this.events.push({ t: 'turretSpawn', a: angle });
  }

  // --- Projectiles ----------------------------------------------------------

  private updateProjectiles(dt: number): void {
    const shieldC = this.shieldCenter;
    const halfArc = this.halfArc;
    const sweet = this.sweetFraction;
    const coreR = ARENA.coreRadius;

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.telegraph < 1) p.telegraph = Math.min(1, p.telegraph + dt / TELEGRAPH_TIME);
      p.prevR = p.r;

      // A projectile's speed is fixed for its whole flight. Nothing in the
      // game slows or speeds an individual shot in mid-air, and that is a
      // deliberate constraint rather than an omission: the spawn gate
      // schedules shots by predicted arrival, so any per-shot speed change
      // would silently invalidate that prediction and let two shots land
      // closer together than the shield can travel.
      const speed = p.speed;

      if (p.outbound || p.returning) {
        p.r += speed * dt;
      } else {
        p.r -= speed * dt;
      }
      if (p.curve !== 0) p.a = normAngle(p.a + p.curve * dt);

      // Outbound (parried) shots: hunt turrets, then leave.
      if (p.outbound) {
        if (this.hitTurretsWith(p)) continue;
        if (p.r > ARENA.despawnRadius) p.active = false;
        continue;
      }

      // Shots that were bounced out - a blocked armoured shell, or the halves
      // of a split - fly outward and then come back. They re-enter through the
      // same arrival gate as everything else rather than simply turning round,
      // because an ungated re-entry can land on top of a queued shot at an
      // angle the shield cannot reach in time.
      if (p.returning) {
        if (p.r >= ARENA.spawnRadius) {
          p.active = false;
          this.requeue(p.kind, normAngle(p.a + this.rng.range(-0.5, 0.5)));
        }
        continue;
      }

      if (p.r > ARENA.despawnRadius) {
        p.active = false;
        continue;
      }

      // --- Shield contact ---------------------------------------------
      // The shield is a *band*, not a plane. A projectile stays resolvable for
      // the whole time it overlaps that band, which on the default core is
      // roughly 150-250ms. Testing only the instant the projectile crossed the
      // shield radius (the obvious implementation) gives a one-frame window:
      // arriving 8ms late produced nothing at all, which reads as the game
      // ignoring your input. This is the difference between "demanding" and
      // "broken".
      const band = ARENA.shieldHalfThickness + p.radius;
      const inBand = Math.abs(p.r - ARENA.shieldOrbit) <= band;

      if (inBand && this.stunT <= 0) {
        const offset = angleDistance(p.a, shieldC);
        // The projectile's own angular half-width at the shield radius: a fat
        // shot clips the shield edge that a thin one would slip past.
        const angularHalf = p.radius / ARENA.shieldOrbit;
        if (offset <= halfArc + angularHalf) {
          const normalized = clamp(offset / Math.max(halfArc, 1e-4), 0, 1.4);
          p.touched = true;
          p.bestOffset = Math.min(p.bestOffset, normalized);
          if (normalized <= sweet) {
            // A clean parry resolves the moment it lands - no waiting.
            this.resolveShieldHit(p, true, angleDelta(shieldC, p.a));
            continue;
          }
        }
      }

      // Left the band travelling inward: settle up. Anything the shield ever
      // touched is a block; anything it never touched sails on to the core.
      if (p.touched && p.r + p.radius < ARENA.shieldOrbit - ARENA.shieldHalfThickness) {
        this.resolveShieldHit(p, false, angleDelta(shieldC, p.a));
        continue;
      }

      // --- Core contact ---
      if (p.r - p.radius <= coreR) {
        this.resolveCoreHit(p);
      }
    }
  }

  private resolveShieldHit(p: Projectile, isParry: boolean, signedOffset: number): void {
    switch (p.kind) {
      case 'void':
        // Blocking a void orb is the mistake. The orb is harmless to the core;
        // catching it on the shield is what costs you.
        p.active = false;
        this.stunT = SHIELD.stunDuration;
        this.breakCombo();
        this.events.push({ t: 'stun', r: p.r, a: p.a });
        return;

      case 'armored':
        if (!isParry) {
          // A plain block is not enough: it bounces out and comes back.
          p.returning = true;
          p.r = ARENA.shieldOrbit + ARENA.shieldHalfThickness + p.radius + 0.01;
          p.touched = false;
          p.bestOffset = 99;
          this.blocked(p);
          return;
        }
        break;

      case 'splitter':
        if (!isParry) {
          this.blocked(p);
          p.active = false;
          this.splitInto(p, 2);
          return;
        }
        break;

      case 'heavy':
        if (!isParry) {
          // Angular recoil: the shield is knocked away from the impact, so a
          // sloppy heavy block costs you position for the next shot.
          const dir = signedOffset >= 0 ? 1 : -1;
          const damping = Math.max(0, 1 - 0.5 * this.stack('counterweight'));
          if (damping > 0) {
            this.recoil = clamp(
              this.recoil + dir * SHIELD.heavyRecoil * damping,
              -1.2,
              1.2,
            );
            this.events.push({ t: 'recoil', dir });
          }
          this.blocked(p);
          p.active = false;
          return;
        }
        break;

      default:
        break;
    }

    if (isParry) {
      this.parried(p);
    } else {
      this.blocked(p);
      p.active = false;
    }
  }

  private parried(p: Projectile): void {
    this.parries += 1;
    this.combo += 1;
    this.comboT = COMBO.window;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    // MOMENTUM: a permanent-for-this-run score bonus at each 10-chain tier.
    const momentum = this.stack('momentum');
    if (momentum > 0) {
      const tier = Math.floor(this.combo / 10);
      if (tier > this.momentumTier) {
        this.momentumTier = tier;
        this.scoreBonus += 0.04 * momentum;
      }
    }

    this.score += SCORE.parry * this.multiplier;
    this.addEnergy(ENERGY.perParry);

    // Capped at one repair per wave: an unbroken chain should buy runway, but
    // it must not make a skilled player literally unkillable.
    if (
      this.combo % COMBO.repairAt === 0 &&
      this.hp < this.maxHp &&
      this.repairsThisWave === 0
    ) {
      this.hp += 1;
      this.repairsThisWave += 1;
      this.events.push({ t: 'heal', hp: this.hp });
    }

    this.events.push({
      t: 'parry',
      r: p.r,
      a: p.a,
      kind: p.kind,
      combo: this.combo,
      multiplier: this.multiplier,
    });

    if (p.kind === 'splitter' || p.kind === 'heavy' || p.kind === 'armored') {
      // Heavy classes are destroyed outright by a clean parry - that is the
      // whole reward for landing one.
      p.active = false;
    } else {
      // Light shots are reflected and become offensive: they can kill turrets.
      p.outbound = true;
      p.returning = false;
      p.speed *= 1.9;
      p.curve = 0;
      p.power = 1 + this.stack('kinetic');
      p.r = ARENA.shieldOrbit + 0.015;
    }

    if (this.stack('aftershock') > 0) this.aftershock(p.a);

    // Overdrive fires on the parry that follows a full charge, so the player
    // always spends it at a moment of their own choosing.
    if (this.overdriveReady) this.triggerOverdrive();
  }

  private blocked(p: Projectile): void {
    this.blocks += 1;
    this.score += SCORE.block * this.multiplier;
    // A block keeps the chain alive but does not extend it. Turtling should
    // survive; only precision should score.
    if (this.combo > 0) this.comboT = COMBO.window;
    this.events.push({ t: 'block', r: p.r, a: p.a, kind: p.kind });
  }

  private splitInto(p: Projectile, n: number): void {
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * 0.55;
      const child = this.spawnProjectile('basic', p.a + offset, ARENA.shieldOrbit + 0.05);
      if (child) {
        // Children start flying outward, then fall back in: a second chance to
        // parry rather than an instant unblockable.
        child.returning = true;
        child.speed = PROJ_SPECS.basic.speed * 0.85 * waveSpeedScale(this.wave);
        child.telegraph = 1;
      }
    }
  }

  /**
   * AFTERSHOCK: a parry destroys the nearest shot closing in beside you.
   *
   * The first version of this upgrade knocked nearby shots backwards instead.
   * It read well but it moved a single projectile's arrival by ~0.4s, which
   * reshuffled it against shots that had already been scheduled around it -
   * the one thing the spawn gate exists to prevent. Destroying is strictly
   * defensive, and changes no other shot's timing at all.
   */
  private aftershock(angle: number): void {
    const stacks = this.stack('aftershock');
    if (stacks <= 0) return;
    const reach = 0.7 + 0.3 * stacks;

    // Nearest first: the shot about to hit you is the one worth clearing.
    const candidates = this.projectiles
      .filter(
        (q) =>
          q.active &&
          !q.outbound &&
          !q.returning &&
          // Void orbs are not threats, and clearing one would steal the
          // energy the player correctly chose to let through.
          q.kind !== 'void' &&
          q.r <= ARENA.shieldOrbit + 0.16 &&
          angleDistance(q.a, angle) <= reach,
      )
      .sort((a, b) => a.r - b.r);

    for (let i = 0; i < Math.min(stacks, candidates.length); i++) {
      const q = candidates[i]!;
      q.active = false;
      this.score += SCORE.block * this.multiplier;
      this.events.push({ t: 'shockwave', r: q.r, a: q.a });
    }
  }

  private breakCombo(): void {
    if (this.combo > 0) this.events.push({ t: 'comboBreak', combo: this.combo });
    this.combo = 0;
    this.comboT = 0;
  }

  private resolveCoreHit(p: Projectile): void {
    if (p.kind === 'void') {
      // Void orbs are *supposed* to reach the core. Absorbing them is the
      // energy economy, and the restraint it demands is the mechanic.
      p.active = false;
      this.absorbs += 1;
      this.absorbCount += 1;
      this.score += SCORE.absorb * this.multiplier;
      this.addEnergy(ENERGY.perAbsorb);
      this.events.push({ t: 'absorb', r: p.r, a: p.a });

      const harvest = this.stack('harvest');
      if (harvest > 0 && this.absorbCount % Math.max(3, 7 - harvest) === 0 && this.hp < this.maxHp) {
        this.hp += 1;
        this.events.push({ t: 'heal', hp: this.hp });
      }
      return;
    }

    p.active = false;
    if (this.invulnT > 0) return;
    this.damage(p.damage, p.r, p.a);
  }

  damage(amount: number, r: number, a: number): void {
    if (this.invulnT > 0 || this.phase === 'over') return;

    if (this.hp - amount <= 0 && this.stack('secondwind') > 0 && !this.secondWindUsed) {
      this.secondWindUsed = true;
      this.hp = 1;
      this.invulnT = HEALTH.invulnAfterHit * 1.8;
      this.breakCombo();
      this.clearNearbyProjectiles();
      this.events.push({ t: 'secondWind' });
      return;
    }

    this.hp -= amount;
    this.invulnT = HEALTH.invulnAfterHit;
    this.breakCombo();
    this.events.push({ t: 'hurt', r, a, hp: this.hp });

    if (this.hp <= 0) {
      this.hp = 0;
      this.endRun();
      return;
    }
    // Sweep the immediate area so a cluster cannot take two lives in one beat.
    this.clearNearbyProjectiles();
  }

  private clearNearbyProjectiles(): void {
    for (const p of this.projectiles) {
      if (p.active && !p.outbound && p.r < HEALTH.clearRadius) p.active = false;
    }
  }

  private endRun(): void {
    this.phase = 'over';
    this.breakCombo();
    this.events.push({ t: 'gameOver', score: Math.floor(this.score) });
  }

  // --- Energy / overdrive ---------------------------------------------------

  private addEnergy(amount: number): void {
    if (this.overdriveReady) return;
    this.energy = Math.min(ENERGY.max, this.energy + amount * this.energyGain);
    if (this.energy >= ENERGY.max) {
      this.overdriveReady = true;
      this.events.push({ t: 'overdriveReady' });
    }
  }

  private triggerOverdrive(): void {
    this.overdriveReady = false;
    this.energy = 0;
    this.blastActive = true;
    this.blastR = ARENA.coreRadius;
    this.blastT = ENERGY.blastDuration;
    this.blastHitTurrets.clear();
    if (this.stack('chain') > 0) {
      this.invulnT = Math.max(this.invulnT, 2);
    }
    this.events.push({ t: 'overdrive' });
  }

  private get blastMaxRadius(): number {
    return ENERGY.blastRadius * (1 + 0.4 * this.stack('chain'));
  }

  private updateBlast(dt: number): void {
    if (!this.blastActive) return;
    this.blastT -= dt;
    const progress = 1 - Math.max(0, this.blastT) / ENERGY.blastDuration;
    this.blastR = ARENA.coreRadius + (this.blastMaxRadius - ARENA.coreRadius) * progress;

    for (const p of this.projectiles) {
      if (!p.active || p.outbound) continue;
      if (p.r <= this.blastR) {
        p.active = false;
        this.score += SCORE.block * this.multiplier;
      }
    }
    for (const t of this.turrets) {
      if (!t.active || this.blastHitTurrets.has(t.id)) continue;
      if (ARENA.turretRadius <= this.blastR) {
        this.blastHitTurrets.add(t.id);
        this.damageTurret(t, 2);
      }
    }
    if (this.blastT <= 0) {
      this.blastActive = false;
      this.blastR = 0;
    }
  }

  // --- Turrets --------------------------------------------------------------

  private updateTurrets(dt: number): void {
    const interval = Math.max(
      TURRET.minFireInterval,
      TURRET.fireInterval - this.wave * 0.08,
    );
    for (const t of this.turrets) {
      if (!t.active) continue;
      if (t.hitFlash > 0) t.hitFlash -= dt;
      if (t.spawnT > 0) {
        t.spawnT -= dt;
        continue;
      }
      if (this.phase !== 'wave') continue;
      t.fireT -= dt;
      if (t.fireT <= 0) {
        t.fireT = interval * this.rng.range(0.85, 1.15);
        const kinds = this.unlockedKinds().filter((k) => k !== 'void');
        if (kinds.length > 0) {
          const kind = this.rng.weighted(kinds, (k) => PROJ_SPECS[k].weight);
          this.queueTurretShot(kind, t.a + this.rng.range(-0.12, 0.12));
        }
      }
    }
  }

  /** @returns true if the projectile was consumed. */
  private hitTurretsWith(p: Projectile): boolean {
    for (const t of this.turrets) {
      if (!t.active || t.spawnT > 0) continue;
      // Law of cosines in polar space - no cartesian conversion needed.
      const d2 =
        p.r * p.r +
        ARENA.turretRadius * ARENA.turretRadius -
        2 * p.r * ARENA.turretRadius * Math.cos(p.a - t.a);
      const reach = p.radius + TURRET.radius;
      if (d2 <= reach * reach) {
        p.active = false;
        this.damageTurret(t, p.power);
        return true;
      }
    }
    return false;
  }

  private damageTurret(t: Turret, amount: number): void {
    t.hp -= amount;
    t.hitFlash = 0.18;
    if (t.hp <= 0) {
      t.active = false;
      this.turretsKilled += 1;
      this.score += SCORE.turret * this.multiplier;
      this.events.push({ t: 'turretDead', r: ARENA.turretRadius, a: t.a });
    } else {
      this.events.push({ t: 'turretHit', r: ARENA.turretRadius, a: t.a });
    }
  }

  // --- Output ---------------------------------------------------------------

  /** Drains the event queue. The caller owns the returned array. */
  drainEvents(): RunEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Shards earned, including run-scoped and meta multipliers. */
  computeShards(): number {
    const base =
      (this.score / 1000) * ECONOMY.shardsPerKScore +
      Math.max(0, this.wave - 1) * ECONOMY.shardsPerWave +
      this.turretsKilled * TURRET.shardReward;
    const runBonus = 1 + 0.25 * this.stack('greed');
    const total = base * runBonus * this.core.shardGain * (1 + this.mods.shardBonus);
    return Math.max(0, Math.floor(total));
  }

  summary(): RunSummary {
    return {
      score: Math.floor(this.score),
      wave: Math.max(1, this.wave),
      duration: this.time,
      parries: this.parries,
      blocks: this.blocks,
      absorbs: this.absorbs,
      bestCombo: this.bestCombo,
      turretsKilled: this.turretsKilled,
      shards: this.computeShards(),
      daily: this.daily,
      coreId: this.core.id,
      seed: this.seed,
    };
  }

  /** Ends the run immediately (used by "give up" in the pause menu). */
  forfeit(): void {
    if (this.phase !== 'over') this.endRun();
  }

  get activeProjectileCount(): number {
    let n = 0;
    for (const p of this.projectiles) if (p.active) n++;
    return n;
  }

  get activeTurretCount(): number {
    let n = 0;
    for (const t of this.turrets) if (t.active) n++;
    return n;
  }
}
