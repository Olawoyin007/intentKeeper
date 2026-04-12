<p align="center">
  <img src="assets/logo.png" alt="IntentKeeper" width="180">
</p>

<h1 align="center">IntentKeeper</h1>

<p align="center"><strong>A digital bodyguard for your mind.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-0.4.0-green.svg" alt="Version: 0.4.0">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue.svg" alt="Python: 3.10+">
  <img src="https://img.shields.io/badge/platform-Twitter%2FX-1DA1F2.svg" alt="Platform: Twitter/X">
  <img src="https://img.shields.io/badge/platform-Reddit-FF4500.svg" alt="Platform: Reddit">
  <img src="https://img.shields.io/badge/accuracy-98%25-brightgreen.svg" alt="Accuracy: 98%">
  <img src="https://img.shields.io/badge/local--first-Ollama-orange.svg" alt="Local-First: Ollama">
</p>

There are hundreds of tools that block, hide, or filter social media. IntentKeeper is the only one that tells you *why* content is designed to manipulate you - and lets you decide what to do with it.

Ragebait, fearmongering, hype, divisive framing - are all classified by intent, not topic, before they affect you. Everything runs on your hardware via Ollama. No cloud. No tracking. No data leaving your machine.

---

<details>
<summary><strong>Why this exists</strong></summary>
<br>

Every major platform optimizes for engagement. Engagement is driven by emotion. The strongest emotions - outrage, fear, tribal identity - are the easiest to manufacture.

The result: your feed is optimized to make you angry, afraid, and divided. Not because the platform is evil, but because that's what the algorithm rewards.

IntentKeeper doesn't fix the platforms. It gives you a lens to see the manipulation before it hooks you.

</details>

## The Idea

> "The content isn't the problem. The intent behind it is."

https://github.com/user-attachments/assets/8982dc1c-227b-4695-97ef-4fdfd91cf45c

A post about politics can be thoughtful analysis or manufactured outrage. A health tip can be genuine advice or fearmongering. Same topic, opposite effect on your wellbeing.

IntentKeeper classifies the **intent** behind the words - not the words themselves. It doesn't censor topics. It surfaces manipulation.

## Quick Start

### Part 1 - Server

**Option A: Docker (recommended)**

```bash
git clone https://github.com/Olawoyin007/intentKeeper.git
cd intentKeeper
docker compose up
```

This starts Ollama and the classification server together. The model pulls automatically on first run.

**Option B: Manual**

```bash
git clone https://github.com/Olawoyin007/intentKeeper.git
cd intentKeeper
pip install -e .
cp .env.example .env
intentkeeper-server
```

**Ollama powers the classification.** Any model works - `mistral:7b-instruct`, `llama3.2`, `phi3`, whatever you have. Set it in `.env` and the server pulls it automatically on first start if it is not already present:

```bash
OLLAMA_MODEL=your-model-name
```

Don't have Ollama yet? [Install it here](https://ollama.com) - it runs entirely on your hardware, no cloud required.

### Part 2 - Extension

1. Open Chrome or Brave and go to `chrome://extensions` (Chrome) or `brave://extensions` (Brave)
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder

Then open [twitter.com](https://twitter.com) or [x.com](https://x.com) and scroll your feed. Intent labels appear on every tweet automatically.

See [docs/usage.md](docs/usage.md) for the full setup guide and troubleshooting.

## What It Detects

| Intent | What It Looks Like | What Happens |
|--------|-------------------|--------------|
| **Ragebait** | "This is EXACTLY why I hate [group]. Every. Single. Time." | Blurred with reveal button |
| **Fearmongering** | "Society is COLLAPSING. Get out while you still can." | Tagged with label |
| **Hype** | "This AI tool changes EVERYTHING. You're missing out!" | Tagged with label |
| **Engagement bait** | "Reply with your favorite X and I'll tell you Y!" | Hidden (expandable) |
| **Divisive** | "People who don't do X are just lazy. Winners have discipline." | Tagged with label |
| **Genuine** | "I've dealt with anxiety for 10 years. Here's what helped me." | Passes through unmodified |

## How It Works

```
You open Twitter/X or Reddit
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

<details>
<summary><strong>Principles</strong></summary>
<br>

**Intent over topic.** We classify the framing, not the subject matter.

**Fail-open.** When classification fails, content passes through unchanged.

**Local-first.** All classification on your device. Nothing leaves your machine.

**User sovereignty.** You control what gets filtered and how aggressively.

**Transparency.** Every classification shows *why* content was flagged.

See [MANIFESTO.md](MANIFESTO.md) for the full principles.

</details>

## Documentation

- [docs/usage.md](docs/usage.md) - Setup guide and troubleshooting
- [docs/architecture.md](docs/architecture.md) - System diagrams
- [ROADMAP.md](ROADMAP.md) - Phased implementation plan
- [CHANGELOG.md](CHANGELOG.md) - Release history
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [MANIFESTO.md](MANIFESTO.md) - Core principles

Also built alongside [empathySync](https://github.com/Olawoyin007/empathySync) - a local-first AI wellness assistant sharing the same philosophy.

## License

MIT - see [LICENSE](LICENSE).

---

*"Protect your attention. Ask what a post is trying to do, not just what it's about."*
