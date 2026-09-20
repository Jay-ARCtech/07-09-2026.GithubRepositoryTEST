/**
 * Headless balance probe.
 *
 * Plays the simulation with four synthetic players and prints how far each
 * gets. This is how the numbers in config.ts were checked: a game a perfect
 * player cannot survive is broken; one a careless player cannot lose is dull.
 *
 * The bot models a human with three knobs - reaction latency, aiming error and
 * how reliably it remembers not to block void orbs - because those are the
 * three things that actually separate a new player from a good one here.
 *
 * Run with:  npm run balance
 */
import { Run, type RunSummary } from '../src/game/run';
import { SIM_DT } from '../src/engine/loop';
import { ARENA } from '../src/game/config';
import { angleDistance } from '../src/engine/math';
import { CORES } from '../src/game/cores';
import { Rng } from '../src/engine/rng';

interface Bot {
  skill: number;
  reaction: number;
  rng: Rng;
  aim: number | null;
  cooldown: number;
}

function makeBot(skill: number, seed: number): Bot {
  return {
    skill,
    // 380ms for a first-timer down to 130ms for an expert.
    reaction: 0.38 - skill * 0.25,
    rng: new Rng(seed),
    aim: null,
    cooldown: 0,
  };
}

function think(run: Run, bot: Bot, dt: number): number | null {
  bot.cooldown -= dt;
  if (bot.cooldown > 0) return bot.aim;
  bot.cooldown = bot.reaction;

  // Pick the inbound threat that will reach the shield band soonest, and aim
  // where it *will* be, not where it is. Leading a curving shot is something a
  // human does without thinking about it, so a bot that does not do it
  // understates how survivable the game actually is.
  let best: { a: number; eta: number } | null = null;
  for (const p of run.projectiles) {
    if (!p.active || p.outbound) continue;
    if (p.kind === 'void') continue; // handled below as an avoidance term
    if (p.returning) continue;
    const dist = p.r - ARENA.shieldOrbit;
    if (dist < -0.06) continue;
    const eta = dist / Math.max(p.speed, 0.01);
    // Lead accuracy scales with skill.
    const predicted = p.a + p.curve * eta * bot.skill;
    if (!best || eta < best.eta) best = { a: predicted, eta };
  }

  if (!best) {
    bot.aim = null;
    return null;
  }

  let aim = best.a + (bot.rng.next() - 0.5) * (1 - bot.skill) * 0.9;

  // Void avoidance: a better player is better at remembering to let them past.
  for (const p of run.projectiles) {
    if (!p.active || p.kind !== 'void' || p.outbound) continue;
    const eta = (p.r - ARENA.shieldOrbit) / Math.max(p.speed, 0.01);
    if (eta > 0.5 || eta < -0.2) continue;
    if (angleDistance(p.a, aim) < run.halfArc && bot.rng.next() < bot.skill) {
      aim = p.a + (run.halfArc + 0.35) * (bot.rng.chance(0.5) ? 1 : -1);
    }
  }

  bot.aim = aim;
  return aim;
}

function play(seed: number, coreId: string, skill: number, maxSeconds = 1200): RunSummary {
  const run = new Run({ seed, coreId, skipTutorial: true });
  const bot = makeBot(skill, seed ^ 0x5bf03635);
  let t = 0;
  while (!run.isOver && t < maxSeconds) {
    if (run.waitingForUpgrade) {
      const choice = run.pendingChoices[bot.rng.int(0, run.pendingChoices.length - 1)];
      if (choice) run.chooseUpgrade(choice.id);
      else run.declineUpgrade();
      continue;
    }
    run.setAim(think(run, bot, SIM_DT));
    run.update(SIM_DT);
    run.drainEvents();
    t += SIM_DT;
  }
  return run.summary();
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const TRIALS = 30;
const profiles: Array<[string, number]> = [
  ['first run  (0.20)', 0.2],
  ['casual     (0.50)', 0.5],
  ['practised  (0.75)', 0.75],
  ['expert     (0.95)', 0.95],
];

/* eslint-disable no-console */
console.log('PARRY CORE - balance probe');
console.log(`${TRIALS} runs per cell (median)\n`);
console.log('core       profile             wave   score   time  shards');

for (const core of CORES) {
  for (const [label, skill] of profiles) {
    const waves: number[] = [];
    const scores: number[] = [];
    const secs: number[] = [];
    const shards: number[] = [];
    for (let i = 0; i < TRIALS; i++) {
      const s = play(1000 + i * 7919, core.id, skill);
      waves.push(s.wave);
      scores.push(s.score);
      secs.push(s.duration);
      shards.push(s.shards);
    }
    console.log(
      `${core.name.padEnd(10)} ${label}  ` +
        `${median(waves).toString().padStart(4)}  ` +
        `${median(scores).toFixed(0).padStart(7)}  ` +
        `${median(secs).toFixed(0).padStart(4)}s  ` +
        `${median(shards).toFixed(0).padStart(5)}`,
    );
  }
  console.log('');
}
