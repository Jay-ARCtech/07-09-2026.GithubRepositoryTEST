/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: the same build is served from a file:// style webview on
  // iOS and from an https://localhost origin on Android.
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    // The game is a single chunk served from the app bundle, so there is
    // nothing to preload. Disabling the polyfill removes the only fetch() call
    // in the whole build, which makes "this app performs no network requests"
    // a claim that can be verified by grepping the artefact rather than a
    // statement of intent.
    modulePreload: false,
    // Never inline assets as data: URIs - the CSP allows data: for images only,
    // and inlining defeats webview caching for no size win at this scale.
    assetsInlineLimit: 0,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // Vite 8's browser-console forwarding injects a client helper that can run
    // before it is defined, throwing "__SERVER_FORWARD_CONSOLE__ is not
    // defined" in the dev console. It is purely a dev-server feature and never
    // reaches a build, but a spurious page error in the console is exactly the
    // kind of noise that hides a real one.
    forwardConsole: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The fairness and stability tests simulate several full runs at 120Hz -
    // hundreds of thousands of steps. That is the point of them, so they get a
    // timeout that fits rather than being trimmed until they prove less.
    testTimeout: 60_000,
  },
});
