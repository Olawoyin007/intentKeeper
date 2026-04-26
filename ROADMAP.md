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

## Phase 4: Reddit Support ✅ COMPLETE

**Goal**: Extend classification to Reddit posts and comments.

### 4.1 Reddit Content Script ✅
- [x] Create `extension/platforms/reddit.js`
- [x] Handle old.reddit.com, new Reddit (React), and Shreddit (web components) - all three DOM variants
- [x] Intercept post titles in feeds
- [x] Intercept comment content (capped at 400 chars to prevent long LLM prompts)
- [x] Include subreddit context in extracted text
- [x] 22 structural tests in `tests/test_reddit_adapter.py`

### 4.2 Reddit-Specific Intents ↗ SUPERSEDED
- Phase 5 reached the prompt ceiling at 98%. Adding new intent categories (karma_farming, brigading,
  copypasta) would require fine-tuning the model, not prompt engineering. The existing 6 intents
  cover Reddit content sufficiently; new intents are only worth adding if fine-tuning is planned.

### 4.3 Subreddit Context ↗ SUPERSEDED
- Per-subreddit threshold tuning is out of scope now that Phase 6.1 gives users per-intent toggles.
  Users who want different sensitivity on r/politics vs r/science can use the global sensitivity
  slider. Full subreddit-aware thresholds would require significant storage/UX work for marginal gain.

### 4.4 Intent Anchoring for Reddit
- [ ] On subreddit landing, prompt: "What are you looking for?" (free text, unobtrusive)
- [ ] Hold declared intent in session memory (shared logic with YouTube, Phase 3.4)
- [ ] Classify feed posts against declared intent: does this match why you came?
- [ ] Soft stop after declared content consumed: "You found what you came for."
- [ ] Opt-in feature (connects to Phase 6 user-configurable sensitivity)

---

## Phase 5: Classification Accuracy ✅ COMPLETE

**Prompt ceiling reached at 98% (78/80). The 2 remaining cases require fine-tuning, not prompt engineering.**

**Goal**: Improve classification quality and handle edge cases.

### 5.1 Few-Shot Example Expansion
- [x] Expand eval test set from 48 to 80 examples with boundary cases across all 6 intents
- [x] Add short-form examples (under 20 words)
- [x] Add sarcasm/irony boundary cases
- [x] New baseline: 79% on 80 examples (63/80) - measured 2026-04-08
- [x] Fix hype/genuine boundary: specificity test rule + 4 new examples - hype now 100% (11/11)
- [x] Fix engagement_bait detection for short provocative formats: 'Change my mind', 'Fight me', 'Unpopular opinion:' - new examples + rules
- [x] New baseline: 85% on 80 examples (68/80) - measured 2026-04-09
- [x] Fix ragebait/divisive boundary: guilt-demand framing, society-level contempt, sarcastic credibility attacks - ragebait now 92% (12/13)
- [x] Fix engagement_bait recall: 'Fight me'/'Change my mind' always engagement_bait, CTA overrides divisive, reply-farming examples - engagement_bait now 92% (11/12)
- [x] Fix lifestyle/cultural sorting staying divisive, short vague content = hype not ragebait
- [x] New baseline: 98% on 80 examples (78/80) - measured 2026-04-09
- [ ] 2 remaining cases require fine-tuning to resolve (prompt ceiling reached)
- [ ] Add platform-specific examples for YouTube and Reddit

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

## Phase 6: User-Configurable Sensitivity ✅ COMPLETE

**Goal**: Let users fine-tune what content is filtered.

### 6.1 Per-Intent Kill Switches ✅ DONE
- [x] Per-intent on/off toggles in popup (ragebait, fearmongering, hype, engagement_bait, divisive)
- [x] "I want to see divisive content but not ragebait" - achieved via toggle UI
- [x] Kill switch sits between master enable and action settings; persisted in chrome.storage.local
- [x] `intentEnabled` map in DEFAULT_SETTINGS; classifier reads it before applying any treatment

### 6.2 Allowlist ✅ DONE
**Note**: Blocklist deferred - filtering by source not content conflicts with the "intent over topic" principle (classifying based on who said it, not what was said). Allowlist = user sovereignty; blocklist = editorial stance. Only allowlist implemented.

- [x] Optional `extractAuthor()` method on platform adapters (Twitter, Reddit) - returns lowercase handle/username
- [x] Allowlist stored in `chrome.storage.local` under `ik_allowlist` as array of bare handles
- [x] In-memory `Set` in classifier.js for O(1) lookup per item in `processItems()`
- [x] `onChanged` listener keeps in-memory Set hot when popup updates storage
- [x] Items from allowlisted authors get `data-intentkeeper-processed="allowed"` - skipped silently
- [x] Popup "Trusted Accounts" section: add by typing @handle or u/username (prefix stripped on save), remove per-entry
- [x] YouTube skipped - channel handle format differs from Twitter/Reddit handle pattern; weaker use case

### 6.3 Custom Intents
- [ ] User-defined intent categories
- [ ] Custom indicators and examples
- [ ] Community-shared intent packs

### 6.4 Confidence Disclosure ✅ DONE
- [x] Low confidence (<0.65): muted label + "?" suffix + `.intentkeeper-tag--uncertain` class
- [x] High confidence (>0.85): standard treatment
- [x] Tooltip: "Classified as ragebait (confidence: 72%)"
- [x] Blur overlay: low-confidence note rendered inline
- [x] `CONFIDENCE_LOW` / `CONFIDENCE_HIGH` constants in classifier.js

### 6.5 User Override & Local Corrections ✅ DONE
**Philosophy**: Corrections stored locally only in `chrome.storage.local`. Nothing leaves the device.

- [x] Pencil button (✏️) on each tag - hover to reveal, click to open correction picker
- [x] Correction picker dropdown: all intents except the current one + Cancel
- [x] `saveCorrection(snippet, originalIntent, correctedIntent)` - stores to `ik_corrections`, LRU cap at 100
- [x] `loadCorrectionsForPrompt()` in background.js - loads 5 most recent corrections
- [x] Corrections injected into LLM prompt as personalized few-shot examples per item in batch
- [x] Tag updates to strikethrough state after correction
- [x] Popup "My Corrections" section: count + Clear all button

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

## Phase 8: Multi-Browser Support 🔧 IN PROGRESS

**Goal**: Bring IntentKeeper to all major browsers.

### 8.1 Chromium Browsers (Chrome, Brave, Edge, Opera) ✅ WORKING

Chrome, Brave, Edge, and Opera all run Chromium and support Manifest V3 natively - the extension works on all four without code changes. Store submissions are the remaining work.

- [x] Brave Private Network Access (PNA) support: `PrivateNetworkAccessMiddleware` added to API server - responds with `Access-Control-Allow-Private-Network: true` when Brave's PNA preflight fires. 3 tests in `TestPrivateNetworkAccessMiddleware`.
- [x] Tested on Microsoft Edge - `chrome.*` API aliases work as expected
- [x] Tested on Opera - works without modification
- [ ] Submit to Chrome Web Store (covers Brave and Opera users via CWS)
- [ ] Submit to Microsoft Edge Add-ons store
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

## Phase 8.5: Non-Technical User Access ⏸ DEFERRED

**Goal**: Make intentKeeper installable by people who do not know what a terminal is, on Windows and Mac as well as Linux.

> **Deferred** - projects are still in active development. Distribution infrastructure adds maintenance overhead before APIs stabilise.

### 8.5.1 Windows PowerShell Setup Script

**Problem**: Windows users have no equivalent to `install.sh`. The only path to a working setup requires 4+ terminal commands.

- [ ] Create `setup.ps1` using `winget` to install Python and Ollama automatically
- [ ] Create `start-server.bat` - double-clickable launcher that activates the venv and starts `intentkeeper-server`
- [ ] `setup.ps1` also: creates a desktop shortcut for the server, configures `.env` from `.env.example`, and pulls the configured model
- [ ] Document in README under "Windows Setup (No Terminal Required)"

### 8.5.2 PyInstaller Freeze - Standalone Binaries

**Problem**: Even with a setup script, users need Python installed. A frozen binary eliminates this requirement entirely.

- [ ] Freeze the FastAPI server into a single self-contained binary via PyInstaller
- [ ] Targets: `intentkeeper-server.exe` (Windows), `intentkeeper-server` app bundle (Mac `.dmg`)
- [ ] Set up GitHub Actions matrix build (`windows-latest`, `macos-latest`, `ubuntu-latest`) triggered on release tags
- [ ] Publish binaries to GitHub Releases automatically
- [ ] When combined with Ollama Desktop + Chrome Web Store extension: three "click to install" steps, zero terminal usage

### 8.5.3 Code Signing

**Problem**: Unsigned executables are blocked by Windows SmartScreen and Mac Gatekeeper. Users see "Windows protected your PC" and most will not override it.

- [ ] Windows: EV certificate or Windows trusted developer account
- [ ] Mac: Apple Developer Program membership, notarize `.dmg` via `notarytool`
- [ ] Add signing steps to the GitHub Actions release workflow
- [ ] Document signing setup in `CONTRIBUTING.md`

### 8.5.4 Transformers.js Serverless Path (Long-Term)

**Goal**: Eliminate the Python server and Ollama dependency entirely for intentKeeper.

**Approach**: Train a fine-tuned DistilBERT-style ONNX model (~65MB) on expanded labeled data from the existing few-shot examples. Run classification entirely in the browser via Transformers.js. No Python, no Ollama, no server.

- [ ] Expand labeled training data from existing `scenarios/intents.yaml` few-shot examples to ~1,000-5,000 labeled examples
- [ ] Fine-tune a DistilBERT-style classifier (ONNX, int8 quantized, ~65MB)
- [ ] Integrate via Transformers.js in the extension service worker
- [ ] Keep Ollama-powered server as "advanced/accurate mode" for users who want higher accuracy with larger models
- [ ] **Accuracy tradeoff**: ~85-92% vs current 98% with the LLM approach. Acceptable for the "zero setup" use case
- [ ] Publish to Chrome Web Store and Firefox Add-ons as a fully self-contained extension

> This sub-phase requires training data collection and ML infrastructure. It is the most transformative change for accessibility but also the highest effort. Revisit once APIs and intent taxonomy are stable.

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
| 5. Classification Accuracy | Critical | Low | ✅ COMPLETE (98%, prompt ceiling) |
| 4. Reddit | High | Medium | ✅ COMPLETE |
| 6. User Sensitivity | Medium | Low | 🔵 After 5 |
| 7. Statistics | Medium | Medium | 🔵 After 6 |
| 8. Multi-Browser (Chrome/Brave/Edge/Opera/Firefox) | Medium | Low-Medium | 🟡 Chrome/Brave/Edge/Opera ✅, Store submissions + Firefox 🔵 |
| 8.5. Non-Technical User Access | High | Medium-High | ⏸ DEFERRED - infra overhead before APIs stabilise |
| 9. Advanced Classification | High | High | 🔵 Long-term |
| 10. Cross-Platform | Medium | High | 🔵 Long-term |

> **Why Phase 5 before Phase 4**: The hardest part of this project is not
> engineering - it's building user trust in the taxonomy. If ragebait/divisive/hype
> labels feel wrong to users, the product feels moralizing regardless of how clean
> the code is. The eval harness in `tests/eval/` measures per-intent precision and
> recall. Platform expansion (Reddit) should not happen until the eval passes a
> 70% macro F1 threshold.

---

## Current Status (2026-04-26)

**Completed**: Phase 1 (Core + Twitter/X), Phase 2 (Hardening), Phase 3.1-3.3 + 3.5 (YouTube + platform abstraction), Phase 4 (Reddit - 3 DOM variants), Phase 5.1-5.2 (98% accuracy), Phase 6.1-6.5 (User-Configurable Sensitivity - all subphases complete), Phase 8.1 (Brave PNA middleware) - **v0.5.0 released**

**Prompt ceiling**: The 2 remaining misclassified cases are at the model's training boundary. Fine-tuning (Phase 5.3) would be needed to pass 98%. Prompting cannot resolve them.

**Next Up**: Phase 7 (Statistics Dashboard) or Phase 8.2 (Firefox support)

**Stats**:

- 98% eval accuracy (78/80)
- 6 intent categories (ragebait, fearmongering, hype, engagement_bait, divisive, genuine)
- 3 platforms (Twitter/X, YouTube, Reddit)
- 4 browsers: Chrome, Brave, Edge, Opera
- Per-intent kill switches, allowlist, confidence disclosure, user corrections

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
**v0.2.0** (Phase 2): Hardening & reliability improvements ✅ COMPLETE
**v0.3.0** (Phase 3): YouTube support ✅ COMPLETE (platform abstraction done, intent anchoring deferred)
**v0.4.0** (Phase 4): Reddit support ✅ COMPLETE
**v0.5.0** (Phase 5): Classification accuracy - 98% reached ✅ COMPLETE (prompt ceiling; fine-tuning needed for final 2%)
**v0.6.0** (Phase 6): User-configurable sensitivity
**v0.7.0** (Phase 7): Statistics dashboard
**v0.8.0** (Phase 8): Multi-browser support (Brave, Edge, Opera, Firefox)
**v0.8.5** (Phase 8.5): Non-technical user access - DEFERRED
**v1.0.0** (Phase 9): Advanced classification features

---

*"Protect your attention. Question the energy, not the topic."*
