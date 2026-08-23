# Known Limits

An honest account of where intentKeeper fails, and why. Written 2026-08-23,
after a live test of the classifier on ordinary jokes and banter.

## The short version

intentKeeper reliably flags loud, one-to-many manipulation from strangers -
rage-farming, fearmongering, clickbait. It does **not** reliably read ordinary
human speech: jokes, sarcasm, self-deprecation, or affectionate roasting between
people who know each other. On that kind of content it is often confidently
wrong.

## The test that showed it

Five posts through the running classifier (`gemma3:12b`):

| Post | Verdict | Confidence | Action |
|---|---|---|---|
| self-deprecating joke ("emotional range of a teaspoon before coffee") | engagement_bait | 0.85 | hide |
| friendly roast ("your fantasy team is so bad even the AI feels sorry 😂") | ragebait | 0.95 | blur |
| sarcasm ("oh WONDERFUL, another Monday") | ragebait | 0.95 | blur |
| dry humour ("question all my life choices, repeat") | genuine | 0.95 | pass (correct) |
| real stranger rage-farming (control) | fearmongering | 0.95 | tag (caught) |

Three of four jokes misread. Two of them confidently (0.95), and routed to the
two most aggressive actions - blur and hide.

## Why it fails (structural, not a tuning bug)

1. **Intent lives in the relationship, not the text.** A roast between friends
   and an attack from a stranger look identical on the page. The only thing that
   tells them apart is knowing the two people are friends - history the tool
   cannot see. A per-post classifier has no access to that context.

2. **No image or video understanding.** The medium is increasingly visual, but
   the classifier reads text only. It fires on the text of posts whose meaning
   is in the picture.

3. **Emoji carry the tone, and are dropped.** "your team is trash 😂" is
   affectionate; the 😂 does the work. Strip it and the read flips from friendly
   to hostile.

4. **Confidence disclosure does not reach this.** The "?" uncertainty marker
   only appears below 0.65 confidence. Every wrong call above was 0.85-0.95, so
   the one safety valve is silent exactly when it is needed.

## What the 96% eval does and does not mean

The 96% accuracy is measured on a 105-example labeled set of loud manipulation.
It contains no affectionate banter, no sarcasm, no visual posts. So the number
is real but narrow: it says the tool is good at spotting the loud manipulation
it was built to spot. It says nothing about false positives on ordinary content
- which is the failure this document is about, and which the eval never tested.

That is itself the lesson: a curated benchmark can hide an entire failure
distribution. High accuracy on the examples you thought to include is not the
same as safety on the inputs users actually bring.

## Consequence for the design

The manifesto's Principle 3 says false positives (blocking genuine content) are
unacceptable, while false negatives are fine. Blurring a friend's joke is
precisely the unacceptable failure. Any version that keeps blur/hide as actions
is in tension with the project's own core promise. A tag-only posture - never
hide, never blur, only a small removable label, and only on high-confidence
loud stranger manipulation - is the honest floor.
