"""
Tests for eval/run_false_positive_eval.py's grouping and reporting.

The probe set is grouped by the kind of good content each item is, because an
overall rate cannot say whether a change fixed something or just added easier
examples - adding items moves the denominator. These tests pin that the
per-group arithmetic is right, using a stubbed classifier so no server or model
is needed.
"""

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent / "eval"))

import run_false_positive_eval as fp  # noqa: E402

SET_PATH = Path(__file__).parent.parent / "eval" / "false_positive_set.yaml"


def _run(flagged: set) -> str:
    """Run main() with a stub that flags exactly `flagged`, and capture output."""
    data = yaml.safe_load(SET_PATH.read_text())
    controls = set(data["controls"])

    def stub(text):
        if text in flagged:
            return {"intent": "ragebait", "confidence": 0.91, "action": "blur"}
        if text in controls:
            return {"intent": "fearmongering", "confidence": 0.95, "action": "tag"}
        return {"intent": "genuine", "confidence": 0.9, "action": "pass"}

    original, fp.classify = fp.classify, stub
    argv, sys.argv = sys.argv, ["run_false_positive_eval.py"]
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            fp.main()
    finally:
        fp.classify, sys.argv = original, argv
    return buf.getvalue()


class TestProbeSet:
    def test_benign_is_grouped_not_a_flat_list(self):
        data = yaml.safe_load(SET_PATH.read_text())
        assert isinstance(data["benign"], dict), "benign must be grouped by kind"
        assert all(isinstance(v, list) for v in data["benign"].values())

    def test_no_duplicate_items_across_groups(self):
        data = yaml.safe_load(SET_PATH.read_text())
        items = [t for group in data["benign"].values() for t in group]
        assert len(items) == len(set(items)), "a duplicate skews its group's rate"


class TestReporting:
    def test_clean_run_reports_zero_everywhere(self):
        out = _run(flagged=set())
        assert "0% of good content flagged" in out
        assert "Controls caught:         6/6" in out

    def test_group_rate_counts_only_its_own_group(self):
        data = yaml.safe_load(SET_PATH.read_text())
        target = data["benign"]["sincere_question"]
        out = _run(flagged=set(target))
        assert f"sincere_question{' ' * 22} {len(target):>2}/{len(target):<2} 100%" in out
        assert "life_updates" in out and " 0%" in out

    def test_worst_group_is_listed_first(self):
        data = yaml.safe_load(SET_PATH.read_text())
        out = _run(flagged=set(data["benign"]["dialect_and_slang"]))
        body = out.split("=== BY GROUP ===")[1]
        assert body.strip().splitlines()[0].strip().startswith("dialect_and_slang")
