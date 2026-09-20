/**
 * Applies the native-project changes this game needs after `npx cap add`.
 *
 * The `ios/` and `android/` directories are generated, not committed, so any
 * hand edit to them is lost on the next regeneration. This script is the
 * committed record of those edits - run it after adding a platform, and any
 * time you regenerate one.
 *
 *   npx cap add android && node tools/prepare-native.mjs
 *
 * It is idempotent: running it twice changes nothing the second time.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const changes = [];
const skipped = [];

function edit(path, label, fn) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    skipped.push(`${label} (${path} not present - platform not added?)`);
    return;
  }
  const before = readFileSync(full, 'utf8');
  const after = fn(before);
  if (after === before) return;
  writeFileSync(full, after);
  changes.push(label);
}

// --- Android ----------------------------------------------------------------

edit('android/app/src/main/AndroidManifest.xml', 'Android: drop the INTERNET permission', (xml) =>
  // The game makes zero network requests - verified by auditing the built
  // bundle and by watching the network during a full session. Shipping without
  // INTERNET turns "we don't collect your data" from a promise into something
  // the operating system enforces, and Play shows the app as requiring no
  // permissions beyond vibration.
  xml.replace(/\s*<uses-permission android:name="android\.permission\.INTERNET"\s*\/>/g, ''),
);

edit('android/app/src/main/AndroidManifest.xml', 'Android: lock to portrait', (xml) => {
  if (xml.includes('android:screenOrientation')) return xml;
  return xml.replace(
    'android:name=".MainActivity"',
    'android:name=".MainActivity"\n            android:screenOrientation="portrait"',
  );
});

edit('android/app/src/main/AndroidManifest.xml', 'Android: opt out of cloud backup', (xml) =>
  // The save is a local high-score file. Auto-backup would silently upload it
  // to the player's Google account, which contradicts the store listing's
  // "no data leaves the device".
  xml.replace('android:allowBackup="true"', 'android:allowBackup="false"'),
);

// --- iOS --------------------------------------------------------------------

edit('ios/App/App/Info.plist', 'iOS: portrait only, both phone and tablet', (plist) => {
  if (plist.includes('UISupportedInterfaceOrientations~ipad')) return plist;
  const block = `	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
	</array>
`;
  // Replace any existing orientation block, or append before </dict>.
  const stripped = plist.replace(
    /\t<key>UISupportedInterfaceOrientations(~ipad)?<\/key>\s*<array>[\s\S]*?<\/array>\s*/g,
    '',
  );
  return stripped.replace(/<\/dict>\s*<\/plist>\s*$/, `${block}</dict>\n</plist>\n`);
});

edit('ios/App/App/Info.plist', 'iOS: hide the status bar', (plist) => {
  if (plist.includes('UIStatusBarHidden')) return plist;
  return plist.replace(
    /<\/dict>\s*<\/plist>\s*$/,
    '\t<key>UIStatusBarHidden</key>\n\t<true/>\n\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>\n</dict>\n</plist>\n',
  );
});

edit('ios/App/App/Info.plist', 'iOS: declare no encryption', (plist) => {
  // Answers App Store Connect's export-compliance question up front. The game
  // uses no cryptography at all.
  if (plist.includes('ITSAppUsesNonExemptEncryption')) return plist;
  return plist.replace(
    /<\/dict>\s*<\/plist>\s*$/,
    '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n</dict>\n</plist>\n',
  );
});

/* eslint-disable no-console */
if (changes.length === 0 && skipped.length === 0) {
  console.log('Native projects already prepared - nothing to do.');
} else {
  for (const c of changes) console.log(`  applied  ${c}`);
  for (const s of skipped) console.log(`  skipped  ${s}`);
}
