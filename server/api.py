"""
IntentKeeper API Server

FastAPI server that provides content classification endpoints
for the browser extension.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .classifier import ClassificationResult, IntentClassifier

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if os.getenv("DEBUG", "").lower() == "true" else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global classifier instance
classifier: Optional[IntentClassifier] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize classifier on startup."""
    global classifier
    logger.info("Starting IntentKeeper server...")
    classifier = IntentClassifier()

    # Check Ollama health
    if classifier.check_health():
        logger.info(f"Ollama connection OK ({classifier.ollama_host})")
    else:
        logger.warning(f"Ollama not reachable at {classifier.ollama_host}")

    yield

    logger.info("Shutting down IntentKeeper server")


app = FastAPI(
    title="IntentKeeper",
    description="Local content intent classification API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Extension runs from chrome-extension:// origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ClassifyRequest(BaseModel):
    """Request to classify content."""

    content: str = Field(..., min_length=1, description="Text content to classify")
    source: Optional[str] = Field(None, description="Source platform (twitter, youtube, etc)")
    url: Optional[str] = Field(None, description="URL of the content")


class ClassifyResponse(BaseModel):
    """Classification result."""

    intent: str
    confidence: float
    reasoning: str
    action: str
    manipulation_score: float


class BatchClassifyRequest(BaseModel):
    """Request to classify multiple pieces of content."""

    items: List[ClassifyRequest] = Field(..., max_length=50)


class BatchClassifyResponse(BaseModel):
    """Batch classification results."""

    results: List[ClassifyResponse]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    ollama_connected: bool
    model: str


# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check server and Ollama health."""
    ollama_ok = classifier.check_health() if classifier else False
    return HealthResponse(
        status="ok" if ollama_ok else "degraded",
        ollama_connected=ollama_ok,
        model=classifier.model if classifier else "none",
    )


@app.post("/classify", response_model=ClassifyResponse)
async def classify_content(request: ClassifyRequest):
    """
    Classify a single piece of content.

    Returns the detected intent, confidence, and recommended action.
    """
    if not classifier:
        raise HTTPException(status_code=503, detail="Classifier not initialized")

    result = classifier.classify(request.content)

    logger.debug(
        f"Classified: {request.content[:50]}... -> {result.intent} ({result.confidence:.2f})"
    )

    return ClassifyResponse(
        intent=result.intent,
        confidence=result.confidence,
        reasoning=result.reasoning,
        action=result.action,
        manipulation_score=result.manipulation_score,
    )


@app.post("/classify/batch", response_model=BatchClassifyResponse)
async def classify_batch(request: BatchClassifyRequest):
    """
    Classify multiple pieces of content.

    More efficient than multiple single requests.
    """
    if not classifier:
        raise HTTPException(status_code=503, detail="Classifier not initialized")

    results = []
    for item in request.items:
        result = classifier.classify(item.content)
        results.append(
            ClassifyResponse(
                intent=result.intent,
                confidence=result.confidence,
                reasoning=result.reasoning,
                action=result.action,
                manipulation_score=result.manipulation_score,
            )
        )

    return BatchClassifyResponse(results=results)


@app.get("/intents")
async def get_intents():
    """Get the current intent definitions."""
    if not classifier:
        raise HTTPException(status_code=503, detail="Classifier not initialized")

    return classifier.intents


def main():
    """Entry point for the server."""
    host = os.getenv("INTENTKEEPER_HOST", "127.0.0.1")
    port = int(os.getenv("INTENTKEEPER_PORT", "8420"))

    logger.info(f"Starting IntentKeeper server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
