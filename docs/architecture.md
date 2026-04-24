# System Architecture

This document provides a visual overview of IntentKeeper's architecture. For detailed technical reference, see [CLAUDE.md](../CLAUDE.md).

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User's Machine                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Browser (Chrome / Brave)                        │   │
│  │  ┌─────────────┐                                             │   │
│  │  │  Extension   │ ◄── Intercepts content from:               │   │
│  │  │              │     Twitter/X (tweets, replies)            │   │
│  │  │  classifier  │     Reddit (shreddit, new, old variants)   │   │
│  │  │  .js (core)  │     YouTube (feed cards, comments)         │   │
│  │  └──────┬──────┘                                              │   │
│  │         │ POST /classify                                      │   │
│  └─────────┼────────────────────────────────────────────────────┘   │
│            │                                                         │
│            ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              IntentKeeper Server (FastAPI)                     │   │
│  │                  localhost:8420                                │   │
│  │                                                                │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │  API Layer   │───▶│  Intent     │───▶│   Ollama    │       │   │
│  │  │  (FastAPI)   │    │ Classifier  │    │   (LLM)     │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │                            │                                   │   │
│  │                            ▼                                   │   │
│  │                     ┌─────────────┐                            │   │
│  │                     │  Scenarios   │                            │   │
│  │                     │ intents.yaml │                            │   │
│  │                     └─────────────┘                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Ollama Server                            │   │
│  │                    (localhost:11434)                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│             No external API calls. Everything stays local.           │
└─────────────────────────────────────────────────────────────────────┘
```

## Classification Flow

```
Content Intercepted (tweet / post / comment)
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. LENGTH CHECK                            │
│     < 20 characters → mark "skipped"       │
│     empty string → leave unmarked          │
│       (element still loading, retry next   │
│        observer pass)                       │
└─────────────────────────────────────────────┘
    │ Pass
    ▼
┌─────────────────────────────────────────────┐
│  2. ALLOWLIST CHECK (Phase 6.2)             │
│     adapter.extractAuthor() if defined      │
│     → Twitter: @handle (bare, lowercase)    │
│     → Reddit: u/username (bare, lowercase)  │
│     If author in chrome.storage ik_allowlist│
│     → mark "allowed", skip classification  │
│     In-memory Set for O(1) lookup           │
└─────────────────────────────────────────────┘
    │ Not allowlisted
    ▼
┌─────────────────────────────────────────────┐
│  3. BUILD PROMPT                            │
│     Intent descriptions from YAML           │
│     + User corrections (Phase 6.5):         │
│       5 most recent corrections from        │
│       chrome.storage ik_corrections,        │
│       injected as personalised few-shot     │
│       examples before the content block     │
│     + Classification rules                  │
│     + Content to classify (truncated 5000c) │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  4. OLLAMA API CALL                         │
│     Temperature: 0.1 (deterministic)        │
│     Max tokens: 150                         │
│     Timeout: 30 seconds                     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  5. PARSE JSON RESPONSE                     │
│     Extract: intent, confidence, reasoning  │
│     Validate intent against known categories│
│     Fallback to neutral on parse failure    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  6. CALCULATE ACTION                        │
│     Look up action from intents.yaml        │
│     manipulation_score = weight × confidence│
│     Apply user threshold                    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  7. RETURN ClassificationResult             │
│     {intent, confidence, reasoning,         │
│      action, manipulation_score}            │
└─────────────────────────────────────────────┘
    │
    ▼
Visual Treatment Applied (classifier.js)
    - confidence < 0.65 → muted label + "?"  (Phase 6.4)
    - confidence shown in tooltip + blur note (Phase 6.4)
    - pencil button → correction picker      (Phase 6.5)
```

## Component Relationships

```
┌────────────────────────────────────────────────────────────────┐
│                    Browser Extension                            │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │core/classifier.js│  │ background.js│  │  popup/popup.js  │  │
│  │ (IntentKeeperCore│  │              │  │                  │  │
│  │ - DOM observation│  │ - Settings   │  │ - Toggle UI      │  │
│  │ - Batch API calls│  │ - Health poll│  │ - Sliders        │  │
│  │ - CSS treatments │  │ - Badge icon │  │ - Status display │  │
│  │ - Allowlist Set  │  │ - PNA proxy  │  │ - Trusted Accts  │  │
│  │   (Phase 6.2)    │  │ - Corrections│  │   add/remove     │  │
│  │ - Confidence UI  │  │   few-shot   │  │ - My Corrections │  │
│  │   (Phase 6.4)    │  │   injection  │  │   count + clear  │  │
│  │ - Correction     │  │   (6.5)      │  │                  │  │
│  │   picker (6.5)   │  │              │  │                  │  │
│  └────────┬─────────┘  └──────────────┘  └──────────────────┘  │
│           │ uses platform adapters                               │
│  ┌────────┴──────────────────────────────────────────────────┐  │
│  │  Platform Adapters (extension/platforms/)                  │  │
│  │  twitter.js - Twitter/X DOM; extractAuthor() → @handle    │  │
│  │  reddit.js  - Reddit DOM (shreddit, new, old);            │  │
│  │               extractAuthor() → u/username                 │  │
│  │  youtube.js - YouTube DOM (no extractAuthor - not needed) │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│  ┌────────┴──────────────────────────────────────────────────┐  │
│  │  chrome.storage.local                                      │  │
│  │  intentkeeper_settings  - all user toggles/thresholds      │  │
│  │  ik_allowlist[]         - trusted account handles (6.2)    │  │
│  │  ik_corrections[]       - label corrections, LRU-100 (6.5) │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
└───────────────────────────────────┬────────────────────────────┘
                                    │ HTTP (localhost:8420)
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│                    FastAPI Server (api.py)                      │
│                                                                 │
│   Endpoints:                                                    │
│   POST /classify         - Single classification               │
│   POST /classify/batch   - Batch (max 50)                      │
│   GET  /health           - Server + Ollama status              │
│   GET  /intents          - Current definitions                 │
│                                                                 │
│   Request body includes user_corrections[] (Phase 6.5)         │
│   Pydantic-validated before passing to classifier              │
└───────────────────────────┬────────────────────────────────────┘
                            │ uses
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                  IntentClassifier (classifier.py)               │
│                                                                 │
│   - Loads intents from YAML                                     │
│   - Builds classification prompts with user corrections         │
│     injected as personalised few-shot examples (Phase 6.5)     │
│   - Calls Ollama API                                            │
│   - Parses JSON responses                                       │
│   - Fail-open error handling                                    │
└───────────────────────────┬────────────────────────────────────┘
                            │ reads
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                   scenarios/intents.yaml                        │
│                                                                 │
│   - 6 intent categories with weights and actions               │
│   - Few-shot examples for accuracy                             │
│   - Classification rules for LLM prompt                        │
│   - Indicator lists for each intent                            │
└────────────────────────────────────────────────────────────────┘
```

## Intent Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTENT SPECTRUM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   MANIPULATIVE                              AUTHENTIC            │
│   ◄────────────────────────────────────────────────────►        │
│                                                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│   │ ragebait │ │divisive  │ │  hype    │                        │
│   │ wt: 0.9  │ │ wt: 0.7  │ │ wt: 0.5  │                       │
│   │ → blur   │ │ → tag    │ │ → tag    │                        │
│   └──────────┘ └──────────┘ └──────────┘                        │
│                                                                  │
│   ┌──────────┐ ┌──────────┐                                     │
│   │ fear-    │ │engage-   │                                     │
│   │ monger   │ │ment_bait│                                      │
│   │ wt: 0.7  │ │ wt: 0.6  │                                     │
│   │ → tag    │ │ → hide   │                                      │
│   └──────────┘ └──────────┘                                      │
│                                                                  │
│                              ┌──────────┐                        │
│                              │ genuine  │                        │
│                              │ wt: 0.0  │                        │
│                              │ → pass   │                        │
│                              └──────────┘                        │
│   (neutral is error fallback only, not a primary category)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Visual Treatments

```
┌─────────────────────────────────────────────────────────────────┐
│                    TREATMENT ACTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   BLUR (ragebait)                                               │
│   ┌─────────────────────────────────────────────────┐           │
│   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │           │
│   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │           │
│   │   🛡️ Ragebait  [Low confidence (61%)]  ✏️       │           │
│   │   Designed to provoke outrage response          │           │
│   │          [Show anyway]                          │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   TAG (fearmongering, hype, divisive)                            │
│   ┌─────────────────────────────────────────────────┐           │
│   │ 🛡️ Fearmongering ✏️  Original content visible   │           │
│   │ tooltip: "Classified as fearmongering (87%)"    │           │
│   │ low-confidence variant: 🛡️ Fearmongering ? ✏️   │           │
│   │ (muted colour, italic, tooltip shows %)         │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   HIDE (engagement_bait)                                         │
│   ┌─────────────────────────────────────────────────┐           │
│   │ ▶ Hidden: engagement bait (click to expand)      │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   PASS (genuine)                                                 │
│   ┌─────────────────────────────────────────────────┐           │
│   │ Content displayed normally, no modification.     │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   ALLOWED (Phase 6.2)                                            │
│   ┌─────────────────────────────────────────────────┐           │
│   │ Author in allowlist → classification skipped    │           │
│   │ No tag, no blur. Marked allowed in DOM attr.    │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   Confidence thresholds (Phase 6.4):                             │
│   < 0.65 → muted label, italic, "?" suffix                       │
│   0.65 - 0.85 → standard treatment                               │
│   > 0.85 → standard treatment (no indicator needed)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling (Fail-Open)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FAIL-OPEN DESIGN                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Failure Scenario              │ Result                        │
│   ──────────────────────────────│───────────────────────────    │
│   Server unreachable            │ Content passes through        │
│   Ollama not running            │ Content passes through        │
│   Model error                   │ Content passes through        │
│   JSON parse failure            │ Content passes through        │
│   Timeout (>30s)                │ Content passes through        │
│   Invalid intent returned       │ Defaults to "neutral"         │
│                                                                  │
│   Principle: False negatives > False positives                   │
│   Missing manipulation is acceptable.                            │
│   Blocking genuine content is not.                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN PRINCIPLES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. LOCAL-FIRST                                                 │
│      All classification on user's machine                        │
│      No external API calls                                       │
│      No data leaves the device                                   │
│                                                                  │
│   2. FAIL-OPEN                                                   │
│      Errors pass content through                                 │
│      Never block genuine content                                 │
│      False negatives over false positives                        │
│                                                                  │
│   3. INTENT OVER TOPIC                                           │
│      Don't filter subjects, surface manipulation                 │
│      Same topic can be genuine or manipulative                   │
│      Classify framing, not content                               │
│                                                                  │
│   4. USER CONTROL                                                │
│      Configurable thresholds                                     │
│      Per-action toggles                                          │
│      Everything can be revealed                                  │
│                                                                  │
│   5. TRANSPARENCY                                                │
│      Every classification includes reasoning                     │
│      Show why content was flagged                                │
│      No black-box decisions                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

For detailed code-level documentation, see [CLAUDE.md](../CLAUDE.md).
