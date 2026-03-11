#!/usr/bin/env python3
"""
IntentKeeper Classification Evaluator

Runs the labeled ground-truth set through the live classifier and reports
per-intent precision, recall, and F1. Use this to measure accuracy before
expanding to new platforms or intents.

Usage:
    python tests/eval/run_eval.py                   # full run
    python tests/eval/run_eval.py --dry-run         # validate YAML only
    python tests/eval/run_eval.py --intent ragebait # single intent
    python tests/eval/run_eval.py --verbose         # show each prediction
"""

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path

import yaml

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from server.classifier import IntentClassifier


def load_ground_truth(path: Path, intent_filter: str | None = None) -> list[dict]:
    data = yaml.safe_load(path.read_text())
    examples = data.get("examples", [])
    if intent_filter:
        examples = [e for e in examples if e["intent"] == intent_filter]
    return examples


def compute_metrics(
    results: list[dict],
) -> tuple[dict[str, dict], dict]:
    """
    Compute per-intent precision, recall, F1, and an overall summary.

    Returns:
        per_intent: {intent -> {precision, recall, f1, tp, fp, fn, support}}
        overall:    {accuracy, macro_f1, total}
    """
    intents = sorted({r["expected"] for r in results} | {r["predicted"] for r in results})

    per_intent: dict[str, dict] = {}
    for intent in intents:
        tp = sum(1 for r in results if r["expected"] == intent and r["predicted"] == intent)
        fp = sum(1 for r in results if r["expected"] != intent and r["predicted"] == intent)
        fn = sum(1 for r in results if r["expected"] == intent and r["predicted"] != intent)
        support = tp + fn

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        per_intent[intent] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "support": support,
        }

    correct = sum(1 for r in results if r["expected"] == r["predicted"])
    total = len(results)
    accuracy = correct / total if total > 0 else 0.0
    active_intents = [i for i in intents if per_intent[i]["support"] > 0]
    macro_f1 = (
        sum(per_intent[i]["f1"] for i in active_intents) / len(active_intents)
        if active_intents
        else 0.0
    )

    return per_intent, {
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "total": total,
        "correct": correct,
    }


def print_report(
    per_intent: dict[str, dict],
    overall: dict,
    results: list[dict],
    verbose: bool = False,
) -> None:
    print("\n" + "=" * 65)
    print("  IntentKeeper Evaluation Report")
    print("=" * 65)

    if verbose:
        print("\nPer-example predictions:")
        print("-" * 65)
        for r in results:
            status = "✓" if r["expected"] == r["predicted"] else "✗"
            print(f"  {status} expected={r['expected']:<18} predicted={r['predicted']:<18}")
            if r.get("note"):
                print(f"    note: {r['note']}")
            print(f"    {r['content'][:80]}{'...' if len(r['content']) > 80 else ''}")
        print()

    print("\nPer-intent breakdown:")
    print(f"  {'Intent':<20} {'Precision':>9} {'Recall':>9} {'F1':>9} {'Support':>8}")
    print("  " + "-" * 61)

    for intent, m in sorted(per_intent.items()):
        if m["support"] == 0:
            continue
        flag = ""
        # Highlight concerning numbers
        if m["precision"] < 0.6:
            flag += " ⚠ low precision (over-triggering)"
        elif m["recall"] < 0.6:
            flag += " ⚠ low recall (under-triggering)"
        print(
            f"  {intent:<20} {m['precision']:>8.0%} {m['recall']:>8.0%} "
            f"{m['f1']:>8.0%} {m['support']:>7}{flag}"
        )

    print()
    print(
        f"  Overall accuracy : {overall['accuracy']:.0%}  ({overall['correct']}/{overall['total']})"
    )
    print(f"  Macro F1         : {overall['macro_f1']:.0%}")

    # Disagreement analysis - show the most common mispredictions
    errors = [r for r in results if r["expected"] != r["predicted"]]
    if errors:
        confusion: dict[tuple, int] = defaultdict(int)
        for r in errors:
            confusion[(r["expected"], r["predicted"])] += 1
        print("\nTop misclassifications (expected → predicted):")
        for (exp, pred), count in sorted(confusion.items(), key=lambda x: -x[1]):
            print(f"  {exp} → {pred}  ({count}x)")

    print("=" * 65 + "\n")


async def run_eval(
    examples: list[dict],
    verbose: bool = False,
    dry_run: bool = False,
) -> int:
    """Returns exit code: 0 if macro F1 >= 0.7, 1 otherwise."""
    if dry_run:
        print(f"Dry run: {len(examples)} examples loaded, YAML is valid.")
        intents = defaultdict(int)
        for e in examples:
            intents[e["intent"]] += 1
        print("Intent distribution:")
        for intent, count in sorted(intents.items()):
            print(f"  {intent:<20} {count} examples")
        return 0

    classifier = IntentClassifier()
    results = []

    print(f"Running {len(examples)} examples through classifier...")
    for i, example in enumerate(examples, 1):
        result = await classifier.classify(example["content"])
        results.append(
            {
                "content": example["content"],
                "expected": example["intent"],
                "predicted": result.intent,
                "confidence": result.confidence,
                "note": example.get("note"),
            }
        )
        # Progress indicator for slow models
        if i % 10 == 0:
            print(f"  {i}/{len(examples)}...")

    await classifier.close()

    per_intent, overall = compute_metrics(results)
    print_report(per_intent, overall, results, verbose=verbose)

    # Fail if overall quality is too low to trust
    threshold = 0.70
    if overall["macro_f1"] < threshold:
        print(f"⚠  Macro F1 {overall['macro_f1']:.0%} is below threshold ({threshold:.0%}).")
        print("   Review misclassifications before expanding to new platforms.\n")
        return 1

    print(f"✓  Macro F1 {overall['macro_f1']:.0%} meets threshold ({threshold:.0%}).\n")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate IntentKeeper classification accuracy")
    parser.add_argument("--dry-run", action="store_true", help="Validate YAML only, no API calls")
    parser.add_argument("--intent", help="Evaluate a single intent only")
    parser.add_argument("--verbose", action="store_true", help="Show each prediction")
    args = parser.parse_args()

    ground_truth_path = Path(__file__).parent / "ground_truth.yaml"
    examples = load_ground_truth(ground_truth_path, intent_filter=args.intent)

    if not examples:
        print(f"No examples found{f' for intent: {args.intent}' if args.intent else ''}.")
        sys.exit(1)

    exit_code = asyncio.run(run_eval(examples, verbose=args.verbose, dry_run=args.dry_run))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
