# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentKeeper is a local-first content filter that classifies online content by its underlying **intent** — ragebait, fearmongering, hype, or genuine insight. It runs entirely on local hardware via Ollama integration.

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

# Run tests (12 tests)
pytest tests/

# Run tests with coverage
pytest tests/ --cov=server

# Linting and formatting
black server/
flake8 server/
```

## Required Environment Variables

Configure in `.env` file (see `.env.example`):

**Required:**
- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `llama3.2`)

**Optional:**
- `INTENTKEEPER_HOST` - Server bind address (default: `127.0.0.1`)
- `INTENTKEEPER_PORT` - Server port (default: `8420`)
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
├── tests/                       # Pytest test suite (12 tests)
├── docs/                        # Documentation
├── pyproject.toml              # Package metadata, dependencies, entry points
└── .env.example                # Environment template
```

### Core Components

**Server** (`server/`):
- [server/api.py](server/api.py) - FastAPI application with endpoints:
  - `POST /classify` — Classify single content
  - `POST /classify/batch` — Classify multiple items (max 50)
  - `GET /health` — Server and Ollama health check
  - `GET /intents` — Current intent definitions
- [server/classifier.py](server/classifier.py) - `IntentClassifier` class:
  - Loads intent definitions from YAML
  - Builds classification prompts with few-shot examples
  - Calls Ollama API for classification
  - Parses LLM response into `ClassificationResult`

**Extension** (`extension/`):
- [extension/content.js](extension/content.js) - Content script that:
  - Observes DOM for new tweets
  - Sends content to local API for classification
  - Applies visual treatments based on result
- [extension/background.js](extension/background.js) - Service worker:
  - Manages settings in `chrome.storage.local`
  - Periodic health checks (badge indicator)
- [extension/popup/](extension/popup/) - Settings UI:
  - Enable/disable toggle
  - Show tags, blur ragebait, hide engagement bait toggles
  - Sensitivity slider (manipulation threshold)

**Scenarios** (`scenarios/`):
- [scenarios/intents.yaml](scenarios/intents.yaml) - Intent configuration:
  - 7 intent categories with descriptions, actions, weights
  - Few-shot examples for improved accuracy
  - Classification rules for the LLM prompt

### Intent Categories

| Intent | Description | Default Action | Weight |
|--------|-------------|----------------|--------|
| `ragebait` | Designed to provoke anger/outrage | Blur | 0.9 |
| `fearmongering` | Exaggerated threats, doom content | Tag | 0.7 |
| `hype` | Manufactured urgency, FOMO triggers | Tag | 0.5 |
| `engagement_bait` | Empty interaction requests | Hide | 0.6 |
| `divisive` | Us-vs-them framing, tribal triggers | Tag | 0.7 |
| `genuine` | Authentic insight, honest perspective | Pass | 0.0 |
| `neutral` | Informational, no manipulation | Pass | 0.0 |

### Classification Flow

```
Content Intercepted (content.js)
    │
    ▼
┌─────────────────────────────────────┐
│  Length Check                        │
│  < 10 chars → neutral (skip LLM)    │
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
    intent: str           # ragebait, fearmongering, hype, engagement_bait, divisive, genuine, neutral
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

Tests are in [tests/test_classifier.py](tests/test_classifier.py) with 12 tests covering:
- Intent classification for each category
- Short content handling
- Fallback behavior on errors
- Health check endpoint
- Batch classification

### Sibling Project

IntentKeeper shares patterns with [empathySync](https://github.com/Olawoyin007/empathySync):
- Same Ollama integration approach
- YAML-driven configuration
- Classification pipeline architecture
- Local-first philosophy

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the phased implementation plan:
- Phase 1: Core classifier + Chrome extension (Twitter/X) ✅
- Phase 2: YouTube support
- Phase 3: Reddit support
- Phase 4: User-configurable sensitivity
- Phase 5: Statistics dashboard
- Phase 6: Firefox extension
