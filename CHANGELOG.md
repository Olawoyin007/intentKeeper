# Changelog

All notable changes to IntentKeeper are documented here.

## v0.5.0 (2026-04-26) - User Control & Platform Reliability

**"You decide what stays. The extension gets out of the way."**

### User-Configurable Sensitivity (Phase 6)

**Per-Intent Kill Switches (Phase 6.1)**
- Every intent (ragebait, engagement_bait, fearmongering, divisive, hype) now has its own toggle in the popup. Disable any intent you don't want filtered without touching the others. Settings persist via `chrome.storage.local`.

**Trusted Accounts / Allowlist (Phase 6.2)**
- Add accounts you trust to an allowlist in the popup. Their content bypasses classification entirely, regardless of what the model would have said. Handles `@username` and `u/username` prefix normalization. In-memory `Set` for O(1) per-item lookup.

**Confidence Disclosure (Phase 6.4)**
- Low-confidence classifications (below threshold) are now shown with a "?" indicator so you know when the model is uncertain. Confidence score exposed in the UI alongside the intent label.

**User Corrections (Phase 6.5)**
- Wrong classification? Click the pencil icon to correct it. Corrections are stored locally and injected as few-shot examples into subsequent classifier prompts, improving accuracy for your specific feed over time.

### Platform Reliability

**YouTube SPA Navigation**
- YouTube's single-page app navigation (pushState/popstate) now correctly triggers re-classification when navigating between videos without a full page reload. Observer hardened against edge cases.

**YouTube Lazy-Load Fix**
- Feed items that load after initial page render (infinite scroll) are now correctly classified. Added lazy-load guard that watches for new DOM nodes.

**Reddit SPA Navigation + Comment Context**
- Reddit's React router navigation handled. Comment context (subreddit, flair) now included in classification text for better accuracy on community-specific content.

**Twitter/Reddit Lazy-Load Guard**
- Applied the same lazy-load guard to Twitter and Reddit adapters. Fixes missed classifications on scroll.

### UI Rebrand
- Extension renamed from working title to **intentKeeper** throughout popup, icons, and manifest. New logo. Popup redesigned with cleaner layout, real branding, and collapsible sections.

### Multi-Browser Support
- **Chrome, Brave, Edge, Opera** all confirmed working. Brave's strict Private Network Access enforcement handled automatically via `PrivateNetworkAccessMiddleware` - no user configuration needed.

### Model Benchmark (new)
- `scripts/benchmark.py` measures classification accuracy and latency across locally installed Ollama models using the 80-example labeled eval set. Results written to `docs/model-benchmark.md` organized by Min VRAM requirement.
- Partial results saved after each model; `--resume` picks up from a crash.

### Stats
- 3 platforms: Twitter/X, YouTube, Reddit
- 4 browsers: Chrome, Brave, Edge, Opera
- 98% eval accuracy (78/80) on 80-example labeled set
- Per-intent kill switches, allowlist, confidence disclosure, user corrections

---

## v0.4.0 (2026-04-12) - Reddit, Brave & Classification Accuracy

**"Three platforms. 98% accuracy. Works in Brave."**

### Reddit Support (Phase 4)
- **Three DOM variants**: Handles Shreddit (web components `<shreddit-post>`), new Reddit (React with `data-testid`), and old Reddit (classic `.thing.link` / `.thing.comment`) - all three are live simultaneously
- **Dynamic selector**: `get baseSelector()` computed property detects variant at runtime rather than static selector string
- **Subreddit context**: Subreddit name and flair extracted and included in classification text for better intent detection
- **Comment truncation**: Comment body capped at 400 characters to keep LLM prompts lean
- **22 structural tests**: `tests/test_reddit_adapter.py` validates interface contract and all three DOM variants

### Brave Support (Phase 8.1)
- **Private Network Access (PNA) middleware**: Brave's strict PNA enforcement requires the server to respond with `Access-Control-Allow-Private-Network: true` on preflight. `PrivateNetworkAccessMiddleware` in `server/api.py` handles this automatically - no user configuration needed
- **3 tests**: `TestPrivateNetworkAccessMiddleware` validates header presence and absence

### Classification Accuracy (Phase 5.1 + 5.2)
- **98% accuracy** (78/80) on 80-example eval set - up from 79% at Phase 5 start
- **Prompt ceiling reached**: 2 remaining cases are at the model's training boundary; fine-tuning (Phase 5.3) would be needed for 100%
- Key improvements: ragebait/divisive boundary, engagement_bait short-form detection, guilt-demand framing, society-level contempt, CTA override rule

### Security
- **CodeQL alerts resolved**: Fixed 3 false-positive "Incomplete URL sanitization" alerts in test code by using exact URL pattern matching instead of substring checks

### Stats
- 98% eval accuracy (78/80)
- 3 platforms supported
- 60+ tests passing

---

## v0.3.0 (2026-02-28) - Distribution & Discoverability

**"Anyone can run it now."**

Docker support, README rewrite, coverage baseline, and open community channels.

### Distribution
- **Docker support**: `docker compose up` starts Ollama + classification server together - no manual setup
- **Auto-pull (non-Docker)**: Server checks `/api/tags` on startup and pulls the configured model automatically if it is not present - no manual `ollama pull` needed
- **Auto model pull**: Ollama container pulls the configured model automatically on first run
- **Any Ollama model**: `OLLAMA_MODEL` env var accepts any model - `mistral:7b-instruct`, `llama3.2`, `phi3`, or whatever you have

### Documentation
- **README rewrite**: Leads with what makes IntentKeeper unique - the only shipped, local-first, intent-classification tool for social media
- **Ollama reframed**: Positioned as a capability, not a prerequisite
- **Quick Start split**: Clear separation between Part 1 (server) and Part 2 (extension)
- **Details blocks**: Philosophy sections collapsible - scannable for skimmers, readable for contributors

### Quality
- **pytest-cov configured**: Coverage reporting enabled, 88% baseline established (30 tests)
- **GitHub topics added**: `ollama`, `local-first`, `humane-tech`, `privacy`, `anti-engagement`, `chrome-extension`, `content-moderation`, `twitter`
- **GitHub Discussions enabled**: Community Q&A channel open

### Stats
- 30 tests passing
- 88% test coverage
- Docker: `docker compose up` - fully working end-to-end

---

## v0.2.0 (2026-02-23) - Hardening & Reliability

**Phase 2 complete.** Production-grade classification pipeline with async processing, batch API, enriched content extraction, and comprehensive test coverage.

### Classification Pipeline

- **Async pipeline**: Replaced synchronous `requests` with `httpx.AsyncClient` and connection pooling
- **Batch classification**: Extension now uses `/classify/batch` instead of individual requests
- **Retry logic**: Automatic 1-retry with 2s backoff on transient Ollama failures
- **Ollama JSON mode**: Uses `format: "json"` to force valid JSON output

### Content Extraction (Extension)

- **Author name**: Extracted for richer context (helps detect quote-tweet mockery)
- **Video tweets**: Detected and classified even without text content
- **Poll options**: Extracted as classification context (often engagement bait)
- **Social context**: "X liked" / "X retweeted" banners included
- **Reprocessing loop**: New tweets that appear during classification are no longer dropped

### Cache & Performance

- **Server-side LRU cache** with configurable TTL (default 300s) and max size
- **Client-side cache** with full content hash keys and LRU eviction
- **200ms debounce** for faster tweet pickup on scroll

### Security & Resilience

- **Prompt injection mitigation**: User content wrapped in `<content>` XML tags
- **Confidence clamping**: Values outside 0.0-1.0 are clamped
- **CORS restricted** to `chrome-extension://` and localhost origins
- **Content length validation** on API endpoints (max 2000 chars)

### Extension UX

- **Tags on all tweets**: Every classified tweet shows its intent label
- **Blur/hide gated by threshold**: Only aggressive treatments respect the sensitivity slider
- **Reactive settings**: `chrome.storage.onChanged` applies settings without page reload
- **Processing lock**: No more duplicate classifications from concurrent observers

### Testing

- **30 tests** covering classifier, API endpoints, cache behavior, edge cases, and batch processing
- Integration tests using `httpx.AsyncClient` with ASGI transport

### Config

- **MIN_CONTENT_LENGTH aligned** between server (20) and extension (20)
- **Default model** updated to `mistral:7b-instruct` in `.env.example`
- **All `.env` variables** wired up (`OLLAMA_TEMPERATURE`, `CACHE_TTL`, `CACHE_MAX_SIZE`)

---

## v0.1.0 (2026-02-06) -Initial Release

**"A digital bodyguard for the mind."**

Phase 1 complete. Core classification engine and Chrome extension for Twitter/X.

### Core Features
- **Intent Classification**: Local LLM-based classification via Ollama
- **7 Intent Categories**: ragebait, fearmongering, hype, engagement_bait, divisive, genuine, neutral
- **FastAPI Server**: Local classification API at `localhost:8420`
- **Chrome Extension**: Manifest V3 extension for Twitter/X
- **YAML Configuration**: Intent definitions and few-shot examples in `scenarios/intents.yaml`

### Classification Engine
- **IntentClassifier class**: Core classification logic with Ollama integration
- **Few-shot learning**: Examples improve accuracy across intent categories
- **Fail-open design**: Classification failures pass content through (never blocks by mistake)
- **Batch classification**: `/classify/batch` endpoint for efficiency

### Browser Extension
- **Content interception**: Intercepts tweets before rendering
- **Visual treatments**: Blur (ragebait), Tag (fearmongering/hype/divisive), Hide (engagement_bait)
- **Sensitivity slider**: User-configurable manipulation threshold (30-90%)
- **Settings popup**: Toggle features on/off, check server status

### API Endpoints
- `POST /classify` -Classify single content
- `POST /classify/batch` -Classify multiple items
- `GET /health` -Server and Ollama status
- `GET /intents` -Current intent definitions

### Stats
- **12 tests passing**
- Local-first, no external API calls
- All processing on user's device

---

*"The content isn't the problem. The intent behind it is."*
