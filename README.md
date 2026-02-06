# IntentKeeper

**A digital bodyguard for your mind.**

IntentKeeper is a local-first content filter that classifies online content by its underlying intent — ragebait, fearmongering, hype, or genuine insight. It helps you consume content mindfully by surfacing manipulation before it affects you.

## Philosophy

> "The content isn't the problem. The intent behind it is."

A post about politics can be thoughtful analysis or manufactured outrage. Same topic, opposite effect on your wellbeing. IntentKeeper classifies the *energy* of content, not its subject matter.

## How It Works

```
Browser Extension → Local API Server → Ollama LLM → Classification Result
     ↓                                                      ↓
Intercepts content                                   Blur/tag/pass
before you see it                                    based on intent
```

All processing happens locally via Ollama. No cloud, no data collection, no tracking.

## Intent Categories

| Intent | Description | Default Action |
|--------|-------------|----------------|
| `ragebait` | Designed to provoke anger/outrage | Blur + warning |
| `fearmongering` | Exaggerated threats, doom content | Tag |
| `hype` | Manufactured urgency, FOMO triggers | Tag |
| `engagement_bait` | "Reply with your X!", empty interaction | Hide |
| `divisive` | Us-vs-them framing, tribal triggers | Tag |
| `genuine` | Authentic insight, honest perspective | Pass |
| `neutral` | Informational, no manipulation | Pass |

## Quick Start

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.ai) running locally with a model (e.g., `llama3.2`)
- Chrome/Chromium browser

### 1. Start the Classification Server

```bash
cd intentKeeper
pip install -e .
intentkeeper-server
# Server runs at http://localhost:8420
```

### 2. Install the Browser Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder

### 3. Browse Mindfully

The extension will automatically classify content on supported sites (Twitter/X initially).

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
INTENTKEEPER_PORT=8420
```

## Project Structure

```
intentKeeper/
├── extension/           # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content.js       # Intercepts page content
│   ├── background.js    # Service worker
│   └── popup/           # Extension popup UI
├── server/              # Local classification API
│   ├── api.py           # FastAPI server
│   └── classifier.py    # Intent classifier
├── scenarios/           # Intent definitions (YAML)
│   └── intents.yaml
├── tests/
└── docs/
```

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/

# Run server in development mode
uvicorn server.api:app --reload --port 8420
```

## Roadmap

- [x] Phase 1: Core classifier + Chrome extension (Twitter/X)
- [ ] Phase 2: YouTube support (titles, descriptions, comments)
- [ ] Phase 3: Reddit support
- [ ] Phase 4: User-configurable sensitivity levels
- [ ] Phase 5: Statistics dashboard (local only)
- [ ] Phase 6: Firefox extension

## Sibling Project

IntentKeeper shares classification patterns with [empathySync](https://github.com/Olawoyin007/empathySync), a local-first wellness assistant. Both projects prioritize:

- **Local-first**: All processing on your device
- **Privacy**: No telemetry, no cloud, no tracking
- **Restraint**: Technology that respects your attention

## License

MIT
