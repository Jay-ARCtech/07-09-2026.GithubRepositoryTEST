# Steam Release Guide

This covers what's already done, what's left, and honest guidance on
pricing and expectations. Read the "Reality check" section before doing
anything else — it directly addresses the "$100 / $500k feel" brief this
build was made against.

## Reality check on price and budget

The build was made to hit a **AAA-adjacent production-quality bar** —
tight core loop, real juice (screen shake, particles, floating damage
numbers, layered adaptive audio), meta-progression, multiple characters,
boss fights, an achievements system, save/export, controller + touch
support — using **zero art/audio budget** (everything is procedurally
drawn/synthesized) and no paid dependencies.

What it does *not* do, and nothing could, is manufacture a genuine
$500,000 art/audio production or justify a **$100 price point**. Being
straight about this because pretending otherwise would set you up to
under-perform your own expectations at launch:

- Steam data from 2025 shows **83% of games earn under $10,000 lifetime**,
  and games with fewer than 50 reviews are essentially invisible to
  Steam's discovery algorithm. Over 20,000 games released on Steam in 2025
  alone. Price is not the bottleneck for a new, unknown title — visibility
  is.
- Genre comparables (Vampire Survivors, Brotato, Halls of Torment) price
  at **$2.99–$9.99**, and that pricing is a big part of why they got
  enough volume of reviews to be seen at all. Brotato and Vampire
  Survivors both under-priced relative to their eventual quality *on
  purpose*, to win the volume game first.
- A $100 price tag on a browser-tech, no-name-art bullet-heaven would not
  read as "premium" to a buyer — it would read as a scam listing, and
  would actively suppress wishlists/conversion.

**Recommendation:** launch at **$4.99–$7.99**, with a **10-15% launch
discount** in the first week (Steam rewards games that already have a
sale configured at launch with extra visibility). If you want the "$500k
feel" to eventually become literal, the highest-leverage next dollar is
**not** raising the price — it's commissioning real pixel/vector art and
a composer to replace the procedural rendering (the code is structured so
that's a swap, not a rewrite — see "Swapping in real art" below), *then*
re-evaluate price against direct genre comparables once you have reviews.

If you disagree with this and want to ship at $100 anyway, that's your
call to make, but do it deliberately — I'd want to understand what's
supposed to justify it to a buyer comparing it against the genre's
established $5-10 price band before building a store page around it.

## What's already done

- [x] Full game (`index.html`, `style.css`, `src/**`) — playable, tested
      end-to-end in a real headless browser with a scripted playthrough,
      zero console/runtime errors.
- [x] Electron desktop wrapper (`electron/main.js`, `electron/preload.js`)
      — sandboxed, no Node integration in the renderer, blocks external
      navigation and window.open, minimal one-way IPC (quit only).
- [x] `package.json` with `electron-builder` config for Windows (NSIS),
      macOS (DMG), and Linux (AppImage).
- [x] Generated app icon (`build/icon.png`, 1024×1024).
- [x] Local save system with versioned schema, corrupt-data recovery, and
      manual export/import (base64 string) as a save backup path.

## What's left (things only you can do)

1. **Steamworks account** ($100 one-time fee per app, paid to Valve
   directly at https://partner.steamgames.com). Nobody else can do this
   step for you — it requires your legal/business identity and banking
   details.
2. **App ID + store page.** Once approved, Steamworks gives you an App ID.
   Store page needs, at minimum:
   - Header capsule (460×215), small capsule (231×87), main capsule
     (616×353), library assets (600×900 vertical, 3840×1240 hero).
   - At least 5 screenshots (1920×1080 recommended) — use the Electron
     build in windowed 1920×1080 and capture with the OS screenshot tool,
     or drive it the same way this repo's own test scripts do (Playwright
     `page.screenshot()`), pointed at real play rather than the automated
     smoke-test flow.
   - A capsule/trailer video is optional at launch but meaningfully
     improves conversion; even a 30-second gameplay loop with the
     in-game music captured via OS audio capture is enough.
   - Store description, tags (`Bullet Heaven`, `Roguelite`, `Survivors-
     like`, `Arena Shooter`, `Top-Down`), and system requirements (this
     game is extremely light — any GPU from the last decade runs it fine
     since it's 2D canvas rendering, no WebGL).
3. **Build the installers.** From `game/`:
   ```bash
   npm install
   npm run build        # builds win + mac + linux via electron-builder
   # or target one platform:
   npm run build:win
   npm run build:mac     # must be run on macOS (Apple's cross-compile
                          # restrictions apply to code signing)
   npm run build:linux
   ```
   Output lands in `game/dist/`. Windows builds from Linux/Mac work
   without signing; an unsigned `.exe` will trigger a SmartScreen warning
   on first run until you get a code-signing certificate (optional for a
   first release, but expect some users to bounce off the warning).
4. **Upload via SteamPipe/steamcmd.** Valve's `steamcmd` tool uploads
   builds to depots. You'll need an `app_build.vdf` and one
   `depot_build.vdf` per platform once Valve gives you your App ID —
   Valve's own documentation
   (https://partner.steamgames.com/doc/sdk/uploading) is the source of
   truth here since the exact IDs are assigned per-app and can't be
   predicted in advance.
5. **(Optional) Steamworks achievements/cloud saves.** The game already
   has a clean achievements system (`src/game/achievements.js`) and a
   save system (`src/engine/save.js`) that are structurally ready to be
   mirrored into Steamworks — swap `unlockAchievement()`'s local-storage
   write for a call into the Steamworks API (via `steamworks.js` or
   `greenworks`, added as an Electron native module) once you have an App
   ID to register achievement API names against. Not done here because it
   requires a live Steamworks App ID to test against.
6. **Playtesting with real humans.** Everything in this repo was verified
   by scripted automated play (see `DESIGN.md`, "What broke during
   testing") — that catches crashes and broken systems, not whether the
   difficulty curve, weapon variety, and pacing are actually *fun* for a
   human. Budget for a private Steam playtest branch before public launch.

## Swapping in real art/audio later

The renderer and audio engine are isolated on purpose:

- All drawing happens in `renderWorld()` in `src/main.js` using Canvas 2D
  primitives (`ctx.arc`, `ctx.fillRect`, etc). To swap in real sprites,
  replace the primitive calls with `ctx.drawImage(spriteSheet, ...)` —
  the position/rotation/state math around each draw call doesn't change.
- All sound goes through `src/engine/audio.js`'s `AudioEngine` class. To
  swap in real SFX/music, replace the `tone()`/`noiseBurst()` calls in
  the `sfx*()` methods with `<audio>`/`AudioBufferSourceNode` playback of
  real files, and replace `startMusic()`'s procedural loop with a
  streamed/looped music track. Nothing outside `audio.js` needs to change
  — every call site just says `audio.sfxHit()`, `audio.sfxLevelUp()`, etc.

## Security notes for the release build

- The Electron wrapper runs with `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true` — the game code has no
  access to Node/filesystem/OS APIs, only what `electron/preload.js`
  explicitly exposes (currently: an `isElectron` flag and a `quit()`
  call, nothing else).
- The page's CSP (`index.html`) restricts script execution to same-origin
  files only — no CDN scripts, no inline `<script>`, no `eval`.
- No network calls anywhere in the game code (`fetch`/`XMLHttpRequest`/
  `WebSocket` are unused) — the game is fully offline, so there's no
  server-side attack surface at all.
- The save-import feature accepts pasted text from the player themselves
  (never from another player or a server — there's no multiplayer or
  networking), decodes it as JSON inside a `try/catch`, and only ever
  renders values via `textContent` (never `innerHTML`), so there's no
  injection path even from a deliberately malformed import string.
