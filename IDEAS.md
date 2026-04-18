# Ideas Log

A record of ideas considered for IntentKeeper - what shipped, what was rejected, and why. Not a roadmap. The roadmap tracks phases; this tracks thinking.

---

## Classification

### Comment-level context for Reddit posts
**Status:** ✅ Shipped (Phase 4)
**What:** When classifying a Reddit post, include the top comment text in the classification input. Comments often reveal the actual energy of a thread better than the title alone.
**Why it fits:** A neutral headline on a rage-farming post gets exposed by its comment section. This significantly improves accuracy without changing the intent model.

### Priority or urgency labeling
**Status:** ❌ Rejected
**What:** Add a secondary label alongside intent - flagging how "urgent" or "high stakes" a piece of content appears to be.
**Why not:** IntentKeeper classifies intent, not importance. Adding urgency scoring would pull the tool toward a different problem (attention management) that it's not designed for. It would also add noise - urgency is highly personal and context-dependent in a way that intent is not. Keeping the tool focused on one question ("what is this content trying to do to you?") is part of why it works.

---

## Platform Support

### YouTube classification
**Status:** ✅ Shipped (Phase 3)
**What:** Platform adapter for YouTube homepage, search results, and sidebar recommendations.
**Why it fits:** Same architecture as Twitter/Reddit adapters. Main challenge was the 2025 DOM change - YouTube removed `#video-title` from homepage feed cards and moved everything into a plain `#content` div. Fixed with a fallback selector chain.

---

## Browser Behaviour

### Per-site session time limits
**Status:** ↗ Out of scope
**What:** Set a daily time budget per site. When the budget runs out, show a friction prompt.
**Why not here:** IntentKeeper's job is to classify content by intent - it observes what you're reading, not how long you're reading it. Time-on-site tracking requires a different kind of browser extension with different permissions and a different mental model. Building it into IntentKeeper would muddy the tool's purpose. This belongs in a dedicated focus/friction tool.

### All-social-media aggregate timer
**Status:** ↗ Out of scope
**What:** Track total time spent across all social platforms in aggregate and surface a prompt when a daily threshold is hit.
**Why not here:** Same reason as per-site limits - this is time management, not intent classification. IntentKeeper doesn't have the tab-monitoring scope to do this reliably, and it's a different problem with a different audience.

---

## Extension

### Icon refresh
**Status:** ✅ Shipped
**What:** Replace the placeholder icons (icon16/48/128.png) with properly resized versions of the project logo.
**Why it fits:** The placeholder icons were tiny and unclear at small sizes. The logo at 819x819 RGBA downscales cleanly to all three sizes with Lanczos resampling.

---

*Last updated: 2026-04-18*
