# What the market says, and what this game does about it

Research done September 2026, before any code was written. Sources are listed
at the bottom. The point of this document is to make the design decisions in
`src/game/config.ts` traceable to a reason rather than a preference.

## 1. Where the money and the players actually are

**Hybrid-casual is the only casual segment still growing.** In-app-purchase
revenue for hybrid-casual rose ~20% to about $4.2bn in the last year, while the
rest of casual was flat or down. Pure hypercasual — one mechanic, no
progression, ad-monetised — has been squeezed out by rising acquisition costs.
Block Blast! took ~368m downloads, the most of any mobile game, on an
ad-monetised block puzzle; Royal Match and Monopoly Go! lead on revenue.

The pattern that works: keep the hypercasual hook (instantly legible, one
input, a run you can start in two seconds) and bolt on the meta-progression and
economy of a real casual game, so there is a reason to open the app on day
seven.

**What this game does.** One-thumb, one mechanic, sub-two-second restart — and
underneath it a roguelite upgrade draft, five cores with genuine trade-offs, a
permanent upgrade track, three daily missions and a seeded Daily Challenge.

## 2. Retention is the whole game

Day-1 retention across mobile sits around 27%, with hypercasual and
hybrid-casual at the top of that band. A hypercasual title that succeeded in
the last year needed day-30 retention of at least 5%, sometimes 7.5%. Top
casual games' day-7 retention has been declining steadily since early 2022;
hybrid-casual improved against them.

**What this game does.** Three separate reasons to come back tomorrow, none of
them a nag:

| Hook | What it is | Why it works |
| --- | --- | --- |
| Daily Challenge | One fixed seed per calendar day, same for everyone, meta upgrades disabled | A fair comparison and a reason to return that expires |
| Daily missions | Three rolling objectives, seeded from the date | Progress that carries across runs, visible on the results screen |
| Shard economy | Cores and permanent upgrades, all earnable | A long arc without a subscription |

Crucially the Daily Challenge disables permanent upgrades, so the one
competitive mode is identical for a day-one player and a day-300 player.

## 3. Why games in this category flop

The recurring causes, in rough order of how often they come up:

1. **No audience.** Roughly half of failures are attributed to building for
   nobody in particular.
2. **Disruptive advertising.** 58% of players will quit a game immediately over
   disruptive ads; 84% uninstall after repeated exposure. 56% of mobile gamers
   report seeing ads that misrepresent the gameplay, which breeds distrust.
3. **Pay-to-win and paywalled progression.** Players tolerate cosmetics taking
   longer to earn as long as a path exists. They do not tolerate content locked
   behind a wall, or a spender beating them on spend alone.
4. **Battle passes nobody can finish.** Reviews sour when a reasonably active
   player cannot complete the pass without reorganising their life.
5. **Poor UX and slow, weighty gameplay.** One 2025 casualty was described as
   too slow and heavy for mobile and shut down within months.
6. **Franchise mismatch.** Age of Empires Mobile leaned into timers and
   long resource loops, diverging from what the franchise's players wanted.

**What this game does.**

- **Audience:** people who want a two-to-four-minute skill test on a phone, one
  thumb, no account, no connection. A specific person, not "mobile gamers".
- **Advertising:** there is no interstitial, and no function to call to show
  one. The only ad type the code can express is rewarded video behind a button
  the player pressed. This build ships no ad SDK at all, so the offer does not
  even render. See `docs/MONETIZATION.md`.
- **Pay-to-win:** nothing purchasable affects difficulty or scoring. The
  starter core is competitive at the highest level — see the balance table in
  `docs/DESIGN.md`, where SENTINEL (free) and EDGE (2,000 shards) top out
  within a few waves of each other and EDGE is *harder* for a new player.
- **Battle pass:** there isn't one.
- **Pace:** a run is 1.5–4 minutes. Restart is one tap from the results screen.
- **Franchise:** no IP to mismatch.

## 4. Game feel is the cheapest quality upgrade available

Juice is the accumulated sensory feedback that makes an interaction feel
satisfying. It changes no rules. The standard toolkit: hit-stop, screen shake
(trauma-based, so small events barely wobble and big ones slam), particles that
erupt along the impact vector, squash and stretch, easing, coyote time, input
buffering, and audio that tracks state.

**What this game does.** `src/ui/juice.ts` is a dedicated layer that turns
simulation events into feel, and is deliberately kept separate from the rules
so that tuning one can never break the other. Every parry drives five channels
at once — particle count, screen shake, hit-stop duration, zoom punch and audio
pitch — all scaled by the current chain length, so a 40-chain physically feels
and sounds different from a 2-chain without the player reading the counter.

Hit-stop is capped at 75ms. Past roughly 120ms it stops reading as impact and
starts reading as a dropped frame.

## 5. The Apple 4.2 problem

Guideline 4.2 (Minimum Functionality) is what rejects thin web wrappers: an app
that loads a responsive site in a webview and adds nothing — no native
integration, no offline behaviour, nothing that distinguishes it from a browser
tab. A Capacitor app passes when it adds genuine native value.

**What this game does.** It is not a website in a wrapper; it is a canvas game
that happens to be authored in TypeScript.

- Native haptics on every impact class, rate-limited so they read as taps
  rather than a buzz (`src/platform/native.ts`).
- Native status-bar and splash-screen control; full-screen immersive mode on
  Android.
- Android hardware/gesture back is handled at every screen, and exits only from
  the root menu.
- App lifecycle handled: backgrounding auto-pauses a run, suspends audio and
  saves.
- Fully offline. Zero network requests — verified by grepping the built bundle
  and by watching the network across a full session. The Android build ships
  without the INTERNET permission.
- No browser chrome, no scrolling, no text selection, safe-area aware.

## Sources

- [Deconstructor of Fun — State of Mobile 2026](https://www.deconstructoroffun.com/blog/2026/2/2/state-of-mobile-2026)
- [PocketGamer.biz — What happened to hypercasual](https://www.pocketgamer.biz/what-happened-to-hypercasual-the-markets-evolution-over-the-past-year/)
- [Antier — Hybrid casual vs hypercasual: retention, LTV, revenue in 2026](https://www.antier.com/blogs/hybrid-casual-games-vs-hypercasual-whats-driving-higher-retention-ltv-and-revenue-in-2026/)
- [Game Growth Advisor — Hybrid casual design and monetization 2026](https://gamegrowthadvisor.com/blog/2026-04-16-hybrid-casual-game-design-strategy-2026/)
- [AppFollow — What mobile game players want: monetization insights from App Store reviews](https://appfollow.io/blog/what-mobile-game-players-want-monetization-insights-from-app-store-reviews)
- [AppFollow — Mobile game monetization 2026](https://appfollow.io/blog/mobile-game-monetization)
- [PocketGamer.biz — Bad ads are killing the mobile gaming experience](https://www.pocketgamer.biz/bad-ads-are-killing-the-mobile-gaming-experience-heres-how-we-fix-it/)
- [GamingOnPhone — The biggest mobile gaming disappointments of 2025](https://gamingonphone.com/editorial/the-biggest-mobile-gaming-disappointments-of-2025/)
- [Calcalist — Mobile gaming's era of easy money is over](https://www.calcalistech.com/ctechnews/article/cd79vt3jv)
- [MoldStud — Understanding key factors for mobile game failures](https://moldstud.com/articles/p-understanding-key-factors-for-mobile-game-failures)
- [GameAnalytics — Squeezing more juice out of your game design](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)
- [Blood Moon Interactive — Juice in game design](https://www.bloodmooninteractive.com/articles/juice.html)
- [MobiLoud — App Store review guidelines: will your webview app be rejected?](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/)
- [Apple Developer Forums — Guideline 4.2 Minimum Functionality](https://developer.apple.com/forums/thread/704430)
