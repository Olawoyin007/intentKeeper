# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentKeeper is a local-first content filter that classifies online content by its underlying **intent** -ragebait, fearmongering, hype, or genuine insight. It runs entirely on local hardware via Ollama integration.

**Core Philosophy**: "The content isn't the problem. The intent behind it is."

A post about politics can be thoughtful analysis OR manufactured outrage. Same topic, opposite effect on your wellbeing. IntentKeeper classifies the *energy* of content, not its subject matter.

## Development Commands

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Start the classification server
intentkeeper-server
# or
uvicorn server.api:app --reload --port 8420

# Run unit tests (58 tests, Ollama not required - all mocked)
pytest tests/

# Run tests with coverage
pytest tests/ --cov=server

# Run the classification eval against the labeled test set (requires Ollama running)
python eval/run_eval.py
python eval/run_eval.py --verbose          # show every item
python eval/run_eval.py --filter ragebait  # one intent only

# Linting and formatting
ruff check server/
ruff check --fix server/
black server/
```

## Eval Harness - IMPORTANT

`eval/test_set.yaml` is a labeled test set of 48 examples (8 per intent) used to measure classification accuracy. `eval/run_eval.py` runs them through the classifier and reports per-intent accuracy and wrong classifications.

**Current baseline: 90% accuracy** (43/48 correct, measured 2026-04-05).

**Rule: run the eval before AND after any change to `scenarios/intents.yaml`.**

This includes changes to intent definitions, few-shot examples, or classification rules. Without this, you have no way to know if a change helped or hurt. The wrong classifications list tells you exactly what to fix next.

```bash
# Workflow for improving classification quality:
python eval/run_eval.py           # get baseline
# make changes to scenarios/intents.yaml
python eval/run_eval.py           # measure improvement
# only commit if accuracy is >= baseline
```

The 5 remaining wrong classifications (10%) are genuine hard cases at the ragebait/divisive and hype/genuine boundaries. Further prompt changes are likely to cause regressions. Expand the test set first if you want to improve further.

## Required Environment Variables

Configure in `.env` file (see `.env.example`):

**Required:**
- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `mistral:7b-instruct`)

**Optional:**
- `OLLAMA_TEMPERATURE` - LLM temperature (default: `0.1`)
- `INTENTKEEPER_HOST` - Server bind address (default: `127.0.0.1`)
- `INTENTKEEPER_PORT` - Server port (default: `8420`)
- `MANIPULATION_THRESHOLD` - Score threshold for treatments (default: `0.6`)
- `CACHE_TTL` - Cache time-to-live in seconds (default: `300`)
- `CACHE_MAX_SIZE` - Max LRU cache entries (default: `1000`)
- `DEBUG` - Enable debug logging (default: `false`)

## Architecture

### Directory Structure

```
intentKeeper/
├── server/                      # Local classification API
│   ├── api.py                  # FastAPI server, endpoints, lifespan
│   └── classifier.py           # IntentClassifier class, Ollama integration
├── extension/                   # Chrome extension (Manifest V3)
│   ├── manifest.json           # Extension manifest
│   ├── content.js              # Content script (intercepts tweets)
│   ├── background.js           # Service worker (health checks, settings)
│   ├── styles.css              # Visual treatments (blur, tag, hide)
│   └── popup/                  # Extension popup UI
│       ├── popup.html
│       └── popup.js
├── scenarios/                   # Configuration (YAML)
│   └── intents.yaml            # Intent definitions, few-shot examples, rules
├── tests/                       # Pytest test suite (30 tests)
├── docs/                        # Documentation
├── pyproject.toml              # Package metadata, dependencies, entry points
└── .env.example                # Environment template
```

### Core Components

**Server** (`server/`):
- [server/api.py](server/api.py) - FastAPI application with endpoints:
  - `POST /classify` -Classify single content
  - `POST /classify/batch` -Classify multiple items (max 50)
  - `GET /health` -Server and Ollama health check
  - `GET /intents` -Current intent definitions
- [server/classifier.py](server/classifier.py) - `IntentClassifier` class:
  - Loads intent definitions from YAML
  - Builds classification prompts with few-shot examples
  - Calls Ollama API for classification
  - Parses LLM response into `ClassificationResult`

**Extension** (`extension/`):
- [extension/content.js](extension/content.js) - Content script that:
  - Observes DOM for new tweets via MutationObserver (200ms debounce)
  - Extracts tweet text, author, video context, polls, social context
  - Sends batches to background worker for classification
  - Applies visual treatments (tags on all tweets, blur/hide gated by threshold)
  - Client-side LRU cache with content hash keys
- [extension/background.js](extension/background.js) - Service worker:
  - Proxies API calls to localhost (avoids Private Network Access blocking)
  - Batch classification via `/classify/batch` endpoint
  - Manages settings in `chrome.storage.local`
  - Periodic health checks (20s interval, badge indicator)
- [extension/popup/](extension/popup/) - Settings UI:
  - Enable/disable toggle
  - Show tags, blur ragebait, hide engagement bait toggles
  - Sensitivity slider (manipulation threshold)

**Scenarios** (`scenarios/`):
- [scenarios/intents.yaml](scenarios/intents.yaml) - Intent configuration:
  - 6 intent categories with descriptions, actions, weights
  - 19 few-shot examples with reasoning (not just labels - reasoning teaches decision logic)
  - Classification rules including explicit boundary rules for hard cases

**Eval** (`eval/`):
- [eval/test_set.yaml](eval/test_set.yaml) - 48 labeled examples, 8 per intent, weighted toward boundary cases
- [eval/run_eval.py](eval/run_eval.py) - Eval runner: per-intent accuracy, wrong classification list

### Intent Categories

6 intents (consolidated from 9 in v2 - engagement_bait absorbed reaction_farming, hype absorbed clickbait, genuine absorbed neutral):

| Intent | Description | Default Action | Weight |
|--------|-------------|----------------|--------|
| `ragebait` | Engineered to provoke anger/outrage | Blur | 0.9 |
| `fearmongering` | Exaggerated threats, vague doom without sources | Tag | 0.7 |
| `hype` | Manufactured urgency, FOMO, clickbait titles | Tag | 0.5 |
| `engagement_bait` | Engineered for metrics - likes, replies, comment warfare | Hide | 0.6 |
| `divisive` | Us-vs-them framing, group sorting, tribal triggers | Tag | 0.7 |
| `genuine` | Authentic content, honest perspective, factual info | Pass | 0.0 |

### Classification Flow

```
Content Intercepted (content.js)
    │
    ▼
┌─────────────────────────────────────┐
│  Length Check                        │
│  < 20 chars → neutral (skip LLM)    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Build Classification Prompt         │
│  - Intent descriptions               │
│  - Few-shot examples                 │
│  - Classification rules              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Ollama API Call                     │
│  - Temperature: 0.1 (deterministic)  │
│  - Max tokens: 150 (short response)  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Parse JSON Response                 │
│  {intent, confidence, reasoning}     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Calculate Action                    │
│  - Look up action from intents.yaml  │
│  - Apply manipulation threshold      │
│  - Return ClassificationResult       │
└─────────────────────────────────────┘
    │
    ▼
Apply Visual Treatment (content.js)
```

### ClassificationResult

```python
@dataclass
class ClassificationResult:
    intent: str           # ragebait, fearmongering, hype, engagement_bait, divisive, genuine
    confidence: float     # 0.0 to 1.0
    reasoning: str        # Brief explanation from LLM
    action: str           # blur, tag, hide, pass
    manipulation_score: float  # weight × confidence
```

### Visual Treatments

| Action | CSS Effect | User Experience |
|--------|------------|-----------------|
| `blur` | `filter: blur(5px)` + overlay | Content obscured, click to reveal |
| `tag` | Badge with intent label | Visible but labeled |
| `hide` | `display: none` | Collapsed, expandable |
| `pass` | No change | Normal display |

### Extension Settings (chrome.storage.local)

```javascript
{
  enabled: true,              // Master toggle
  showTags: true,             // Show intent labels
  blurRagebait: true,         // Blur high-manipulation content
  hideEngagementBait: true,   // Collapse empty interactions
  manipulationThreshold: 0.6  // 0.3-0.9 sensitivity slider
}
```

### Error Handling

**Fail-open design**: If classification fails for any reason, content passes through unchanged. This ensures:
- Broken server doesn't block browsing
- Network issues don't hide content
- Model errors don't cause false positives

```python
except Exception as e:
    # Fail open - don't block content if classification fails
    return ClassificationResult(
        intent="neutral",
        confidence=0.0,
        reasoning=f"Classification failed: {str(e)}",
        action="pass",
        manipulation_score=0.0,
    )
```

### Key Design Principles

1. **Local-first**: All processing on user's device via Ollama
2. **Privacy**: No telemetry, no cloud, no tracking
3. **Fail-open**: Errors pass content through, never block
4. **Intent over topic**: Political content can be genuine OR manipulative
5. **User control**: Configurable thresholds and toggles
6. **Transparency**: Show reasoning for classifications

### Testing

Tests are in [tests/test_classifier.py](tests/test_classifier.py) with 58 tests covering:
- Intent classification for each category
- Short content handling and min-length boundary
- Fallback behavior on errors (fail-open)
- Health check endpoint (healthy and degraded)
- Batch classification and concurrency
- Cache behavior (TTL expiration, LRU eviction)
- Edge cases (long content, unicode, confidence clamping)
- API endpoint validation (empty content, max length)
- Retry on transient Ollama failures

### Sibling Project

IntentKeeper shares patterns with [empathySync](https://github.com/Olawoyin007/empathySync):
- Same Ollama integration approach
- YAML-driven configuration
- Classification pipeline architecture
- Local-first philosophy

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the phased implementation plan:
- Phase 1: Core classifier + Chrome extension (Twitter/X) ✅
- Phase 2: Hardening & reliability ✅
- Phase 3: YouTube support
- Phase 4: Reddit support
- Phase 5: Classification accuracy
- Phase 6: User-configurable sensitivity
- Phase 7: Statistics dashboard
- Phase 8: Multi-browser support (Brave, Edge, Opera, Firefox)
