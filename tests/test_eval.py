"""
Tests for tests/eval/run_eval.py

Covers the pure computation functions (compute_metrics, load_ground_truth)
without requiring a live Ollama connection.
"""

from pathlib import Path

import pytest

from tests.eval.run_eval import compute_metrics, load_ground_truth

GROUND_TRUTH_PATH = Path(__file__).parent / "eval" / "ground_truth.yaml"


# ---- load_ground_truth ----


class TestLoadGroundTruth:
    def test_loads_all_examples(self):
        examples = load_ground_truth(GROUND_TRUTH_PATH)
        assert len(examples) > 0

    def test_each_example_has_required_keys(self):
        examples = load_ground_truth(GROUND_TRUTH_PATH)
        for ex in examples:
            assert "content" in ex, f"Missing 'content' in example: {ex}"
            assert "intent" in ex, f"Missing 'intent' in example: {ex}"

    def test_intent_filter_returns_only_matching(self):
        examples = load_ground_truth(GROUND_TRUTH_PATH, intent_filter="ragebait")
        assert len(examples) > 0
        assert all(e["intent"] == "ragebait" for e in examples)

    def test_intent_filter_unknown_intent_returns_empty(self):
        examples = load_ground_truth(GROUND_TRUTH_PATH, intent_filter="nonexistent_intent")
        assert examples == []

    def test_all_nine_intents_present(self):
        examples = load_ground_truth(GROUND_TRUTH_PATH)
        found = {e["intent"] for e in examples}
        expected = {
            "ragebait",
            "fearmongering",
            "hype",
            "engagement_bait",
            "divisive",
            "genuine",
            "neutral",
            "clickbait",
            "reaction_farming",
        }
        assert expected == found, f"Missing intents: {expected - found}"

    def test_no_filter_returns_more_than_any_single_intent(self):
        all_examples = load_ground_truth(GROUND_TRUTH_PATH)
        ragebait_only = load_ground_truth(GROUND_TRUTH_PATH, intent_filter="ragebait")
        assert len(all_examples) > len(ragebait_only)


# ---- compute_metrics ----


def _make_results(pairs: list[tuple[str, str]]) -> list[dict]:
    """Build a results list from (expected, predicted) pairs."""
    return [{"expected": e, "predicted": p} for e, p in pairs]


class TestComputeMetrics:
    def test_perfect_predictions(self):
        results = _make_results(
            [
                ("ragebait", "ragebait"),
                ("genuine", "genuine"),
                ("neutral", "neutral"),
            ]
        )
        per_intent, overall = compute_metrics(results)
        assert overall["accuracy"] == 1.0
        assert overall["macro_f1"] == 1.0
        for intent in ["ragebait", "genuine", "neutral"]:
            assert per_intent[intent]["precision"] == 1.0
            assert per_intent[intent]["recall"] == 1.0
            assert per_intent[intent]["f1"] == 1.0

    def test_all_wrong_predictions(self):
        results = _make_results(
            [
                ("ragebait", "neutral"),
                ("ragebait", "neutral"),
            ]
        )
        per_intent, overall = compute_metrics(results)
        assert overall["accuracy"] == 0.0
        assert per_intent["ragebait"]["recall"] == 0.0
        assert per_intent["ragebait"]["tp"] == 0
        assert per_intent["ragebait"]["fn"] == 2

    def test_precision_and_recall_calculated_correctly(self):
        # 2 ragebait, 1 correctly predicted, 1 missed
        # 1 false positive (genuine predicted as ragebait)
        results = _make_results(
            [
                ("ragebait", "ragebait"),  # TP
                ("ragebait", "neutral"),  # FN
                ("genuine", "ragebait"),  # FP
            ]
        )
        per_intent, _ = compute_metrics(results)
        m = per_intent["ragebait"]
        assert m["tp"] == 1
        assert m["fp"] == 1
        assert m["fn"] == 1
        assert m["precision"] == pytest.approx(0.5)
        assert m["recall"] == pytest.approx(0.5)
        assert m["f1"] == pytest.approx(0.5)

    def test_support_counts_only_expected_not_predicted(self):
        # ragebait: expected 3 times, predicted 5 times - support should be 3
        results = _make_results(
            [
                ("ragebait", "ragebait"),
                ("ragebait", "ragebait"),
                ("ragebait", "ragebait"),
                ("genuine", "ragebait"),
                ("neutral", "ragebait"),
            ]
        )
        per_intent, _ = compute_metrics(results)
        assert per_intent["ragebait"]["support"] == 3

    def test_macro_f1_averages_only_intents_with_support(self):
        # Only ragebait and genuine have examples (support > 0)
        # neutral is only predicted, not expected - no support
        results = _make_results(
            [
                ("ragebait", "ragebait"),
                ("genuine", "genuine"),
                ("genuine", "neutral"),  # neutral predicted but never expected
            ]
        )
        per_intent, overall = compute_metrics(results)
        # neutral has support=0, so macro F1 averages only ragebait and genuine
        assert per_intent["neutral"]["support"] == 0
        active = [i for i in per_intent if per_intent[i]["support"] > 0]
        expected_macro = sum(per_intent[i]["f1"] for i in active) / len(active)
        assert overall["macro_f1"] == pytest.approx(expected_macro)

    def test_zero_division_handled_gracefully(self):
        # An intent predicted but never expected: precision defined, recall = 0/0
        results = _make_results(
            [
                ("genuine", "ragebait"),  # ragebait predicted but never expected
            ]
        )
        per_intent, overall = compute_metrics(results)
        # ragebait: tp=0, fp=1, fn=0 -> precision=0, recall=0/0 -> 0.0
        assert per_intent["ragebait"]["precision"] == 0.0
        assert per_intent["ragebait"]["recall"] == 0.0
        assert per_intent["ragebait"]["f1"] == 0.0

    def test_overall_accuracy(self):
        results = _make_results(
            [
                ("ragebait", "ragebait"),  # correct
                ("genuine", "genuine"),  # correct
                ("neutral", "ragebait"),  # wrong
                ("hype", "hype"),  # correct
            ]
        )
        _, overall = compute_metrics(results)
        assert overall["correct"] == 3
        assert overall["total"] == 4
        assert overall["accuracy"] == pytest.approx(0.75)

    def test_single_result(self):
        results = _make_results([("ragebait", "ragebait")])
        per_intent, overall = compute_metrics(results)
        assert overall["accuracy"] == 1.0
        assert overall["total"] == 1
