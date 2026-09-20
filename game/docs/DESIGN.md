# PARRY CORE — design

## The pitch

A reactor sits at the centre of the screen. Shots come in from every direction.
You have one shield, on one orbit, steered with one thumb. Catch a shot on the
shield's bright centre and you **parry** it — it reflects, it chains, it scores.
Catch it on the edge and you merely **block** it: you survive, you gain nothing.

That gap between surviving and succeeding is the whole game.

## The core loop

```
     aim  ──►  contact  ──►  parry (centre)  ──►  chain ──► multiplier ──► repair
                     └────►  block (edge)    ──►  survive, no chain
                     └────►  miss            ──►  lose integrity
```

A run is 1.5–4 minutes. Restarting is one tap.

## Controls: why a floating stick

Press anywhere; the direction from where you pressed to where your thumb is now
becomes the shield's angle. The origin trails your thumb past 64px so long
drags re-centre instead of running out of travel.

The obvious alternative — "the shield goes where you touch" — is unusable on a
phone held in one hand. A thumb physically cannot reach the top of the screen,
so an absolute scheme locks out roughly a third of the play circle. A relative
stick reaches all 360° from a two-centimetre flick.

The shield turns at a finite rate (11 rad/s on the starter core), so position
is something you plan rather than something you teleport into. That rate is
also the game's fairness constant — see below.

## The one rule that makes it fair

> **No two threats may arrive at angles further apart than the shield can
> travel in the time between them.**

Everything in the spawn system exists to enforce this. It is the difference
between a game that is hard and a game that is cheap, and cheapness is what
people write one-star reviews about.

In practice:

- Every shot in the game — wave shots, turret shots, and shells that bounce off
  your shield and come back — is queued and released by a single gate
  (`Run.updateSpawnGate`).
- The gate schedules on **predicted arrival**, not on spawn time. Spacing
  spawns is not enough: a fast shot released later overtakes a slow one and
  they land together.
- Arrival is predicted to the **outer edge of the shield band**, where contact
  actually begins — not to the shield's centre line. A fat, slow heavy shot
  reaches the band 0.37s before its centre-line estimate while a thin, fast
  swift reaches it only 0.08s early; scheduling on the centre line lets two
  shots land ~0.3s closer together than intended.
- Each shot's exact speed, jitter included, is decided when it is **queued**,
  so the prediction uses the real number.
- **Nothing changes a projectile's speed in mid-air.** Two upgrades originally
  did (a knockback and a slow field); both silently invalidated the gate's
  predictions, and both were redesigned into effects with no scheduling side
  effects. There is a test that asserts this invariant directly.
- Clusters ("twins" and "triplets") are exempt, because they land inside a
  single shield width — one correct position covers all of them. They inherit
  the lead shot's speed and curve so they cannot drift apart in flight.

`tests/run.test.ts` asserts the rule over six seeded runs by recording the
angle and time of every arrival and checking each consecutive pair.

## The contact window

The shield is a **band**, not a plane. A shot stays resolvable for the entire
time it overlaps that band — roughly 150–250ms on the default core.

The first implementation tested only the single frame on which a projectile
crossed the shield radius. That gives a one-frame parry window: arriving 8ms
late produced nothing at all, which reads as the game ignoring your input. In
headless testing it capped every skill level at wave 6. Fixing it roughly
doubled how far a competent player gets.

Resolution order inside the window:

- Sweet spot at any point during the window → **parry**, immediately.
- Shield edge only → the shot grinds along the shield and settles as a **block**
  when it leaves the band.
- Never touched → it carries on to the core.

## Threats

| | Reads as | Rule |
| --- | --- | --- |
| **Basic** | Cyan disc | Parry reflects it; it can then kill turrets |
| **Swift** | Yellow dart, long trail | Fast and curves; lead it |
| **Heavy** | Orange ring with a cross | A block knocks your shield off aim; a parry destroys it |
| **Splitter** | Pink, visibly coming apart | A block splits it in two; a parry destroys it |
| **Void** | Hollow purple, arrows pointing inward | **Do not block.** It is harmless to the core and feeds overdrive. Blocking stuns the shield for 0.55s |
| **Armoured** | White faceted shell | A block bounces it out and it comes back. Only a parry breaks it |

Every kind is distinguished on three channels at once — colour, silhouette and
motion — not colour alone. Around 8% of men have some colour vision deficiency,
and a game that encodes "never block this" purely as purple-versus-cyan is
unplayable for them.

The void orb is the design's favourite idea: a threat whose correct answer is
restraint. It inverts the reflex the rest of the game trains.

## Overdrive

Parries and absorbed void orbs charge an energy ring around the core. At full
charge, your **next parry** detonates a shockwave that clears the screen and
damages turrets. It spends itself on a moment you choose, with no extra input —
there is no second button, because there is no second thumb.

## Progression

**In-run (roguelite).** Every fourth wave, pick one of three upgrades. They
last for that run only. Fourteen of them, with stack caps, and rare ones
weighted to become more likely the deeper a run goes so a long run gets to see
a build-defining pick.

**Permanent.** Five upgrade tracks bought with shards. Deliberately small: a
fully-maxed account is roughly 15–20% stronger, not twice as strong. There is a
test that asserts the ceiling.

**Cores.** Five, each a real trade-off rather than a tier:

| Core | Cost | The deal |
| --- | --- | --- |
| SENTINEL | free | Balanced. Competitive at the top level |
| BULWARK | 800 | +1 integrity, widest shield, slow turn, narrow sweet spot |
| EDGE | 2,000 | Huge sweet spot, fastest turn, 2 integrity, tiny shield |
| FLUX | 3,600 | +75% energy: overdrive constantly |
| VAGRANT | 6,000 | +70% shards, one hit ends the run |

## Balance, measured

`npm run balance` plays the simulation headlessly with four synthetic players
modelled on reaction latency, aiming error, and how reliably they remember not
to block void orbs. Median of 30 runs each:

| Core | First run | Casual | Practised | Expert |
| --- | --- | --- | --- | --- |
| SENTINEL | w9 · 28k · 2:17 | w14 · 109k · 3:51 | w16 · 181k · 4:31 | w20 · 324k · 6:08 |
| BULWARK | w9 · 23k · 2:18 | w13 · 69k · 3:26 | w15 · 124k · 4:05 | w17 · 197k · 4:46 |
| EDGE | w7 · 13k · 1:40 | w13 · 86k · 3:33 | w17 · 222k · 4:47 | w24 · 649k · 7:46 |
| FLUX | w9 · 24k · 2:18 | w14 · 84k · 3:44 | w18 · 217k · 5:09 | w20 · 353k · 6:13 |
| VAGRANT | w7 · 13k · 1:37 | w11 · 59k · 2:45 | w12 · 83k · 3:11 | w13 · 102k · 3:29 |

What the table is meant to show:

- **Run length lands where a mobile session lands.** 1.5–2.5 minutes for a
  first attempt, 3–4 for a regular player, up to ~8 for someone very good.
- **Skill pays enormously.** On SENTINEL, expert scores 11× a first attempt. On
  EDGE it is 52×.
- **The free core is not the weak core.** SENTINEL beats BULWARK, FLUX and
  VAGRANT at expert level.
- **EDGE is the mastery core, and it is honest about it.** Worst first-run
  result of any core and the highest ceiling by a wide margin. You buy a
  harder game, not a stronger one.

## Difficulty: what actually ramps

Not raw speed. Speed is asymptotic and caps at just over +100%, because past a
point it stops being a skill test and starts outrunning human reaction time.
What ramps instead:

1. **Arrival density** — the minimum gap tightens from 0.78s to a floor of
   0.32s, which is still above the 0.29s the shield needs to cross the arena.
2. **Cluster size** — twins from wave 3, triplets from wave 9.
3. **Variety** — a new threat type every few waves through wave 10, each
   over-represented for two waves so you actually learn it.
4. **Turrets** — from wave 6, up to four, adding a second stream you can only
   stop by parrying shots back into them.

## Things that are deliberately absent

- No interstitial ads, and no function in the codebase that could show one.
- No pay-to-win: nothing purchasable touches difficulty or scoring.
- No battle pass, no energy timer, no "come back in 4 hours".
- No account, no login, no analytics, no network.
- No daily-reward nag screen. The Daily Challenge is an option, not a popup.
