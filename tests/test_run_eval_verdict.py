"""
Tests for eval/run_eval.py's structured verdict.

This is the harness the nightly run drives (`--result-json`), distinct from
tests/eval/run_eval.py. build_result() is deliberately separate from run() so
the verdict shape can be checked without loading a model.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "eval"))

from run_eval import build_result  # noqa: E402


def _meta(model="llama3.1:8b"):
    return {
        "eval": "intentkeeper",
        "eval_version": "2026.09-r2",
        "model": model,
        "dataset": "eval/test_set.yaml",
        "dataset_hash": "1400100babef",
    }


class TestBuildResult:
    def test_records_the_model_that_produced_the_score(self):
        # A score with no model is not comparable: the 96% baseline is
        # llama3.1:8b, and a different model scoring 94% is not a regression.
        result = build_result(_meta("gemma3:12b"), 99, 105, {}, [])
        assert result["model"] == "gemma3:12b"

    def test_score_pct_matches_correct_over_total(self):
        result = build_result(_meta(), 99, 105, {}, [])
        assert result["score_pct"] == 94.3
        assert result["correct"] == 99
        assert result["total"] == 105

    def test_empty_test_set_does_not_divide_by_zero(self):
        result = build_result(_meta(), 0, 0, {}, [])
        assert result["score_pct"] == 0.0

    def test_per_intent_accuracy_is_computed_and_sorted(self):
        per_intent = {
            "ragebait": {"correct": 15, "total": 15},
            "engagement_bait": {"correct": 11, "total": 14},
        }
        result = build_result(_meta(), 26, 29, per_intent, [])
        assert list(result["per_intent"]) == ["engagement_bait", "ragebait"]
        assert result["per_intent"]["ragebait"]["acc_pct"] == 100.0
        assert result["per_intent"]["engagement_bait"]["acc_pct"] == 78.6

    def test_failed_checks_carry_the_call_and_truncate_content(self):
        wrong = [
            {
                "expected": "engagement_bait",
                "got": "divisive",
                "confidence": 0.9012,
                "content": "x" * 300,
                "note": "clear - manufactured tribal conflict",
            }
        ]
        result = build_result(_meta(), 104, 105, {}, wrong)
        check = result["failed_checks"][0]
        assert check["expected"] == "engagement_bait"
        assert check["got"] == "divisive"
        assert check["confidence"] == 0.9
        assert len(check["content"]) == 120
