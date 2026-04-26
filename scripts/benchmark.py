#!/usr/bin/env python3
"""
IntentKeeper model benchmark.

Runs the labeled eval set (eval/test_set.yaml) through each candidate
Ollama model and records accuracy and latency. Results go to
docs/model-benchmark.md so users can pick the right model for their hardware.

Partial results saved to docs/benchmark-results.json after each model.

Usage:
    python scripts/benchmark.py                    # all defaults
    python scripts/benchmark.py --resume           # skip already-done models
    python scripts/benchmark.py --models qwen2.5:7b-instruct mistral:7b-instruct
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

RESULTS_FILE = ROOT / "docs" / "benchmark-results.json"
PROBE_TIMEOUT = 30  # seconds

DEFAULT_MODELS = [
    "qwen2.5:1.5b-instruct",
    "gemma:2b-instruct",
    "qwen2.5:3b-instruct",
    "llama3.2:latest",
    "phi3.5:latest",
    "mistral:7b-instruct",
    "llama3.1:8b",
    "qwen2.5:7b-instruct",
    "dolphin-mistral:latest",
    "gemma3:12b",
    "phi4:latest",
    "qwen2.5:14b-instruct-q4_K_M",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def hardware_tier(size_gb: float) -> str:
    if size_gb < 1.0:
        return "CPU / Any"
    if size_gb < 3.0:
        return "4 GB"
    if size_gb < 6.5:
        return "8 GB"
    if size_gb < 11.0:
        return "12 GB"
    if size_gb < 18.0:
        return "16 GB"
    return "24 GB"


def format_size(size_gb: float) -> str:
    if size_gb < 1.0:
        return f"{size_gb * 1024:.0f} MB"
    return f"{size_gb:.1f} GB"


def pct(v: float) -> str:
    return f"{v * 100:.0f}%"


def fmt_ms(v: float) -> str:
    if v >= 1000:
        return f"{v / 1000:.1f}s"
    return f"{v:.0f}ms"


def get_installed_models() -> dict:
    result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
    models = {}
    lines = result.stdout.strip().splitlines()
    if len(lines) < 2:
        return models
    for line in lines[1:]:
        parts = line.split()
        if len(parts) < 4:
            continue
        name = parts[0]
        try:
            size = float(parts[2])
            unit = parts[3]
            if unit == "MB":
                size /= 1024
            models[name] = round(size, 2)
        except (ValueError, IndexError):
            pass
    return models


def load_test_set() -> list:
    path = ROOT / "eval" / "test_set.yaml"
    with open(path) as f:
        return yaml.safe_load(f)


def load_partial_results() -> dict:
    if not RESULTS_FILE.exists():
        return {}
    try:
        with open(RESULTS_FILE) as f:
            return json.load(f)
    except Exception as e:
        print(f"  warn: could not load {RESULTS_FILE}: {e}", flush=True)
        return {}


def save_partial_results(results: dict) -> None:
    data = dict(results)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    tmp = str(RESULTS_FILE) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, RESULTS_FILE)


async def probe_model(model_name: str, ollama_host: str) -> bool:
    """Quick health check - can the model respond at all within PROBE_TIMEOUT seconds."""
    import httpx

    url = f"{ollama_host}/api/generate"
    payload = {
        "model": model_name,
        "prompt": "Hi",
        "stream": False,
        "options": {"num_predict": 5, "temperature": 0.0},
    }
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json=payload, timeout=PROBE_TIMEOUT)
            r.raise_for_status()
            return bool(r.json().get("response"))
    except Exception as e:
        print(f"  probe failed for {model_name}: {e}", flush=True)
        return False


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------


async def bench_model(model_name: str, test_set: list) -> dict:
    """Run the full eval set through model_name. Returns metrics dict."""
    from server.classifier import IntentClassifier

    classifier = IntentClassifier(model=model_name)

    total = len(test_set)
    correct = 0
    per_intent: dict = defaultdict(lambda: {"total": 0, "correct": 0})
    latencies = []

    for item in test_set:
        content = item["content"]
        expected = item["expected_intent"]
        t0 = time.perf_counter()
        try:
            result = await classifier.classify(content)
            latencies.append((time.perf_counter() - t0) * 1000)
            got = result.intent
            per_intent[expected]["total"] += 1
            if got == expected:
                correct += 1
                per_intent[expected]["correct"] += 1
        except Exception as e:
            print(f"    warn [{expected}]: {e}", flush=True)
            latencies.append((time.perf_counter() - t0) * 1000)
            per_intent[expected]["total"] += 1

    await classifier.close()

    per_intent_acc = {
        intent: counts["correct"] / counts["total"]
        for intent, counts in per_intent.items()
        if counts["total"] > 0
    }

    return {
        "accuracy": correct / total if total else 0.0,
        "correct": correct,
        "total": total,
        "avg_latency_ms": sum(latencies) / len(latencies) if latencies else 0.0,
        "per_intent": per_intent_acc,
    }


# ---------------------------------------------------------------------------
# Markdown output
# ---------------------------------------------------------------------------


def build_markdown(results: dict, installed: dict, ts: str) -> str:
    # Sort by accuracy descending
    sorted_models = sorted(
        [(m, r) for m, r in results.items() if isinstance(r, dict) and "accuracy" in r],
        key=lambda x: x[1]["accuracy"],
        reverse=True,
    )

    # Collect all intent names
    all_intents = set()
    for _, m in sorted_models:
        all_intents.update(m.get("per_intent", {}).keys())
    intents = sorted(all_intents)

    lines = [
        "# Model Benchmark",
        "",
        "Classification accuracy on the 80-example labeled eval set (`eval/test_set.yaml`).",
        "Higher accuracy = fewer wrong classifications on real social media content.",
        "",
        f"_Last run: {ts}_",
        "",
        "---",
        "",
        "## Overall Accuracy",
        "",
        "| Model | Size | Min VRAM | Accuracy | Avg Latency/item |",
        "|-------|------|:--------:|:--------:|:----------------:|",
    ]

    for model, m in sorted_models:
        size_gb = installed.get(model, 0.0)
        lines.append(
            f"| `{model}` | {format_size(size_gb)} | {hardware_tier(size_gb)} "
            f"| **{pct(m['accuracy'])}** ({m['correct']}/{m['total']}) "
            f"| {fmt_ms(m['avg_latency_ms'])} |"
        )

    lines += [
        "",
        "## Per-Intent Accuracy",
        "",
        "Accuracy broken down by intent. Low scores highlight where a model struggles.",
        "",
    ]

    # Per-intent table header
    header = "| Model |" + "".join(f" {i} |" for i in intents)
    sep = "|-------|" + "".join(":---------:|" for _ in intents)
    lines += [header, sep]

    for model, m in sorted_models:
        per = m.get("per_intent", {})
        row = f"| `{model}` |"
        for intent in intents:
            v = per.get(intent)
            row += f" {pct(v) if v is not None else '-'} |"
        lines.append(row)

    lines += [
        "",
        "---",
        "",
        "## Min VRAM by Model Size",
        "",
        "| Min VRAM | Models that fit |",
        "|:--------:|----------------|",
        "| CPU / Any | Models under 1 GB (run without a GPU) |",
        "| 4 GB | Models up to ~3 GB |",
        "| 8 GB | Models up to ~6.5 GB |",
        "| 12 GB | Models up to ~11 GB (gemma3:12b, phi4, qwen2.5:14b) |",
        "| 16 GB | Models up to ~18 GB |",
        "",
        "> Run `python scripts/benchmark.py` to regenerate this table with your own models.",
    ]

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main_async(args):
    installed = get_installed_models()
    test_set = load_test_set()
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")

    results = load_partial_results() if args.resume else {}
    results.pop("updated_at", None)

    print(
        f"Loaded {len(test_set)} eval examples. "
        f"Installed models: {len(installed)}. "
        f"Benchmarking {len(args.models)} models.",
        flush=True,
    )
    if args.resume and results:
        print(f"Resuming: {len(results)} models already done.", flush=True)
    print(flush=True)

    t_start_all = time.perf_counter()

    try:
        for model in args.models:
            if model not in installed:
                print(f"  skip {model} (not installed)", flush=True)
                continue
            if args.resume and model in results:
                print(f"  skip {model} (already done)", flush=True)
                continue

            print(f"  probing {model}...", flush=True)
            if not await probe_model(model, ollama_host):
                print(f"  skip {model} (probe failed - may not load)", flush=True)
                continue

            print(f"  benchmarking {model} ({len(test_set)} examples)...", flush=True)
            try:
                metrics = await bench_model(model, test_set)
                results[model] = metrics
                print(
                    f"  -> accuracy={pct(metrics['accuracy'])} "
                    f"({metrics['correct']}/{metrics['total']}) "
                    f"latency={fmt_ms(metrics['avg_latency_ms'])}",
                    flush=True,
                )
                save_partial_results(results)
            except Exception as e:
                print(f"  ERROR [{model}]: {e}", flush=True)
                traceback.print_exc()
                save_partial_results(results)

    except KeyboardInterrupt:
        print("\nInterrupted - saving partial results...", flush=True)
        save_partial_results(results)
        print(f"Partial results saved to {RESULTS_FILE}", flush=True)
        print("Resume with: python scripts/benchmark.py --resume", flush=True)
        sys.exit(0)

    elapsed = time.perf_counter() - t_start_all
    print(f"\nTotal runtime: {elapsed / 60:.1f} min", flush=True)

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    md = build_markdown(results, installed, ts)

    out_path = ROOT / "docs" / "model-benchmark.md"
    with open(out_path, "w") as f:
        f.write(md)

    save_partial_results(results)
    print(f"Written: {out_path}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="IntentKeeper model benchmark")
    parser.add_argument(
        "--models",
        nargs="+",
        default=DEFAULT_MODELS,
        help="Models to benchmark (default: curated list)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Load existing results and skip already-benchmarked models",
    )
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
