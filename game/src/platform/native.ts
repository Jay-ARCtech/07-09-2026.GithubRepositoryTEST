/**
 * Native bridge.
 *
 * Capacitor is talked to through the global `window.Capacitor` registry rather
 * than by importing `@capacitor/*` packages. Two deliberate consequences:
 *
 *  1. The web build has zero runtime dependencies and zero third-party code in
 *     the bundle. Nothing to audit, nothing to get compromised upstream.
 *  2. The same build runs unchanged in a browser, in the iOS webview and in the
 *     Android webview. Every call degrades to a web fallback or a no-op.
 *
 * This file is also where App Store guideline 4.2 is answered in practice. A
 * bare webview wrapper gets rejected; this app ships native haptics, native
 * status-bar and splash control, real Android back-button handling and proper
 * app-lifecycle pause/resume - and plays fully offline.
 */

type PluginCall = (...args: unknown[]) => Promise<unknown>;
type PluginMap = Record<string, Record<string, PluginCall> | undefined>;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: PluginMap;
}

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

function plugin(name: string): Record<string, PluginCall> | undefined {
  return cap()?.Plugins?.[name];
}

/** Fire-and-forget: a failed native call must never break a frame. */
function call(pluginName: string, method: string, ...args: unknown[]): void {
  try {
    const p = plugin(pluginName);
    const fn = p?.[method];
    if (typeof fn === 'function') void fn.call(p, ...args)?.catch?.(() => {});
  } catch {
    /* plugin missing or bridge not ready */
  }
}

export const platform = {
  isNative(): boolean {
    try {
      return cap()?.isNativePlatform?.() === true;
    } catch {
      return false;
    }
  },
  /** 'ios' | 'android' | 'web' */
  name(): string {
    try {
      return cap()?.getPlatform?.() ?? 'web';
    } catch {
      return 'web';
    }
  },
  get isIOS(): boolean {
    return platform.name() === 'ios';
  },
  get isAndroid(): boolean {
    return platform.name() === 'android';
  },
};

// --- Haptics ----------------------------------------------------------------

export type HapticStrength = 'light' | 'medium' | 'heavy';

/**
 * Haptics are rate-limited. Firing the taptic engine on every one of ten
 * projectiles a second turns a satisfying thump into a continuous buzz, and on
 * Android it measurably drains battery.
 */
const HAPTIC_MIN_GAP_MS = 45;

class Haptics {
  enabled = true;
  private last = 0;
  private readonly hasVibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  impact(strength: HapticStrength = 'medium'): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.last < HAPTIC_MIN_GAP_MS) return;
    this.last = now;

    if (platform.isNative()) {
      // Capacitor's ImpactStyle enum values are the capitalised strings.
      const style = strength === 'light' ? 'LIGHT' : strength === 'heavy' ? 'HEAVY' : 'MEDIUM';
      call('Haptics', 'impact', { style });
      return;
    }
    // Web fallback. iOS Safari ignores this; Android Chrome honours it.
    if (this.hasVibrate) {
      const ms = strength === 'light' ? 8 : strength === 'heavy' ? 28 : 15;
      try {
        navigator.vibrate(ms);
      } catch {
        /* blocked by user settings */
      }
    }
  }

  notify(type: 'success' | 'warning' | 'error' = 'success'): void {
    if (!this.enabled) return;
    if (platform.isNative()) {
      call('Haptics', 'notification', { type: type.toUpperCase() });
      return;
    }
    if (this.hasVibrate) {
      try {
        navigator.vibrate(type === 'error' ? [18, 40, 18] : [10, 30, 10]);
      } catch {
        /* blocked */
      }
    }
  }

  /** Long-form pattern used for the run-ending hit. */
  gameOver(): void {
    if (!this.enabled) return;
    if (platform.isNative()) {
      call('Haptics', 'impact', { style: 'HEAVY' });
      window.setTimeout(() => call('Haptics', 'impact', { style: 'MEDIUM' }), 120);
      return;
    }
    if (this.hasVibrate) {
      try {
        navigator.vibrate([40, 60, 90]);
      } catch {
        /* blocked */
      }
    }
  }
}

export const haptics = new Haptics();

// --- Shell integration ------------------------------------------------------

export const shell = {
  /** Dark, edge-to-edge status bar so the game fills the display. */
  configureStatusBar(): void {
    call('StatusBar', 'setStyle', { style: 'DARK' });
    call('StatusBar', 'setBackgroundColor', { color: '#05060d' });
    call('StatusBar', 'setOverlaysWebView', { overlay: true });
  },

  hideSplash(): void {
    call('SplashScreen', 'hide');
  },

  /** Native full-screen immersive mode where the platform supports it. */
  requestImmersive(): void {
    if (platform.isAndroid) {
      call('StatusBar', 'hide');
      call('NavigationBar', 'hide');
    }
  },

  exitApp(): void {
    call('App', 'exitApp');
  },
};

type Unsub = () => void;

/**
 * Android hardware/gesture back. Wiring this is required for a good Play Store
 * review: an app that ignores back and drops the player straight to the home
 * screen mid-run is a guaranteed one-star.
 *
 * `handler` returns true if it consumed the press. When nothing consumes it at
 * the root menu, the app exits, which is what Android users expect.
 */
export function onBackButton(handler: () => boolean): Unsub {
  const p = plugin('App');
  const add = p?.['addListener'];
  if (typeof add !== 'function') return () => {};

  let removeFn: (() => void) | null = null;
  try {
    const result = add.call(p, 'backButton', () => {
      if (!handler()) shell.exitApp();
    }) as Promise<{ remove?: () => void }> | { remove?: () => void };

    if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<{ remove?: () => void }>).then((h) => {
        removeFn = h?.remove ? (): void => void h.remove?.() : null;
      });
    } else {
      const h = result as { remove?: () => void };
      removeFn = h?.remove ? (): void => void h.remove?.() : null;
    }
  } catch {
    return () => {};
  }
  return () => removeFn?.();
}

/**
 * App foreground/background. Covers the native lifecycle event *and* the web
 * visibility event, because on Android the webview can be hidden without the
 * native appStateChange firing (split screen, notification shade).
 */
export function onAppStateChange(handler: (active: boolean) => void): Unsub {
  const listeners: Unsub[] = [];

  const p = plugin('App');
  const add = p?.['addListener'];
  if (typeof add === 'function') {
    try {
      const result = add.call(p, 'appStateChange', (state: unknown) => {
        const active = (state as { isActive?: boolean })?.isActive !== false;
        handler(active);
      }) as Promise<{ remove?: () => void }> | { remove?: () => void };
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        void (result as Promise<{ remove?: () => void }>).then((h) => {
          if (h?.remove) listeners.push(() => void h.remove?.());
        });
      } else {
        const h = result as { remove?: () => void };
        if (h?.remove) listeners.push(() => void h.remove?.());
      }
    } catch {
      /* listener unavailable */
    }
  }

  const onVis = (): void => handler(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', onVis);
  listeners.push(() => document.removeEventListener('visibilitychange', onVis));

  const onPageHide = (): void => handler(false);
  window.addEventListener('pagehide', onPageHide);
  listeners.push(() => window.removeEventListener('pagehide', onPageHide));

  return () => {
    for (const un of listeners) un();
  };
}
