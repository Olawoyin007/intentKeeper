# IntentKeeper Roadmap

> "The content isn't the problem. The intent behind it is."

## Project Goals

1. **Protect attention without censoring content** — Surface manipulation patterns, let users decide what to engage with.
2. **Local-first classification** — All processing on-device via Ollama. No cloud, no tracking.
3. **Platform-agnostic design** — The classification engine should work across any platform with a content script adapter.

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
- [x] `POST /classify` — Single content classification
- [x] `POST /classify/batch` — Batch classification (max 50 items)
- [x] `GET /health` — Server and Ollama health check
- [x] `GET /intents` — Current intent definitions
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
- `server/classifier.py` — IntentClassifier class
- `server/api.py` — FastAPI application
- `extension/manifest.json` — Chrome extension manifest
- `extension/content.js` — Content interception
- `extension/background.js` — Service worker
- `extension/styles.css` — Visual treatments
- `extension/popup/` — Settings UI
- `scenarios/intents.yaml` — Intent definitions
- `tests/test_classifier.py` — Test suite

---

## Phase 2: Hardening & Reliability 🔜 NEXT

**Goal**: Fix critical issues from Phase 1 before expanding to new platforms. Make the core engine production-grade.

### 2.1 Async Pipeline (Critical)
- [ ] Replace synchronous `requests` with `httpx.AsyncClient` in classifier
- [ ] Make `classify()` and `_call_ollama()` async methods
- [ ] Use long-lived `AsyncClient` with connection pooling (created at startup, closed at shutdown)
- [ ] Make batch endpoint truly parallel with `asyncio.gather()`

### 2.2 Cache Improvements (Critical)
- [ ] Implement cache TTL — honor `CACHE_TTL` from `.env` (default 300s)
- [ ] Make `_max_cache_size` configurable via environment variable
- [ ] Wire up all `.env` config that's currently ignored (`OLLAMA_TEMPERATURE`, `MANIPULATION_THRESHOLD`)

### 2.3 Prompt Security (High)
- [ ] Add XML-tag delimiters around user content in classification prompt to mitigate prompt injection
- [ ] Validate that returned confidence is within 0.0–1.0 range
- [ ] Use Ollama's `format: "json"` parameter to force valid JSON output (eliminates brittle regex parsing)
- [ ] Increase `num_predict` from 80 to 150 for safer headroom

### 2.4 Server Resilience (High)
- [ ] Add retry logic for Ollama calls (1 retry with 2s backoff)
- [ ] Add max content length validation on `/classify` endpoint
- [ ] Restrict CORS origins from `*` to `chrome-extension://` and localhost
- [ ] Add request timeout middleware

### 2.5 Extension Stability (High)
- [ ] Fix cache key — use full content hash instead of first 100 characters
- [ ] Add `chrome.storage.onChanged` listener so settings are reactive without page reload
- [ ] Add error handling for `chrome.runtime.sendMessage` when background worker is dead
- [ ] Guard `processTweets()` against concurrent re-entry (processing lock)
- [ ] Reduce health check interval from 60s to 20s

### 2.6 Testing (Critical)
- [ ] Add integration tests for all FastAPI endpoints using `TestClient`
- [ ] Add cache behavior tests (TTL expiration, LRU eviction, hash collisions)
- [ ] Add edge case tests (very long content, unicode/emoji, empty strings, malformed Ollama responses)
- [ ] Add concurrency tests for batch processing
- [ ] Set up pytest-cov configuration and establish coverage baseline

### 2.7 Code Quality (Medium)
- [ ] Extract magic numbers into named constants with justification comments
- [ ] Remove unused `ClassificationResult` import in `api.py` (already covered by Pydantic model)
- [ ] Replace `console.log` in extension with a togglable debug logger
- [ ] Add structured logging configuration for the server

---

## Phase 3: YouTube Support 🔜 PLANNED

**Goal**: Extend classification to YouTube titles, descriptions, and comments.

### 3.1 YouTube Content Script
- [ ] Create `extension/platforms/youtube.js`
- [ ] Intercept video titles in feed/search
- [ ] Intercept video descriptions on watch page
- [ ] Intercept top-level comments

### 3.2 YouTube-Specific Intents
- [ ] Add `clickbait` intent (YouTube-specific)
- [ ] Add `reaction_farming` intent for comment sections
- [ ] Update few-shot examples with YouTube content

### 3.3 Visual Treatments for YouTube
- [ ] Thumbnail blur for high-manipulation videos
- [ ] Title badges for tagged content
- [ ] Comment collapse for engagement bait

### 3.4 Platform Abstraction
- [ ] Refactor content.js into a platform adapter pattern
- [ ] Create shared classification logic used by both Twitter and YouTube adapters
- [ ] Ensure new platforms can be added by implementing a single adapter

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

---

## Phase 5: Classification Accuracy 🔜 PLANNED

**Goal**: Improve classification quality and handle edge cases.

### 5.1 Few-Shot Example Expansion
- [ ] Add sarcasm/irony examples with explicit guidance
- [ ] Add mixed-intent content examples (partly genuine, partly hype)
- [ ] Add edge cases (very short, emoji-heavy, link-only)
- [ ] Add platform-specific examples for YouTube and Reddit
- [ ] Target 5+ examples per intent category

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

## Phase 8: Firefox Extension 🔜 PLANNED

**Goal**: Bring IntentKeeper to Firefox users.

### 8.1 Firefox Compatibility
- [ ] Port Manifest V3 to Firefox format
- [ ] Handle Firefox storage API differences
- [ ] Test on Firefox Developer Edition

### 8.2 AMO Submission
- [ ] Prepare for Firefox Add-ons submission
- [ ] Privacy policy document
- [ ] Extension description and screenshots

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
- [ ] Optional: intercept notification content

### 10.2 Mobile Considerations
- [ ] Research iOS/Android integration options
- [ ] Share sheet integration
- [ ] Browser-based mobile solution

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Core + Twitter | High | Medium | ✅ COMPLETE |
| 2. Hardening & Reliability | Critical | Medium | 🔴 Next |
| 3. YouTube | High | Medium | 🔵 After 2 |
| 4. Reddit | High | Medium | 🔵 After 3 |
| 5. Classification Accuracy | High | Low | 🔵 After 3 |
| 6. User Sensitivity | Medium | Low | 🔵 After 5 |
| 7. Statistics | Medium | Medium | 🔵 After 6 |
| 8. Firefox | Medium | Low | 🔵 After 7 |
| 9. Advanced Classification | High | High | 🔵 Long-term |
| 10. Cross-Platform | Medium | High | 🔵 Long-term |

---

## Current Status (2026-02-09)

**Completed**: Phase 1 (Core classifier + Chrome extension for Twitter/X)

**Next Up**: Phase 2 (Hardening & Reliability)

**Stats**:
- 12 tests passing
- 7 intent categories
- 1 platform supported (Twitter/X)

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
**v0.8.0** (Phase 8): Firefox extension
**v1.0.0** (Phase 9): Advanced classification features

---

*"Protect your attention. Question the energy, not the topic."*
