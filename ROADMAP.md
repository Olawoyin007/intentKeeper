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
- [x] Fail-open design (errors pass content through)I'

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

## Phase 2: YouTube Support 🔜 PLANNED

**Goal**: Extend classification to YouTube titles, descriptions, and comments.

### 2.1 YouTube Content Script
- [ ] Create `extension/platforms/youtube.js`
- [ ] Intercept video titles in feed/search
- [ ] Intercept video descriptions on watch page
- [ ] Intercept top-level comments

### 2.2 YouTube-Specific Intents
- [ ] Add `clickbait` intent (YouTube-specific)
- [ ] Add `reaction_farming` intent for comment sections
- [ ] Update few-shot examples with YouTube content

### 2.3 Visual Treatments for YouTube
- [ ] Thumbnail blur for high-manipulation videos
- [ ] Title badges for tagged content
- [ ] Comment collapse for engagement bait

### 2.4 Performance Optimization
- [ ] Debounce classification requests during scrolling
- [ ] Cache classifications by content hash
- [ ] Batch requests for visible content

---

## Phase 3: Reddit Support 🔜 PLANNED

**Goal**: Extend classification to Reddit posts and comments.

### 3.1 Reddit Content Script
- [ ] Create `extension/platforms/reddit.js`
- [ ] Handle old.reddit.com and new Reddit
- [ ] Intercept post titles in feeds
- [ ] Intercept comment content

### 3.2 Reddit-Specific Intents
- [ ] Add `karma_farming` intent
- [ ] Add `brigading` intent (coordinated attacks)
- [ ] Add `copypasta` detection

### 3.3 Subreddit Context
- [ ] Pass subreddit context to classifier
- [ ] Adjust thresholds by subreddit type
- [ ] r/politics vs r/science need different baselines

---

## Phase 4: User-Configurable Sensitivity 🔜 PLANNED

**Goal**: Let users fine-tune what content is filtered.

### 4.1 Per-Intent Thresholds
- [ ] Individual sensitivity sliders per intent
- [ ] "I want to see divisive content but not ragebait"
- [ ] Save preferences in chrome.storage.sync

### 4.2 Allowlist/Blocklist
- [ ] Allowlist specific accounts (never filter)
- [ ] Blocklist specific accounts (always filter)
- [ ] Import/export lists

### 4.3 Custom Intents
- [ ] User-defined intent categories
- [ ] Custom indicators and examples
- [ ] Community-shared intent packs

---

## Phase 5: Statistics Dashboard 🔜 PLANNED

**Goal**: Show users their content exposure patterns (local only).

### 5.1 Local Analytics
- [ ] Track classifications by intent over time
- [ ] Sessions, content items classified, intents detected
- [ ] Store in IndexedDB (browser local storage)

### 5.2 Dashboard UI
- [ ] Options page with charts
- [ ] "Your week: 45% genuine, 30% ragebait, 15% hype, 10% neutral"
- [ ] Trend lines over time

### 5.3 Insights
- [ ] "You encounter more ragebait on weekends"
- [ ] "Your engagement bait exposure decreased this week"
- [ ] Optional: suggest breaks after high-manipulation sessions

---

## Phase 6: Firefox Extension 🔜 PLANNED

**Goal**: Bring IntentKeeper to Firefox users.

### 6.1 Firefox Compatibility
- [ ] Port Manifest V3 to Firefox format
- [ ] Handle Firefox storage API differences
- [ ] Test on Firefox Developer Edition

### 6.2 AMO Submission
- [ ] Prepare for Firefox Add-ons submission
- [ ] Privacy policy document
- [ ] Extension description and screenshots

---

## Phase 7: Advanced Classification 🔵 LONG-TERM

**Goal**: Improve classification accuracy with advanced techniques.

### 7.1 Context-Aware Classification
- [ ] Include conversation thread context
- [ ] Detect sarcasm and irony
- [ ] Handle quote tweets / retweets

### 7.2 Multimedia Support
- [ ] Image analysis for memes (requires vision model)
- [ ] Video thumbnail analysis
- [ ] Audio/video content classification (transcription)

### 7.3 Fine-Tuned Models
- [ ] Create IntentKeeper-specific fine-tuned model
- [ ] Smaller, faster model for edge deployment
- [ ] Offline classification without Ollama

---

## Phase 8: Cross-Platform App 🔵 LONG-TERM

**Goal**: Protect attention beyond the browser.

### 8.1 Desktop App
- [ ] System tray app for clipboard monitoring
- [ ] Classify links before opening
- [ ] Optional: intercept notification content

### 8.2 Mobile Considerations
- [ ] Research iOS/Android integration options
- [ ] Share sheet integration
- [ ] Browser-based mobile solution

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Core + Twitter | High | Medium | ✅ COMPLETE |
| 2. YouTube | High | Medium | 🔵 Next |
| 3. Reddit | High | Medium | 🔵 After 2 |
| 4. Sensitivity | Medium | Low | 🔵 After 3 |
| 5. Statistics | Medium | Medium | 🔵 After 4 |
| 6. Firefox | Medium | Low | 🔵 After 5 |
| 7. Advanced | High | High | 🔵 Long-term |
| 8. Cross-Platform | Medium | High | 🔵 Long-term |

---

## Current Status (2026-02-06)

**Completed**: Phase 1 (Core classifier + Chrome extension for Twitter/X)

**Next Up**: Phase 2 (YouTube support)

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

## Version Targets

**v0.1.0** (Phase 1): Core classifier + Twitter/X extension ✅ COMPLETE
**v0.2.0** (Phase 2): YouTube support
**v0.3.0** (Phase 3): Reddit support
**v0.4.0** (Phase 4): User-configurable sensitivity
**v0.5.0** (Phase 5): Statistics dashboard
**v0.6.0** (Phase 6): Firefox extension
**v1.0.0** (Phase 7): Advanced classification features

---

*"Protect your attention. Question the energy, not the topic."*
