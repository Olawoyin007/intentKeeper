#!/bin/sh
set -e

echo "[ollama] Starting Ollama server..."
ollama serve &

echo "[ollama] Waiting for Ollama to be ready..."
until ollama list >/dev/null 2>&1; do
  sleep 2
done

if [ -z "$OLLAMA_MODEL" ]; then
  echo "[ollama] ERROR: OLLAMA_MODEL is not set"
  exit 1
fi

if ! ollama list | grep -q "$OLLAMA_MODEL"; then
  echo "[ollama] Pulling model: $OLLAMA_MODEL"
  ollama pull "$OLLAMA_MODEL"
else
  echo "[ollama] Model already present: $OLLAMA_MODEL"
fi

wait
