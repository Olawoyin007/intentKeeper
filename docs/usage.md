# intentKeeper - Usage

## Setup

### What you need

- **Ollama** running locally - [install it here](https://ollama.com)
- **Python 3.10+**
- Chrome, Brave, Edge, or Opera

Any model that runs on Ollama works. Smaller models are faster; larger ones are more accurate:

| Model | Speed | Accuracy |
|-------|-------|----------|
| `qwen2.5:3b-instruct` | ~1-3s | Good |
| `mistral:7b-instruct` | ~3-8s | Better |
| `llama3.2` or similar | varies | Depends on model |

Pull whichever you want and set it in `.env`:

```bash
ollama pull qwen2.5:3b-instruct
```

```
OLLAMA_MODEL=qwen2.5:3b-instruct
```

### Start the server

```bash
cd intentKeeper
pip install -e .
intentkeeper-server
```

Runs at `http://localhost:8420`. The server needs to stay running while you browse.

### Load the extension

1. Go to your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

---

## The popup

Click the intentKeeper icon in your toolbar.

**Header** - the master on/off toggle is in the top-right of the header. Turning this off disables all filtering.

**Connection status** - green dot means the server and Ollama are reachable. Red means the server is unreachable (check that `intentkeeper-server` is running).

**Display settings:**

| Toggle | What it does |
|--------|--------------|
| Show intent tags | Labels classified content inline |
| Blur ragebait | Blurs high-manipulation content |
| Hide engagement bait | Collapses empty interaction requests |

**Sensitivity** - the slider (30-90%) sets the confidence threshold. Lower = catches more, higher = fewer false positives. 60% is the default.

**Intent filters** - per-intent toggles. Turn off an intent to let it pass through with no treatment, even if the classifier detects it.

---

## The page badge

When you open a supported site, a small badge appears in the **bottom-right corner** of the page. It shows:

- **intentKeeper · scanning...** while classifying content on load
- **intentKeeper · N classified** once done (fades after a few seconds)
- **intentKeeper · N found, 0 classified** in orange if content was detected but the API call failed

If the server is unreachable, the badge shows in red.

---

## What classification looks like

**Blurred (ragebait)** - content is blurred with a "Show anyway" button. Click to reveal.

**Tagged (fearmongering, hype, divisive)** - content is fully visible with a small label above it. Hover for confidence score.

**Hidden (engagement bait)** - collapsed to a single line with a "Show" link.

**Genuine / neutral** - passes through unchanged (tag still appears if "Show intent tags" is on).

---

## Troubleshooting

**Extension shows disconnected**
```bash
curl http://localhost:8420/health
```
If that fails, start the server: `intentkeeper-server`

**Nothing being classified**
- Check the master toggle in the popup header is on
- Check you're on a supported site (Twitter/X, YouTube, Reddit)
- Open the browser console (`F12` → Console) and look for errors

**Classification seems off**
- Adjust the sensitivity slider
- Use a larger model for better accuracy
- Check the per-intent filters - an intent might be toggled off

**Server keeps stopping**
The server is a standard Python process. Run it in a terminal you keep open, or use a tool like `screen` or `tmux` to keep it alive.
