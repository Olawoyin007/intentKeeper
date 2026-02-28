FROM python:3.12-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY pyproject.toml .
COPY server/ server/
COPY scenarios/ scenarios/

RUN pip install --no-cache-dir -e .

EXPOSE 8420

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8420/health || exit 1

CMD ["intentkeeper-server"]
