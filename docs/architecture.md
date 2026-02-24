# System Architecture

This document provides a visual overview of IntentKeeper's architecture. For detailed technical reference, see [CLAUDE.md](../CLAUDE.md).

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User's Machine                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Browser (Chrome)                            │   │
│  │  ┌─────────────┐                                             │   │
│  │  │  Extension   │ ◄── Intercepts content from Twitter/X       │   │
│  │  │  content.js  │                                             │   │
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
Content Intercepted (tweet text)
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. LENGTH CHECK                            │
│     < 20 characters → neutral (skip LLM)    │
└─────────────────────────────────────────────┘
    │ Pass
    ▼
┌─────────────────────────────────────────────┐
│  2. BUILD PROMPT                            │
│     Intent descriptions from YAML           │
│     + Few-shot examples (up to 5)           │
│     + Classification rules                  │
│     + Content to classify                   │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  3. OLLAMA API CALL                         │
│     Temperature: 0.1 (deterministic)        │
│     Max tokens: 150                         │
│     Timeout: 30 seconds                     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  4. PARSE JSON RESPONSE                     │
│     Extract: intent, confidence, reasoning  │
│     Validate intent against known categories│
│     Fallback to neutral on parse failure    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  5. CALCULATE ACTION                        │
│     Look up action from intents.yaml        │
│     manipulation_score = weight × confidence│
│     Apply user threshold                    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  6. RETURN ClassificationResult             │
│     {intent, confidence, reasoning,         │
│      action, manipulation_score}            │
└─────────────────────────────────────────────┘
    │
    ▼
Visual Treatment Applied (content.js)
```

## Component Relationships

```
┌────────────────────────────────────────────────────────────────┐
│                    Browser Extension                            │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   content.js     │  │ background.js│  │  popup/popup.js  │  │
│  │                  │  │              │  │                  │  │
│  │ - DOM observation│  │ - Settings   │  │ - Toggle UI      │  │
│  │ - Tweet intercept│  │ - Health poll│  │ - Sliders        │  │
│  │ - API calls      │  │ - Badge icon │  │ - Status display │  │
│  │ - CSS treatments │  │              │  │                  │  │
│  └────────┬─────────┘  └──────────────┘  └──────────────────┘  │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │ HTTP (localhost:8420)
            ▼
┌────────────────────────────────────────────────────────────────┐
│                    FastAPI Server (api.py)                      │
│                                                                 │
│   Endpoints:                                                    │
│   POST /classify         -Single classification               │
│   POST /classify/batch   -Batch (max 50)                      │
│   GET  /health           -Server + Ollama status              │
│   GET  /intents          -Current definitions                 │
└───────────────────────────┬────────────────────────────────────┘
                            │ uses
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                  IntentClassifier (classifier.py)               │
│                                                                 │
│   - Loads intents from YAML                                    │
│   - Builds classification prompts                              │
│   - Calls Ollama API                                           │
│   - Parses JSON responses                                      │
│   - Fail-open error handling                                   │
└───────────────────────────┬────────────────────────────────────┘
                            │ reads
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                   scenarios/intents.yaml                        │
│                                                                 │
│   - 7 intent categories with weights and actions               │
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
│                              ┌──────────┐ ┌──────────┐          │
│                              │ genuine  │ │ neutral  │          │
│                              │ wt: 0.0  │ │ wt: 0.0  │          │
│                              │ → pass   │ │ → pass   │          │
│                              └──────────┘ └──────────┘          │
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
│   │          ⚠ Ragebait detected -click to reveal   │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   TAG (fearmongering, hype, divisive)                            │
│   ┌─────────────────────────────────────────────────┐           │
│   │ [fearmongering] Original content visible here    │           │
│   │ with a small label badge in the corner.          │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   HIDE (engagement_bait)                                         │
│   ┌─────────────────────────────────────────────────┐           │
│   │ ▶ Hidden: engagement bait (click to expand)      │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
│   PASS (genuine, neutral)                                        │
│   ┌─────────────────────────────────────────────────┐           │
│   │ Content displayed normally, no modification.     │           │
│   └─────────────────────────────────────────────────┘           │
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
