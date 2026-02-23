# Usage Guide

This guide explains how to use IntentKeeper day-to-day.

## Getting Started

### Prerequisites

1. **Ollama** installed and running with a model:
   ```bash
   # Install Ollama (https://ollama.ai)
   ollama pull mistral:7b-instruct
   ollama serve
   ```

2. **Python 3.10+** installed

3. **Chrome** or Chromium-based browser

### Starting the Server

```bash
cd intentKeeper
pip install -e .
intentkeeper-server
```

The server runs at `http://localhost:8420`. You should see:
```
Starting IntentKeeper server on 127.0.0.1:8420
Ollama connection OK (http://localhost:11434)
```

### Installing the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from the IntentKeeper directory
5. The IntentKeeper shield icon appears in your toolbar

### Verify It Works

1. Visit [twitter.com](https://twitter.com) or [x.com](https://x.com)
2. Scroll through your feed
3. Look for intent labels, blurred content, or hidden posts
4. Click the toolbar icon to check connection status

## The Extension Popup

Click the shield icon in your Chrome toolbar to access settings.

### Connection Status

At the top, you'll see the connection indicator:
- **Green dot**: Server connected, Ollama running
- **Red dot**: Server unreachable (check if `intentkeeper-server` is running)

### Settings

| Setting | Default | What It Does |
|---------|---------|--------------|
| **Enable filtering** | On | Master toggle for all classification |
| **Show intent tags** | On | Display labels on detected content |
| **Blur ragebait** | On | Blur high-manipulation content |
| **Hide engagement bait** | On | Collapse empty interaction requests |

### Sensitivity Slider

The sensitivity slider (30%-90%) controls the **manipulation threshold**:
- **30% (Strict)**: Flags more content, more false positives
- **60% (Default)**: Balanced filtering
- **90% (Relaxed)**: Only flags high-confidence manipulation

The threshold is compared against the `manipulation_score` (intent weight x confidence). Content below the threshold passes through.

## What You'll See

### Blurred Content (Ragebait)

High-manipulation content appears blurred with an overlay:
```
┌─────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│    Ragebait detected — click to reveal   │
│              [Show anyway]               │
└─────────────────────────────────────────┘
```

Click **Show anyway** to reveal the content. The blur is removed and you can read normally.

### Tagged Content (Fearmongering, Hype, Divisive)

Lower-manipulation content gets a small label:
```
[Fear-mongering] The original tweet text is fully
visible with a small badge at the top.
```

Hover over the tag to see the confidence percentage.

### Hidden Content (Engagement Bait)

Empty interaction requests are collapsed:
```
▶ Hidden: Engagement Bait [Show]
```

Click **Show** to expand.

### Passed Content (Genuine, Neutral)

Genuine and neutral content displays normally with an intent tag (when tags are enabled), so you can always see that classification is working.

## Intent Categories

| Intent | What It Detects | Visual Treatment |
|--------|----------------|------------------|
| **Ragebait** | Content designed to provoke anger or outrage | Blur + reveal button |
| **Fearmongering** | Exaggerated threats, doom language | Tag label |
| **Hype** | Manufactured urgency, FOMO triggers | Tag label |
| **Engagement Bait** | "Reply with your X!", empty interactions | Collapsed/hidden |
| **Divisive** | Us-vs-them framing, tribal triggers | Tag label |
| **Genuine** | Authentic insight, honest perspective | Pass (no change) |
| **Neutral** | Informational, no manipulation | Pass (no change) |

## How Classification Works

IntentKeeper focuses on **how** content is framed, not the topic:

- A political post with nuanced analysis → **genuine**
- A political post with inflammatory language → **ragebait**
- A health tip sharing personal experience → **genuine**
- A health warning using scare tactics → **fearmongering**

The same topic can be classified differently based on its framing and intent.

## Troubleshooting

### Extension shows "Disconnected"

1. Check if the server is running:
   ```bash
   curl http://localhost:8420/health
   ```
2. If not, start it:
   ```bash
   intentkeeper-server
   ```

### Ollama not connected

1. Check if Ollama is running:
   ```bash
   ollama list
   ```
2. If not, start it:
   ```bash
   ollama serve
   ```
3. Verify your model is downloaded:
   ```bash
   ollama pull mistral:7b-instruct
   ```

### No content being classified

1. Check the extension is enabled (popup toggle)
2. Make sure you're on twitter.com or x.com
3. Check the browser console for errors (`F12` → Console)
4. Very short tweets (< 20 characters) are skipped

### Classification is slow

Classification speed depends on your hardware and model:
- **Small models** (3B): ~1-3 seconds per tweet
- **Medium models** (7B): ~3-8 seconds
- **Large models** (13B+): ~10+ seconds

Consider using a smaller model for faster classification:
```bash
# In .env
OLLAMA_MODEL=qwen2.5:3b-instruct  # ~1-3s per tweet
# or keep the default for better accuracy:
OLLAMA_MODEL=mistral:7b-instruct  # ~3-8s per tweet
```

### Too many false positives

Increase the sensitivity threshold (popup slider toward 90%). This reduces false positives but may miss some manipulation.

### Too much content getting through

Decrease the sensitivity threshold (popup slider toward 30%). This catches more manipulation but increases false positives.

## Tips

1. **Start with defaults.** The 60% threshold is a good balance for most users.

2. **Adjust per your tolerance.** If you prefer to see everything and just want labels, turn off blur/hide and keep tags on.

3. **The server must be running.** IntentKeeper needs the local server. If it stops, content just passes through (fail-open design).

4. **Check classifications you disagree with.** The reasoning field (visible in console/API) explains why content was classified a certain way. Use it to calibrate your trust.

5. **Smaller models = faster.** If speed matters more than accuracy, use a 3B model. If accuracy matters more, use 7B+.

## API Reference

The server exposes a REST API. Useful for debugging or building integrations.

### Classify Content

```bash
curl -X POST http://localhost:8420/classify \
  -H "Content-Type: application/json" \
  -d '{"content": "This is EXACTLY why I hate them. Every. Single. Time."}'
```

Response:
```json
{
  "intent": "ragebait",
  "confidence": 0.85,
  "reasoning": "Inflammatory language with absolutist framing",
  "action": "blur",
  "manipulation_score": 0.765
}
```

### Health Check

```bash
curl http://localhost:8420/health
```

### Get Intent Definitions

```bash
curl http://localhost:8420/intents
```

---

*"The content isn't the problem. The intent behind it is."*
