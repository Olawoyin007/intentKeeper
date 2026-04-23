<p align="center">
  <img src="assets/logo.png" alt="intentKeeper" width="180">
</p>

<h1 align="center">intentKeeper</h1>

<p align="center"><strong>A digital bodyguard for your mind.</strong></p>

<p align="center">
  <!-- Project -->
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-0.4.0-green.svg" alt="Version: 0.4.0">
  <img src="https://img.shields.io/badge/accuracy-98%25-brightgreen.svg" alt="Accuracy: 98%">
</p>
<p align="center">
  <!-- Platforms -->
  <img src="https://img.shields.io/badge/platform-Twitter%2FX-1DA1F2.svg" alt="Platform: Twitter/X">
  <img src="https://img.shields.io/badge/platform-YouTube-FF0000.svg" alt="Platform: YouTube">
  <img src="https://img.shields.io/badge/platform-Reddit-FF4500.svg" alt="Platform: Reddit">
</p>
<p align="center">
  <!-- Tech -->
  <img src="https://img.shields.io/badge/python-3.10%2B-blue.svg" alt="Python: 3.10+">
  <img src="https://img.shields.io/badge/local--first-Ollama-orange.svg" alt="Local-First: Ollama">
  <img src="https://img.shields.io/badge/browser-Chrome%20%7C%20Brave%20%7C%20Edge%20%7C%20Opera-4285F4.svg" alt="Browser: Chrome, Brave, Edge, Opera">
</p>

There are hundreds of tools that block, hide, or filter social media. IntentKeeper is the only one that surfaces the manipulation patterns behind content - and lets you decide what to do with them.

Ragebait, fearmongering, hype, divisive framing - all detected by the patterns they use, not the topics they cover, before they affect you. Everything runs on your hardware via Ollama. No cloud. No tracking. No data leaving your machine.

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

IntentKeeper classifies the **manipulation patterns** in content - not the topics themselves. It doesn't censor subjects. It flags the framing patterns associated with ragebait, fearmongering, divisive content, and hype before they land.

**Accuracy**: 98% on an 80-example labeled eval set (measured 2026-04-09). The remaining 2% are at the model's training boundary - prompt engineering cannot resolve them without breaking other cases. Classification confidence is shown alongside each label so you know when the model is uncertain.

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

1. Open your browser and go to the extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder

Then open [Twitter/X](https://twitter.com), [YouTube](https://youtube.com), or [Reddit](https://reddit.com) and scroll your feed. Intent labels appear on content automatically.

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
You open Twitter/X, YouTube, or Reddit
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

*"Protect your attention. Notice what a post is doing to you, not just what it's about."*
