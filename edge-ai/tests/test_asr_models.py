"""End-to-end speech recognition with the real models. Skipped unless scripts/fetch_models.sh has been run."""
import os

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

MODELS = os.path.join(os.path.dirname(__file__), "..", "models", "asr")
FIX = os.path.join(os.path.dirname(__file__), "fixtures")
pytestmark = pytest.mark.skipif(not os.path.isfile(os.path.join(MODELS, "hi", "model.int8.onnx")), reason="models not fetched")


@pytest.fixture(autouse=True)
def sherpa_models(monkeypatch):
    monkeypatch.setattr(config, "ASR_SHERPA_DIR", MODELS)


client = TestClient(app)


def wav(name: str) -> bytes:
    with open(os.path.join(FIX, name), "rb") as f:
        return f.read()


def test_health_lists_installed_languages():
    asr = client.get("/health").json()["capabilities"]["asr"]
    assert asr["available"] is True
    assert {"hi", "en"} <= set(asr["languages"])


def test_hindi():
    r = client.post("/asr?lang=hi", content=wav("hi.wav"), headers={"Content-Type": "audio/wav"})
    assert r.status_code == 200, r.text
    text = r.json()["text"]
    assert "पेशाब" in text and "जलन" in text


def test_english():
    r = client.post("/asr?lang=en", content=wav("en.wav"), headers={"Content-Type": "audio/wav"})
    assert r.status_code == 200, r.text
    assert "chest pain" in r.json()["text"].lower()


def test_language_without_model_is_503_and_garbage_is_400():
    assert client.post("/asr?lang=ta", content=wav("hi.wav")).status_code == 503
    assert client.post("/asr?lang=hi", content=b"\x00\x01" * 2000).status_code == 400
