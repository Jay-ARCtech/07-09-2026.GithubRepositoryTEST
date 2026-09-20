# Monetisation

## Position

This build ships **no advertising SDK and no in-app-purchase SDK**. What it
ships is the seam where one could be attached, plus the rules that seam
enforces. Both choices are deliberate.

**Security.** Every ad SDK is third-party code with network access and an
appetite for device identifiers. Each one is a supply-chain dependency and a
privacy disclosure on both stores. Without one, this app can honestly declare
"No data collected" and ship on Android without the `INTERNET` permission.

**Product.** Disruptive advertising is the most-cited reason players give for
uninstalling a casual game: 58% quit immediately over disruptive ads and 84%
uninstall after repeated exposure. That is not a reason to have no business
model; it is a reason to have one that does not do that.

## The rules, enforced by the code's shape

`src/platform/monetization.ts` is the only boundary. It is written so the wrong
thing is not merely discouraged but unavailable:

1. **There is no interstitial.** There is no `showInterstitial()` to call. A
   full-screen ad between runs cannot be added without changing this module,
   which is the point.
2. **The only ad type is rewarded video, and it is player-initiated.**
   `rewardedAvailable()` returns false unless a provider is attached, so in
   this build the "double your shards" button does not render at all.
3. **Supporters never see an offer.** `rewardedAvailable()` returns false for
   them unconditionally.
4. **Nothing purchasable affects difficulty, scoring, or the Daily
   Challenge.** The daily disables permanent upgrades for everyone.

## Attaching a real provider

```ts
import { setRewardedProvider } from './platform/monetization';

setRewardedProvider({
  isReady: () => adUnit.isLoaded(),
  // Must resolve true ONLY when the reward was genuinely earned.
  show: async () => (await adUnit.show()).userDidEarnReward,
});
```

`setPurchaseProvider` is the same shape for IAP. `restorePurchases()` is
already wired and reachable without a purchase flow — Apple requires this, and
it is correct behaviour on a reinstall regardless.

Doing this adds a third-party dependency and changes the privacy answers on
both stores. Update `docs/PRIVACY.md` and the store data-safety forms in the
same change, and re-add the `INTERNET` permission in
`tools/prepare-native.mjs`.

## The intended model, if you ship one

| Item | Price | What it does |
| --- | --- | --- |
| Rewarded video | free | Doubles the shards from the run you just finished. One button, on the results screen, after the run. Never interrupts play |
| Supporter Pack | one-off | Removes every ad offer permanently, +25% shards, alternate colour themes |

Nothing else. No currency packs, no loot boxes, no battle pass, no energy
timer. The Supporter Pack is a tip jar with a cosmetic reward and an ad
removal — which is exactly the thing reviewers of this genre say they would
actually pay for.

## What the economy currently looks like

Shards come only from playing. A casual run yields roughly 500–800; daily
missions add about 400/day.

| Sink | Cost |
| --- | --- |
| BULWARK / EDGE / FLUX / VAGRANT | 800 / 2,000 / 3,600 / 6,000 |
| All five permanent upgrade tracks, fully maxed | ~26,000 |

Everything unlockable costs roughly 38,000 shards in total — a few weeks of
casual play, and reachable without spending anything, because there is nothing
to spend.
