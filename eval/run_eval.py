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
import hashlib
import json
import os
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


def build_result(meta: dict, correct: int, total: int, per_intent: dict, wrong: list[dict]) -> dict:
    """Assemble the structured verdict. score_pct + correct/total is the grade;
    `wrong` is the failed_checks; per_intent is the rationale (where it failed).
    Kept separate from run() so it can be tested without loading a model."""
    return {
        "eval": meta["eval"],
        "eval_version": meta["eval_version"],
        "model": meta["model"],
        "dataset": meta["dataset"],
        "dataset_hash": meta["dataset_hash"],
        "score_pct": round(correct / total * 100, 1) if total else 0.0,
        "correct": correct,
        "total": total,
        "per_intent": {
            k: {
                "correct": v["correct"],
                "total": v["total"],
                "acc_pct": round(v["correct"] / v["total"] * 100, 1) if v["total"] else 0.0,
            }
            for k, v in sorted(per_intent.items())
        },
        "failed_checks": [
            {
                "expected": w["expected"],
                "got": w["got"],
                "confidence": round(w["confidence"], 2),
                "content": w["content"][:120],
                "note": w["note"],
            }
            for w in wrong
        ],
    }


async def run(test_set: list[dict], verbose: bool, meta: dict, result_path: str | None) -> None:
    classifier = IntentClassifier()
    # A score is meaningless without the model that produced it - the 96%
    # baseline is llama3.1:8b. Print it so the log is self-describing, and
    # record it below so two runs can be compared like with like.
    meta["model"] = classifier.model
    print(f"  model: {classifier.model}")

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

    # Structured verdict, alongside the human-readable output above. The DAG's
    # digest still reads the "accuracy" line; this file is for comparing runs.
    if result_path:
        result = build_result(meta, correct, total, per_intent, wrong)
        Path(result_path).write_text(json.dumps(result, indent=2))
        print(f"  wrote verdict: {result_path}\n")


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
    parser.add_argument(
        "--result-json",
        metavar="PATH",
        help="Also write a structured verdict (score, per-intent, failed checks) here",
    )
    args = parser.parse_args()

    test_set = load_test_set(args.test_set, filter_intent=args.filter)
    if not test_set:
        print(f"No examples found (filter={args.filter!r})")
        sys.exit(1)

    # Per-eval fingerprint: the dataset is the dial most likely to move a score,
    # so hash it. eval_version comes from the DAG (EVAL_VERSION), 'dev' by hand.
    dataset_bytes = Path(args.test_set).read_bytes()
    meta = {
        "eval": "intentkeeper",
        "eval_version": os.environ.get("EVAL_VERSION", "dev"),
        "model": None,  # filled in from the classifier once it is constructed
        "dataset": args.test_set,
        "dataset_hash": hashlib.sha256(dataset_bytes).hexdigest()[:12],
    }

    asyncio.run(run(test_set, verbose=args.verbose, meta=meta, result_path=args.result_json))


if __name__ == "__main__":
    main()
