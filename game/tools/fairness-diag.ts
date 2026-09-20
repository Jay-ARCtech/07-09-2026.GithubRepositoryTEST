/**
 * Fairness diagnostic.
 *
 * `tests/run.test.ts` asserts that no two separately-angled threats arrive
 * closer together than the shield can travel between them. When that test
 * fails it tells you *that* the invariant broke; this tool tells you *which*
 * pair broke it, on which wave, and by how much.
 *
 * Three genuine bugs were found this way, each of which produced hits that
 * were impossible to avoid:
 *   1. The gate spaced spawns instead of arrivals, so a fast shot released
 *      later overtook a slow one and they landed together.
 *   2. Arrival was predicted to the shield's centre line rather than to the
 *      outer edge of the contact band, which biased the estimate by up to
 *      0.37s depending on projectile size and speed.
 *   3. Two upgrades changed a projectile's speed in mid-flight, invalidating
 *      predictions the gate had already scheduled around.
 *
 * Run with:  npx vite-node tools/fairness-diag.ts
 */
import { Run } from '../src/game/run';
import { SIM_DT } from '../src/engine/loop';
import { ARENA, minArrivalGap } from '../src/game/config';
import { angleDistance } from '../src/engine/math';

const SEEDS = Array.from({ length: 24 }, (_, i) => 1 + i * 104729);
let totalViolations = 0;
let totalArrivals = 0;
for (const seed of SEEDS) {
  const run = new Run({ seed, coreId: 'sentinel', skipTutorial: true });
  const arrivals: Array<{ t: number; a: number; halfArc: number; kind: string; id: number; push: number; wave: number; born: number }> = [];
  const seen = new Set<number>();
  const born = new Map<number, number>();

  for (let i = 0; i < Math.round(240 / SIM_DT); i++) {
    if (run.isOver) break;
    if (run.waitingForUpgrade) { const c = run.pendingChoices[0]; if (c) run.chooseUpgrade(c.id); else run.declineUpgrade(); continue; }
    run.invulnT = 1;
    const before = new Set(run.projectiles.filter(p => p.active).map(p => p.id));
    run.update(SIM_DT);
    run.drainEvents();
    for (const p of run.projectiles) {
      if (p.active && !before.has(p.id) && !born.has(p.id)) born.set(p.id, run.time);
    }
    for (const p of run.projectiles) {
      if (!p.active || p.outbound || p.returning || seen.has(p.id)) continue;
      if (Math.abs(p.r - ARENA.shieldOrbit) <= ARENA.shieldHalfThickness + p.radius) {
        seen.add(p.id);
        arrivals.push({ t: run.time, a: p.a, halfArc: run.halfArc, kind: p.kind, id: p.id, push: p.pushT, wave: run.wave, born: born.get(p.id) ?? -1 });
      }
    }
  }

  let violations = 0;
  for (let i = 1; i < arrivals.length; i++) {
    const prev = arrivals[i-1]!, cur = arrivals[i]!;
    const d = angleDistance(prev.a, cur.a);
    if (d <= 2 * Math.min(prev.halfArc, cur.halfArc)) continue;
    const dt = cur.t - prev.t;
    const needed = d / 11;
    if (dt < needed - 1e-6) {
      violations++;
      if (violations <= 4) {
        console.log(`seed ${seed} w${cur.wave}: dt=${dt.toFixed(3)} needed=${needed.toFixed(3)} dAngle=${d.toFixed(2)} gap=${minArrivalGap(cur.wave).toFixed(2)}`);
        console.log(`   prev id=${prev.id} ${prev.kind} born=${prev.born.toFixed(2)} arr=${prev.t.toFixed(2)} flight=${(prev.t-prev.born).toFixed(2)} push=${prev.push.toFixed(2)}`);
        console.log(`   cur  id=${cur.id} ${cur.kind} born=${cur.born.toFixed(2)} arr=${cur.t.toFixed(2)} flight=${(cur.t-cur.born).toFixed(2)} push=${cur.push.toFixed(2)}`);
      }
    }
  }
  totalViolations += violations;
  totalArrivals += arrivals.length;
}
console.log(`TOTAL: ${totalArrivals} arrivals across ${SEEDS.length} runs, ${totalViolations} violations`);
