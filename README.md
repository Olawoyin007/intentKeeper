<p align="center">
  <img src="docs/logo.png" alt="IntentKeeper" width="180">
</p>

<h1 align="center">IntentKeeper</h1>

<p align="center"><strong>A digital bodyguard for your mind.</strong></p>

IntentKeeper is a local-first content filter that classifies online content by its underlying intent — ragebait, fearmongering, hype, or genuine insight. It sits between you and your feed, surfacing manipulation before it affects you.

> **Status**: v0.2.0 — Core classification engine and Chrome extension for Twitter/X are production-ready with async pipeline, batch classification, caching, and 30+ tests.

---

## The Problem

Every major platform optimizes for engagement. Engagement is driven by emotion. The strongest emotions — outrage, fear, tribal identity — are the easiest to manufacture.

The result: your feed is optimized to make you angry, afraid, and divided. Not because the platform is evil, but because that's what the algorithm rewards.

IntentKeeper doesn't fix the platforms. It gives you a lens to see the manipulation before it hooks you.

## The Idea

> "The content isn't the problem. The intent behind it is."

A post about politics can be thoughtful analysis or manufactured outrage. A health tip can be genuine advice or fearmongering. Same topic, opposite effect on your wellbeing.

IntentKeeper classifies the **energy** behind the words — not the words themselves. It doesn't censor topics. It surfaces manipulation.

## How It Works

```
You open Twitter/X
        │
        ▼
Extension intercepts content before you read it
        │
        ▼
Local LLM classifies the intent (via Ollama)
        │
        ▼
Content is blurred, tagged, hidden, or passed through
        │
        ▼
You decide what to engage with
```

All processing happens on your machine. No cloud. No data collection. No tracking.

## What It Detects

| Intent | What It Looks Like | What Happens |
|--------|-------------------|--------------|
| **Ragebait** | "This is EXACTLY why I hate [group]. Every. Single. Time." | Blurred with reveal button |
| **Fearmongering** | "Society is COLLAPSING. Get out while you still can." | Tagged with label |
| **Hype** | "This AI tool changes EVERYTHING. You're missing out!" | Tagged with label |
| **Engagement bait** | "Reply with your favorite X and I'll tell you Y!" | Hidden (expandable) |
| **Divisive** | "People who don't do X are just lazy. Winners have discipline." | Tagged with label |
| **Genuine** | "I've dealt with anxiety for 10 years. Here's what helped me." | Passes through |
| **Neutral** | "The new transit line opens March 15. Here's the schedule." | Passes through |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Your Machine (everything stays here)                     │
│                                                           │
│  Browser ──► Extension ──► Local API ──► Ollama (LLM)    │
│                               :8420        :11434         │
│                                                           │
│  No external calls. No cloud. No telemetry.              │
└──────────────────────────────────────────────────────────┘
```

| Component | Tech | Purpose |
|-----------|------|---------|
| Extension | Chrome Manifest V3 | Intercepts content, applies visual treatments |
| Server | FastAPI (Python) | Classification API on localhost |
| Classifier | Ollama + LLM | Intent detection via local model |
| Config | YAML | Intent definitions, few-shot examples |

## Principles

**Intent over topic.** We never filter by subject matter. Political content isn't inherently manipulative. The same topic can be genuine or manufactured — we classify the framing.

**Fail-open.** When classification fails, content passes through unchanged. We will never block content because of a bug. False negatives are acceptable; false positives are not.

**Local-first.** All classification on your device. Your browsing patterns never leave your machine.

**User sovereignty.** You control what gets filtered, how aggressively, and whether it runs at all. Every blurred or hidden post can be revealed with one click.

**Transparency.** Every classification comes with a reasoning field. You can always see *why* content was flagged.

See [MANIFESTO.md](MANIFESTO.md) for the full principles.

## Roadmap

| Phase | What | Status |
|-------|------|--------|
| 1 | Core classifier + Chrome extension (Twitter/X) | Done |
| 2 | Hardening & reliability (async, cache, security, 30+ tests) | Done |
| 3 | YouTube support (titles, descriptions, comments) | Next |
| 4 | Reddit support | Planned |
| 5 | Classification accuracy improvements | Planned |
| 6 | User-configurable sensitivity per intent | Planned |
| 7 | Local statistics dashboard | Planned |
| 8 | Firefox extension | Planned |
| 9 | Advanced classification (sarcasm, multimedia) | Long-term |
| 10 | Cross-platform (desktop app, mobile) | Long-term |

See [ROADMAP.md](ROADMAP.md) for detailed phase descriptions.

## Project Structure

```
intentKeeper/
├── server/              # Classification API (FastAPI)
│   ├── api.py           # Endpoints: /classify, /health, /intents
│   └── classifier.py    # IntentClassifier + Ollama integration
├── extension/           # Chrome extension (Manifest V3)
│   ├── content.js       # Intercepts tweets, applies treatments
│   ├── background.js    # Service worker, settings, health checks
│   ├── styles.css       # Blur, tag, hide visual treatments
│   └── popup/           # Extension settings UI
├── scenarios/
│   └── intents.yaml     # Intent definitions + few-shot examples
├── tests/               # Pytest test suite
└── docs/                # Architecture, usage guide
```

## Sibling Project

IntentKeeper is a sibling to [empathySync](https://github.com/Olawoyin007/empathySync), a local-first AI wellness assistant. Both share the same philosophy:

| | empathySync | IntentKeeper |
|-|-------------|--------------|
| **Protects against** | Over-reliance on AI for emotional support | Content designed to manipulate emotions |
| **Approach** | Restraint — limits itself on sensitive topics | Transparency — labels manipulation, lets you decide |
| **Processing** | Local Ollama | Local Ollama |
| **Tracking** | None | None |

Same mission, different surface areas.

## Documentation

- [MANIFESTO.md](MANIFESTO.md) — Core principles and ethical guidelines
- [ROADMAP.md](ROADMAP.md) — Phased implementation plan
- [CLAUDE.md](CLAUDE.md) — Technical architecture reference
- [docs/architecture.md](docs/architecture.md) — Visual system diagrams
- [docs/usage.md](docs/usage.md) — User guide and troubleshooting

## License

MIT

---

*"Protect your attention. Question the energy, not the topic."*
