"""
Hospital OS — on-premise Edge AI service.

Runs open models on the hospital's own machine so patient audio and text never leave the premises.
The Node backend (EDGE_AI_URL) is the only intended client; bind to localhost or a private network.

    uvicorn app.main:app --host 127.0.0.1 --port 8090
"""
from __future__ import annotations

import logging
import platform

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from . import config
from .engines import ENGINES, LANGS, asr, llm, ocr, translator, tts, _device

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = FastAPI(title="Hospital OS Edge AI", version="1.0.0", docs_url=None, redoc_url=None)


def require_token(authorization: str = Header(default="")) -> None:
    if config.TOKEN and authorization != f"Bearer {config.TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def check_lang(lang: str) -> str:
    if lang not in LANGS:
        raise HTTPException(status_code=400, detail=f"Unsupported language '{lang}'")
    return lang


def run(engine_name: str, fn):
    engine = ENGINES[engine_name]
    if not engine.configured():
        raise HTTPException(status_code=503, detail=f"{engine_name} model is not installed")
    try:
        return fn()
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # model errors must not crash the service
        logging.getLogger("edge-ai").exception("%s failed", engine_name)
        raise HTTPException(status_code=500, detail=f"{engine_name} failed: {type(e).__name__}")


@app.get("/health")
def health(_: None = Depends(require_token)):
    caps = {name: e.status() for name, e in ENGINES.items()}
    for name in ("asr", "tts", "translate"):
        caps[name]["languages"] = [l for l in LANGS if not (name == "asr" and l == "or")] if caps[name]["available"] else []
    return {"status": "ok", "device": f"{_device()} ({platform.machine()})", "capabilities": caps}


@app.post("/asr")
async def transcribe(request: Request, lang: str = Query("hi"), _: None = Depends(require_token)):
    audio = await request.body()
    if len(audio) < 1000:
        raise HTTPException(status_code=400, detail="No audio received")
    if len(audio) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too long")
    check_lang(lang)
    return run("asr", lambda: asr.transcribe(audio, lang))


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    lang: str = "hi"


@app.post("/tts")
def synthesize(body: TtsIn, _: None = Depends(require_token)):
    check_lang(body.lang)
    wav = run("tts", lambda: tts.synthesize(body.text, body.lang))
    return Response(content=wav, media_type="audio/wav")


class TranslateIn(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=40)
    source: str = "en"
    target: str = "hi"


@app.post("/translate")
def translate(body: TranslateIn, _: None = Depends(require_token)):
    check_lang(body.source)
    check_lang(body.target)
    texts = [t[:400] for t in body.texts]
    out = run("translate", lambda: translator.translate(texts, body.source, body.target))
    return {"translations": out, "model": translator.model_name()}


class ExtractIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    lang: str = "hi"


@app.post("/extract")
def extract(body: ExtractIn, _: None = Depends(require_token)):
    check_lang(body.lang)
    result = run("llm", lambda: llm.extract(body.text, body.lang))
    return {"findings": result.get("findings", []), "model": llm.model_name()}


class SoapIn(BaseModel):
    transcript: str = Field(default="", max_length=12000)
    structured: dict = Field(default_factory=dict)
    careStream: str = "UNDECIDED"


@app.post("/soap")
def soap(body: SoapIn, _: None = Depends(require_token)):
    result = run("llm", lambda: llm.soap(body.transcript, body.structured, body.careStream))
    return {**result, "model": llm.model_name()}


@app.post("/ocr")
async def read_document(request: Request, _: None = Depends(require_token)):
    image = await request.body()
    if not image or len(image) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image missing or too large")
    result = run("ocr", lambda: ocr.read(image))
    return {**result, "model": ocr.model_name()}
