/**
 * Capacitor configuration.
 *
 * Capacitor wraps the built web app in a native iOS and Android shell. The
 * native projects themselves are generated (`npx cap add ios|android`) and are
 * not committed - they are reproducible from this file plus dist/, and they
 * contain absolute machine paths that make them noisy in version control.
 *
 * Before submitting, change `appId` to a bundle identifier you own. It is the
 * one value here that must be unique and cannot be changed after the first
 * release on either store.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.parrycore',
  appName: 'PARRY CORE',
  webDir: 'dist',

  // No dev server, no remote URL. The app loads only from the bundle, which is
  // both a security property and what makes it work offline on a plane.
  server: {
    androidScheme: 'https',
    // Cleartext is off: there is nothing to load over HTTP, so allowing it
    // would only widen the attack surface.
    cleartext: false,
  },

  android: {
    backgroundColor: '#05060d',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    backgroundColor: '#05060d',
    // The canvas fills the screen and handles its own safe areas; the webview
    // must not add its own inset or bounce.
    contentInset: 'never',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#05060d',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#05060d',
      overlaysWebView: true,
    },
  },
};

export default config;
