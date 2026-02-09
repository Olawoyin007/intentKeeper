"""
Tests for IntentClassifier and API endpoints.

Covers:
- ClassificationResult dataclass
- Classifier unit tests (with mocked Ollama)
- Cache behavior (TTL, LRU eviction)
- Manipulation score calculation
- Edge cases (long content, unicode, malformed responses)
- FastAPI endpoint integration tests
"""

import asyncio
import time

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from server.classifier import (
    ClassificationResult,
    IntentClassifier,
    MIN_CONTENT_LENGTH,
    MAX_CONTENT_LENGTH,
)
from server.api import app


# --- Helpers ---

def make_classifier(**kwargs) -> IntentClassifier:
    """Create a classifier with defaults suitable for testing."""
    return IntentClassifier(**kwargs)


def mock_ollama_response(intent="neutral", confidence=0.5, reasoning="Test"):
    """Build a JSON string mimicking Ollama's output."""
    return f'{{"intent": "{intent}", "confidence": {confidence}, "reasoning": "{reasoning}"}}'


# --- ClassificationResult ---

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


# --- Classifier unit tests ---

class TestIntentClassifier:
    """Tests for IntentClassifier."""

    def test_init_loads_default_intents(self):
        """Classifier initializes with default intents if YAML not found."""
        with patch("server.classifier.Path.exists", return_value=False):
            classifier = make_classifier()
            assert "ragebait" in classifier.intents.get("intents", {})
            assert "genuine" in classifier.intents.get("intents", {})

    @pytest.mark.asyncio
    async def test_short_content_returns_neutral(self):
        """Very short content should be classified as neutral."""
        classifier = make_classifier()
        result = await classifier.classify("Hi")
        assert result.intent == "neutral"
        assert result.action == "pass"

    @pytest.mark.asyncio
    async def test_classify_ragebait(self):
        """Test classification of ragebait content."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("ragebait", 0.9, "Inflammatory")
        )

        result = await classifier.classify(
            "This is EXACTLY why I hate them. Every. Single. Time."
        )
        assert result.intent == "ragebait"
        assert result.action == "blur"
        assert result.confidence == 0.9

    @pytest.mark.asyncio
    async def test_classify_genuine(self):
        """Test classification of genuine content."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("genuine", 0.85, "Personal experience")
        )

        result = await classifier.classify(
            "I've been dealing with this for 10 years. Here's what helped me."
        )
        assert result.intent == "genuine"
        assert result.action == "pass"
        assert result.manipulation_score == 0.0

    @pytest.mark.asyncio
    async def test_classification_error_fails_open(self):
        """Classification errors should fail open (return neutral)."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(side_effect=Exception("API error"))

        result = await classifier.classify("Some content that is long enough")
        assert result.intent == "neutral"
        assert result.action == "pass"

    @pytest.mark.asyncio
    async def test_invalid_json_fails_open(self):
        """Invalid JSON response should fail open."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(return_value="not valid json at all")

        result = await classifier.classify("Some content that is long enough")
        assert result.intent == "neutral"

    @pytest.mark.asyncio
    async def test_unknown_intent_defaults_to_neutral(self):
        """Unknown intent should default to neutral."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("unknown_category", 0.9, "Test")
        )

        result = await classifier.classify("Some content that is long enough")
        assert result.intent == "neutral"

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Health check returns True when Ollama is reachable."""
        classifier = make_classifier()
        mock_client = AsyncMock()
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_client.get = AsyncMock(return_value=mock_response)
        classifier._http_client = mock_client

        assert await classifier.check_health() is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """Health check returns False when Ollama is not reachable."""
        classifier = make_classifier()
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("Connection refused"))
        classifier._http_client = mock_client

        assert await classifier.check_health() is False


# --- Manipulation score ---

class TestManipulationScore:
    """Tests for manipulation score calculation."""

    @pytest.mark.asyncio
    async def test_ragebait_high_manipulation(self):
        """Ragebait with high confidence should have high manipulation score."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("ragebait", 0.9, "Test")
        )

        result = await classifier.classify("Inflammatory content here")
        # ragebait weight is 0.9, confidence is 0.9, so score = 0.81
        assert result.manipulation_score == pytest.approx(0.81, rel=0.01)

    @pytest.mark.asyncio
    async def test_genuine_zero_manipulation(self):
        """Genuine content should have zero manipulation score."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("genuine", 0.95, "Test")
        )

        result = await classifier.classify("Genuine content here today")
        # genuine weight is 0.0, so score is always 0
        assert result.manipulation_score == 0.0


# --- Cache behavior ---

class TestCache:
    """Tests for in-memory classification cache."""

    @pytest.mark.asyncio
    async def test_cache_hit_avoids_ollama_call(self):
        """Second classification of same content should use cache."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("hype", 0.7, "Cached test")
        )

        content = "This is some content to classify for caching"
        result1 = await classifier.classify(content)
        result2 = await classifier.classify(content)

        assert result1.intent == result2.intent
        # Ollama should only be called once
        assert classifier._call_ollama.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_ttl_expiration(self):
        """Expired cache entries should be evicted and re-classified."""
        classifier = make_classifier()
        classifier._cache_ttl = 0  # Expire immediately
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("hype", 0.7, "TTL test")
        )

        content = "Content for TTL testing purposes here"
        await classifier.classify(content)

        # Wait a tiny bit so the entry expires (TTL=0 means instant expiry)
        await asyncio.sleep(0.01)

        await classifier.classify(content)
        # Should have called Ollama twice because cache expired
        assert classifier._call_ollama.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_lru_eviction(self):
        """Cache should evict oldest entries when at capacity."""
        classifier = make_classifier()
        classifier._max_cache_size = 2
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("neutral", 0.5, "LRU test")
        )

        await classifier.classify("First piece of content here aa")
        await classifier.classify("Second piece of content here bb")
        await classifier.classify("Third piece of content here cc")

        # Cache should have 2 entries (second and third), first evicted
        assert len(classifier._cache) == 2

    @pytest.mark.asyncio
    async def test_failed_classification_not_cached(self):
        """Failed classifications (confidence=0) should not be cached."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(side_effect=Exception("fail"))

        await classifier.classify("Content that will fail to classify")
        assert len(classifier._cache) == 0


# --- Edge cases ---

class TestEdgeCases:
    """Tests for edge case handling."""

    @pytest.mark.asyncio
    async def test_content_at_min_length_boundary(self):
        """Content exactly at MIN_CONTENT_LENGTH should be classified."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("neutral", 0.5, "Boundary")
        )

        # Content with exactly MIN_CONTENT_LENGTH chars (after strip)
        content = "a" * MIN_CONTENT_LENGTH
        result = await classifier.classify(content)
        # Should NOT be skipped — it meets the minimum
        assert classifier._call_ollama.call_count == 1

    @pytest.mark.asyncio
    async def test_very_long_content_is_truncated(self):
        """Content longer than MAX_CONTENT_LENGTH should be truncated in the prompt."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("neutral", 0.5, "Long")
        )

        long_content = "Q" * (MAX_CONTENT_LENGTH + 500)
        await classifier.classify(long_content)

        # The prompt should contain at most MAX_CONTENT_LENGTH "Q" chars,
        # not the full long_content. "Q" doesn't appear in the prompt prefix.
        call_args = classifier._call_ollama.call_args[0][0]
        # The prompt should NOT contain all 2500 Q's — only up to MAX_CONTENT_LENGTH
        q_count = call_args.count("Q")
        assert q_count <= MAX_CONTENT_LENGTH + 10  # small margin for prompt text
        assert q_count < MAX_CONTENT_LENGTH + 500  # definitely not the full content

    @pytest.mark.asyncio
    async def test_unicode_content(self):
        """Unicode and emoji content should be handled without errors."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("genuine", 0.8, "Unicode")
        )

        result = await classifier.classify("This is great content! Merci beaucoup! Danke schon!")
        assert result.intent == "genuine"

    @pytest.mark.asyncio
    async def test_confidence_clamped_to_valid_range(self):
        """Confidence values outside 0-1 should be clamped."""
        classifier = make_classifier()

        # Test confidence > 1.0
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("ragebait", 1.5, "Over")
        )
        result = await classifier.classify("Content with inflated confidence")
        assert result.confidence == 1.0

    @pytest.mark.asyncio
    async def test_confidence_clamped_negative(self):
        """Negative confidence should be clamped to 0."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value='{"intent": "ragebait", "confidence": -0.5, "reasoning": "Negative"}'
        )
        result = await classifier.classify("Content with negative confidence")
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_batch_classification(self):
        """Batch classification should process all items."""
        classifier = make_classifier()
        call_count = 0

        async def mock_ollama(prompt):
            nonlocal call_count
            call_count += 1
            return mock_ollama_response("neutral", 0.5, f"Batch item {call_count}")

        classifier._call_ollama = mock_ollama

        contents = [
            "First batch item content here",
            "Second batch item content here",
            "Third batch item content here",
        ]
        results = await classifier.classify_batch(contents)
        assert len(results) == 3
        assert all(r.intent == "neutral" for r in results)

    @pytest.mark.asyncio
    async def test_retry_on_transient_failure(self):
        """Classifier should retry once on transient Ollama failure."""
        classifier = make_classifier()

        call_count = 0

        async def flaky_ollama(prompt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ConnectionError("Temporary failure")
            return mock_ollama_response("genuine", 0.8, "Recovered")

        classifier._call_ollama = flaky_ollama

        result = await classifier.classify("Content to test retry logic here")
        assert result.intent == "genuine"
        assert call_count == 2  # First call failed, second succeeded


# --- API integration tests ---

class TestAPIEndpoints:
    """Integration tests for FastAPI endpoints."""

    @pytest.fixture
    def mock_classifier(self):
        """Patch the global classifier in api module."""
        classifier = make_classifier()
        classifier._call_ollama = AsyncMock(
            return_value=mock_ollama_response("ragebait", 0.9, "API test")
        )
        classifier.check_health = AsyncMock(return_value=True)
        return classifier

    @pytest.mark.asyncio
    async def test_health_endpoint(self, mock_classifier):
        """GET /health should return health status."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["ollama_connected"] is True

    @pytest.mark.asyncio
    async def test_classify_endpoint(self, mock_classifier):
        """POST /classify should return classification result."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/classify",
                    json={"content": "This is OUTRAGEOUS content that makes me angry!"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "ragebait"
        assert data["action"] == "blur"
        assert "confidence" in data
        assert "manipulation_score" in data

    @pytest.mark.asyncio
    async def test_classify_empty_content_rejected(self, mock_classifier):
        """POST /classify with empty content should return 422."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post("/classify", json={"content": ""})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_classify_too_long_content_rejected(self, mock_classifier):
        """POST /classify with content exceeding max length should return 422."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/classify",
                    json={"content": "x" * (MAX_CONTENT_LENGTH + 1)},
                )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_endpoint(self, mock_classifier):
        """POST /classify/batch should return results for all items."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/classify/batch",
                    json={
                        "items": [
                            {"content": "First item content here for testing"},
                            {"content": "Second item content here for testing"},
                        ]
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 2

    @pytest.mark.asyncio
    async def test_intents_endpoint(self, mock_classifier):
        """GET /intents should return intent definitions."""
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/intents")

        assert response.status_code == 200
        data = response.json()
        assert "intents" in data
        assert "ragebait" in data["intents"]

    @pytest.mark.asyncio
    async def test_health_degraded_when_ollama_down(self, mock_classifier):
        """GET /health should return degraded when Ollama is unreachable."""
        mock_classifier.check_health = AsyncMock(return_value=False)
        with patch("server.api.classifier", mock_classifier):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["ollama_connected"] is False
