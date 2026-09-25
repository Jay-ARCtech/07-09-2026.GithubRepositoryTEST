# Security — an honest account

This was tested the way the brief asked for: as an adversarial pass against
the game's own code, not a checklist exercise. This document says what was
actually tried, what actually broke, what got fixed, and — just as
important — what was deliberately left alone and why.

## Threat model, stated plainly

Verdigris Protocol is a static, offline, single-player game. No server, no
accounts, no payments, no network calls beyond loading two font files from
Google Fonts. There is no multiplayer, no leaderboard, no shared state
between players. That collapses the realistic attack surface to two shapes:

1. **A malicious or malformed save file being imported and trusted.** This
   is the one place the game reads data it did not produce itself a moment
   ago — a `localStorage` blob that could predate a version change, or a
   `.json` file a player downloads from somewhere and loads in.
2. **Player-authored text reaching the page as markup instead of data.**
   The only free-text field in the whole game is the character name. If
   that string were ever concatenated into an HTML string, or handed to
   `innerHTML`, that would be a stored-XSS shape even with zero server
   involved — a save file is a thing people share.

**Explicitly out of scope, on purpose:** a player editing their own
`localStorage` to give themselves 99 in every stat. That costs them nothing
but their own single-player experience. Building fake client-side
"anti-cheat" against that would be theater, not security, and DESIGN.md §12
says so before any code was written — this file is the follow-through on
that promise, not a walk-back of it.

## Method

Two layers, both real, both run against the actual code (not a description
of it):

- **`test/logic.test.mjs`** — pure Node, no browser. Feeds `validateState`/
  `validateLegacy` adversarial payloads directly: `__proto__`/`constructor`
  keys at every nesting level a save can have, huge strings, out-of-range
  numbers, wrong types, raw non-object input. Also runs 200 simulated
  combats across every Origin to catch state-corruption bugs a single
  playtest would miss.
- **`test/browser.test.mjs`** — real headless Chromium via Playwright.
  Plays an actual run (character creation through tutorial through live
  combat and encounters to an epilogue), with an XSS payload deliberately
  used as the character name, then separately imports a hand-crafted
  malicious save file mid-session and checks what happens for real: does
  `window.__xss_fired` ever get set, does `Object.prototype` ever pick up a
  `polluted` property, does the page ever go blank.

Both are committed to `test/` so this isn't a one-time claim — anyone can
re-run them (see each file's header for prerequisites).

## What actually broke, and the fixes

Adversarial testing against this codebase found five real problems. None of
them were the "obvious" one (raw XSS execution) — that defense held on the
first try, because of how it's built (below). What broke instead were the
second-order failure modes: what happens to the *screen* when a value is
missing or unexpected, and one plain gameplay bug the same testing surfaced
along the way.

1. **Combat attack button silently no-op'd at 0 AP.** `playerBasicAttack`
   correctly refused to act with insufficient AP, but the enemy card's
   `clickable` state didn't check AP at all, and `combatAttack` in the
   controller ignored the failure return value — so clicking kept doing
   nothing, with no feedback, forever. Found by the browser test simply
   trying to play a full combat; a real player would have hit the exact
   same dead end. Fixed by gating the enemy card's clickability on
   available AP (matching the pattern `AbilitySlot` already used
   correctly) and by having `combatAttack` flash the reason on failure like
   its sibling handlers already did.
2. **A finished run's `beforeunload` autosave resurrected a dead epilogue
   screen.** Reaching an ending correctly calls `clearGame()`, but the
   page's `beforeunload` handler re-saved current state on *any* reload —
   including one firing during the same navigation, undoing that clear and
   writing `phase: "epilogue"` back to `localStorage`. `epilogueData` is
   deliberately never persisted (it's the run's own composed text, not
   save-shaped data), so reloading into it rendered nothing but an orphaned
   "Return to Title" button. Fixed at both ends: the constructor now
   redirects a resumed `epilogue` phase straight to a fresh title state
   (the run it belonged to is definitionally over), and the
   `beforeunload` handler no longer saves during that phase to begin with.
3. **A crafted `zone` string in an imported save's node map crashed the
   map screen outright.** `safeNodeMap` was, before this pass, a
   pass-through that only checked "is this JSON-shaped" — its own comment
   claimed the map always gets regenerated from the seed, which was false;
   `enterMap()` only regenerates when `nodeMap` is falsy, so a
   *present-but-malicious* map was used as-is. `MapScreen` then did
   `ZONES[node.zone].name` with no guard, and an unrecognized zone made
   that throw, which happened synchronously during render — before
   anything got appended to the page. Net effect: import a bad save,
   screen goes permanently blank. Reproduced directly (`repro_nodemap_crash.mjs`,
   not committed — a one-off) before and after the fix. Fixed by writing
   `safeNodeMap` for real: every node's `kind` and `zone` are checked
   against the actual allowlists (`NODE_KINDS`/`ZONE_ORDER`, now the single
   source of truth both the generator and the validator read from),
   dangling `connectsTo` references get pruned, and a map that doesn't
   fully check out is rejected as a whole rather than served half-broken —
   `MapScreen` already had a "no map generated, return to Safehouse"
   fallback for a null map, so failing closed lands on a screen that
   already existed and already works.
4. **The same class of bug, one layer down: a fake equipped item ID.**
   `safeEquipped`/`safeInventory` checked that item IDs were *strings*, not
   that they were *real items*. A crafted save with
   `equipped.cyberware: ["not_a_real_item"]` sailed through validation,
   and `AbilitySlot`'s render does `item.powerCost` straight off
   `getItem(itemId)` with no null check — another render-time crash, this
   time reachable the moment the player opened combat. Same root cause as
   #3 (a string being treated as already-safe because it *is* a string,
   when the real risk was semantic, not syntactic), so it got the same
   category of fix: `originId`, every `inventory`/`equipped` item ID,
   `companions[].companionId`, and `journal[]` entries are now checked
   against their real catalogs (`ORIGINS`, `ITEMS`, `COMPANIONS`,
   `JOURNAL_ENTRIES`) at the validation boundary, not just typed-checked.
   Verified fixed with a direct reproduction
   (`repro_fake_item_crash.mjs`) before and after.
5. **Minor, but worth stating:** while chasing #3, the import handler's
   `.catch()` — written to catch "this file failed to validate" — was also
   accidentally catching the render crash that happened *after* a
   successful validation, and flashing its message as if the import itself
   had failed. That mislabeling is exactly the kind of thing that hides a
   real bug during testing. Fixed by giving the post-validation render its
   own try/catch, which resets to a clean state and says plainly that the
   save loaded but couldn't be displayed, rather than blaming the file.

## What was verified to hold, and why it holds structurally

- **No XSS via the character name, in any of the places it's rendered.**
  This isn't an escaping convention that has to be remembered at every call
  site — `engine/dom.js`'s `h()` builder never accepts an `innerHTML`
  property, and there is exactly zero uses of `innerHTML`, `outerHTML`, or
  `document.write` anywhere in `src/`. Every dynamic string reaches the DOM
  through `document.createTextNode`, which cannot be parsed as markup no
  matter what it contains. Tested with `<svg onload=...>` as the literal
  character name, live in Chromium, at both the point it's set and every
  screen that displays it afterward: it always renders as visible text,
  never as an element, and the `onload` hook never fires.
- **No prototype pollution from an imported save.** Verified two ways: a
  payload with `__proto__` keys at the top level, inside `character.name`,
  and inside the `flags` map, none of which left a `polluted` property on
  `{}` or `Object.prototype` afterward. This holds structurally, not by
  luck — every fixed-shape object (`character`, `stats`, `equipped`, ...)
  is built by reading named fields explicitly (`raw.character.name`, never
  `for (const k in raw)` copied onto a live object), and the one place a
  save genuinely needs dynamic keys (`flags`, `perks`) is built on
  `Object.create(null)`, which has no `__proto__` accessor to trigger even
  if a bad key slipped past the filter. Belt and suspenders, checked both
  ways in `logic.test.mjs`.
- **No code execution paths.** Zero uses of `eval`, `new Function(...)`, or
  string-argument `setTimeout`/`setInterval` anywhere in the codebase.
- **Zero supply-chain surface.** The game has no `package.json`, no npm
  dependencies, no build step — it's hand-written HTML/CSS/JS served as-is.
  The only external network request the page makes is two Google Fonts
  stylesheet/font loads, which fail closed (the CSS declares system-font
  fallbacks for exactly that case) rather than blocking anything. This
  wasn't a deliberate security choice so much as a side effect of not
  needing a framework for a project this size — but it does mean there is
  no dependency tree to audit, which most web projects this size don't get
  to say.
- **Oversized/malformed import doesn't hang the tab.** `safeJSONParse`
  rejects anything over 2MB before `JSON.parse` ever runs on it, so a
  maliciously huge file can't turn into a multi-second parse freeze.

## What this doesn't cover

This is a small, static, single-player game, and the testing matched that
scope. It does not cover: browser-engine-level vulnerabilities (out of this
project's control), a player modifying the JS files they downloaded
themselves (that's just running different code, not a security bypass of
this code), or anything requiring a server this game doesn't have.
