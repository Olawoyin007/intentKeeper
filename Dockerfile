FROM python:3.12-slim

WORKDIR /app

# gosu lets the entrypoint drop privileges cleanly so SIGTERM from
# `docker stop` reaches uvicorn directly (no extra shell layer).
# curl is needed for the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY pyproject.toml .
COPY server/ server/
COPY scenarios/ scenarios/

RUN pip install --no-cache-dir -e .

RUN mkdir -p data logs

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8420

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8420/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["intentkeeper-server"]
