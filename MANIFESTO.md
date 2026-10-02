# The IntentKeeper Manifesto

> "The content isn't the problem. The intent behind it is."

## What This Is 

intentKeeper labels social media posts by the manipulation patterns they use, so
you can see what a post is doing before you react to it.

It does not filter topics. It names framing.

A post about politics can be thoughtful analysis or manufactured outrage. A health tip can be genuine advice or fearmongering. IntentKeeper classifies the **energy** behind the words - not the words themselves.

## Core Principles

### 1. Surface, Don't Censor

IntentKeeper never decides what you can and cannot see. It **labels intent** and lets you decide. Blur, tag, and hide are suggestions - every piece of content can be revealed with a click.

The difference that matters: deciding for you, versus giving you something to decide with.

### 2. Local-First, Always

All classification happens on your device via Ollama. Your browsing patterns, the content you consume, your sensitivity settings - none of it leaves your machine. Ever.

No cloud, no analytics, and no using your data to improve anything.

### 3. Fail Open, Not Closed

When classification fails - server down, model error, network issue - content passes through unchanged. IntentKeeper will never block you from seeing something because of a bug.

False negatives (missing manipulation) are acceptable. False positives (blocking genuine content) are not.

### 4. Intent Over Topic

A political post can be thoughtful analysis or manufactured outrage. A health tip can be genuine advice or fearmongering. We classify the framing, not the subject.

### 5. User Sovereignty

You control everything:
- What gets filtered and what doesn't
- How aggressively it filters
- Which platforms it runs on
- Whether it runs at all

IntentKeeper is a tool, not a guardian. It serves you; you don't serve it.

### 6. No Engagement Optimization

IntentKeeper will never:
- Track how long you spend on filtered vs unfiltered content
- A/B test different filter presentations for "effectiveness"
- Gamify the experience (streaks, badges, scores)
- Nudge you to use it more
- Send notifications

The best outcome is that you internalize the patterns and stop needing IntentKeeper.

### 7. Transparency in Classification

Every classification comes with a reasoning field. You can always see **why** content was flagged. If the reasoning doesn't make sense, the classification is wrong - and the content should be treated as genuine.

We don't hide behind "trust the algorithm." We show our work.

## What We Won't Build

- **Topic filters**: We classify intent, not subjects. No political filters, no religion filters.
- **User profiling**: We don't build models of what you like or dislike.
- **Social features**: No sharing, no leaderboards, no "your friends are using IntentKeeper."
- **Premium manipulation detection**: All features are free. We don't gate safety behind paywalls.
- **Notification systems**: We don't interrupt you. We're there when you're already browsing.

## On Imperfection

intentKeeper makes mistakes. It struggles with sarcasm, irony and cultural
context, and it will sometimes disagree with your judgment. This is measured, not
estimated: see `KNOWN_LIMITS.md`.

It is a second opinion, not an authority. When it disagrees with you, trust
yourself.

## Relationship to empathySync

IntentKeeper is a sibling project to [empathySync](https://github.com/Olawoyin007/empathySync). Both share the same philosophy:

| Principle | empathySync | IntentKeeper |
|-----------|-------------|--------------|
| **Local-first** | All AI processing on-device | All classification on-device |
| **Restraint** | Limits itself on sensitive topics | Labels but never censors |
| **Human primacy** | Redirects to human connection | Gives users information to decide |
| **Anti-engagement** | Optimizes for user exit | Doesn't track or nudge |
| **Transparency** | Shows why guardrails fire | Shows classification reasoning |

empathySync protects you from over-relying on AI for emotional support.
IntentKeeper protects you from content designed to manipulate your emotions.

Same mission, different surface areas.

---

## The Living Clause

This manifesto evolves only to **tighten** protections, never to weaken them. Any change that loosens user privacy, adds tracking, enables censorship, or introduces engagement optimization violates the spirit of this document.

If IntentKeeper ever contradicts these principles, the principles win.

---

*"Protect your attention. Question the energy, not the topic."*
