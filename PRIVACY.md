# Privacy Policy - intentKeeper

_Last updated: 2026-07-26_

intentKeeper is built on one promise: **your data never leaves your machine.**
This policy describes exactly what the browser extension does and does not do
with your information.

## The short version

- intentKeeper does **not** collect, transmit, sell, or share any personal data.
- There are **no analytics, no telemetry, no tracking, and no remote servers**
  operated by us.
- The only network request the extension makes is to a classification server
  running on **your own computer** (`http://localhost:8420`), which you install
  and run yourself.
- Everything you configure is stored **locally in your browser** and can be
  deleted at any time by removing the extension.

## What the extension accesses, and why

**Page content on supported sites (Twitter/X, YouTube, Reddit).**
To do its job, intentKeeper reads the text of posts, titles, and comments on the
pages you visit on these sites. This text is sent **only** to the classification
server on your own computer to be labeled (for example, "ragebait" or
"genuine"). It is used in that instant to decide whether to blur, tag, or hide
the item. It is **not** stored, logged, or transmitted anywhere else.

**Local browser storage (`storage` permission).**
The extension saves your settings in your browser's local storage on your own
device:

- your on/off toggles and sensitivity slider,
- your per-intent preferences (e.g. "show divisive, hide ragebait"),
- your "trusted accounts" allowlist (handles you choose to never filter),
- your local corrections (when you re-label an item to teach your own copy).

None of this is transmitted off your device. Uninstalling the extension removes
it.

## What we do NOT do

- We do **not** run any server that receives your data. The `localhost` server
  is yours.
- We do **not** use cookies, advertising identifiers, fingerprinting, or any
  cross-site tracking.
- We do **not** collect browsing history, account credentials, or personal
  identifiers.
- We do **not** build a profile of you. There is no engagement optimization and
  nothing is measured about your behavior.

## Data retention and deletion

Because nothing is collected by us, there is nothing for us to retain or delete.
The only data that exists is the settings stored locally in your browser, which
you control and can clear at any time (remove the extension, or use the popup's
"Clear" buttons for corrections and allowlist entries).

## Children's privacy

intentKeeper does not knowingly collect any data from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be published in this repository
with a new "Last updated" date.

## Contact

Questions about privacy can be raised as an issue on the project repository:
https://github.com/Olawoyin007/intentKeeper
