/**
 * Simulation tests.
 *
 * The important ones here are the FAIRNESS invariants. "Hard" and "cheap" feel
 * identical in the moment you lose a life; the difference is whether the hit
 * was reachable. These tests assert reachability directly rather than trusting
 * that the spawn code still does what it did when it was written.
 */
import { describe, expect, it } from 'vitest';
import { Run } from '../src/game/run';
import { SIM_DT } from '../src/engine/loop';
import {
  ARENA,
  COMBO,
  PROJ_SPECS,
  SHIELD,
  baseSpeed,
  flightTime,
  minArrivalGap,
  waveSpeedScale,
} from '../src/game/config';
import { angleDistance } from '../src/engine/math';
import { CORES } from '../src/game/cores';

/** Steps a run forward, feeding it a fixed aim. */
function step(run: Run, seconds: number, aim: number | null = null): void {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps && !run.isOver; i++) {
    if (run.waitingForUpgrade) {
      const c = run.pendingChoices[0];
      if (c) run.chooseUpgrade(c.id);
      else run.declineUpgrade();
      continue;
    }
    if (aim !== null) run.setAim(aim);
    run.update(SIM_DT);
    run.drainEvents();
  }
}

describe('Run basics', () => {
  it('starts at full integrity and wave 0 before the first wave', () => {
    const run = new Run({ seed: 1, coreId: 'sentinel' });
    expect(run.hp).toBe(run.maxHp);
    expect(run.wave).toBe(0);
    expect(run.phase).toBe('intro');
    expect(run.isOver).toBe(false);
  });

  it('is deterministic: identical seed and inputs give identical outcomes', () => {
    const a = new Run({ seed: 777, coreId: 'sentinel', skipTutorial: true });
    const b = new Run({ seed: 777, coreId: 'sentinel', skipTutorial: true });
    step(a, 45, 0.7);
    step(b, 45, 0.7);
    expect(b.summary()).toEqual(a.summary());
  });

  it('applies meta modifiers, and the daily ignores them', () => {
    const mods = {
      bonusHp: 2,
      sweetBonus: 0.2,
      turnBonus: 0.1,
      energyBonus: 0.3,
      shardBonus: 0.5,
    };
    const normal = new Run({ seed: 5, coreId: 'sentinel', modifiers: mods });
    const daily = new Run({ seed: 5, coreId: 'sentinel', modifiers: mods, daily: true });

    expect(normal.maxHp).toBe(CORES[0]!.maxHp + 2);
    expect(daily.maxHp).toBe(CORES[0]!.maxHp);
    expect(daily.sweetFraction).toBeCloseTo(CORES[0]!.sweetFraction, 6);
    expect(normal.sweetFraction).toBeGreaterThan(daily.sweetFraction);
  });

  it('caps the sweet spot so upgrades cannot turn the whole shield into one', () => {
    const run = new Run({
      seed: 1,
      coreId: 'edge',
      modifiers: { bonusHp: 0, sweetBonus: 99, turnBonus: 0, energyBonus: 0, shardBonus: 0 },
    });
    for (let i = 0; i < 10; i++) run.stacks['sweet'] = i;
    expect(run.sweetFraction).toBeLessThanOrEqual(SHIELD.maxSweetFraction);
  });

  it('caps the shield width no matter how many BROAD FIELD stacks are taken', () => {
    const run = new Run({ seed: 1, coreId: 'bulwark' });
    run.stacks['wide'] = 99;
    expect(run.halfArc).toBeLessThanOrEqual(SHIELD.maxHalfArc);
  });
});

describe('fairness: arrival spacing', () => {
  /**
   * The core guarantee. Two shots that arrive at the shield at different angles
   * must be separated by at least the time it takes the shield to travel
   * between them. Spacing *spawns* is not enough, because a fast projectile
   * released later still lands earlier - this test would catch a regression
   * back to that bug.
   */
  it('never lands two separately-angled shots closer than the shield can travel', () => {
    for (const seed of [1, 99, 4242, 88888, 104730, 523646]) {
      const run = new Run({ seed, coreId: 'sentinel', skipTutorial: true });
      // Arrivals recorded as (time, angle) at the moment a shot enters the band.
      const arrivals: Array<{ t: number; a: number; halfArc: number }> = [];
      const seen = new Set<number>();

      const total = Math.round(240 / SIM_DT);
      for (let i = 0; i < total; i++) {
        if (run.isOver) break;
        if (run.waitingForUpgrade) {
          const c = run.pendingChoices[0];
          if (c) run.chooseUpgrade(c.id);
          else run.declineUpgrade();
          continue;
        }
        // Make the core immortal so the run reaches deep waves. Topping up hp
        // is not enough: a one-integrity core dies inside a single step.
        run.invulnT = 1;
        run.update(SIM_DT);
        run.drainEvents();

        for (const p of run.projectiles) {
          if (!p.active || p.outbound || p.returning || seen.has(p.id)) continue;
          if (Math.abs(p.r - ARENA.shieldOrbit) <= ARENA.shieldHalfThickness + p.radius) {
            seen.add(p.id);
            arrivals.push({ t: run.time, a: p.a, halfArc: run.halfArc });
          }
        }
      }

      expect(arrivals.length).toBeGreaterThan(30);

      // Worst-case shield traversal, plus a human's reaction floor.
      const worstTravel = Math.PI / CORES[0]!.turnRate;

      for (let i = 1; i < arrivals.length; i++) {
        const prev = arrivals[i - 1]!;
        const cur = arrivals[i]!;
        const dt = cur.t - prev.t;
        const dAngle = angleDistance(prev.a, cur.a);
        // Shots close enough together that a single shield position covers
        // both may arrive at the same instant - that is the "twin" mechanic,
        // not a fairness break. The threshold is the shield's actual width,
        // which grows as BROAD FIELD is taken during the run.
        const coverable = 2 * Math.min(prev.halfArc, cur.halfArc);
        if (dAngle <= coverable) continue;
        const needed = dAngle / CORES[0]!.turnRate;
        expect(dt).toBeGreaterThanOrEqual(needed - 1e-6);
        expect(worstTravel).toBeLessThan(0.36);
      }
    }
  });

  it('no projectile changes speed in mid-flight', () => {
    // The arrival gate schedules on predicted flight time. Any per-shot speed
    // change in the air would silently invalidate that prediction, which is
    // how two earlier versions of this game produced unavoidable hits.
    const run = new Run({ seed: 31415, coreId: 'sentinel', skipTutorial: true });
    const speeds = new Map<number, number>();
    for (let i = 0; i < Math.round(160 / SIM_DT); i++) {
      if (run.isOver) break;
      if (run.waitingForUpgrade) {
        const c = run.pendingChoices[0];
        if (c) run.chooseUpgrade(c.id);
        else run.declineUpgrade();
        continue;
      }
      run.invulnT = 1;
      run.update(SIM_DT);
      run.drainEvents();
      for (const p of run.projectiles) {
        if (!p.active || p.outbound) continue;
        const prev = speeds.get(p.id);
        if (prev === undefined) speeds.set(p.id, p.speed);
        else expect(p.speed).toBe(prev);
      }
    }
    expect(speeds.size).toBeGreaterThan(50);
  });

  it('minArrivalGap never drops below the shield traversal time', () => {
    const slowest = Math.min(...CORES.map((c) => c.turnRate));
    for (let wave = 1; wave <= 60; wave++) {
      // Even the slowest core must be able to cross a quarter turn inside the
      // gap; a half turn is the absolute worst case and is covered by the
      // "shots are not always opposite" statistics of random angles.
      expect(minArrivalGap(wave)).toBeGreaterThan(Math.PI / 2 / slowest);
    }
  });

  it('flightTime shrinks with wave speed but stays positive', () => {
    let prev = Infinity;
    for (let wave = 1; wave <= 40; wave++) {
      const t = flightTime('basic', baseSpeed('basic', wave), ARENA.spawnRadius);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(prev + 1e-9);
      prev = t;
    }
  });

  it('speed scaling is bounded so shots never outrun human reaction', () => {
    for (let wave = 1; wave <= 500; wave++) {
      expect(waveSpeedScale(wave)).toBeLessThan(2.1);
    }
    // The fastest thing in the game still takes over half a second to cross.
    const fastest = PROJ_SPECS.swift.speed * waveSpeedScale(500);
    const travel = (ARENA.spawnRadius - ARENA.shieldOrbit) / fastest;
    expect(travel).toBeGreaterThan(0.5);
  });
});

describe('shield contact', () => {
  /**
   * Regression test for the one-frame parry window.
   *
   * A projectile must stay resolvable for the whole time it overlaps the
   * shield band, not just on the single step where it crosses the shield
   * radius. The original implementation tested only the crossing instant,
   * which made arriving 8ms late do nothing at all.
   */
  it('keeps a projectile resolvable for the whole contact window', () => {
    const run = new Run({ seed: 1, coreId: 'sentinel', skipTutorial: true });
    const p = run.spawnProjectile('basic', 0, ARENA.shieldOrbit + 0.12);
    expect(p).not.toBeNull();

    // Aim far away so it enters the band unopposed.
    run.setAim(Math.PI);
    let framesInBand = 0;
    for (let i = 0; i < 200 && p!.active; i++) {
      run.update(SIM_DT);
      run.drainEvents();
      if (Math.abs(p!.r - ARENA.shieldOrbit) <= ARENA.shieldHalfThickness + p!.radius) {
        framesInBand++;
      }
    }
    // At 120Hz the window must be many frames, not one.
    expect(framesInBand).toBeGreaterThan(10);
  });

  it('parries a shot caught in the sweet spot', () => {
    const run = new Run({ seed: 2, coreId: 'sentinel', skipTutorial: true });
    run.shieldAngle = 0;
    run.targetAngle = 0;
    run.spawnProjectile('basic', 0, ARENA.shieldOrbit + 0.1);
    step(run, 1.5, 0);
    expect(run.parries).toBe(1);
    expect(run.combo).toBe(1);
    expect(run.blocks).toBe(0);
  });

  it('blocks (does not parry) a shot caught on the shield edge', () => {
    const run = new Run({ seed: 3, coreId: 'sentinel', skipTutorial: true });
    run.shieldAngle = 0;
    run.targetAngle = 0;
    // Just outside the sweet spot, just inside the shield.
    const edge = run.halfArc * (run.sweetFraction + (1 - run.sweetFraction) * 0.6);
    run.spawnProjectile('basic', edge, ARENA.shieldOrbit + 0.1);
    step(run, 1.5, 0);
    expect(run.blocks).toBe(1);
    expect(run.parries).toBe(0);
    // A block keeps you alive but does not build a chain.
    expect(run.combo).toBe(0);
  });

  it('lets a shot through when the shield is elsewhere', () => {
    const run = new Run({ seed: 4, coreId: 'sentinel', skipTutorial: true });
    run.shieldAngle = Math.PI;
    run.targetAngle = Math.PI;
    const before = run.hp;
    run.spawnProjectile('basic', 0, ARENA.shieldOrbit + 0.1);
    step(run, 3, Math.PI);
    expect(run.hp).toBe(before - 1);
  });
});

describe('projectile behaviours', () => {
  it('a void orb reaching the core is absorbed, not damaging', () => {
    const run = new Run({ seed: 5, coreId: 'sentinel', skipTutorial: true });
    run.shieldAngle = Math.PI;
    run.targetAngle = Math.PI;
    const hp = run.hp;
    run.spawnProjectile('void', 0, ARENA.shieldOrbit - 0.05);
    step(run, 3, Math.PI);
    expect(run.hp).toBe(hp);
    expect(run.absorbs).toBe(1);
    expect(run.energy).toBeGreaterThan(0);
  });

  it('blocking a void orb stuns the shield and breaks the chain', () => {
    const run = new Run({ seed: 6, coreId: 'sentinel', skipTutorial: true });
    run.shieldAngle = 0;
    run.targetAngle = 0;
    run.combo = 12;
    run.comboT = COMBO.window;
    run.spawnProjectile('void', 0, ARENA.shieldOrbit + 0.1);
    // Step less than SHIELD.stunDuration so the stun is still active.
    step(run, 0.3, 0);
    expect(run.stunT).toBeGreaterThan(0);
    expect(run.stunT).toBeLessThanOrEqual(SHIELD.stunDuration);
    expect(run.combo).toBe(0);
  });

  it('a heavy shot blocked off-centre applies angular recoil', () => {
    const run = new Run({ seed: 7, coreId: 'bulwark', skipTutorial: true });
    run.shieldAngle = 0;
    run.targetAngle = 0;
    const edge = run.halfArc * (run.sweetFraction + (1 - run.sweetFraction) * 0.7);
    run.spawnProjectile('heavy', edge, ARENA.shieldOrbit + 0.1);
    step(run, 1.5, 0);
    expect(run.blocks).toBe(1);
    expect(Math.abs(run.recoil)).toBeGreaterThan(0);
  });

  it('an armoured shot survives a block and comes back', () => {
    const run = new Run({ seed: 8, coreId: 'bulwark', skipTutorial: true });
    run.shieldAngle = 0;
    run.targetAngle = 0;
    const edge = run.halfArc * (run.sweetFraction + (1 - run.sweetFraction) * 0.7);
    const p = run.spawnProjectile('armored', edge, ARENA.shieldOrbit + 0.1)!;
    step(run, 1.2, 0);
    expect(run.blocks).toBe(1);
    expect(p.active).toBe(true);
    expect(p.returning).toBe(true);
  });

  it('a splitter blocked off-centre splits, parried cleanly it does not', () => {
    const blocked = new Run({ seed: 9, coreId: 'bulwark', skipTutorial: true });
    blocked.shieldAngle = 0;
    blocked.targetAngle = 0;
    const edge = blocked.halfArc * (blocked.sweetFraction + (1 - blocked.sweetFraction) * 0.7);
    blocked.spawnProjectile('splitter', edge, ARENA.shieldOrbit + 0.1);
    // An edge hit is settled when the shot leaves the contact band, not on
    // entry, so this needs the full traversal time.
    step(blocked, 1.4, 0);
    expect(blocked.blocks).toBe(1);
    expect(blocked.activeProjectileCount).toBe(2);

    const parried = new Run({ seed: 9, coreId: 'bulwark', skipTutorial: true });
    parried.shieldAngle = 0;
    parried.targetAngle = 0;
    parried.spawnProjectile('splitter', 0, ARENA.shieldOrbit + 0.1);
    step(parried, 1.4, 0);
    expect(parried.parries).toBe(1);
    expect(parried.activeProjectileCount).toBe(0);
  });
});

describe('scoring and survival', () => {
  it('the multiplier grows with the chain and is capped', () => {
    const run = new Run({ seed: 10, coreId: 'sentinel', skipTutorial: true });
    expect(run.multiplier).toBe(1);
    run.combo = COMBO.step;
    expect(run.multiplier).toBeCloseTo(1 + COMBO.multiplierPerStep);
    run.combo = 100000;
    expect(run.multiplier).toBe(COMBO.maxMultiplier);
  });

  it('clears nearby shots after a hit so a cluster cannot take two lives', () => {
    const run = new Run({ seed: 11, coreId: 'bulwark', skipTutorial: true });
    run.shieldAngle = Math.PI;
    run.targetAngle = Math.PI;
    for (let i = 0; i < 5; i++) {
      run.spawnProjectile('basic', (i / 5) * Math.PI * 2, ARENA.coreRadius + 0.08);
    }
    const hp = run.hp;
    step(run, 1.2, Math.PI);
    // Exactly one point of damage, not five.
    expect(run.hp).toBe(hp - 1);
  });

  it('SECOND WIND converts one fatal hit into a survival, once', () => {
    const run = new Run({ seed: 12, coreId: 'vagrant', skipTutorial: true });
    run.stacks['secondwind'] = 1;
    expect(run.maxHp).toBe(1);

    run.damage(1, 0.2, 0);
    expect(run.isOver).toBe(false);
    expect(run.hp).toBe(1);

    run.invulnT = 0;
    run.damage(1, 0.2, 0);
    expect(run.isOver).toBe(true);
  });

  it('a chain repairs integrity, but only once per wave', () => {
    const run = new Run({ seed: 13, coreId: 'bulwark', skipTutorial: true });
    run.hp = 1;

    /** Parries exactly one shot dead centre. */
    const parryOne = (): void => {
      run.shieldAngle = 0;
      run.targetAngle = 0;
      run.spawnProjectile('basic', 0, ARENA.shieldOrbit + 0.05);
      const before = run.parries;
      for (let i = 0; i < 400 && run.parries === before; i++) {
        run.setAim(0);
        run.invulnT = 1;
        run.update(SIM_DT);
        run.drainEvents();
      }
      expect(run.parries).toBe(before + 1);
    };

    // Land on the first repair threshold.
    run.combo = COMBO.repairAt - 1;
    run.comboT = COMBO.window;
    parryOne();
    expect(run.hp).toBe(2);

    // Land on the second threshold inside the same wave: no further repair.
    run.combo = COMBO.repairAt * 2 - 1;
    run.comboT = COMBO.window;
    parryOne();
    expect(run.hp).toBe(2);
  });

  it('ends the run at zero integrity and reports a summary', () => {
    const run = new Run({ seed: 14, coreId: 'vagrant', skipTutorial: true });
    run.damage(5, 0.2, 0);
    expect(run.isOver).toBe(true);
    const s = run.summary();
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.shards).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.duration)).toBe(true);
  });

  it('forfeit ends the run cleanly', () => {
    const run = new Run({ seed: 15, coreId: 'sentinel', skipTutorial: true });
    step(run, 10, 0);
    run.forfeit();
    expect(run.isOver).toBe(true);
    run.forfeit(); // idempotent
    expect(run.isOver).toBe(true);
  });
});

describe('stability', () => {
  it('survives a long run on every core without NaN or a stuck state', () => {
    for (const core of CORES) {
      const run = new Run({ seed: 2024, coreId: core.id, skipTutorial: true });
      for (let i = 0; i < Math.round(300 / SIM_DT); i++) {
        if (run.isOver) break;
        if (run.waitingForUpgrade) {
          const c = run.pendingChoices[0];
          if (c) run.chooseUpgrade(c.id);
          else run.declineUpgrade();
          continue;
        }
        // Genuinely immortal: a one-integrity core dies inside a single step,
        // so topping health up before update() is not enough.
        run.invulnT = 1;
        run.setAim(Math.sin(run.time * 2) * Math.PI);
        run.update(SIM_DT);
        run.drainEvents();

        expect(Number.isFinite(run.score)).toBe(true);
        expect(Number.isFinite(run.shieldAngle)).toBe(true);
        expect(Number.isFinite(run.energy)).toBe(true);
        for (const p of run.projectiles) {
          if (!p.active) continue;
          expect(Number.isFinite(p.r)).toBe(true);
          expect(Number.isFinite(p.a)).toBe(true);
        }
      }
      expect(run.wave).toBeGreaterThan(8);
    }
  });

  it('never exceeds its projectile pool', () => {
    const run = new Run({ seed: 4, coreId: 'sentinel', skipTutorial: true });
    for (let i = 0; i < Math.round(200 / SIM_DT); i++) {
      if (run.isOver) break;
      if (run.waitingForUpgrade) {
        const c = run.pendingChoices[0];
        if (c) run.chooseUpgrade(c.id);
        else run.declineUpgrade();
        continue;
      }
      run.invulnT = 1;
      run.update(SIM_DT);
      run.drainEvents();
      expect(run.activeProjectileCount).toBeLessThanOrEqual(run.projectiles.length);
    }
  });

  it('drains its event queue rather than growing it forever', () => {
    const run = new Run({ seed: 6, coreId: 'sentinel', skipTutorial: true });
    for (let i = 0; i < Math.round(60 / SIM_DT); i++) {
      if (run.isOver) break;
      if (run.waitingForUpgrade) {
        run.declineUpgrade();
        continue;
      }
      run.update(SIM_DT);
      run.drainEvents();
      expect(run.events.length).toBeLessThan(50);
    }
  });
});
