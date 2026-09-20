/**
 * Monetisation boundary.
 *
 * This build ships NO advertising SDK and NO in-app-purchase SDK. What it
 * ships is the seam where one could be attached, plus the rules that seam
 * enforces. Two reasons:
 *
 *  1. Security and privacy. Every ad SDK is third-party code with network
 *     access and a device-identifier appetite, and each one is a supply-chain
 *     dependency and a privacy disclosure. Shipping without one means this app
 *     can honestly declare "no data collected" on both stores.
 *  2. Product. Disruptive advertising is the most common reason players give
 *     for uninstalling a casual game. If ads are ever added here, the rules
 *     below are the ones that keep them from doing that.
 *
 * THE RULES (enforced by this module's shape, not by good intentions):
 *  - There is no interstitial. There is no `showInterstitial()` to call.
 *  - The only ad type is rewarded video, and it is only ever reachable from a
 *    button the player pressed. `offerRewarded` returns false unless a provider
 *    is attached, so the button does not render at all in this build.
 *  - Nothing purchasable affects difficulty, scoring, or the Daily Challenge.
 *    The supporter pack is cosmetic plus a shard bonus in a single-player game
 *    with no shared leaderboard.
 *
 * To attach a real provider, implement RewardedProvider and call
 * `setRewardedProvider`. See docs/MONETIZATION.md.
 */

export interface RewardedProvider {
  /** True when an ad is loaded and ready right now. */
  isReady(): boolean;
  /**
   * Shows the ad. Resolves true only if the player watched it to the point
   * where the reward is earned.
   */
  show(): Promise<boolean>;
}

let provider: RewardedProvider | null = null;

export function setRewardedProvider(p: RewardedProvider | null): void {
  provider = p;
}

/** Whether a rewarded offer can be shown to the player at all. */
export function rewardedAvailable(supporter: boolean): boolean {
  // Supporters never see an ad offer again. That is the whole product.
  if (supporter) return false;
  return provider !== null && provider.isReady();
}

/** @returns true when the reward was earned. */
export async function showRewarded(): Promise<boolean> {
  if (!provider) return false;
  try {
    return await provider.show();
  } catch {
    return false;
  }
}

export interface PurchaseProvider {
  isAvailable(): boolean;
  /** @returns true when the purchase completed and should be granted. */
  buySupporter(): Promise<boolean>;
  /** @returns true when a previous purchase was found and should be granted. */
  restore(): Promise<boolean>;
}

let purchases: PurchaseProvider | null = null;

export function setPurchaseProvider(p: PurchaseProvider | null): void {
  purchases = p;
}

export function purchasesAvailable(): boolean {
  return purchases !== null && purchases.isAvailable();
}

export async function buySupporter(): Promise<boolean> {
  if (!purchases) return false;
  try {
    return await purchases.buySupporter();
  } catch {
    return false;
  }
}

/**
 * Restoring purchases must be reachable without a purchase flow - Apple
 * requires it, and it is the right behaviour on a reinstall regardless.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!purchases) return false;
  try {
    return await purchases.restore();
  } catch {
    return false;
  }
}
