# Verdigris Protocol

A cyberpunk / solarpunk roguelike RPG. Single player, permadeath, no
tomorrow. Read [`DESIGN.md`](DESIGN.md) for the full design and
[`RESEARCH.md`](RESEARCH.md) for what it's built on. [`SECURITY.md`](SECURITY.md)
has the honest account of the adversarial testing pass.

## Run it

No build step, no dependencies to install for the game itself — it's plain
HTML/CSS/JS served as static files.

```bash
cd verdigris-protocol
npx http-server -p 8080 -c-1 .
# open http://localhost:8080
```

It must be served over `http://`/`https://`, not opened as a `file://` URL —
the game is built from ES modules, which browsers refuse to load from the
local filesystem directly.

## Controls

Entirely mouse/click-driven, no keyboard shortcuts required. Character
name entry is the one text field.

## What's here, honestly

**Fully implemented and playable start to finish:**
- Six Origins with distinct starting stats, gear, faction standing, and
  dialogue-recoloring flags
- Six-attribute D&D-style check system (d20 + stat vs DC) with odds always
  shown before you commit
- Five factions with independent reputation tracks
- Turn-based tactical combat with telegraphed enemy intent, cyberware
  (Essence-costed) and bio-augments (Bloomstrain-costed)
- 5 recruitable companions with bond tracking and a combat assist ability
  each
- 20 hand-written encounters across skill/faction/companion/cache/rest
  kinds, procedurally combined into a branching node-map run structure
  (3 Cycles, escalating enemy tiers, a named boss per Cycle)
- Permadeath with a composed, New-Vegas-style epilogue (personal fate ×
  dominant-faction city state × per-companion outcome)
- Legacy meta-progression across runs (points, unlockable Origins, and —
  the one mechanic doing the most emotional work in the design — your
  previous character becomes the next one's tutorial mentor, by name)
- A scripted tutorial ("The Awakening") with a one-time death safety net,
  separate from and required before real permadeath begins
- Save/export/import via `localStorage` and downloadable `.json`, both
  paths hardened against malformed/malicious input (see `SECURITY.md`)

**Deliberately out of scope, not started:** a shop/currency economy beyond
loot drops and Legacy Points; more than 3 Cycles per run; voice/audio;
save-slot management (one active run at a time, by design — this is a
roguelike, not a save-scummable RPG). None of this was cut by accident;
each is a scope line drawn in `DESIGN.md` before content was written, not
discovered as a gap afterward.

## Project structure

```
index.html, style.css        entry point + the "Verdigris Fusion" visual theme
src/engine/                  state store, seeded RNG, safe DOM builder, save/load + validation
src/data/                    origins, factions, items, enemies, encounters, companions, endings
src/systems/                 skill checks, combat resolution, run/node-map/legacy logic
src/ui/                      screens and shared render components
src/main.js                  the GameController — wires state + systems + UI together
test/logic.test.mjs          pure-Node adversarial + simulation tests (no browser needed)
test/browser.test.mjs        real end-to-end Playwright run, see its header for setup
```

## Testing

```bash
node test/logic.test.mjs                 # ~600 assertions, no setup needed
# separately (playwright not bundled — see test/browser.test.mjs header):
npx http-server -p 8123 -c-1 .           # in one terminal, from this directory
node test/browser.test.mjs               # in another
```
