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
