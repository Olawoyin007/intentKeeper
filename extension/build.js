#!/usr/bin/env node
/**
 * Build script: emits per-browser extension bundles into dist/.
 *
 * Chrome/Chromium (MV3) uses background.service_worker; Firefox MV3 uses an
 * event page (background.scripts) and requires browser_specific_settings.gecko.id
 * for stable storage. Rather than sniff the browser at runtime, we emit two
 * manifests from one source of truth (manifest.json = the Chrome manifest).
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

// Everything the manifest references. Legacy/dev-only files (content.js,
// tests/, htmlcov/) are intentionally excluded from the shipped bundle.
const INCLUDE = ['background.js', 'styles.css', 'core', 'platforms', 'popup', 'icons'];

// Stable add-on identity for Firefox. Required for storage persistence; change
// before AMO submission if a different namespace is preferred.
const GECKO_ID = 'intentkeeper@olawoyin007.github.io';
const GECKO_MIN_VERSION = '128.0'; // first Firefox ESR with stable MV3 support

function copyInto(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const item of INCLUDE) {
    fs.cpSync(path.join(root, item), path.join(targetDir, item), { recursive: true });
  }
}

const base = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// Chrome / Chromium: manifest as-is (service worker background).
const chromeDir = path.join(dist, 'chrome');
copyInto(chromeDir);
fs.writeFileSync(path.join(chromeDir, 'manifest.json'), JSON.stringify(base, null, 2) + '\n');

// Firefox: event-page background + mandatory gecko settings.
const firefox = JSON.parse(JSON.stringify(base));
delete firefox.background.service_worker;
firefox.background.scripts = ['background.js'];
firefox.browser_specific_settings = {
  gecko: { id: GECKO_ID, strict_min_version: GECKO_MIN_VERSION },
};
const firefoxDir = path.join(dist, 'firefox');
copyInto(firefoxDir);
fs.writeFileSync(path.join(firefoxDir, 'manifest.json'), JSON.stringify(firefox, null, 2) + '\n');

console.log('Built dist/chrome and dist/firefox');
