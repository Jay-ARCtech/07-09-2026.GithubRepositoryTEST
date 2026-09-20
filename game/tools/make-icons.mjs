/**
 * Renders public/icon.svg to the PNG sizes both stores require.
 *
 * Uses the Chromium that Playwright already provides rather than adding an
 * image-processing dependency to the project: icons are a build-time artefact,
 * and a native-binary dependency in package.json is a supply-chain surface the
 * game itself never needs.
 *
 * Usage:  node tools/make-icons.mjs  [--playwright <path-to-playwright>]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/**
 * Android launcher densities. `foreground` entries are the adaptive-icon
 * foreground layer, which Android masks to whatever shape the launcher uses -
 * so the artwork has to sit inside the safe circle, at 72/108 of the canvas.
 */
const ANDROID = [
  { dir: 'mipmap-mdpi', legacy: 48, adaptive: 108 },
  { dir: 'mipmap-hdpi', legacy: 72, adaptive: 162 },
  { dir: 'mipmap-xhdpi', legacy: 96, adaptive: 216 },
  { dir: 'mipmap-xxhdpi', legacy: 144, adaptive: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, adaptive: 432 },
];

const SIZES = [
  { name: 'icon-180.png', size: 180, maskable: false }, // apple-touch-icon
  { name: 'icon-192.png', size: 192, maskable: false }, // Android / PWA
  { name: 'icon-512.png', size: 512, maskable: false }, // Android / PWA
  { name: 'icon-maskable-512.png', size: 512, maskable: true }, // Android adaptive
  { name: 'icon-1024.png', size: 1024, maskable: false }, // App Store listing
];

const svg = readFileSync(resolve(root, 'public/icon.svg'), 'utf8');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'playwright is not installed. Icons are committed to public/, so this ' +
      'script only needs to run when the artwork changes:\n' +
      '  npm i -D playwright && node tools/make-icons.mjs',
  );
  process.exit(1);
}

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

for (const { name, size, maskable } of SIZES) {
  // A maskable icon must keep its content inside the safe circle (80% of the
  // canvas) because Android crops it to whatever shape the launcher uses.
  const inner = maskable ? Math.round(size * 0.78) : size;
  const pad = Math.round((size - inner) / 2);
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:#05060d;width:${size}px;height:${size}px;overflow:hidden}
     .wrap{position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px}
     svg{width:100%;height:100%;display:block}</style>
     <div class="wrap">${svg}</div>`,
    { waitUntil: 'load' },
  );
  const out = resolve(root, 'public', name);
  mkdirSync(dirname(out), { recursive: true });
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(out, buf);
  await page.close();
  console.log(`wrote public/${name} (${size}x${size}${maskable ? ', maskable' : ''})`);
}

/**
 * Renders the mark at `size`, with the artwork occupying `inset` of the
 * canvas and the rest left as background (or transparent).
 */
async function render(size, { inset = 1, transparent = false } = {}) {
  const inner = Math.round(size * inset);
  const pad = Math.round((size - inner) / 2);
  // An adaptive foreground layer must be transparent outside the artwork -
  // Android composites it over a separate background drawable and masks the
  // result. Leaving the SVG's own background rect in place produces a dark
  // square floating inside the launcher's circle.
  const art = transparent ? svg.replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, '') : svg;
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#05060d'};width:${size}px;height:${size}px;overflow:hidden}
     .wrap{position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px}
     svg{width:100%;height:100%;display:block}</style>
     <div class="wrap">${art}</div>`,
    { waitUntil: 'load' },
  );
  const buf = await page.screenshot({ omitBackground: transparent });
  await page.close();
  return buf;
}

// --- Native launcher icons --------------------------------------------------
// Only written when the platform has been added; `android/` and `ios/` are
// generated directories, so this runs alongside tools/prepare-native.mjs.

const androidRes = resolve(root, 'android/app/src/main/res');
if (existsSync(androidRes)) {
  for (const { dir, legacy, adaptive } of ANDROID) {
    const out = resolve(androidRes, dir);
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'ic_launcher.png'), await render(legacy));
    writeFileSync(resolve(out, 'ic_launcher_round.png'), await render(legacy));
    // Adaptive foreground: artwork inside the 72/108 safe zone, transparent
    // elsewhere, with the background supplied as a flat colour resource.
    writeFileSync(
      resolve(out, 'ic_launcher_foreground.png'),
      await render(adaptive, { inset: 72 / 108, transparent: true }),
    );
  }
  const values = resolve(androidRes, 'values');
  mkdirSync(values, { recursive: true });
  writeFileSync(
    resolve(values, 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#05060d</color>\n</resources>\n',
  );
  console.log(`wrote Android launcher icons (${ANDROID.length} densities, legacy + round + adaptive)`);
}

const iosAssets = resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
if (existsSync(iosAssets)) {
  // Modern Xcode takes a single 1024x1024 icon with no alpha channel.
  writeFileSync(resolve(iosAssets, 'AppIcon-512@2x.png'), await render(1024));
  console.log('wrote iOS AppIcon-512@2x.png (1024x1024, opaque)');
}

await browser.close();
