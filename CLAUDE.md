# CLAUDE.md

> **Before any PR**: read `MERGE_CHECKLIST.md`
> **Before any release**: run `python3 scripts/check_version.py`

## Project Overview

intentKeeper is a local-first content filter that classifies social media content by its
underlying **intent** - ragebait, fearmongering, hype, or genuine insight. It runs entirely
on local hardware via Ollama. No external API calls, no telemetry, no cloud.

**Core philosophy**: "The content isn't the problem. The intent behind it is."

## Development Commands

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Start the classification server
intentkeeper-server
# or
uvicorn server.api:app --reload --port 8420

# Run unit tests (93 tests, Ollama not required - all mocked)
pytest tests/

# Run tests with coverage
pytest tests/ --cov=server

# Run the classification eval (requires Ollama running)
python eval/run_eval.py
python eval/run_eval.py --verbose          # show every item
python eval/run_eval.py --filter ragebait  # one intent only

# Version consistency check
python3 scripts/check_version.py

# Linting and formatting
ruff check server/
ruff check --fix server/
black server/
```

## Required Environment Variables

Configure in `.env` (see `.env.example`):

**Required:**
- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `mistral:7b-instruct`)

**Optional:**
- `OLLAMA_TEMPERATURE` - LLM temperature (default: `0.1`)
- `OLLAMA_SEED` - Pin sampling seed for reproducible output (unset = non-deterministic)
- `OLLAMA_VISION_MODEL` - Vision model for image/thumbnail analysis (e.g. `moondream`, `llava:7b`); when unset, image analysis is skipped and only text is classified
- `INTENTKEEPER_HOST` - Server bind address (default: `127.0.0.1`)
- `INTENTKEEPER_PORT` - Server port (default: `8420`)
- `MANIPULATION_THRESHOLD` - Score threshold for treatments (default: `0.6`)
- `CACHE_TTL` - Cache time-to-live in seconds (default: `300`)
- `CACHE_MAX_SIZE` - Max LRU cache entries (default: `1000`)
- `DEBUG` - Enable debug logging (default: `false`)

## Key Design Constraints

These are non-negotiable. Every feature decision should be checked against them.

- All classification must remain local — no external API calls, ever
- No telemetry, engagement metrics, or behaviour tracking
- Fail-open: errors pass content through, never block or hide
- Intent over topic: classify framing, not subject matter
- User sovereignty: configurable thresholds, per-intent toggles, everything revealable
- Transparency: every classification includes reasoning

## Eval Harness

`eval/test_set.yaml` is a labeled test set of 105 examples used to measure
classification accuracy. `eval/run_eval.py` runs them through the classifier and reports
per-intent accuracy and wrong classifications.

**Current baseline: 96% accuracy** (101/105 with `llama3.1:8b`, measured 2026-07-10). Most
remaining misses are deliberately included boundary cases. The harness reads `OLLAMA_MODEL`
from the environment - it does not auto-load `.env`.

**Rule: run the eval before AND after any change to `scenarios/intents.yaml`.**

```bash
python eval/run_eval.py           # get baseline
# make changes to scenarios/intents.yaml
python eval/run_eval.py           # measure improvement
# only commit if accuracy >= baseline
```

The 2 remaining wrong classifications are at the model-training boundary:
- `Millennials ruined the housing market. It's really that simple.` - model reads 'really
  that simple' as contemptuous; requires fine-tuning to fix
- `People who recline their airplane seat are inconsiderate. Change my mind.` - model reads
  'Change my mind' as contempt language; prompt rules cannot reliably override this

Further improvement requires fine-tuning, not prompt engineering.

## Testing

```
tests/
├── test_classifier.py       # 93 tests: classifier, API endpoints, cache, edge cases, concurrency
├── test_eval.py             # Eval harness validation
└── test_reddit_adapter.py   # Reddit DOM adapter structural tests

extension/tests/             # Jest tests (Ollama not required)
├── core.test.js             # Shared classifier engine
├── twitter.test.js          # Twitter/X adapter
└── youtube.test.js          # YouTube adapter
```

## Architecture Reference

Full details are in the docs — do not duplicate them here.

| Topic | Reference |
|-------|-----------|
| System diagram, classification flow, component relationships | `docs/architecture.md` |
| Intent categories, visual treatments, fail-open design | `docs/architecture.md` |
| Model benchmarks | `docs/model-benchmark.md` |
| Setup guide and troubleshooting | `docs/usage.md` |
| Trust boundary and known security gaps | `THREAT_MODEL.md` |
| Pre-merge checklist | `MERGE_CHECKLIST.md` |

**Before modifying `server/classifier.py` or `server/api.py`: read `docs/architecture.md`
first.** Changes to the classification pipeline or API surface that contradict it without
updating it introduce silent inconsistency.

## Key Patterns

Patterns that affect coding decisions — not obvious from reading the code.

**`<content>` tag boundary** (`server/classifier.py`): Social media content sent to the LLM
is wrapped in `<content>...</content>` tags before the classification prompt is formatted.
The prompt instructs the LLM not to follow any instructions inside the tags. This limits
prompt injection from adversarial page content — intentKeeper's input comes from potentially
hostile third parties, unlike empathySync where input is the user's own typing.

**`ALLOWED_IMAGE_DOMAINS` allowlist** (`server/classifier.py`): When vision classification
is enabled, image URLs are validated against a fixed domain allowlist before any fetch is
made. A malicious tweet can include arbitrary URLs; the allowlist ensures only known platform
CDN domains are ever fetched. Do not widen this list without understanding the SSRF surface.

**Corrections validated before prompt injection** (`server/classifier.py`): User label
corrections are checked against `valid_intents` before being injected as few-shot examples.
Corrections with unknown intent labels are silently dropped. This prevents prompt injection
via the corrections mechanism.

**Fail-open at the call site** (`server/classifier.py`): `classify()` catches all exceptions
and returns `intent="neutral", action="pass"` rather than re-raising. Callers never handle
errors — content always gets a result. This is a deliberate design constraint, not a gap to
fill.

**`_validate_ollama_host()` enforces localhost at construction** (`server/classifier.py`):
The classifier refuses to initialise if `OLLAMA_HOST` is not a localhost address. Checked
once at startup via the lifespan handler in `server/api.py`.

## Documentation Maintenance

**Rule: docs must be updated before merging any PR that changes behaviour, structure, or
features. Never leave docs stale.**

| Document | Update when |
|----------|-------------|
| `README.md` | New features, browser support changes, accuracy baseline changes, new platform |
| `ROADMAP.md` | Phase completed - mark ✅; new phase planned - add entry |
| `docs/architecture.md` | API endpoints change, new platform adapter, browser support changes |
| `CLAUDE.md` (this file) | Eval baseline changes, new env vars, new key patterns |

### Per-change checklist

**New platform supported:**
- [ ] `docs/architecture.md` - update High-Level Overview (browser line, Extension section)
- [ ] `ROADMAP.md` - mark phase ✅
- [ ] `README.md` - supported platforms list
- [ ] `CLAUDE.md` - if new files added to directory structure

**Intent categories changed:**
- [ ] `docs/architecture.md` - Intent Categories section
- [ ] `eval/test_set.yaml` - add/update examples
- [ ] Run eval before and after

**Eval baseline changes:**
- [ ] `CLAUDE.md` - update baseline percentage and date above

**New browser support:**
- [ ] `docs/architecture.md` - "Browser" line in High-Level Overview
- [ ] `README.md` - browser badge and install instructions

## Roadmap

Phases 1-6, 8.1 complete. See `ROADMAP.md` for full history.

Current version: check `pyproject.toml` (source of truth).
Run `python3 scripts/check_version.py` to verify all files are in sync.

Phase 8.2 (Firefox support) is the next planned phase. Phase 7 (Statistics
Dashboard) is deferred pending manifesto reconciliation - see ROADMAP.md.
