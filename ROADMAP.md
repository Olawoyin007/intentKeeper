# IntentKeeper Roadmap

> "The content isn't the problem. The intent behind it is."

## Project Goals

1. **Protect attention without censoring content** -Surface manipulation patterns, let users decide what to engage with.
2. **Local-first classification** -All processing on-device via Ollama. No cloud, no tracking.
3. **Platform-agnostic design** -The classification engine should work across any platform with a content script adapter.

---

## Phase 1: Core Classifier + Chrome Extension ✅ COMPLETE

**Goal**: Prove the concept works with Twitter/X as the first platform.

### 1.1 Classification Engine ✅ DONE
- [x] Create `IntentClassifier` class with Ollama integration
- [x] Define 7 intent categories (ragebait, fearmongering, hype, engagement_bait, divisive, genuine, neutral)
- [x] Build classification prompt with few-shot examples
- [x] JSON response parsing with fallback handling
- [x] Fail-open design (errors pass content through)

### 1.2 FastAPI Server ✅ DONE
- [x] `POST /classify` -Single content classification
- [x] `POST /classify/batch` -Batch classification (max 50 items)
- [x] `GET /health` -Server and Ollama health check
- [x] `GET /intents` -Current intent definitions
- [x] CORS middleware for browser extension

### 1.3 Chrome Extension ✅ DONE
- [x] Manifest V3 for twitter.com and x.com
- [x] Content script observes DOM for tweets
- [x] Classification request to local API
- [x] Visual treatments: blur, tag, hide, pass
- [x] Settings popup with toggles and sensitivity slider
- [x] Background service worker for health checks

### 1.4 Configuration ✅ DONE
- [x] `scenarios/intents.yaml` with intent definitions
- [x] Few-shot examples for improved accuracy
- [x] Classification rules embedded in prompt
- [x] Indicator lists for each intent

### 1.5 Testing ✅ DONE
- [x] 12 tests covering classifier, API, and error handling

**Files created:**
- `server/classifier.py` -IntentClassifier class
- `server/api.py` -FastAPI application
- `extension/manifest.json` -Chrome extension manifest
- `extension/content.js` -Content interception
- `extension/background.js` -Service worker
- `extension/styles.css` -Visual treatments
- `extension/popup/` -Settings UI
- `scenarios/intents.yaml` -Intent definitions
- `tests/test_classifier.py` -Test suite

---

## Phase 2: Hardening & Reliability ✅ COMPLETE

**Goal**: Fix critical issues from Phase 1 before expanding to new platforms. Make the core engine production-grade.

### 2.1 Async Pipeline (Critical)
- [x] Replace synchronous `requests` with `httpx.AsyncClient` in classifier
- [x] Make `classify()` and `_call_ollama()` async methods
- [x] Use long-lived `AsyncClient` with connection pooling (created at startup, closed at shutdown)
- [x] Make batch endpoint truly parallel with `asyncio.gather()`

### 2.2 Cache Improvements (Critical)
- [x] Implement cache TTL -honor `CACHE_TTL` from `.env` (default 300s)
- [x] Make `_max_cache_size` configurable via environment variable
- [x] Wire up all `.env` config that's currently ignored (`OLLAMA_TEMPERATURE`, `MANIPULATION_THRESHOLD`)

### 2.3 Prompt Security (High)
- [x] Add XML-tag delimiters around user content in classification prompt to mitigate prompt injection
- [x] Validate that returned confidence is within 0.0–1.0 range
- [x] Use Ollama's `format: "json"` parameter to force valid JSON output (eliminates brittle regex parsing)
- [x] Increase `num_predict` from 80 to 150 for safer headroom

### 2.4 Server Resilience (High)
- [x] Add retry logic for Ollama calls (1 retry with 2s backoff)
- [x] Add max content length validation on `/classify` endpoint
- [x] Restrict CORS origins from `*` to `chrome-extension://` and localhost
- [x] Add request timeout middleware (httpx client timeout)

### 2.5 Extension Stability (High)
- [x] Fix cache key -use full content hash instead of first 100 characters
- [x] Add `chrome.storage.onChanged` listener so settings are reactive without page reload
- [x] Add error handling for `chrome.runtime.sendMessage` when background worker is dead
- [x] Guard `processTweets()` against concurrent re-entry (processing lock)
- [x] Reduce health check interval from 60s to 20s
- [x] Use batch API endpoint instead of individual requests
- [x] Align MIN_CONTENT_LENGTH between server and extension (20 chars)
- [x] Extract poll text and author name for richer classification context

### 2.6 Testing (Critical)
- [x] Add integration tests for all FastAPI endpoints using `TestClient`
- [x] Add cache behavior tests (TTL expiration, LRU eviction, hash collisions)
- [x] Add edge case tests (very long content, unicode/emoji, empty strings, malformed Ollama responses)
- [x] Add concurrency tests for batch processing
- [ ] Set up pytest-cov configuration and establish coverage baseline

### 2.7 Code Quality (Medium)
- [x] Extract magic numbers into named constants with justification comments
- [x] Remove unused `ClassificationResult` import in `api.py` (already covered by Pydantic model)
- [x] Replace `console.log` in extension with a togglable debug logger
- [x] Add structured logging configuration for the server

---

## Phase 3: YouTube Support 🔜 PLANNED

**Goal**: Extend classification to YouTube titles, descriptions, and comments.

### 3.1 YouTube Content Script ✅ DONE
- [x] Create `extension/platforms/youtube.js`
- [x] Intercept video titles in feed/search
- [x] Intercept video descriptions on watch page
- [x] Intercept top-level comments

### 3.2 YouTube-Specific Intents ✅ DONE
- [x] Add `clickbait` intent (YouTube-specific)
- [x] Add `reaction_farming` intent for comment sections
- [x] Update few-shot examples with YouTube content

### 3.3 Visual Treatments for YouTube ✅ DONE
- [x] Thumbnail blur for high-manipulation videos (overlay scoped to thumbnail)
- [x] Title badges for tagged content
- [x] Comment collapse for engagement bait

### 3.4 Intent Anchoring (Recommendation Shield) ⏸ DEFERRED
- [ ] On YouTube landing, prompt: "What did you come here for?" (one line, free text, unobtrusive)
- [ ] Hold declared intent in session memory
- [ ] Classify recommendations on a second axis: does this match why you came?
- [ ] After declared content is consumed, surface a soft stop: "You came for X. You've seen it."
- [ ] Not a hard block, just a pause before endless scrolling
- [ ] Opt-in feature (connects to Phase 6 user-configurable sensitivity)

> Deferred: Requires user trust in classifications to be established first.
> Revisit after Phase 5 eval passes.

### 3.5 Platform Abstraction ✅ DONE
- [x] Refactor content.js into a platform adapter pattern
- [x] Create shared classification logic used by both Twitter and YouTube adapters
- [x] Ensure new platforms can be added by implementing a single adapter

---

## Phase 4: Reddit Support 🔜 PLANNED

**Goal**: Extend classification to Reddit posts and comments.

### 4.1 Reddit Content Script
- [ ] Create `extension/platforms/reddit.js`
- [ ] Handle old.reddit.com and new Reddit
- [ ] Intercept post titles in feeds
- [ ] Intercept comment content

### 4.2 Reddit-Specific Intents
- [ ] Add `karma_farming` intent
- [ ] Add `brigading` intent (coordinated attacks)
- [ ] Add `copypasta` detection

### 4.3 Subreddit Context
- [ ] Pass subreddit context to classifier
- [ ] Adjust thresholds by subreddit type
- [ ] r/politics vs r/science need different baselines

### 4.4 Intent Anchoring for Reddit
- [ ] On subreddit landing, prompt: "What are you looking for?" (free text, unobtrusive)
- [ ] Hold declared intent in session memory (shared logic with YouTube, Phase 3.4)
- [ ] Classify feed posts against declared intent: does this match why you came?
- [ ] Soft stop after declared content consumed: "You found what you came for."
- [ ] Opt-in feature (connects to Phase 6 user-configurable sensitivity)

---

## Phase 5: Classification Accuracy 🔧 IN PROGRESS

**Goal**: Improve classification quality and handle edge cases.

### 5.1 Few-Shot Example Expansion
- [x] Expand eval test set from 48 to 80 examples with boundary cases across all 6 intents
- [x] Add short-form examples (under 20 words)
- [x] Add sarcasm/irony boundary cases
- [x] New baseline: 79% on 80 examples (63/80) - measured 2026-04-08
- [ ] Fix hype/genuine boundary: personal-experience framing without substance
- [ ] Fix ragebait/divisive boundary: contempt without explicit anger trigger
- [ ] Fix engagement_bait detection for short provocative statements
- [ ] Add platform-specific examples for YouTube and Reddit
- [ ] Target 85%+ accuracy on the 80-example set

### 5.2 Context-Aware Classification
- [ ] Include conversation thread context for replies
- [ ] Detect sarcasm and irony
- [ ] Handle quote tweets / retweets with added commentary
- [ ] Consider author context when available

### 5.3 Multilingual Support
- [ ] Test classification accuracy on non-English content
- [ ] Add multilingual few-shot examples
- [ ] Document supported language coverage

---

## Phase 6: User-Configurable Sensitivity 🔜 PLANNED

**Goal**: Let users fine-tune what content is filtered.

### 6.1 Per-Intent Thresholds
- [ ] Individual sensitivity sliders per intent
- [ ] "I want to see divisive content but not ragebait"
- [ ] Save preferences in chrome.storage.sync

### 6.2 Allowlist/Blocklist
- [ ] Allowlist specific accounts (never filter)
- [ ] Blocklist specific accounts (always filter)
- [ ] Import/export lists

### 6.3 Custom Intents
- [ ] User-defined intent categories
- [ ] Custom indicators and examples
- [ ] Community-shared intent packs

---

## Phase 7: Statistics Dashboard 🔜 PLANNED

**Goal**: Show users their content exposure patterns (local only).

### 7.1 Local Analytics
- [ ] Track classifications by intent over time
- [ ] Sessions, content items classified, intents detected
- [ ] Store in IndexedDB (browser local storage)

### 7.2 Dashboard UI
- [ ] Options page with charts
- [ ] "Your week: 45% genuine, 30% ragebait, 15% hype, 10% neutral"
- [ ] Trend lines over time

### 7.3 Insights
- [ ] "You encounter more ragebait on weekends"
- [ ] "Your engagement bait exposure decreased this week"
- [ ] Optional: suggest breaks after high-manipulation sessions

---

## Phase 8: Multi-Browser Support 🔜 PLANNED

**Goal**: Bring IntentKeeper to all major browsers.

### 8.1 Chromium Browsers (Brave, Edge, Opera)

Brave, Edge, and Opera all run Chromium and support Manifest V3 natively - the extension works on them without code changes. Work here is testing and store submissions only.

- [ ] Test full feature set on Brave (Private Network Access behavior may differ slightly)
- [ ] Test on Microsoft Edge - verify `chrome.*` API aliases work as expected
- [ ] Test on Opera
- [ ] Submit to Microsoft Edge Add-ons store
- [ ] Submit to Chrome Web Store (covers Brave and Opera users via CWS)
- [ ] Document installation instructions for each browser

### 8.2 Firefox

Firefox uses a different extension format and has subtle WebExtensions API incompatibilities with Chrome MV3. This requires real porting work.

- [ ] Port Manifest V3 to Firefox MV3 format (`browser_specific_settings`, `browser_action` vs `action`)
- [ ] Audit and fix any `chrome.*` calls not covered by the WebExtensions polyfill
- [ ] Handle Firefox's stricter Content Security Policy
- [ ] Test on Firefox Developer Edition
- [ ] Prepare for Mozilla Add-ons (AMO) submission
- [ ] Privacy policy document
- [ ] Extension description and screenshots

### 8.3 Safari (Optional - High Effort)

Safari requires Apple developer account, Xcode, and wrapping the extension in a native macOS/iOS app. Significant effort for relatively low reach among target audience.

- [ ] Evaluate if user demand justifies the effort
- [ ] Wrap extension using Xcode's Safari Web Extension converter
- [ ] Submit to Mac App Store

---

## Phase 9: Advanced Classification 🔵 LONG-TERM

**Goal**: Push classification accuracy with advanced techniques.

### 9.1 Multimedia Support
- [ ] Image analysis for memes (requires vision model)
- [ ] Video thumbnail analysis
- [ ] Audio/video content classification (transcription)

### 9.2 Fine-Tuned Models
- [ ] Create IntentKeeper-specific fine-tuned model
- [ ] Smaller, faster model for edge deployment
- [ ] Offline classification without Ollama

---

## Phase 10: Cross-Platform App 🔵 LONG-TERM

**Goal**: Protect attention beyond the browser.

### 10.1 Desktop App
- [ ] System tray app for clipboard monitoring
- [ ] Classify links before opening

### 10.2 Notification Interceptor
- [ ] Use OS notification API (Windows/macOS/Linux all expose hooks) to intercept notifications before display
- [ ] Route intercepted notifications through the existing FastAPI classification server
- [ ] Batch non-urgent notifications into a single digest, delivered on a user-defined schedule
- [ ] Hard-stop on notification volume: if an app sends more than N notifications per hour, auto-batch regardless of content
- [ ] Per-app configuration: allow users to exempt specific apps from interception

### 10.3 Mobile Considerations
- [ ] Research iOS/Android integration options
- [ ] Share sheet integration
- [ ] Browser-based mobile solution

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Core + Twitter | High | Medium | ✅ COMPLETE |
| 2. Hardening & Reliability | Critical | Medium | ✅ COMPLETE |
| 3. YouTube | High | Medium | 🟡 In Progress |
| 5. Classification Accuracy | Critical | Low | 🔴 Next - gates platform expansion |
| 4. Reddit | High | Medium | 🔵 After eval passes |
| 6. User Sensitivity | Medium | Low | 🔵 After 5 |
| 7. Statistics | Medium | Medium | 🔵 After 6 |
| 8. Multi-Browser (Brave/Edge/Opera/Firefox) | Medium | Low-Medium | 🔵 After 7 |
| 9. Advanced Classification | High | High | 🔵 Long-term |
| 10. Cross-Platform | Medium | High | 🔵 Long-term |

> **Why Phase 5 before Phase 4**: The hardest part of this project is not
> engineering - it's building user trust in the taxonomy. If ragebait/divisive/hype
> labels feel wrong to users, the product feels moralizing regardless of how clean
> the code is. The eval harness in `tests/eval/` measures per-intent precision and
> recall. Platform expansion (Reddit) should not happen until the eval passes a
> 70% macro F1 threshold.

---

## Current Status (2026-03-11)

**Completed**: Phase 1 (Core classifier + Chrome extension for Twitter/X), Phase 2 (Hardening & Reliability), Phase 3.1-3.3 + 3.5 (YouTube support + platform abstraction)

**Next Up**: Phase 5 (Classification accuracy - eval harness built, needs Ollama run to establish baseline)

**Priority shift**: Phase 4 (Reddit) moved after Phase 5. Eval gates platform expansion.

**Stats**:

- 30+ tests passing
- 7 intent categories
- 1 platform supported (Twitter/X)
- Async pipeline with batch classification
- LRU cache with TTL expiration

---

## Guiding Principles (Never Compromise)

1. **Local-first**: All classification on-device. No cloud processing.
2. **Fail-open**: Errors pass content through, never block.
3. **Intent over topic**: Don't censor subjects, surface manipulation.
4. **User control**: Configurable thresholds, not black boxes.
5. **Transparency**: Show reasoning, explain decisions.
6. **Privacy**: No telemetry, no tracking, no data collection.

---

## Sibling Project

IntentKeeper shares architectural DNA with [empathySync](https://github.com/Olawoyin007/empathySync). Same design philosophy (local-first, Ollama integration, YAML-driven config, classification pipelines), different mission. empathySync protects against over-reliance on AI for emotional support. IntentKeeper protects against content designed to manipulate emotions.

---

## Version Targets

**v0.1.0** (Phase 1): Core classifier + Twitter/X extension ✅ COMPLETE
**v0.2.0** (Phase 2): Hardening & reliability improvements
**v0.3.0** (Phase 3): YouTube support
**v0.4.0** (Phase 4): Reddit support
**v0.5.0** (Phase 5): Classification accuracy improvements
**v0.6.0** (Phase 6): User-configurable sensitivity
**v0.7.0** (Phase 7): Statistics dashboard
**v0.8.0** (Phase 8): Multi-browser support (Brave, Edge, Opera, Firefox)
**v1.0.0** (Phase 9): Advanced classification features

---

*"Protect your attention. Question the energy, not the topic."*
