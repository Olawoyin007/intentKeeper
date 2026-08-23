# Chrome Web Store - Submission Checklist

What an agent has prepared, and what only you can do. Work top to bottom.

## What is ready (in this repo)

- [x] Listing copy - name, summary, description, category, single-purpose
      statement, permission justifications, data-safety answers, reviewer notes:
      `store/CHROME_WEB_STORE.md`
- [x] Privacy policy text: `PRIVACY.md`
- [x] Store icon (128x128): `extension/icons/icon128.png`
- [x] Manifest cleaned for review - the unused `activeTab` permission was
      removed, so the listing only requests `storage` + the localhost host
      permission (fewer permissions = smoother review + a cleaner privacy story).

## Human tasks (you must do these)

### 1. Developer account + fee
- [ ] Create a Chrome Web Store developer account at
      https://chrome.google.com/webstore/devconsole
- [ ] Pay the **one-time $5 registration fee** (this is the "payment" in the
      plan - it's Google's fee, not a paywall on intentKeeper).

### 2. Build the package to upload
- [ ] From the repo:
      ```
      cd extension
      npm ci
      npm test          # confirm green before packaging
      npm run build     # emits dist/chrome (MV3) and dist/firefox
      cd dist/chrome
      zip -r ../../../intentkeeper-chrome-0.7.0.zip .
      ```
- [ ] The file to upload is `intentkeeper-chrome-0.7.0.zip` (the **contents** of
      `dist/chrome`, zipped - `manifest.json` must be at the zip root).

### 3. Screenshots (cannot be automated)
- [ ] Capture 1-5 screenshots at **1280x800** (or 640x400). Suggested:
      1. a tweet blurred with a "ragebait" tag
      2. the popup with per-intent toggles + sensitivity slider
      3. a YouTube thumbnail flagged as hype
      4. the trusted-accounts allowlist
- [ ] Optional: a 440x280 small promo tile.

### 4. Host the privacy policy
- [ ] The store asks for a **privacy policy URL**. Point it at the hosted file:
      `https://github.com/Olawoyin007/intentKeeper/blob/main/PRIVACY.md`
      (works once this branch is merged to `main`).

### 5. Fill the dashboard and submit
- [ ] Paste each field from `store/CHROME_WEB_STORE.md` into the matching box.
- [ ] Paste the **reviewer notes** - they explain that a local server is
      required, which is unusual and will otherwise confuse the reviewer.
- [ ] Complete the data-safety form using the answers in the listing doc.
- [ ] Upload the zip, upload screenshots, set the privacy policy URL.
- [ ] Submit for review.

## Notes

- **Why the reviewer notes matter:** intentKeeper does nothing without the local
  server running. A reviewer who just installs the extension and opens Twitter
  will see no effect and may reject it. The notes tell them to start the server
  first.
- **Same kit works for Microsoft Edge Add-ons** (Chromium, MV3) - the zip and
  most copy carry over; Edge has its own dashboard and a separate (free)
  registration.
- **Firefox / AMO** is a different submission (uses `dist/firefox`) and is
  tracked separately under Phase 8.2.
