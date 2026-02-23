# Contributing to IntentKeeper

Thanks for your interest in contributing! IntentKeeper is a local-first content filter that classifies online content by manipulation intent. Every contribution helps protect people's attention.

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Ollama** installed and running ([ollama.ai](https://ollama.ai))
- **Chrome** or Chromium-based browser
- **Git**

### Setup

```bash
# Clone the repo
git clone https://github.com/Olawoyin007/intentKeeper.git
cd intentKeeper

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install with dev dependencies
pip install -e ".[dev]"

# Copy environment config
cp .env.example .env

# Pull the default model
ollama pull mistral:7b-instruct

# Run the test suite
pytest tests/

# Start the server
intentkeeper-server
```

### Loading the Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

## Development Workflow

### Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=server

# Run a specific test
pytest tests/test_classifier.py::TestCache -v
```

### Linting

```bash
# Check for issues
ruff check server/

# Auto-fix
ruff check --fix server/

# Format
black server/
```

### Project Structure

```
server/           # Python FastAPI backend
  api.py          # API endpoints
  classifier.py   # IntentClassifier + Ollama integration
extension/        # Chrome extension (Manifest V3)
  content.js      # DOM observer, tweet extraction, visual treatments
  background.js   # Service worker, API proxy, health checks
  popup/          # Settings UI
scenarios/        # YAML config (intent definitions, few-shot examples)
tests/            # Pytest test suite
```

## How to Contribute

### Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Python version, Ollama model, Chrome version)

### Suggesting Features

Check the [ROADMAP.md](ROADMAP.md) first — your idea might already be planned. If not, open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Which platforms it affects (Twitter, YouTube, etc.)

### Submitting Code

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests if applicable
4. Run `pytest tests/` and `ruff check server/` — both must pass
5. Write a clear commit message describing the change
6. Open a pull request

### What We're Looking For

Check the [ROADMAP.md](ROADMAP.md) for planned work. High-impact areas:

- **Platform adapters** (YouTube, Reddit) — see Phase 3 and 4
- **Classification accuracy** — better few-shot examples, edge cases
- **Test coverage** — more edge cases, integration tests
- **Documentation** — usage guides, screenshots, video demos

## Code Style

- Python: [Black](https://black.readthedocs.io/) formatting, [Ruff](https://docs.astral.sh/ruff/) linting
- JavaScript: No build step, vanilla JS, consistent with existing extension code
- Keep it simple — avoid over-engineering and unnecessary abstractions

## Design Principles

Before contributing, understand these non-negotiable principles:

1. **Local-first** — No cloud processing. Everything runs on the user's machine.
2. **Fail-open** — If classification fails, content passes through. Never block content by mistake.
3. **Intent over topic** — We classify manipulation patterns, not subject matter.
4. **Privacy** — No telemetry, no tracking, no data collection. Ever.
5. **User control** — Users decide what gets filtered and how aggressively.

See [MANIFESTO.md](MANIFESTO.md) for the full philosophy.

## Questions?

Open an issue or start a discussion. We're happy to help you get started.

---

*"The content isn't the problem. The intent behind it is."*
