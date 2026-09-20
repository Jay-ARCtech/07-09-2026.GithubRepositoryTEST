# Nova Core Protocol

A bullet-heaven arena survival roguelite. Survive escalating waves, level
up mid-run with weapon/passive picks, evolve weapons, defeat bosses, and
spend Cores between runs on permanent upgrades and new characters.

Fully self-contained: no external art files, no external audio files, no
CDN scripts, no network calls, no npm dependencies required just to play
(dependencies are only needed for the optional Electron/Steam packaging).

## Play it

Any static file server works, since the game uses ES modules (which
browsers block from loading over `file://`):

```bash
cd game
npx http-server -p 8080 -c-1 .
# or: python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / Arrow keys | Left stick / D-pad | Drag anywhere |
| Dash (brief speed burst + i-frames) | Space / Shift | A / Cross | — |
| Pause | Esc / P | — | Pause button |
| Confirm | Enter | — | Tap |

Weapons fire automatically at the nearest enemy — there's no aiming input.
The skill expression is in movement (positioning, kiting, dodging boss
telegraphs) and build choices at each level-up.

## Core loop

1. Pick a character (each has a different starting weapon and stat bias).
2. Survive. Weapons auto-fire; you dodge and collect XP gems dropped by
   kills.
3. Level up → choose 1 of up to 4 random weapon/passive upgrades (or a
   weapon evolution, once a weapon is maxed and you hold its paired
   passive at max level).
4. Bosses spawn every 4.5 minutes. Defeating all 4 (at the 18-minute mark)
   is the win condition ("Cycle Complete").
5. Cores earned each run (from kills, survival time, and bosses) persist
   across runs — spend them in the Armory on permanent stat upgrades and
   new characters.

There's also a **Daily Challenge**: a fixed random seed shared by everyone
who plays that day, with its own personal-best tracking.

## Project structure

```
game/
  index.html / style.css     entry point + all UI styling
  src/
    engine/                  reusable, game-agnostic systems
      utils.js                math, seeded RNG, spatial hash grid
      core.js                 canvas setup, camera (shake/zoom), RAF loop
      audio.js                procedural WebAudio synth engine (sfx + music)
      particles.js             pooled particle & floating-text system
      input.js                 keyboard + gamepad + touch, normalized
      save.js                  versioned localStorage save/load/export
      bus.js                   tiny event bus
    game/                     gameplay data + simulation logic
      world.js, player.js, weapons.js, passives.js, characters.js,
      enemies.js, bosses.js, director.js, pickups.js, achievements.js,
      upgrades.js, levelup-options.js
    ui/                       DOM-overlay screens (menus, HUD, cards)
      hud.js, screens.js
    main.js                   wires everything into the actual game loop
  electron/                  desktop wrapper for Steam packaging
  build/icon.png              app icon (procedurally generated PNG)
  DESIGN.md                   design rationale + research citations
  STEAM_RELEASE_GUIDE.md      what's left to actually ship on Steam
```

Rendering is Canvas 2D for the game world (all primitives — circles,
triangles, rings — no sprite assets) and DOM for menus/HUD (crisp text,
CSS transitions, easy to restyle).

## Desktop build (Electron)

```bash
cd game
npm install
npm start          # run the desktop build locally
npm run build       # build installers for win/mac/linux (see STEAM_RELEASE_GUIDE.md)
```

## Save data

Stored in `localStorage` under `novacore.save.v1`. Settings screen has
export/import as a copy-pasteable string for manual backup — no account
system, no server, nothing leaves your machine.
