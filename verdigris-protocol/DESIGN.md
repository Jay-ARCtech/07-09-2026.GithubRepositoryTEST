# VERDIGRIS PROTOCOL — Design Document

*A cyberpunk/solarpunk roguelike RPG. Single player. No multiplayer, no network calls.*

This document is the source of truth for every system built in this project. Every
major decision below traces back to a specific precedent in `RESEARCH.md` — cited
inline as **(see: Game Name)** — so the reasoning is checkable, not vibes.

---

## 1. Premise

**Setting:** Meridian, a coastal megacity, ~130 years from now. Meridian used to be one
city. It isn't anymore.

Decades ago, a self-replicating photosynthetic nanite-organism hybrid — **the Bloom**
— tore out of a failed corporate climate-remediation project and went feral. It killed
thousands. Then it started healing things: dead soil, poisoned water, collapsed
reefs. Two answers to "what do we do with it" split the city:

- **Ashgrove Combine** patented what they could isolate, walled off the rest, and
  built the **Sprawl** — the lower city: arcology towers, chrome, wage-labor, cheap
  cyberware, black markets, surveillance drones, neon over concrete.
- **The Verdant Commons** refused to let it be owned, seeded it deliberately into
  collapsing infrastructure, and grew the **Canopy** — the upper city: vertical farms
  and mycelial architecture literally rooted in the Sprawl's old bones, communal
  power and water, bio-augmentation instead of chrome.

They are not stacked cleanly. They are tangled into and dependent on each other,
competing for the same water table, the same power grid, the same raw Bloom.

**You** carry a **Bloomstrain** — a rare, unstable, living interface to the Bloom
itself, grown into your nervous system since childhood (Origin-dependent — see §4).
It makes you valuable. Corps want to extract and patent it. The Commons wants to
understand and free it. Gangs want to sell you. An AI collective wants to talk to it.
It is also killing you, slowly, on a clock you can see and manage but not stop
**(see: Cyberpunk 2077's relic countdown, Citizen Sleeper's contract clock)**.

That clock is the entire "no tomorrow" promise: this game is built around the fact
that your character's story *will* end, the only open questions are when, how, and
what it leaves behind.

---

## 2. The three questions this design answers

1. **How is it hard from minute one without being unfair?** → §7 (telegraphed danger,
   no invisible checks, a forgiving tutorial with real stakes right after).
2. **How does permadeath feel like progress instead of punishment?** → §9 (Legacy:
   every run — won or lost — banks something permanent for the next one).
3. **How does a single-player game make someone feel they built "their own world,
   their own character, with heart and soul in it"?** → §10 (named NPCs with memory,
   run-ending epilogues that narrate *your specific choices'* lasting effect on the
   city, and — the load-bearing idea — your previous characters literally become
   part of the next run's fiction, not just a stats carryover).

---

## 3. Attributes (D&D-shaped, reskinned)

Six stats, d20-under-stat-plus-modifier resolution, directly modeled on 5e's
ability-check math because it's the most widely legible system to the target
audience **(see: D&D 5e)**:

| Stat | Governs |
|---|---|
| **Body** | Melee damage/accuracy, carry capacity, max Health |
| **Reflex** | Initiative, ranged accuracy, Dodge, stealth |
| **Synth** | Hacking, cyberware power/reliability, crafting, tech skill checks |
| **Grit** | Resistance to Heat and Stress, environmental survival, death saves |
| **Empathy** | Dialogue checks, faction reputation gain/loss magnitude, companion bond |
| **Resonance** | Bio-augment power, Bloom-related actions — **and** how fast your Bloomstrain clock advances. The setting's unique risk/reward stat: more Resonance is more power *and* a shorter story. |

Checks are always previewed before you commit: the game states what's at risk and
gives a plain-language odds band (Poor / Fair / Good / Strong) rather than a raw
percentage or, worse, nothing at all **(see: Blades in the Dark's position/effect;
this is the direct fix for "hard" tipping into "unfair")**.

---

## 4. Origins (life-path — a mechanical fork, not a cosmetic one)

Chosen at character creation, each Origin sets starting stats, starting gear,
starting faction standing (some positive, some already hostile), a unique starting
companion-or-contact, and — critically — **recolors dialogue options across the whole
game**, the same way Cyberpunk 2077's three life paths do, not just in an opening
scene **(see: Cyberpunk 2077, Vampire: The Masquerade – Bloodlines, Cyberpunk RED
life-path tables)**.

1. **Corpo Defector** — Ashgrove cyberware, Ashgrove enemies, a former handler who
   wants you back or dead.
2. **Commons-Raised** — bio-augment, Commons trust, Ashgrove treats you as stolen
   property.
3. **Undertow Runner** — no faction loyalty, black-market contacts, starts owing
   someone dangerous a favor.
4. **Choir-Touched** — raised near the rogue-AI collective; starts with a synthetic
   "voice" companion; every human faction starts at reduced trust because you read as
   *wrong* to them.
5. **Warden Washout** — ex-security discharge, combat-trained, bound by a personal
   code that costs you narrative options (you can't easily lie, can't easily take
   the cruelest choice branches) in exchange for unique Warden-only resolutions.
6. **Bloom-Orphan** — found feral near a wild Bloom outbreak as a child. No faction
   ties, highest starting Resonance (shortest safe clock, highest ceiling), a
   genuine blank slate. This is the answer to "I just want total freedom."

---

## 5. Factions (the hero/villain/neutral sandbox)

Five factions, each with a reputation track from Hostile → Unknown → Trusted → Bonded.
None are purely good or evil — every one has an internal minority position that
complicates it — because a hero/villain/neutral sandbox only works if every faction
is a *real* choice, not an obvious trap or an obvious correct answer.

- **Ashgrove Combine** — corporate, wants the Bloom patented and controlled. Villain-
  coded by default. Cyberware supplier. Has an internal reform cell.
- **The Verdant Commons** — collectivist, wants the Bloom free. Hero-coded by
  default. Bio-augment supplier. Has an internal purity-zealot faction that will
  turn on you for compromising "too much."
- **Undertow** — street gangs and fixers running the Sprawl's underlevels.
  Transactional, not moral. The pure mercenary/survivalist path
  **(see: Cyberpunk RED edgerunner contracts, Streets of Rogue)**.
- **The Choir** — a rogue-AI collective living in abandoned server-arcologies. Wants
  the Bloom for reasons that aren't human reasons. The "villain with an alien goal,
  not a cruel one" option, and the hacking-flavored faction.
- **Wardens** — independent ex-corp security running contested-zone order and bounty
  work. The "help without picking a side's ideology" path — structure over dogma.

You can be loved by one, hated by three, and dead center neutral with the last —
simultaneously. Nothing locks you out of playing villain-to-everyone or
friend-to-everyone except the natural friction of factions that dislike each other
noticing who you're seen with. Faction relationships also drift and act on *each
other* independent of the player, not just in reaction to them
**(see: Stellaris, Crusader Kings)** — the world keeps moving even in the systems you
haven't touched this run.

---

## 6. Combat

Turn-based, tactical, action-point based (2 AP/turn: move, attack, ability, item,
interact — mix and match) rather than a full battle-grid, to keep scope real
**(see: Citizen Sleeper's AP-as-allocation, Into the Breach's small tight
battlefields)**.

Hard rule carried from §7: **every enemy telegraphs its next action one turn before
it happens** (an icon over their head, plain language on hover) **(see: Into the
Breach)**. Difficulty comes from having too few good options under real resource
scarcity, never from information you couldn't have had.

Cyberware abilities draw on **Power**; bio-augments draw on **Resonance**-scaled
Power too, but bio-augments also creep the Bloomstrain clock a little on use —
so the "better" ability in the short term is never free in the long term. That
tension is the whole game's thesis compressed into one combat decision.

---

## 7. The "no tomorrow" difficulty philosophy

Three separate clocks, on purpose kept to three (see RESEARCH.md conclusion #5 —
small interlocking resource sets beat sprawling ones):

- **Health** — dies, you die (a run-ending death, not a soft fail).
- **Heat** — per-Cycle pursuit meter. Rises from violence, failed stealth, faction
  hostility. High Heat spawns hunting squads that come looking for *you*
  specifically **(see: FTL's rebel fleet)**.
- **Bloomstrain Progression (0–100%)** — the macro clock across the whole run. Rises
  passively over time and faster with high-Resonance/bio-augment use. At 100%, the
  run ends — not with "you lose," but with a specific transformation epilogue that
  depends on your alignment and choices (see §10).

**The fairness rule, stated once so it can be checked against every system built
after this document:** difficulty comes from *scarcity and consequence*, never from
*hidden information*. The player should always be able to say exactly why they died.
If a death can't be explained in one sentence pointing at a decision the player
actually saw, it's a bug, not "hard."

The tutorial (§8) is real content, not a menu-driven walkthrough, but it runs at
reduced lethality with a safety net (see below) specifically so the very first
hour doesn't gatekeep the genre-curious. After it ends, full stakes apply
immediately and permanently — the game does not get easier because the character
survived longer; if anything Heat and Bloomstrain pressure compound
**(see: Monster Train/Loop Hero's escalating-stakes structure)**.

---

## 8. Tutorial: "The Awakening"

Framed inside the fiction, not bolted on as a menu: this is the Bloomstrain's first
activation. You're guided by a **Memory-Echo** — a fading fragment of your
Bloomstrain's *previous* host, who talks you through movement, combat, dialogue/skill
checks, and what Health/Heat/Progression mean, across one low-lethality mission
(you cannot permanently die during it — a Memory-Echo "catches" a killing blow once,
narrated in-fiction, not as an apologetic system message). At the end, the Echo
fades out for good, and the game says plainly: *this is where it gets real.* Full
permadeath begins the moment tutorial control returns to the player.

This does double duty: it's the onboarding the brief asked for, and it's the first
emotional beat of the Legacy system (§9/§10) — the player's very first exposure to
"a previous host's memory guiding you" is the exact mechanic their *own* character
will become for the next one.

---

## 9. Runs, permadeath, and Legacy (meta-progression)

**Run structure:** a branching node map per Cycle, spanning Sprawl nodes, Canopy
nodes, and liminal border nodes, toward a Cycle-ending confrontation
**(see: FTL, Slay the Spire)**. A full playthrough is several Cycles.

**Permadeath:** Health hits 0, or Bloomstrain hits 100%, and that character's story
is over. There is no reload-to-undo. This is not softened.

**Legacy Points** are earned from choices, faction standing reached, and how far a
run got, banked permanently at run's end regardless of how it ended
**(see: Hades, Rogue Legacy)**. They buy:

- New Origins and starting-companion options
- Narrative callbacks (see §10) — NOT stat power
- Cosmetic and flavor unlocks (Codex/Journal entries, alternate mentor-Echo lines)

**Explicit rule to prevent difficulty rot:** Legacy purchases widen *options*, they do
not increase raw power. A fresh character with everything unlocked is exactly as
mechanically hard to keep alive as the very first character — because "hard even at
the start, and stays hard" was an explicit requirement, and the easiest way to break
that promise silently is meta-progression power creep. This rule exists specifically
to stop that.

---

## 10. Making it feel earned: named memory, not just numbers

This is the direct answer to "make them feel they built their own world and put
heart and soul into it," and it's mechanical, not just narrative flavor:

- **Companions and contacts are specific named characters who remember what you did**
  — including to them. They can be permanently lost. Bonds (not romance-as-checklist,
  but real relationship state) affect what they'll do for you later in the run.
- **Every run ends with an epilogue-slide sequence**, in the New Vegas mold
  **(see: Fallout: New Vegas)**, narrating the specific, lasting effect of *that
  character's* choices on Meridian — which faction ascended, who you saved, who you
  sold out, what the Bloom became because of you.
- **The load-bearing idea:** your dead character's memory becomes the next
  character's Memory-Echo mentor (§8). Named. Specific. Referencing what *that*
  player actually did. This is the single mechanic doing the most emotional work in
  the whole design — it makes every past run literally part of the game's ongoing
  fiction, which is as close as a strictly single-player, no-multiplayer game can get
  to "I built my own world" without pretending otherwise.
- A personal **Codex/Journal** fills in from the player's own actions rather than
  static lore dumps **(see: Disco Elysium's thought cabinet)** — by the end, it reads
  as *that character's* story, not the game's marketing copy.

---

## 11. What "worth $200" means here

Not a price mechanism — there's no payment code in a single-player offline game, and
building one would be actively dishonest scope. It means: the depth and
craftsmanship promise of a full-price premium release, evaluated against everything
in §1–§10:

- Six meaningfully different Origins that recolor dialogue throughout, not just at
  the start.
- Five factions with independent drift, internal complexity, and real hero/villain/
  neutral latitude.
- A combat system with real tactical decisions and telegraphed fairness.
- A permadeath loop where death is designed to feel like *narrative material*, not
  failure — carried by named-NPC memory and epilogues, not a scoreboard.
- Multiple, materially different endings driven by accumulated choices.

Depth is the deliverable. The README states plainly what's fully built vs. scaffolded
for future content, because overclaiming here would be the opposite of honest.

---

## 12. Security posture (design-level; full pass in a later phase)

This is a static, offline, client-side single-player game — there is no server, no
account system, no payment flow, and no multiplayer surface. Stated honestly: the
realistic threat model is **not** "a hacker breaks into the game," it's:

- A malicious or malformed **save file** being imported and trusted blindly
  (prototype pollution, `eval`/`Function`-style code execution, unbounded values that
  break math).
- **Reflected input** (character name, journal text, any player-authored string)
  being rendered as HTML instead of text — a classic stored-XSS shape, even with no
  server involved, if the player ever shares/pastes a save file.
- The player editing their own `localStorage` save to cheat. This is **not a threat
  worth defending against** in a single-player offline game — it costs the player
  nothing but their own experience — and pretending otherwise (fake client-side
  "anti-cheat") would be theater, not security. It is explicitly out of scope, stated
  here so it isn't silently "fixed" with something dishonest later.

The real adversarial pass (task: Security hardening) treats every save-import path
and every place player-authored text reaches the DOM as untrusted input, on the
assumption a "veteran hacker" would specifically target save-file parsing and any
`innerHTML`/`eval` usage — because that's where the actual exploitable surface of a
client-side game lives.
