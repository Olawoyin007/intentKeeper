#!/usr/bin/env python3
"""
IntentKeeper Classification Eval Harness

Runs the labeled test set through the classifier and reports accuracy.
Use this to measure whether prompt/example/rule changes actually help.

Usage:
    python eval/run_eval.py
    python eval/run_eval.py --verbose              # show every item
    python eval/run_eval.py --filter ragebait      # one intent only
    python eval/run_eval.py --test-set path/to/other.yaml

Run from the repo root.
"""

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path

import yaml

# Allow importing server modules from the repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.classifier import IntentClassifier  # noqa: E402


def load_test_set(path: str, filter_intent: str | None = None) -> list[dict]:
    with open(path) as f:
        items = yaml.safe_load(f)
    if filter_intent:
        items = [i for i in items if i["expected_intent"] == filter_intent]
    return items


async def run(test_set: list[dict], verbose: bool) -> None:
    classifier = IntentClassifier()

    total = len(test_set)
    correct = 0
    per_intent: dict[str, dict] = defaultdict(lambda: {"total": 0, "correct": 0})
    wrong: list[dict] = []

    print(f"\nRunning {total} examples...\n")

    for item in test_set:
        content = item["content"]
        expected = item["expected_intent"]
        note = item.get("note", "")

        result = await classifier.classify(content)
        got = result.intent
        is_correct = got == expected

        per_intent[expected]["total"] += 1
        if is_correct:
            correct += 1
            per_intent[expected]["correct"] += 1
        else:
            wrong.append(
                {
                    "content": content,
                    "expected": expected,
                    "got": got,
                    "confidence": result.confidence,
                    "reasoning": result.reasoning,
                    "note": note,
                }
            )

        if verbose:
            status = "✓" if is_correct else "✗"
            print(f"  {status} [{expected:>16}] -> [{got:<16}] {content[:60]}")

    await classifier.close()

    # ── Summary ──────────────────────────────────────────────────────────────

    pct = correct / total * 100 if total else 0
    print(f"\n{'─' * 60}")
    print(f"  Overall accuracy: {correct}/{total}  ({pct:.0f}%)")
    print(f"{'─' * 60}\n")

    # Per-intent breakdown
    print(f"  {'Intent':<20} {'Correct':>7}  {'Total':>5}  {'Acc':>5}")
    print(f"  {'─' * 20}  {'─' * 7}  {'─' * 5}  {'─' * 5}")
    for intent, counts in sorted(per_intent.items()):
        t = counts["total"]
        c = counts["correct"]
        acc = c / t * 100 if t else 0
        bar = "█" * c + "░" * (t - c)
        print(f"  {intent:<20} {c:>7}  {t:>5}  {acc:>4.0f}%  {bar}")

    # Wrong classifications
    if wrong:
        print(f"\n  Wrong ({len(wrong)}):\n")
        for w in wrong:
            print(f"  expected: {w['expected']}")
            print(f"  got:      {w['got']}  (confidence {w['confidence']:.2f})")
            print(f"  content:  {w['content'][:80]}")
            if w["note"]:
                print(f"  note:     {w['note']}")
            print(f"  reason:   {w['reasoning']}")
            print()
    else:
        print("\n  No wrong classifications. 🎉\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run IntentKeeper classification eval")
    parser.add_argument(
        "--test-set",
        default="eval/test_set.yaml",
        help="Path to labeled test set YAML (default: eval/test_set.yaml)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print every item as it's classified",
    )
    parser.add_argument(
        "--filter",
        metavar="INTENT",
        help="Only run examples for this intent",
    )
    args = parser.parse_args()

    test_set = load_test_set(args.test_set, filter_intent=args.filter)
    if not test_set:
        print(f"No examples found (filter={args.filter!r})")
        sys.exit(1)

    asyncio.run(run(test_set, verbose=args.verbose))


if __name__ == "__main__":
    main()
