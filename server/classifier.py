"""
IntentClassifier - Classifies content by underlying intent/energy.

Uses local Ollama LLM to detect manipulation patterns in text content.
Adapted from empathySync's classification pipeline.
"""

import json
import logging
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import requests
import yaml

logger = logging.getLogger(__name__)


@dataclass
class ClassificationResult:
    """Result of classifying a piece of content."""

    intent: str  # ragebait, fearmongering, hype, engagement_bait, divisive, genuine, neutral
    confidence: float  # 0.0 to 1.0
    reasoning: str  # Brief explanation
    action: str  # blur, tag, hide, pass
    manipulation_score: float  # 0.0 to 1.0 overall manipulation level


class IntentClassifier:
    """Classifies content intent using local Ollama LLM."""

    def __init__(
        self,
        ollama_host: str = None,
        model: str = None,
        temperature: float = 0.1,
    ):
        self.ollama_host = ollama_host or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2")
        self.temperature = temperature
        self.ollama_url = f"{self.ollama_host}/api/generate"

        # Load intent definitions
        self.intents = self._load_intents()

    def _load_intents(self) -> Dict:
        """Load intent definitions from YAML."""
        scenarios_dir = Path(__file__).parent.parent / "scenarios"
        intents_path = scenarios_dir / "intents.yaml"

        if intents_path.exists():
            with open(intents_path, "r") as f:
                return yaml.safe_load(f)
        else:
            logger.warning(f"Intents file not found at {intents_path}, using defaults")
            return self._default_intents()

    def _default_intents(self) -> Dict:
        """Default intent definitions if YAML not found."""
        return {
            "intents": {
                "ragebait": {
                    "description": "Content designed to provoke anger or outrage",
                    "action": "blur",
                    "weight": 0.9,
                },
                "fearmongering": {
                    "description": "Exaggerated threats or doom content",
                    "action": "tag",
                    "weight": 0.7,
                },
                "hype": {
                    "description": "Manufactured urgency or FOMO triggers",
                    "action": "tag",
                    "weight": 0.5,
                },
                "engagement_bait": {
                    "description": "Empty interaction requests",
                    "action": "hide",
                    "weight": 0.6,
                },
                "divisive": {
                    "description": "Us-vs-them framing, tribal triggers",
                    "action": "tag",
                    "weight": 0.7,
                },
                "genuine": {
                    "description": "Authentic insight or honest perspective",
                    "action": "pass",
                    "weight": 0.0,
                },
                "neutral": {
                    "description": "Informational content, no manipulation",
                    "action": "pass",
                    "weight": 0.0,
                },
            }
        }

    def _build_classification_prompt(self, content: str) -> str:
        """Build the LLM prompt for intent classification."""
        intents_desc = "\n".join(
            f"- {name}: {info['description']}"
            for name, info in self.intents.get("intents", {}).items()
        )

        few_shot = self.intents.get("few_shot_examples", [])
        examples_text = ""
        if few_shot:
            examples_text = "\n\nExamples:\n"
            for ex in few_shot[:5]:
                examples_text += f'Content: "{ex["content"]}"\nIntent: {ex["intent"]}\n\n'

        return f"""Classify the intent/energy of the following social media content.

Intent categories:
{intents_desc}

Rules:
- Focus on HOW the content is framed, not the topic itself
- Political content can be genuine discussion OR ragebait - analyze the framing
- Questions asking for opinions are usually engagement_bait
- Sensational language ("BREAKING", "You won't believe") often indicates manipulation
- Personal stories and specific experiences tend to be genuine
- Content that triggers strong immediate emotional reaction is likely manipulative
{examples_text}
Content to classify:
"{content}"

Respond in JSON format:
{{"intent": "<category>", "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}}

JSON response:"""

    def classify(self, content: str) -> ClassificationResult:
        """
        Classify content intent using the LLM.

        Args:
            content: Text content to classify (tweet, post, headline, etc.)

        Returns:
            ClassificationResult with intent, confidence, and recommended action
        """
        # Skip very short content
        if len(content.strip()) < 10:
            return ClassificationResult(
                intent="neutral",
                confidence=1.0,
                reasoning="Content too short to classify",
                action="pass",
                manipulation_score=0.0,
            )

        prompt = self._build_classification_prompt(content)

        try:
            result = self._call_ollama(prompt)
            return self._parse_response(result)
        except Exception as e:
            logger.error(f"Classification error: {e}")
            # Fail open - don't block content if classification fails
            return ClassificationResult(
                intent="neutral",
                confidence=0.0,
                reasoning=f"Classification failed: {str(e)}",
                action="pass",
                manipulation_score=0.0,
            )

    def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API for classification."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": 150,  # Classification responses are short
            },
        }

        response = requests.post(self.ollama_url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        return result.get("response", "").strip()

    def _parse_response(self, response: str) -> ClassificationResult:
        """Parse LLM response into ClassificationResult."""
        # Try to extract JSON from response
        json_match = re.search(r"\{[^}]+\}", response, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON found in response: {response[:100]}")
            return self._fallback_result()

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON in response: {json_match.group()}")
            return self._fallback_result()

        intent = data.get("intent", "neutral").lower()
        confidence = float(data.get("confidence", 0.5))
        reasoning = data.get("reasoning", "")

        # Validate intent
        valid_intents = self.intents.get("intents", {}).keys()
        if intent not in valid_intents:
            intent = "neutral"

        # Get action and weight from intent config
        intent_config = self.intents.get("intents", {}).get(intent, {})
        action = intent_config.get("action", "pass")
        weight = intent_config.get("weight", 0.0)

        # Calculate manipulation score
        manipulation_score = weight * confidence

        return ClassificationResult(
            intent=intent,
            confidence=confidence,
            reasoning=reasoning,
            action=action,
            manipulation_score=manipulation_score,
        )

    def _fallback_result(self) -> ClassificationResult:
        """Return safe fallback when parsing fails."""
        return ClassificationResult(
            intent="neutral",
            confidence=0.0,
            reasoning="Failed to parse classification",
            action="pass",
            manipulation_score=0.0,
        )

    def classify_batch(self, contents: List[str]) -> List[ClassificationResult]:
        """Classify multiple pieces of content."""
        return [self.classify(content) for content in contents]

    def check_health(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            response = requests.get(f"{self.ollama_host}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
