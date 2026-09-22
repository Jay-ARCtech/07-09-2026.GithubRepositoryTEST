# Design Rationale — Nova Core Protocol

## Genre choice

Picked **bullet-heaven / arena survival roguelite** (Vampire Survivors,
Brotato, Halls of Torment) over other options for concrete, sourced reasons:

- The full gameplay loop (movement, auto-combat, leveling, meta-progression)
  is achievable at high visual/feel quality with **zero external art or
  audio assets** — every sprite is drawn procedurally on canvas, every sound
  is synthesized with WebAudio. That removes the two biggest risk areas for
  a scoped build: art asset licensing/quality and audio licensing.
- The genre's own success pattern is well documented: a tight core loop,
  constant escalating power fantasy, and short, replayable sessions. Design
  research on the genre consistently points to "sharp gameplay loop,"
  "constantly rewarding," and "feel overpowered" as the retention drivers,
  and to build variety (distinct weapon/passive combinations, evolutions)
  as the long-tail replay hook.
- It fails loudly and immediately when undertuned, which made it a good
  forcing function for actually testing the build rather than assuming it
  works. (See "What broke during testing" below — this was not a smooth,
  first-try success.)

## What indie games get wrong, and what this build does about it

Cross-referenced multiple 2025/2026 postmortem sources on why indie games
fail on Steam. The recurring, structural causes (as opposed to "bad luck"):

1. **No persistent reason to return.** A run-and-done game with no
   meta-progression loses players after one or two sessions.
   → Addressed with a permanent Cores currency, 6 permanent stat upgrades,
   4 unlockable characters, and an achievements list, all saved to
   `localStorage` with a versioned, corruption-tolerant schema.
2. **Undertuned "game feel."** Hits that don't register, weapons that
   don't feel like they're doing anything, no screen shake/particles/audio
   feedback. This is the single most common "why does this feel cheap"
   complaint in indie postmortems.
   → Hit-stop-free but heavy juice: screen shake, hit-flash, floating
   damage numbers, particle bursts, camera zoom pulses on level-up/boss
   kill, procedurally layered music that intensifies with danger, and
   (critically) collision math that was actually simulated and corrected
   — see below.
3. **Bloated scope, nothing finished.** Half-built systems read as
   unpolished even when the idea is good.
   → Deliberately bounded scope: 6 weapons (each with one evolution), 8
   passives, 5 enemy types + elites, 3 boss patterns, 4 characters, a daily
   challenge, and a defined ~18-minute "clear" state (4 bosses) rather than
   an open-ended, structureless grind.
4. **No defined session shape.** Many roguelites never tell the player
   when a "win" happens, which makes sessions feel like they trail off
   rather than conclude.
   → A fixed victory condition (survive + defeat 4 bosses = "Cycle
   Complete") gives every run a legible arc, win or lose.

## What broke during testing (and why this matters)

This build was **actually run in a headless browser and played through
automated input**, not just read for logical consistency. That surfaced two
real bugs that static review did not catch:

- **A silent data-contract mismatch**: `characters.js` stored stat
  multipliers under a nested `baseStats` object; `player.js` read them as
  flat fields. `undefined * number` produced `NaN` for max HP, move speed,
  damage, and luck from frame one — with **no thrown error**, because NaN
  propagates silently through arithmetic. The player's position, HP, and
  every derived stat were corrupted on every single run. This is exactly
  the class of bug that ships in a "looks done" build that nobody clicked
  through.
- **A geometry/balance bug in the starting weapon**: the orbiter weapon's
  hit detection was a single point rotating around the player. Simulating
  it showed only a ~15-18% chance of ever tagging an approaching enemy
  before it reached melee range — meaning the default starting weapon was
  very close to non-functional, and a new player's first run would have
  been a swarm death with almost no kills. Fixed by switching to a
  proximity-ring damage model (closer to how "Garlic" works in Vampire
  Survivors) decoupled from the visual blade angle.

Both were confirmed fixed by re-running the same automated playthrough:
kills, leveling, and survivability all moved from "broken" to healthy
numbers. The lesson generalizes: **a game that has never been played,
even by a script, should not be assumed to work.**

### Balance tuning, measured

After the two fixes above, the same scripted playthrough (identical input
policy: cycle movement keys, always take the first level-up/chest option,
run for up to 5 minutes) still died fast — the early-to-mid game was too
punishing for a genre whose whole appeal is an escalating power fantasy.
Rather than guess, three rounds of changes were each measured against the
same bot, holding its behavior constant so the numbers are a fair A/B
comparison:

| Change | Survival time | HP curve |
|---|---|---|
| (baseline, post-bugfix) | 47.7s | 92 → 30 → dead (sudden crash) |
| + smoothed spawn ramp (fractional budget instead of stepped `Math.floor`) | 54.9s | 98 → 71 → 23 → dead |
| + longer i-frames (0.55s→0.75s), small baseline regen, -15% contact damage on melee enemies | **75.5s**, level 10, 104 kills | 125 → 108 → 89 → 50 → dead (gradual) |

That's a real, causally-isolated improvement (same bot, same policy, only
the game's numbers changed), not noise. It's still not "final" balance —
the test bot never reinvests in its starting weapon past level 1 (a
quirk of its always-pick-first-option policy competing against ~10 other
roughly-equal-weight choices), so it under-represents a human who
deliberately builds survivability. That gap is exactly why
`STEAM_RELEASE_GUIDE.md` calls out human playtesting as a remaining
step rather than claiming this is tuned to a final release bar.

## v1.1.0: combat variety, prestige, and All-Out War

Direct response to player feedback that the horde was one-note ("everything
just chases and touches you") and that the meta-progression had a hard
ceiling ("once I maxed everything, the game had nothing left to show me").

- **Faction-based combat.** Every combat unit (player, enemy, boss, ally)
  now carries a `faction`. Bullet collision, contact damage, and AI target
  selection (`findNearestHostile` in `world.js`) all resolve purely by
  faction mismatch instead of a hardcoded "enemies hit the player" rule.
  This one change is what makes allies, and later All-Out War, possible
  without three parallel combat systems.
- **6 new enemy archetypes**: gatling (burst-fire), sniper (telegraphed
  long-range one-shot), launcher (lobbed AoE), healer (heals nearby
  hostiles), summoner (spawns reinforcements), engineer (drops timed hazard
  zones that damage/slow the player). Existing `shooter` is the "basic"
  ranged archetype these build on.
- **3 player allies** (Combat Drone, Field Medic, Vanguard), unlocked via
  new passives, spawn into the same faction-aware system as hostiles and
  can be killed and out-healed by the horde -- they're a real resource to
  protect, not a free buff.
- **Fixed a real softlock**: `generateOptions` could return fewer choices
  than requested -- zero, once every weapon/passive was maxed -- rendering
  an unpickable, undismissable level-up screen. Fixed with always-available
  "Overflow" micro-bonuses (`OVERFLOW_OPTIONS` in `levelup-options.js`) so
  the pool never runs dry. Also raised weapon/passive level caps 5→8
  (evolution timing unchanged via a separate `evolveAt` field) and steepened
  the XP curve, since the old curve let an efficient player exhaust the
  entire content pool in the first few minutes.
- **Ascension**: pausing mid-run and choosing "Overload Core" ends the run
  immediately but, if the run reached that tier's level requirement, banks
  one of 10 permanent tiers (`ascension.js`) -- extra level-up choices,
  rerolls, a free starting passive, permanent stat bonuses. This is the
  intended move once a build is fully maxed, instead of a dead end.
- **All-Out War**: a selectable mode (2-4 empires) that spawns that many
  boss "capitals" simultaneously around the arena, each with its own
  faction and troop spawner (`warmode.js`). Empires fight the player, the
  player's allies, *and each other* -- for free, because that's just what
  the generalized faction-targeting system does once each empire has its
  own faction tag. Verified in headless playtest: an empire boss was
  eliminated within 32 seconds of a 4-empire match starting, well before
  the player alone could have killed it.

## v1.2.0: All-Out War rebalance -- no infighting, scalable empire count

Direct response to player feedback: empires fighting each other in v1.1.0
diluted the threat (troops died to each other instead of pressuring the
player) and the mode was locked to a fixed 2/3/4 choice.

- **Empires no longer fight each other.** `isHostileFaction(a, b)` in
  `world.js` replaces the old "any faction mismatch is hostile" rule with
  "hostile only if one side is `player`" (the player and every ally share
  faction `player`). Two different `empireN` factions are now never
  hostile to one another -- every boss and every troop from every empire
  exists to hunt the player and the player's allies, full stop. This is
  the one function that both `findNearestHostile` and every bullet/contact
  collision check in `main.js` and `bosses.js` go through, so the change
  is centralized rather than scattered.
- **Empire count is now a slider (`screen-warsetup`)**, 2-6 empires
  (`MIN_EMPIRES`/`MAX_EMPIRES` in `warmode.js`), not three fixed cards.
  Boss `hpScale`/`dmgScale` stay at their original v1.1.0 values through 4
  empires, then taper (`0.55 * (4/n)` for HP, `0.85 * sqrt(4/n)` for
  damage) past that -- total boss HP/damage budget holds roughly flat at
  5-6 empires rather than compounding, so the difficulty spike comes from
  *more simultaneous troop directors and fronts to manage* (now that
  nothing thins them out for you), not from bosses becoming unkillable HP
  bricks. A hard cap (`WAR_ENEMY_CAP = 240` on `world.enemies.length`)
  stops the troop directors from spawning past that ceiling, so 6 empires
  is a genuine nightmare without ever turning into an unplayable slideshow
  or an unwinnable HP wall.

## v1.3.0: Cyberpunk reskin, bigger ranged threats, and the Mimic

Three independent player-facing asks, addressed without touching any
archetype/weapon/passive `id` (so meta-progression, achievements, and save
data all stay valid across the update):

- **Cyberpunk aesthetic pass.** New neon palette (`style.css` root
  variables: electric cyan `--accent`, magenta `--accent2`, violet
  `--accent3`, hot-pink `--danger`) replaces the old blue/purple/slate
  theme across every screen, HUD bar, and button, plus a system-monospace
  font stack (`--font-mono`, entirely self-hosted -- no external font
  fetches, so the CSP's `style-src 'self' 'unsafe-inline'` needs no
  loosening) and a flickering neon gradient on the title. A new
  `#scanlines` div (pure CSS `repeating-linear-gradient`, `pointer-events:
  none`, `mix-blend-mode: screen`) adds a CRT/terminal texture with zero
  per-frame canvas cost. In-run rendering (arena ring, background grid,
  menu starfield) was retinted to match; individual enemy/weapon/boss
  colors were left alone since they already read as neon against the new,
  much darker background -- retuning ~30 gameplay-entity colors for a
  marginal gain wasn't worth the regression risk of touching that many
  values in one pass.
- **Bigger ranged enemies hit harder and faster, as a rule, not a
  one-off.** `fireHostileBolt` in `enemies.js` now computes `sizeScale =
  radius / REF_RANGED_RADIUS` (13, the Shooter's radius -- the baseline
  ranged unit) and scales every hostile bolt's speed and damage off it.
  This applies uniformly to every ranged behavior (`ranged`, `gatling`,
  `sniper`, `launcher`), so it's one rule instead of per-archetype
  tuning, and it means even an elite's enlarged radius (1.35x) now also
  quietly buffs its shots -- reinforcing "big enemy, big threat" as a
  single readable visual language. Three new ranged archetypes were added
  to actually showcase the range of sizes: **Skirmisher** (small, radius
  9, weak/fast), **Heavy Gunner** (bulked-up Gatling, radius 22), and
  **Siege Cannon** (radius 30, near-hitscan shells, the biggest ranged
  threat in the game). All three spawn at ordinary director weight-table
  rates from early-to-mid game onward, in both Survival and War Mode.
- **The Mimic.** A regular enemy (`enemies.js`) and a boss variant "Mimic
  Overlord" (`bosses.js`, in the normal 4-boss rotation alongside
  Colossus/Swarm Queen/Void Lancer) that snapshots the *real* player's
  current weapon loadout (id/level/evolved) at spawn time and fights with
  all of it. Neither spawn path is gated behind the elite roll or any
  rarity mechanic -- it appears at normal weighted rates like every other
  archetype, per the explicit "not a rare enemy" requirement. Implementation
  lives in the new `mimic.js`, shared by both the regular and boss variant,
  rather than reusing `weapons.js`'s `WEAPONS[id].update()` directly: those
  functions assume `player` is the real player hunting `world.enemies`
  (`nearestEnemy()` explicitly filters out faction `"player"`), which is
  exactly backwards for something that has to hunt the real player instead.
  Each copied weapon is re-expressed as a small flavor entry (damage/
  cooldown/range coefficients, keyed by weapon id) driven off the Mimic's
  own already-scaled `dmg` stat -- the same pattern every other ranged
  archetype already uses to derive its shot damage from `e.dmg`. Bullet-
  based copies (Blaster, Missile, Lightning, Drone) reuse the existing
  faction-aware bullet pipeline outright; direct-damage copies (Orbiter,
  Nova) tick damage into nearby hostiles via `isHostileFaction` and reach
  the real player through a new `world._onMimicPulseHit` callback, following
  the same `world._onXxx` hook pattern `main.js` already registers for
  particle/audio side effects (`_onEnemyDamaged`, `_spawnRing`,
  `_onSupportPulse`) rather than adding a bespoke direct-damage path. It
  renders with the player's own ship silhouette (not a plain circle) in
  the player's own character color, snapshotted at spawn, so it visually
  reads as "a copy of you" rather than just another enemy type.

## v1.4.0: Night City art pass -- from palette to actual scenery and silhouettes

Direct player feedback on v1.3.0: the cyberpunk pass was "just dots and shapes
and colors" with a neon coat of paint -- the ask was for the game to actually
look like Night City (Cyberpunk 2077's setting), not just be tinted like it.
This pass rebuilds what's actually drawn on the canvas, not just its colors,
entirely in `src/engine/scenery.js` (new module) plus the render calls in
`main.js` that use it:

- **A real skyline, not a starfield.** The menu background (`drawCitySkyline`)
  is a procedurally generated building skyline -- ~22 buildings of varying
  height with individually flickering lit windows, a tall "megacorp" tower
  with a sweeping magenta holographic beam, a street-level neon reflection
  line, and falling rain streaks in place of the old twinkling stars. Built
  once from a fixed seed (not regenerated per frame), so it's static art, not
  a per-frame cost.
- **The arena is a rooftop/street battlefield, not a bare circle.** Seven
  holographic billboards (glowing rectangles with animated abstract "ad" data
  bars) and ten glowing containment pylons ring the play space
  (`buildArenaScenery`/`drawArenaGround`), plus a handful of drifting distant
  light glints just outside the boundary implying the rest of the city is out
  there. Placement is seeded from `world.seed` through its *own* RNG instance
  -- never `world.rng` -- because consuming rolls from the gameplay RNG
  stream for decorative purposes would silently change enemy spawns/loot for
  a given seed and break Daily Challenge reproducibility.
- **Every unit is a silhouette, not a dot.** `ENEMY_TYPES`/`BOSS_TYPES` now
  carry a `shape` field (`swarm`, `heavy`, `gunner`, `sniper`, `launcher`,
  `healer`, `summoner`, `engineer`, `mimic`/`operator`, plus boss-only
  `fortress`/`queen`/`lancer`) that `drawUnitShape`/`drawBossShape` in
  scenery.js dispatch on: melee swarm units are angular diamonds with a
  single "eye," gunners get a barrel pointed along their travel direction,
  support units carry a distinct glyph (cross/antenna/gear), and each boss
  has a motif matching its name -- Colossus is a spiked hex fortress, Swarm
  Queen has orbiting petal nodes, Void Lancer is a blade silhouette. The
  player and the Mimic share one "operator" ship-hull shape (a dark
  silhouette over their own glow disc), which is the whole point of the
  Mimic. Bullets are stretched glowing tracers along their travel direction
  instead of plain circles.
- Every enemy/boss/ally archetype was already a small, fixed set (`shape` is
  a lookup field, not per-instance data), so this added zero new gameplay
  state and no measurable per-frame cost beyond a handful more canvas path
  calls per visible unit -- verified by the same up-to-6-empire War Mode
  playtest used for prior passes, with zero console/page errors.

## Deliberately out of scope

- Custom-drawn sprite art / hand-authored music (procedural instead, to
  keep the build self-contained and licensing-free — see `README.md` for
  how to swap in real assets later).
- Steam achievements/cloud-save API integration (Steamworks SDK requires a
  registered App ID and can't be wired up or tested outside of Valve's
  infrastructure) — the hooks are documented in `STEAM_RELEASE_GUIDE.md`
  for whoever owns the Steamworks account to wire in.
- Full localization (all strings are plain English, but they're centralized
  in the `game/src/game/*.js` data tables, not scattered through markup).
