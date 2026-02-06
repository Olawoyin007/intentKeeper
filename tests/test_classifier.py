"""
Tests for IntentClassifier
"""

import pytest
from unittest.mock import Mock, patch

from server.classifier import IntentClassifier, ClassificationResult


class TestClassificationResult:
    """Tests for ClassificationResult dataclass."""

    def test_create_result(self):
        result = ClassificationResult(
            intent="ragebait",
            confidence=0.9,
            reasoning="Inflammatory language",
            action="blur",
            manipulation_score=0.81,
        )
        assert result.intent == "ragebait"
        assert result.confidence == 0.9
        assert result.action == "blur"


class TestIntentClassifier:
    """Tests for IntentClassifier."""

    def test_init_loads_default_intents(self):
        """Classifier initializes with default intents if YAML not found."""
        with patch("server.classifier.Path.exists", return_value=False):
            classifier = IntentClassifier()
            assert "ragebait" in classifier.intents.get("intents", {})
            assert "genuine" in classifier.intents.get("intents", {})

    def test_short_content_returns_neutral(self):
        """Very short content should be classified as neutral."""
        classifier = IntentClassifier()
        result = classifier.classify("Hi")
        assert result.intent == "neutral"
        assert result.action == "pass"

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_classify_ragebait(self, mock_ollama):
        """Test classification of ragebait content."""
        mock_ollama.return_value = '{"intent": "ragebait", "confidence": 0.9, "reasoning": "Inflammatory"}'

        classifier = IntentClassifier()
        result = classifier.classify("This is EXACTLY why I hate them. Every. Single. Time.")

        assert result.intent == "ragebait"
        assert result.action == "blur"
        assert result.confidence == 0.9

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_classify_genuine(self, mock_ollama):
        """Test classification of genuine content."""
        mock_ollama.return_value = '{"intent": "genuine", "confidence": 0.85, "reasoning": "Personal experience"}'

        classifier = IntentClassifier()
        result = classifier.classify("I've been dealing with this for 10 years. Here's what helped me.")

        assert result.intent == "genuine"
        assert result.action == "pass"
        assert result.manipulation_score == 0.0

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_classification_error_fails_open(self, mock_ollama):
        """Classification errors should fail open (return neutral)."""
        mock_ollama.side_effect = Exception("API error")

        classifier = IntentClassifier()
        result = classifier.classify("Some content")

        assert result.intent == "neutral"
        assert result.action == "pass"

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_invalid_json_fails_open(self, mock_ollama):
        """Invalid JSON response should fail open."""
        mock_ollama.return_value = "not valid json"

        classifier = IntentClassifier()
        result = classifier.classify("Some content")

        assert result.intent == "neutral"

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_unknown_intent_defaults_to_neutral(self, mock_ollama):
        """Unknown intent should default to neutral."""
        mock_ollama.return_value = '{"intent": "unknown_category", "confidence": 0.9, "reasoning": "Test"}'

        classifier = IntentClassifier()
        result = classifier.classify("Some content")

        assert result.intent == "neutral"

    @patch("server.classifier.requests.get")
    def test_health_check_success(self, mock_get):
        """Health check returns True when Ollama is reachable."""
        mock_get.return_value.status_code = 200

        classifier = IntentClassifier()
        assert classifier.check_health() is True

    @patch("server.classifier.requests.get")
    def test_health_check_failure(self, mock_get):
        """Health check returns False when Ollama is not reachable."""
        mock_get.side_effect = Exception("Connection refused")

        classifier = IntentClassifier()
        assert classifier.check_health() is False


class TestManipulationScore:
    """Tests for manipulation score calculation."""

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_ragebait_high_manipulation(self, mock_ollama):
        """Ragebait with high confidence should have high manipulation score."""
        mock_ollama.return_value = '{"intent": "ragebait", "confidence": 0.9, "reasoning": "Test"}'

        classifier = IntentClassifier()
        result = classifier.classify("Inflammatory content")

        # ragebait weight is 0.9, confidence is 0.9, so score = 0.81
        assert result.manipulation_score == pytest.approx(0.81, rel=0.01)

    @patch("server.classifier.IntentClassifier._call_ollama")
    def test_genuine_zero_manipulation(self, mock_ollama):
        """Genuine content should have zero manipulation score."""
        mock_ollama.return_value = '{"intent": "genuine", "confidence": 0.95, "reasoning": "Test"}'

        classifier = IntentClassifier()
        result = classifier.classify("Genuine content")

        # genuine weight is 0.0, so score is always 0
        assert result.manipulation_score == 0.0
