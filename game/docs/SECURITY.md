# Security review

Reviewed against the build in this commit. Re-run everything here with
`npm run verify` plus the manual checks below.

## Threat model

A single-player offline game with no account, no server and no user-generated
content has a small attack surface. What remains:

1. **Supply chain** — third-party code shipped inside the app.
2. **Malicious or corrupt local state** — the save file.
3. **Injection** — anything that turns data into code.
4. **Privacy** — data leaving the device.
5. **Native surface** — permissions and webview configuration.

## 1. Supply chain

**Runtime dependencies: zero.** `"dependencies": {}`. The game engine,
renderer, audio synthesis, particle system and UI are all first-party.

Build-time dependencies are TypeScript, Vite, Vitest and the Capacitor CLI and
plugins. None ship in the web bundle — Capacitor is reached through the
`window.Capacitor` global rather than by importing `@capacitor/*`, which is why
the bundle contains no third-party code at all.

```
$ npm audit --audit-level=low
found 0 vulnerabilities
```

Verified in the built artefact:

```
$ grep -c "node_modules"  dist/assets/index-*.js   # 0
$ grep -c "@capacitor"    dist/assets/index-*.js   # 0
```

The only `Capacitor` occurrence is the name of the global this app probes for.

> Note on history: the initial toolchain (Vite 5 / Vitest 2) carried five
> advisories including one critical, all in the dev server and test runner —
> path traversal and arbitrary file read against a developer's machine, none of
> them shipping to users. They were resolved by upgrading to Vite 8 / Vitest 4
> rather than by suppressing them.

## 2. Local state

The save file is treated as untrusted input, because it is: it can be
truncated by a crash, written by an older build, or hand-edited.

- Every field is validated and clamped on load (`migrateSave` in
  `src/game/meta.ts`). Unknown core ids and upgrade ids are dropped; levels are
  clamped to their maximum; dates must match `YYYY-MM-DD`; numbers are coerced
  and range-checked, so `NaN`, `Infinity`, negatives and strings all become
  sane defaults.
- A selected core the player does not own is corrected to the default, because
  otherwise the menu would soft-lock.
- An FNV-1a checksum detects corruption. It is **not** anti-cheat, and is not
  presented as such: there are no leaderboards to poison, and a player editing
  their own single-player save is their business. A failed checksum does not
  wipe the save — the data is migrated through the same validator and merely
  flagged, because deleting somebody's progress over a checksum is worse than
  the thing it protects against.
- `localStorage` being unavailable (private mode, blocked storage, zero quota)
  degrades to an in-memory store; it never throws.

`tests/meta.test.ts` covers all of this, including a case where every field is
the wrong type.

## 3. Injection

No dynamic code execution and no HTML injection anywhere:

```
$ grep -rE "\beval\(|new Function|innerHTML|outerHTML|document\.write|insertAdjacentHTML" src/
(no matches)
```

All rendering goes through the Canvas 2D API. No user-supplied string is ever
parsed as HTML or JavaScript, because the game never accepts one — there is no
text input in the entire app.

**Content Security Policy** (`index.html`), with no `unsafe-inline` on
`script-src`:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
media-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none';
base-uri 'none'; form-action 'none'
```

## 4. Privacy

**The app makes no network requests.** Not "no tracking" — none at all.

Verified statically:

```
$ grep -rE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource" src/
(no matches)
$ grep -c "fetch(" dist/assets/index-*.js
0
```

Vite's module-preload polyfill was the one `fetch()` in the build; it is
disabled (`build.modulePreload: false`) specifically so that this claim can be
verified by grepping the artefact.

Verified at runtime — full session, every screen, a complete run:

```
total requests: 4
  /                          (document)
  /assets/index-*.js         (app)
  /assets/index-*.css        (styles)
  /icon.svg                  (favicon)
EXTERNAL requests: NONE
storage: ["parrycore.v1.save"]   cookies: ""   sessionStorage: []
```

No device identifiers are read: no `navigator.userAgent`, `deviceMemory`,
`hardwareConcurrency`, geolocation, camera, microphone, clipboard or contacts.

No advertising or analytics SDK is present. See `docs/MONETIZATION.md` for the
seam where one could be added and the constraints that seam enforces.

## 5. Native surface

- **Android ships without the `INTERNET` permission.** `tools/prepare-native.mjs`
  removes it from the generated manifest. The only permission in the merged
  manifest is `VIBRATE`, contributed by the haptics plugin. This makes "no data
  leaves the device" enforced by the OS rather than promised by the developer.
- `android:allowBackup="false"` — the save is a local high-score file, and
  auto-backup would silently copy it to the player's Google account, which
  would contradict the store listing.
- `cleartext: false`, `allowMixedContent: false` — there is nothing to load
  over HTTP, so permitting it would only widen the surface.
- `webContentsDebuggingEnabled: false` in release configuration.
- iOS: `limitsNavigationsToAppBoundDomains: true`; no remote URL is configured,
  so the webview can only load the bundled app.
- No custom URL scheme, no deep links, no exported activities beyond the
  launcher, no `FileProvider` paths that expose app data.

## 6. Build integrity

- `npm ci` installs from a committed lockfile.
- No postinstall scripts in the dependency tree beyond the standard Capacitor
  and esbuild binaries.
- The dev-only debug hook (`window.__parry`, used by the browser smoke test) is
  behind `import.meta.env.DEV` and is dead-code-eliminated from production.
  Verified: `grep -c "__parry" dist/assets/*.js` → `0`.
- No secrets, keys, tokens or endpoints exist in the repository, because the
  app has nothing to authenticate to.

## Reproducing this review

```bash
npm ci
npm run verify                      # typecheck, 81 tests, build, audit
grep -rE "eval\(|new Function|innerHTML" src/
grep -cE "fetch\(|XMLHttpRequest|WebSocket" dist/assets/*.js
grep -c "__parry" dist/assets/*.js
npx cap add android && node tools/prepare-native.mjs
grep uses-permission android/app/src/main/AndroidManifest.xml
```
