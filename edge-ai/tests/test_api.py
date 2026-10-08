"""Runs without any model installed: the service must start, report honestly and refuse cleanly."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_missing_models():
    r = client.get("/health")
    assert r.status_code == 200
    caps = r.json()["capabilities"]
    assert set(caps) == {"asr", "tts", "translate", "llm", "ocr"}
    assert all(c["available"] is False for c in caps.values())


def test_endpoints_return_503_without_models():
    assert client.post("/asr?lang=hi", content=b"x" * 2000).status_code == 503
    assert client.post("/tts", json={"text": "नमस्ते", "lang": "hi"}).status_code == 503
    assert client.post("/translate", json={"texts": ["Take twice daily"], "target": "hi"}).status_code == 503
    assert client.post("/extract", json={"text": "मेरे पेट में दर्द है", "lang": "hi"}).status_code == 503
    assert client.post("/soap", json={"transcript": "x"}).status_code == 503


def test_validation():
    assert client.post("/asr?lang=hi", content=b"short").status_code == 400
    assert client.post("/translate", json={"texts": ["x"], "target": "fr"}).status_code == 400
