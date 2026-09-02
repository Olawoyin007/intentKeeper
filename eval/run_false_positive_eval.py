#!/usr/bin/env python3
"""Measure how often the classifier flags benign content as manipulation.

Complements run_eval.py (which measures accuracy on manipulation examples but
never tests false positives on good content). Requires the server running.

Usage:
    python eval/run_false_positive_eval.py [path-to-set.yaml]
"""
import json
import sys
import urllib.request
from pathlib import Path

import yaml

URL = "http://localhost:8420/classify"
DEFAULT_SET = Path(__file__).with_name("false_positive_set.yaml")


def classify(text):
    req = urllib.request.Request(
        URL,
        data=json.dumps({"content": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SET
    data = yaml.safe_load(path.read_text())
    benign, controls = data["benign"], data["controls"]

    fp, benign_rows = [], []
    for t in benign:
        d = classify(t)
        benign_rows.append((t, d["intent"], d["confidence"], d["action"]))
        if d["action"] != "pass":
            fp.append((t, d["intent"], d["confidence"], d["action"]))

    missed, control_rows = [], []
    for t in controls:
        d = classify(t)
        control_rows.append((t, d["intent"], d["confidence"], d["action"]))
        if d["action"] == "pass":
            missed.append((t, d["intent"], d["confidence"], d["action"]))

    print("=== BENIGN (should all pass) ===")
    for t, i, c, a in benign_rows:
        mark = "  FP->" if a != "pass" else "  ok  "
        print(f"{mark} {a:5} {i:15} {c:.2f}  {t[:60]}")

    print("\n=== CONTROLS (should all flag) ===")
    for t, i, c, a in control_rows:
        mark = "  MISS" if a == "pass" else "  ok  "
        print(f"{mark} {a:5} {i:15} {c:.2f}  {t[:60]}")

    n = len(benign)
    print("\n=== RESULT ===")
    print(f"Benign items:            {n}")
    print(f"False positives:         {len(fp)}  ({100*len(fp)/n:.0f}% of good content flagged)")
    if fp:
        conf = [c for _, _, c, _ in fp]
        aggressive = [r for r in fp if r[3] in ("blur", "hide")]
        print(f"  FP confidence range:   {min(conf):.2f} - {max(conf):.2f}")
        print(f"  of which blur/hide:    {len(aggressive)}")
    print(f"Controls caught:         {len(controls)-len(missed)}/{len(controls)}")


if __name__ == "__main__":
    main()
