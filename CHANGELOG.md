# Changelog

All notable changes to IntentKeeper are documented here.

## v0.2.0 (2026-02-23) — Hardening & Reliability

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

## v0.1.0 (2026-02-06) — Initial Release

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
- `POST /classify` — Classify single content
- `POST /classify/batch` — Classify multiple items
- `GET /health` — Server and Ollama status
- `GET /intents` — Current intent definitions

### Stats
- **12 tests passing**
- Local-first, no external API calls
- All processing on user's device

---

*"The content isn't the problem. The intent behind it is."*
