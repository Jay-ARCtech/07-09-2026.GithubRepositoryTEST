# PARRY CORE

A one-thumb radial parry arcade roguelite for iOS and Android.

A reactor sits at the centre of the screen. Shots come in from every direction.
You have one shield, on one orbit, steered with one thumb. Catch a shot on the
shield's bright centre and you **parry** it — it reflects, it chains, it scores.
Catch it on the edge and you merely **block** it: you survive, you gain nothing.

That gap between surviving and succeeding is the whole game.

```
       ·  ·  ·                     drag anywhere to swing the shield
    ·           ·
  ·    ▁▁▃▃▃▁▁    ·                ▃  shield        ▓  sweet spot (parry)
 ·    ▁▃▓▓▓▓▓▃▁    ·
 ·        ⬡        ·               ⬡  your core
 ·                 ·
  ·               ·                ·  incoming
    ·           ·
       ·  ·  ·
```

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173 — plays with mouse or arrow keys
npm run verify     # typecheck + 81 tests + production build + npm audit
npm run balance    # headless balance probe across four synthetic skill levels
```

## What's here

| | |
| --- | --- |
| **Bundle size** | 31 KB gzipped, total |
| **Runtime dependencies** | none |
| **Network requests** | none — the game is fully offline |
| **Assets** | none — all art is drawn procedurally, all audio is synthesised |
| **Tests** | 81, including the fairness invariants below |

## Documentation

| | |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | How the game works, the fairness rule, measured balance |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Market research, what flops and why, and what this does about it |
| [docs/STORE.md](docs/STORE.md) | Step-by-step submission to both stores, plus listing copy |
| [docs/SECURITY.md](docs/SECURITY.md) | Security review and how to reproduce it |
| [docs/MONETIZATION.md](docs/MONETIZATION.md) | The monetisation boundary and the rules it enforces |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Privacy policy, ready to host |

## Architecture

```
src/
  engine/      loop, math, seeded RNG, input, audio, particles, camera, storage
  game/        the simulation — no DOM, no canvas, no timers
  ui/          renderer, HUD, menus, and the layer that turns events into feel
  platform/    Capacitor bridge and the monetisation boundary
```

The simulation and the presentation are strictly separated. `src/game/run.ts`
takes input, advances by a fixed timestep, and emits a queue of events. It
touches no browser API at all, which is why a full 30-wave run can be simulated
headlessly in a test — and why `npm run balance` can play thousands of runs in
a few seconds to check the difficulty curve.

The simulation runs at a fixed 120Hz regardless of display refresh. Parry
windows are measured in milliseconds, so a variable timestep would make the
game measurably easier on a 120Hz phone than a 60Hz one.

## The fairness rule

> No two threats may arrive at angles further apart than the shield can travel
> in the time between them.

Every shot in the game — wave shots, turret shots, and shells that bounce off
your shield and come back — is released by a single gate that schedules on
*predicted arrival*, not spawn time, measured to the outer edge of the shield
band where contact actually begins.

Three separate bugs violating this rule were found by writing the invariant as
a test and letting it fail. Each one produced hits that were genuinely
impossible to avoid, which is the difference between a game that is hard and a
game that is cheap. `tests/run.test.ts` asserts it over six seeded runs.

## Building for the stores

```bash
npm run native:add:android     # generates android/ and applies native config
npm run native:add:ios         # macOS only
npm run native:icons           # launcher icons (needs: npm i -D playwright)
npm run cap:sync               # after any web change
```

`ios/` and `android/` are generated, not committed. Every native change this
game needs lives in `tools/prepare-native.mjs`, which is committed, idempotent,
and documented in [docs/STORE.md](docs/STORE.md).

## What this game deliberately does not do

No interstitial ads — and no function in the codebase that could show one.
No pay-to-win: nothing purchasable touches difficulty or scoring, and the free
starter core is competitive at the highest level. No battle pass, no energy
timer, no daily-reward nag. No account, no login, no analytics, no network.

Each of those is a direct response to something the research said drives
uninstalls. The reasoning is in [docs/RESEARCH.md](docs/RESEARCH.md).

## Licence

MIT.
