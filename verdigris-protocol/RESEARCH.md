# Research: 60 games across 22 genre buckets

Method note, stated plainly: this is a curated pass, not 60 independent deep-dives. Most
entries below come from existing knowledge of the genre (training cutoff January 2026);
a handful of targeted live searches (September 2026) were used specifically to check
what's current in the thinner categories — solarpunk games, and anything cyberpunk/roguelike
that shipped in 2025–2026 — since those are the areas most likely to have moved. Search-sourced
entries are marked **[verified 2026-09]** with a link. Everything else reflects the trained
knowledge cutoff and should be treated as "true as of ~Jan 2026" rather than independently
re-checked today.

Every row states a **design takeaway** — the actual reason it's in this document — because
a list of names is not research, it's trivia. The takeaways are what got built into
`DESIGN.md`.

---

## 1. Cyberpunk action-RPG / open world

| Game | Takeaway |
|---|---|
| Cyberpunk 2077 (+ Phantom Liberty) | Life-path origin (Corpo / Street Kid / Nomad) that recolors the *same* early missions with different dialogue and access — cheap to build, huge perceived personalization. We steal this directly for Origins. |
| Deus Ex (series) | Multiple valid solutions to one objective (stealth / hack / combat / social) is what makes "be whoever you want" feel real instead of cosmetic. |
| The Ascent | Isometric cyberpunk combat with a vertical arcology city — proof a small team can make cyberpunk *feel* dense without an open-world budget. |
| Ruiner | Minimalist neon combat, no filler — a lesson in cutting scope rather than diluting it. |
| Ghostrunner | Movement-as-power-fantasy; punishing one-hit-death combat that still feels fair because failure is always legible (you can always name what killed you). Directly informs "hard but fair." |

## 2. Cyberpunk immersive sim / narrative

| Game | Takeaway |
|---|---|
| System Shock (1994/2023 remake) | Audio-log environmental storytelling — lets us deliver worldbuilding without gating it behind cutscenes. |
| Prey (2017) | Every system (GLOO cannon, mimics, skill tree) touches every other system — the standard for "systemic" design we're aiming at in Combat + Districts. |
| VA-11 HALL-A | Entire game is a bartender taking drink orders and listening — proof that a tiny interaction loop can carry an entire cyberpunk world if the writing is dense enough. |
| 2064: Read Only Memories | Investigation + companion-relationship narrative in a hopeful (not grimdark) cyberpunk Neo-San Francisco — the closest existing tonal blend to what "cyberpunk + solarpunk" should feel like. |
| Citizen Sleeper | Dice-allocation-as-daily-action-points, permanent consequence, class-struggle cyberpunk without a single gunfight. Directly shaped our Action Point + faction-reputation systems. |

## 3. Cyberpunk roguelike / roguelite / tactics

| Game | Takeaway |
|---|---|
| Anomaly Collapse **[verified 2026-09]** ([wiki](https://en.wikipedia.org/wiki/Anomaly_Collapse)) | Recent (2026) roguelike-adjacent release — confirms the genre is still active, not dead. |
| Streets of Rogue | Emergent sandbox systems (bribe, hack, fight, sneak) inside a run-based roguelike city — the closest structural sibling to what we're building. |
| Katana ZERO | Time-rewind narrative framing turns permadeath retries into in-fiction "redos" instead of a meta-mechanic — we use a lighter version of this for the tutorial's forgiving retries. |
| Void Bastards | Comic-panel narration over a run-based FTL-like structure — proof that voice/tone can carry procedural content. |
| Cyber Shadow | Old-school difficulty curve done fair: damage patterns are always readable a beat before they land. |

## 4. Classic dungeon-crawler roguelikes (the D&D lineage)

| Game | Takeaway |
|---|---|
| Caves of Qud | Deep character-build systems (mutations *and* cybernetics in one game already!) with permadeath and a persistent world — the single closest existing analog to "cyberpunk-meets-biopunk roguelike RPG." |
| Dwarf Fortress / DCSS (Dungeon Crawl Stone Soup) | Origin/background selecting starting kit + skills instead of a blank slate — the genre-standard onboarding pattern we use for Origins. |
| NetHack | "Ascension" as an extremely hard, rare, earned endpoint — informs that our hardest ending should be legitimately rare, not the expected outcome. |
| Brogue | Proof that a roguelike can be *fair*-hard (readable danger, no unavoidable deaths) instead of *cruel*-hard. This is the single biggest influence on our difficulty philosophy. |

## 5. Roguelike deckbuilders / run-based meta-progression

| Game | Takeaway |
|---|---|
| Slay the Spire | Per-run build variety from a small card pool + node-map run structure — this is the literal shape of our mission-map system. |
| Hades / Hades II | Meta-progression (permanent unlocks bought with run currency) turns permadeath from "punishment" into "the loop" — died runs still *advance* the player. This is the core of our Legacy system. |
| Griftlands | Faction reputation + deck changes based on dialogue choices in a cyberpunk-adjacent setting — direct precedent for tying combat build to narrative choice. |
| Monster Train / Loop Hero | Escalating-stakes run structure ("it gets worse the longer you take") — informs the "no tomorrow" pressure clock. |
| Rogue Legacy / Rogue Legacy 2 | Each death funds the next attempt via inherited currency, not inherited power alone — keeps runs feeling earned rather than trivialized. |

## 6. Solarpunk (games)

| Game | Takeaway |
|---|---|
| *Solarpunk* (Steam, floating-islands survival-crafting) **[verified 2026-09]** ([Steam](https://store.steampowered.com/app/1805110/Solarpunk/), [release info](https://www.gamermarkt.com/blog/solarpunk-cozy-survival-game-release-date-features/)) | Shipped June 2026, 2-person studio, 1M+ wishlists before launch — confirms real commercial appetite for the aesthetic, not just a mood board. Renewables-as-crafting-resource (solar/wind gathering) is a mechanic we borrow for the Commons faction's tech tree. |
| Terra Nil | "Reverse city-builder" — you restore a dead world to life and then *leave no trace*. This is the single clearest mechanical expression of solarpunk values in an existing game, and it directly shaped the Commons faction's win-condition (regeneration, not conquest). |
| Eco (global.gg) | Player actions have real, shared ecological consequence (overharvest a species, it's gone) — informs that Commons-faction choices should have lasting world-state weight even though this is single-player. |
| Save the Dungeon **[verified 2026-09]** (itch.io) | Explicitly tagged "solarpunk turn-based roguelite RPG where you restore the environment" — direct genre-and-mechanics precedent for combining roguelike structure with regeneration-as-objective. |
| SolAR – Solarpunk RPG **[verified 2026-09]** (mobile) | Character customization + "purify the city" framing — confirms hero-vs-corruption framing is an established solarpunk-game trope we can lean on. |
| Abzu | Pure exploration, biodiversity as spectacle, near-zero UI — informs the *tone* (awe, not grind) we want the Commons district to evoke visually even inside a harder game. |

## 7. Solarpunk (tabletop — design reference only, not ported directly)

| Game | Takeaway |
|---|---|
| Fully Automated! RPG **[verified 2026-09]** ([site](https://fullyautomatedrpg.com/)) | Post-scarcity framing where automation freed labor — informs Commons-faction flavor text and why its "currency" is reputation/mutual aid, not credits. |
| Dragon Turtle Games' *Solarpunk RPG* **[verified 2026-09]** ([Geek Native](https://www.geeknative.com/103528/dragon-turtle-games-announce-solarpunk-rpg/)) | Tagline "a bright future, but with a shadow just below the surface" — this is almost exactly our tonal thesis (hope-punk surface, hard mechanical stakes underneath), independent confirmation we're not inventing an oxymoron. |
| Wanderhome | Stat-light, seasons-and-travelogue structure — not something we're adopting mechanically (we need harder stats for the RPG/roguelike promise) but a useful reminder to keep *flavor text* gentle in Commons zones even when systems are unforgiving. |

## 8. Biopunk

| Game | Takeaway |
|---|---|
| BioShock | Plasmids-as-power-and-body-horror — informs that "bio-augments" (our solarpunk answer to cyberware) should carry a body-cost, not just a stat bonus, to stay morally weighted like the corporate cyberware is. |
| Prototype / [REC]-style body-horror titles | Grotesque transformation as power fantasy *and* warning — the tension we want between "this augment is strictly better" and "this augment is changing what you are." |
| SIGNALIS | Biomechanical horror aesthetic married to a tightly resource-constrained survival loop — informs scarcity-driven tension design (ammo/heal counts visible and low). |
| SCORN | Environmental storytelling entirely through biomechanical architecture, near-zero exposition — a reminder that the Commons/Sprawl border zones can tell story through *what things look like grown into*, not just text. |
| Eclipse Phase (tabletop) | Consciousness-transfer / body-as-equipment framing — informs permadeath narrative framing: dying can *mean* something different depending on which faction's tech you're carrying. |

## 9. Post-apocalyptic open-world RPG

| Game | Takeaway |
|---|---|
| Fallout 3 / New Vegas / 4 | Faction reputation gates content and endings without gating *play* — New Vegas specifically (multiple end-slides based on choices across the whole run) is the direct model for our multiple-ending structure. |
| S.T.A.L.K.E.R. | Persistent danger + faction warfare that continues without the player — informs that district conflicts should feel like they're happening *to* the world, not just at the player. |
| ELEX | Sci-fi/fantasy/post-apo hybrid factions (tech vs. magic vs. primitive) as a direct tonal cousin of cyberpunk-vs-solarpunk factions. |
| Wasteland 3 / Underrail / ATOM RPG / Encased | Turn-based tactical combat with a hard, resource-scarce economy in a post-apo/retro-future setting — closest existing sibling to our combat-and-scarcity pairing. |

## 10. Vault-tech / shelter / colony management

| Game | Takeaway |
|---|---|
| Fallout Shelter | Resource triangle (power/food/water) as the entire pressure engine — informs our lean 2–3 resource pressure clock instead of a bloated 10-resource economy. |
| Sheltered / Mr. Prepper | Small-scale survival-management as its own genre — confirms a hub/base-management layer between runs is a proven pattern, used for our between-run Safehouse. |
| This War of Mine | Survival choices with genuine moral weight and no "correct" answer — the emotional target for hero/villain/neutral choices: every option should be defensible. |
| 60 Seconds! / 60 Parsecs! | Dark comedy tone married to brutal scarcity — a reminder that "hard" doesn't require "humorless"; a little levity keeps hard-but-fair from tipping into grim slog. |

## 11. Space survival / colony sim

| Game | Takeaway |
|---|---|
| RimWorld | Emergent storytelling from systemic simulation ("the AI storyteller") over authored plot — informs our procedural encounter-fragment system (combine small authored pieces algorithmically rather than write every path by hand). |
| Oxygen Not Included | Resource interdependency (heat, gas, power all cross-affect) creates puzzle-like emergent difficulty — informs Heat/Power as cross-linked resources in Combat. |
| Barotrauper / Barotrauma | Systemic failure cascades (one broken system causes three more) under time pressure — informs "no tomorrow" pacing: pressure should compound, not just tick down linearly. |
| Subnautica | Fear-of-the-unknown exploration without combat-first design — informs that some Sprawl/Commons zones should be about *dread and discovery*, not only fights. |

## 12. Space roguelike (run-based)

| Game | Takeaway |
|---|---|
| FTL: Faster Than Light | The node-map-with-branching-paths-and-a-pursuing-threat structure *is* "no tomorrow" made mechanical (the rebel fleet always catches up if you dawdle) — this is our literal template for the pursuit/heat clock across a run. |
| Duskers | Tension from information-scarcity (you can't see the threat directly, only sensor echoes) — informs fog-of-war design on the district map. |
| Into the Breach | Perfect-information tactical puzzles where you can see enemy intent before acting — informs telegraphed enemy actions in Combat so "hard" never means "unfair." |

## 13. Mecha / bio-mecha

| Game | Takeaway |
|---|---|
| Titanfall 2 (campaign) | Tight, escalating single-player campaign structure with a genuinely emotional non-human companion arc — informs pacing of the tutorial's mentor-NPC arc. |
| Zone of the Enders | Fusion of clean chrome-tech mecha silhouette against organic enemy design — direct visual-language reference for Sprawl-vs-Commons enemy design contrast. |

## 14. Immersive-choice / stat-driven narrative RPG

| Game | Takeaway |
|---|---|
| Disco Elysium | Skills as internal voices that argue with the player; failure states that are *interesting* rather than just "you lose" — the model for how failed skill checks should still advance the story instead of dead-ending it. |
| Planescape: Torment | Character build expressed entirely through dialogue options, not just combat stats — informs that Empathy/Synthesis stats need real non-combat narrative payoff, not just a combat modifier. |
| Vampire: The Masquerade – Bloodlines | Clan/origin choice reshapes entire dialogue trees and available endings — reinforces Origin-as-real-mechanical-fork, not cosmetic flavor. |

## 15. Colony/settlement sim with narrative consequence

| Game | Takeaway |
|---|---|
| Frostpunk / Frostpunk 2 | "The city must survive" law-passing under time pressure, where every law is a moral trade-off with no undo — the clearest existing precedent for making hard choices *mechanically* costly, not just flavor text. |
| Against the Storm | Roguelite settlement-building with a hostile world pressing in — reinforces pairing roguelike run structure with a management layer. |

## 16. Cli-fi / climate-fiction narrative

| Game | Takeaway |
|---|---|
| Far From Home **[verified 2026-09]** (2025 survival/sim) | Recent survival-sim entry in adjacent climate-fiction space — confirms continued genre activity worth tracking, though not deeply divergent mechanically from Eco/Terra Nil above. |
| In Other Waters | Minimalist UI-as-the-whole-interface, deep-sea discovery narrative about ecological stakes — informs keeping key HUD elements diegetic/thematic rather than generic RPG-menu chrome. |

## 17. Bullet-heaven / arena survival (contrast case)

| Game | Takeaway |
|---|---|
| Vampire Survivors / Brotato / Risk of Rain 2 | Build-from-chaos power fantasy via stacking passive upgrades over a short run — this is the genre of the *existing* `game/` (Nova Core Protocol) in this repo. Noted explicitly so this new project stays differentiated: we are turn-based/tactical/narrative, not reflex/wave-survival. |

## 18. Tabletop RPG systems (mechanical reference, not narrative)

| Game | Takeaway |
|---|---|
| D&D 5e | Attribute-plus-proficiency check math, advantage/disadvantage as a simple binary modifier — the direct source for our d20-under-stat check resolution. |
| Shadowrun (tabletop + Returns/Dragonfall/Hong Kong CRPGs) | Cyberware with an "Essence"/humanity cost — the direct precedent for cyberware carrying a stat trade-off, not just a flat upgrade. |
| Cyberpunk RED | "Edgerunner" life-path tables generating a character's starting circumstances — direct precedent for Origins rolling starting gear/contacts/enemies, not just stats. |
| Blades in the Dark | Position/Effect resolution (how risky + how impactful, decided *before* the roll) — informs telegraphing stakes to the player before a hard combat/skill decision, keeping "hard" from feeling like a gotcha. |
| Mothership RPG | Deliberately lethal, panic-and-stress mechanics in a sci-fi horror frame — informs a lightweight "Stress/Heat" meter that raises danger the longer a run drags on. |

## 19. Hopepunk / cozy-apocalypse

| Game | Takeaway |
|---|---|
| Spiritfarer | Processes grief/loss through a warm, generous mechanical loop rather than punishing ones — the emotional counterweight reference for why permadeath in this game ends in a Legacy epilogue scene, not just a game-over screen. |
| Stardew Valley | Escaping a soulless corporate job for a life of growth and community — thematically the Commons faction's entire pitch, compressed into one game's opening cutscene. |

## 20. Metroidvania / movement-driven (structure reference)

| Game | Takeaway |
|---|---|
| Hollow Knight | Area-gated progression via ability unlocks, environmental storytelling with minimal text — informs district-gating (you need a specific augment/hack to access a new district) as a non-arbitrary progression gate. |
| Hyper Light Drifter | Wordless-almost narrative delivered through color and ruin — direct visual-tone reference for "what remains of the old world" environmental storytelling in Sprawl zones. |

## 21. Vault-tech / anomaly & horror-adjacent sci-fi

| Game | Takeaway |
|---|---|
| SOMA | Body/identity horror tied directly to sci-fi copying/backup technology — informs the moral weight of any "backup consciousness" Legacy-run narrative framing so it doesn't feel like a free reset. |
| The Long Dark | No enemies at all — the environment itself is the antagonist via cold/hunger/fatigue — informs that Heat/Power/Health pressure alone (without an enemy on screen) should already feel dangerous in Commons zones. |

## 22. 4X / emergent political simulation (faction-AI reference)

| Game | Takeaway |
|---|---|
| Stellaris | Factions with their own goals that shift independent of the player's actions — informs that faction reputation should drift and factions should act on each other, not just react to the player. |
| Crusader Kings (series) | Every character is a simulated agent with memory of what you did to them — inspiration (heavily scaled down) for named NPCs remembering specific player choices across a run, referenced again after death in the Legacy epilogue. |

---

## Cross-cutting conclusions carried into `DESIGN.md`

1. **"Hard but fair" has a consistent technical definition across every well-regarded hard
   roguelike above (Brogue, Into the Breach, Blades in the Dark):** danger is telegraphed
   *before* it resolves, and death is always attributable to a legible decision, never an
   invisible stat check. This is now a hard design rule, not a vibe.
2. **Meta-progression (Hades, Rogue Legacy, Slay the Spire) is what makes permadeath feel
   like progress instead of punishment.** Every run — win or die — must bank something
   permanent.
3. **The cyberpunk/solarpunk tonal blend already exists in embryo** (2064: Read Only Memories,
   Dragon Turtle Games' *Solarpunk RPG* tagline, ELEX's faction split) — we are sharpening an
   existing lane, not inventing an unproven oxymoron.
4. **Origin/life-path-as-mechanical-fork** (Cyberpunk 2077, Vampire: Bloodlines, Cyberpunk RED,
   DCSS backgrounds) is the cheapest way to deliver replayable personalization without
   authoring N complete games — this is the backbone of the Origins system.
5. **Small, interlocking resource systems (Fallout Shelter's 3 resources, ONI's cross-linked
   heat/gas/power) beat sprawling ones.** We are deliberately capping the core pressure loop
   at three tracked resources: Health, Heat (corporate pursuit), Power (cyberware/tech fuel).
