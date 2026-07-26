# Chrome Web Store - Listing Copy

Ready-to-paste text for the Chrome Web Store developer dashboard. Copy each
field into the matching box. Anything marked **[human]** needs a person (an
image, an account, a payment, a hosted URL).

---

## Product name

```
intentKeeper
```

## Summary (short description - max 132 characters)

```
See the manipulation behind your feed. Local AI flags ragebait, hype and fear on Twitter, YouTube and Reddit. Nothing leaves your device.
```

_(131 characters - check the live counter; trim "and Reddit" if it complains.)_

## Category

```
Productivity
```

## Language

```
English (United States)
```

## Detailed description

```
You open Twitter to check one thing. Forty minutes later you're exhausted and angry about something you don't even care about. intentKeeper shows you what's doing that - on Twitter/X, YouTube, and Reddit - before it lands.

It reads posts, titles, and comments and flags the ones built to manipulate you: ragebait, fearmongering, hype, engagement bait, and divisive framing. It judges content by the PATTERNS it uses, not the topics it covers - so it never takes a side on what you're allowed to read. You decide what happens to flagged items: blur it, tag it, or hide it.

WHY IT'S DIFFERENT

- Runs entirely on your own hardware. Classification happens on a small AI model (via Ollama) on your computer. There is no cloud, no account, and no data leaving your machine.
- No tracking, no telemetry, no engagement metrics. The extension has nothing to sell and measures nothing about you.
- You stay in control. Per-intent toggles ("show divisive, hide ragebait"), a sensitivity slider, a trusted-accounts allowlist, and the ability to correct any label - all stored locally.

IMPORTANT: REQUIRES A FREE LOCAL SERVER

intentKeeper is local-first by design. The extension talks to a small classification server that YOU run on your own computer (it ships free and open-source with the project). Without it running, the extension does nothing - it has no remote fallback on purpose, because "no data leaves your device" is the whole point.

One-time setup (about 5 minutes): install Ollama, install the intentKeeper server, start it. Full instructions:
https://github.com/Olawoyin007/intentKeeper

HOW IT WORKS

1. You browse Twitter/X, YouTube, or Reddit as normal.
2. The extension sends each post's text to your local server.
3. The server labels it (ragebait, hype, genuine, etc.) using a local AI model.
4. Based on your settings, the item is blurred, tagged, or hidden - or passes through untouched.

Open-source (MIT). Built on the principle that software should protect your attention, not harvest it.
```

## Privacy practices tab

### Single purpose description

```
intentKeeper has one purpose: to detect manipulative intent (such as ragebait, fearmongering, and engagement bait) in social media content on Twitter/X, YouTube, and Reddit, and let the user blur, tag, or hide it. All classification is performed by a server on the user's own machine.
```

### Permission justifications

**`storage`**
```
Stores the user's own settings locally in the browser: on/off toggles, sensitivity, per-intent preferences, a trusted-accounts allowlist, and locally-kept label corrections. None of this is transmitted off the device.
```

**Host permission - `http://localhost:8420/*` and `http://127.0.0.1:8420/*`**
```
The extension sends page text to the intentKeeper classification server running on the user's OWN computer (localhost) to be labeled. This is the only network destination the extension contacts. No external or remote servers are used.
```

**Content scripts - twitter.com, x.com, youtube.com, reddit.com**
```
The extension must read post/title/comment text on these sites to classify it, and modify the page to blur, tag, or hide flagged items. It runs only on these three platforms.
```

### Data usage disclosures (data safety form)

Answer the checkboxes as follows:

- Does this item collect or use user data? **Yes** (it reads page content) - but:
  - "Personally identifiable information" - **No**
  - "Web history" - **No**
  - "User activity / analytics" - **No**
  - Website content is read and sent **only to the user's own local machine**, not to the developer or any third party.
- I do not sell or transfer user data to third parties: **certify true**
- I do not use or transfer data for purposes unrelated to the item's single purpose: **certify true**
- I do not use or transfer data to determine creditworthiness or for lending: **certify true**

### Privacy policy URL  **[human - needs a public URL]**

Point to the hosted `PRIVACY.md` in the repo, e.g.:
```
https://github.com/Olawoyin007/intentKeeper/blob/main/PRIVACY.md
```

---

## Graphic assets  **[human - images required]**

Chrome Web Store requires:

- **Store icon**: 128x128 PNG - already in the repo at `extension/icons/icon128.png`.
- **Screenshots**: at least 1 (up to 5), 1280x800 or 640x400 PNG/JPEG.
  Suggested shots: (1) a tweet blurred with a "ragebait" tag, (2) the popup with
  the per-intent toggles, (3) a YouTube thumbnail flagged as hype, (4) the
  trusted-accounts allowlist. These need to be captured from a live browser -
  an agent cannot produce them.
- **Small promo tile** (optional): 440x280 PNG.

## Reviewer notes  **[paste into "Notes for reviewers"]**

```
This extension requires a local classification server (open-source, shipped with the project) running on the reviewer's machine at http://localhost:8420. Without it, the extension intentionally does nothing - it has no remote server by design ("no data leaves the device" is the core promise).

To test: follow the setup at https://github.com/Olawoyin007/intentKeeper (install Ollama + the intentKeeper Python server, start it), then browse Twitter/X, YouTube, or Reddit. Posts will be classified and blurred/tagged/hidden per the popup settings.

No account, login, or payment is needed. No data is transmitted to the developer or any third party.
```
