# On-premise AI service. The base image runs Hindi + English speech recognition on CPU (sherpa-onnx);
# other model backends are added with  docker build --build-arg EXTRAS=1 ...
# Fetch the speech models once into the models volume:
#   docker compose --profile ai run --rm edge-ai scripts/fetch_models.sh
FROM python:3.11-slim
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl bzip2 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements-models.txt ./
ARG EXTRAS=0
RUN pip install --no-cache-dir -r requirements.txt && if [ "$EXTRAS" = "1" ]; then pip install --no-cache-dir -r requirements-models.txt; fi
COPY app ./app
COPY scripts ./scripts
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8090/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
