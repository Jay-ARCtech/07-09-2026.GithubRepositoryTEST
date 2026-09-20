# Shipping to the App Store and Google Play

The web build is the game. Capacitor wraps it in a native shell for each
platform. Everything below assumes you are starting from a clean checkout.

## 0. Before anything else

Change the bundle identifier. It is the one value that must be unique and
**cannot be changed after your first release on either store**.

```ts
// capacitor.config.ts
appId: 'com.yourcompany.parrycore',
```

## 1. Build and verify

```bash
npm ci
npm run verify     # typecheck + 81 tests + production build + npm audit
```

## 2. Generate the native projects

The `ios/` and `android/` directories are **generated, not committed**. They are
reproducible from `capacitor.config.ts` plus `dist/`, and they contain absolute
machine paths that make them noisy in version control. Any native change this
game needs lives in `tools/prepare-native.mjs`, which is committed and
idempotent.

```bash
npm run native:add:android     # cap add android + prepare-native
npm run native:add:ios         # cap add ios     + prepare-native   (macOS only)
npm run native:icons           # launcher icons for whichever platforms exist
```

`native:icons` needs Playwright to rasterise the SVG. It is not a project
dependency because icons are a build-time artefact and a native binary in
`package.json` is a supply-chain surface the game never needs:

```bash
npm i -D playwright && npm run native:icons
```

After any web change: `npm run cap:sync`.

### What `prepare-native.mjs` does, and why

| Change | Reason |
| --- | --- |
| Removes the Android `INTERNET` permission | The game makes zero network requests. Shipping without it makes "no data leaves the device" OS-enforced |
| `android:screenOrientation="portrait"` | One-thumb portrait game |
| `android:allowBackup="false"` | The save is a local high-score file; auto-backup would copy it to the player's Google account |
| iOS portrait-only, phone and tablet | Same |
| `UIStatusBarHidden` | The canvas is full-bleed |
| `ITSAppUsesNonExemptEncryption = false` | Answers App Store Connect's export-compliance question. The game uses no cryptography |

## 3. Android release

```bash
npm run native:open:android     # builds, syncs, opens Android Studio
```

1. **Signing key** — generate once and keep it somewhere you will still have it
   in five years. Losing it means you can never update the app.
   ```bash
   keytool -genkey -v -keystore parrycore.keystore \
     -alias parrycore -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Wire it into `android/app/build.gradle` as a `signingConfig`, or use Play App
   Signing and upload the key. Never commit the keystore or its passwords.
3. **Build → Generate Signed Bundle** → Android App Bundle (`.aab`). Play
   requires AAB, not APK, for new apps.
4. Bump `versionCode` (integer, must increase) and `versionName` (display
   string) in `android/app/build.gradle` for every upload.

**Play Console checklist**

- Data safety form: **no data collected, no data shared**. That is accurate;
  see `docs/SECURITY.md` for how to verify it.
- Content rating questionnaire: no violence against people, no gore, no user
  interaction, no ads, no purchases → expect **PEGI 3 / ESRB Everyone**.
- Target audience: 13+ is the safe answer. If you select "children" you take on
  Families Policy obligations for no benefit here.
- Ads declaration: **contains no ads** (true for this build).
- Privacy policy URL: required. Host `docs/PRIVACY.md`.
- Graphics: 512×512 icon (`public/icon-512.png`), 1024×500 feature graphic,
  2–8 phone screenshots.

## 4. iOS release

Requires macOS with Xcode.

```bash
npm run native:open:ios
```

1. Signing & Capabilities → select your team. Capacitor sets the bundle id from
   `capacitor.config.ts`.
2. Set the version and build number. Build number must increase every upload.
3. Product → Archive → Distribute App → App Store Connect.

**App Store Connect checklist**

- App Privacy: **Data Not Collected**.
- Export compliance: already answered by `ITSAppUsesNonExemptEncryption=false`.
- Age rating: no objectionable content → **4+**.
- Screenshots: 6.7" iPhone is mandatory; 5.5" if you support older devices;
  12.9" iPad if you ship iPad.
- No sign-in, so no demo account is needed in review notes.

### Guideline 4.2 (Minimum Functionality)

This is what rejects thin web wrappers, and it is the single most likely reason
a Capacitor game gets bounced. Put this in the review notes:

> PARRY CORE is a natively-packaged arcade game, not a wrapped website. It has
> no web equivalent and no remote URL — all content is bundled and the app runs
> entirely offline with no network access whatsoever (the Android build ships
> without the INTERNET permission). It integrates native haptics with distinct
> feedback per impact type, native status bar and splash screen control,
> Android hardware back navigation, and native app-lifecycle handling that
> auto-pauses a run when the app is backgrounded. There is no browser chrome,
> no scrolling and no text selection; the interface is a full-screen canvas
> that is safe-area aware on notched devices.

If it is still rejected, the usual remaining asks are Game Center leaderboards
and iCloud save sync. Both are additive and neither changes the game.

## 5. Store listing copy

**Title:** `PARRY CORE`

**Subtitle / short description (≤80 chars):**
`One thumb. One shield. Catch every shot on the bright centre, or don't.`

**Full description:**

```
A reactor. One shield. Everything in the universe aimed at your core.

PARRY CORE is a one-thumb arcade game about precision under pressure. Drag
anywhere to swing your shield around the core. Block a shot and you survive.
Catch it on the shield's bright centre and you PARRY it - it reflects, your
chain climbs, and your score multiplies.

The difference between surviving and succeeding is about twenty degrees.

- ONE THUMB. Press and flick anywhere. No buttons, no menus mid-run.
- LEARN THE THREATS. Six kinds, each with its own answer. Armoured shells only
  break to a clean parry. Heavy rounds knock your shield off aim. Void orbs
  must NOT be blocked - let them through and they charge your overdrive.
- BUILD A RUN. Every few waves, choose one of three upgrades. No two runs the
  same.
- FIVE CORES, real trade-offs. The one you start with is competitive at the
  highest level. EDGE has a huge sweet spot, the fastest turn, and two points
  of integrity - it is harder, not stronger.
- A DAILY CHALLENGE. One seed a day, identical for everyone, with permanent
  upgrades switched off. A fair fight.

NO FORCED ADS. There is no interstitial in this game. None.
NO PAY-TO-WIN. Nothing you can buy makes the game easier or your score bigger.
PLAYS OFFLINE. No account, no login, no network. Your progress lives on your
device and nowhere else.

Runs last two to four minutes. Getting good takes considerably longer.
```

**Keywords (iOS, 100 chars):**
`parry,arcade,reflex,one thumb,roguelite,shield,timing,skill,offline,no ads,daily,bullet,precision`

**Category:** Games → Action (primary), Games → Arcade (secondary)

## 6. Screenshots

Capture at exact device resolutions with the dev server running:

```bash
npm run dev
```

Then drive a headless browser at the required viewport (the smoke-test script
in `tools/` is a starting point). Good shots, in order of how well they sell:

1. Mid-run with a high chain visible and particles mid-burst
2. The upgrade draft screen
3. The core select screen — the shield glyphs show the trade-offs at a glance
4. The results screen with a strong score
5. The Daily Challenge on the main menu

Caption them with the mechanic, not the feature: "Catch it on the white band",
"Never block a void orb", "One seed a day, same for everyone".

## 7. Version bookkeeping

Update all three together, every release:

- `package.json` → `version`
- `android/app/build.gradle` → `versionCode` (increment) and `versionName`
- Xcode → version and build number
