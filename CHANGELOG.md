# Changelog

All notable changes to IntentKeeper are documented here.

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
