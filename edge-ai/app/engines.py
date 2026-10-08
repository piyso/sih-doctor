"""
Model backends. Each engine loads lazily on first use and reports whether it is available, so the
service runs (and answers /health honestly) on a machine with none, some or all models installed.
"""
from __future__ import annotations

import io
import json
import logging
import os
import tempfile
import threading
from typing import Any

from . import config

log = logging.getLogger("edge-ai")

LANGS = ["en", "hi", "mr", "bn", "ta", "te", "gu", "kn", "ml", "pa", "or"]
WHISPER_LANGS = {"en", "hi", "mr", "bn", "ta", "te", "gu", "kn", "ml", "pa"}  # Whisper has no Odia
INDICTRANS = {
    "en": "eng_Latn", "hi": "hin_Deva", "mr": "mar_Deva", "bn": "ben_Beng", "ta": "tam_Taml", "te": "tel_Telu",
    "gu": "guj_Gujr", "kn": "kan_Knda", "ml": "mal_Mlym", "pa": "pan_Guru", "or": "ory_Orya",
}


def _device() -> str:
    if config.DEVICE != "auto":
        return config.DEVICE
    try:
        import torch  # noqa: F401
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


class Engine:
    name = "engine"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._error: str | None = None
        self._loaded = False

    def configured(self) -> bool:
        return False

    def model_name(self) -> str:
        return ""

    def _load(self) -> Any:  # pragma: no cover - needs model files
        raise NotImplementedError

    def get(self) -> Any:
        if not self.configured():
            raise RuntimeError(f"{self.name} is not configured")
        with self._lock:
            if not self._loaded:
                try:
                    self._model = self._load()
                    log.info("%s loaded: %s", self.name, self.model_name())
                except Exception as e:  # keep the service up; report the problem in /health
                    self._error = f"{type(e).__name__}: {e}"
                    log.exception("%s failed to load", self.name)
                self._loaded = True
        if self._model is None:
            raise RuntimeError(self._error or f"{self.name} unavailable")
        return self._model

    def status(self) -> dict:
        d = {"available": self.configured() and self._error is None, "model": self.model_name() or None}
        if self._error:
            d["error"] = self._error
        return d


# --------------------------------------------------------------------------- speech recognition
def _sherpa_dirs() -> dict[str, str]:
    """Languages with a sherpa-onnx model folder under ASR_SHERPA_DIR."""
    root = config.ASR_SHERPA_DIR
    if not root or not os.path.isdir(root):
        return {}
    out = {}
    for lang in LANGS:
        d = os.path.join(root, lang)
        if os.path.isfile(os.path.join(d, "tokens.txt")) and (
            os.path.isfile(os.path.join(d, "model.int8.onnx")) or os.path.isfile(os.path.join(d, "encoder.int8.onnx"))
        ):
            out[lang] = d
    return out


def decode_audio(audio: bytes) -> tuple[Any, int]:
    """Returns (float32 mono samples, sample rate). WAV/FLAC/OGG via soundfile; WebM/MP4 via PyAV if installed."""
    import numpy as np
    import soundfile as sf
    try:
        data, sr = sf.read(io.BytesIO(audio), dtype="float32", always_2d=True)
        return np.ascontiguousarray(data.mean(axis=1)), sr
    except Exception:
        pass
    try:
        import av  # installed with faster-whisper
    except ImportError as e:
        raise ValueError("Send 16 kHz WAV audio (install PyAV to accept WebM/MP4)") from e
    with av.open(io.BytesIO(audio)) as container:
        resampler = av.AudioResampler(format="flt", layout="mono", rate=16000)
        chunks = []
        for frame in container.decode(audio=0):
            for f in resampler.resample(frame):
                chunks.append(f.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError("No audio in the recording")
    return np.concatenate(chunks).astype("float32"), 16000


class AsrEngine(Engine):
    """sherpa-onnx per-language models (preferred) with an optional faster-whisper fallback."""
    name = "asr"

    def __init__(self) -> None:
        super().__init__()
        self._sherpa: dict[str, Any] = {}
        self._sherpa_locks: dict[str, threading.Lock] = {}

    def configured(self) -> bool:
        return bool(_sherpa_dirs()) or bool(config.ASR_MODEL)

    def languages(self) -> list[str]:
        langs = set(_sherpa_dirs())
        if config.ASR_MODEL:
            langs |= WHISPER_LANGS
        return [l for l in LANGS if l in langs]

    def model_name(self) -> str:
        parts = [f"sherpa-onnx:{','.join(sorted(_sherpa_dirs()))}"] if _sherpa_dirs() else []
        if config.ASR_MODEL:
            parts.append(f"whisper:{config.ASR_MODEL}")
        return " + ".join(parts)

    def _load(self):  # faster-whisper fallback only
        if not config.ASR_MODEL:
            raise RuntimeError("No Whisper fallback configured (ASR_MODEL)")
        from faster_whisper import WhisperModel
        dev = "cuda" if _device() == "cuda" else "cpu"
        return WhisperModel(config.ASR_MODEL, device=dev, compute_type=config.ASR_COMPUTE)

    def _recognizer(self, lang: str, d: str):
        if lang not in self._sherpa_locks:
            with self._lock:
                self._sherpa_locks.setdefault(lang, threading.Lock())
        with self._sherpa_locks[lang]:
            if lang not in self._sherpa:
                import sherpa_onnx
                tokens = os.path.join(d, "tokens.txt")
                if os.path.isfile(os.path.join(d, "encoder.int8.onnx")):
                    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
                        encoder=os.path.join(d, "encoder.int8.onnx"), decoder=os.path.join(d, "decoder.int8.onnx"),
                        joiner=os.path.join(d, "joiner.int8.onnx"), tokens=tokens, model_type="nemo_transducer",
                        num_threads=config.ASR_THREADS)
                else:
                    rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
                        model=os.path.join(d, "model.int8.onnx"), tokens=tokens, num_threads=config.ASR_THREADS)
                self._sherpa[lang] = rec
                log.info("asr loaded sherpa-onnx model for %s from %s", lang, d)
            return self._sherpa[lang]

    def transcribe(self, audio: bytes, lang: str) -> dict:
        dirs = _sherpa_dirs()
        if lang in dirs:
            samples, sr = decode_audio(audio)
            duration = len(samples) / sr
            if duration < 0.2:
                raise ValueError("Recording is too short")
            rec = self._recognizer(lang, dirs[lang])
            stream = rec.create_stream()
            stream.accept_waveform(sr, samples)
            rec.decode_stream(stream)  # thread-safe for separate streams
            return {"text": stream.result.text.strip(), "language": lang, "engine": "sherpa-onnx", "durationSec": round(duration, 2)}
        if not config.ASR_MODEL:
            raise RuntimeError(f"No speech model installed for '{lang}'")
        model = self.get()
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
            f.write(audio)
            path = f.name
        try:
            segments, info = model.transcribe(
                path,
                language=lang if lang in WHISPER_LANGS else None,
                vad_filter=True,
                beam_size=5,
                condition_on_previous_text=False,
            )
            segs = list(segments)
            text = " ".join(s.text.strip() for s in segs).strip()
            avg_logprob = sum(s.avg_logprob for s in segs) / len(segs) if segs else -5.0
            return {
                "text": text,
                "language": info.language,
                "engine": "faster-whisper",
                "confidence": round(max(0.0, min(1.0, 1.0 + avg_logprob / 2)), 3),
                "durationSec": round(info.duration, 2),
            }
        finally:
            os.unlink(path)


# --------------------------------------------------------------------------- read-aloud voice
class TtsEngine(Engine):
    name = "tts"

    def configured(self) -> bool:
        return bool(config.TTS_MODEL)

    def model_name(self) -> str:
        return config.TTS_MODEL

    def _load(self):
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer
        dev = _device()
        model = ParlerTTSForConditionalGeneration.from_pretrained(config.TTS_MODEL).to(dev)
        tok = AutoTokenizer.from_pretrained(config.TTS_MODEL)
        desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
        return {"model": model, "tok": tok, "desc_tok": desc_tok, "device": dev, "torch": torch}

    def synthesize(self, text: str, lang: str) -> bytes:
        m = self.get()
        import soundfile as sf
        description = "A calm female speaker speaks slowly and clearly with a warm tone. The recording is very clear with no background noise."
        d = m["desc_tok"](description, return_tensors="pt").to(m["device"])
        p = m["tok"](text, return_tensors="pt").to(m["device"])
        with m["torch"].no_grad():
            audio = m["model"].generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
        buf = io.BytesIO()
        sf.write(buf, audio.cpu().numpy().squeeze(), m["model"].config.sampling_rate, format="WAV")
        return buf.getvalue()


# --------------------------------------------------------------------------- translation
class TranslateEngine(Engine):
    name = "translate"

    def configured(self) -> bool:
        return bool(config.TRANSLATE_MODEL)

    def model_name(self) -> str:
        return config.TRANSLATE_MODEL

    def _load(self):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        from IndicTransToolkit.processor import IndicProcessor
        dev = _device()
        tok = AutoTokenizer.from_pretrained(config.TRANSLATE_MODEL, trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(config.TRANSLATE_MODEL, trust_remote_code=True).to(dev).eval()
        return {"tok": tok, "model": model, "ip": IndicProcessor(inference=True), "device": dev, "torch": torch}

    def translate(self, texts: list[str], source: str, target: str) -> list[str]:
        m = self.get()
        src, tgt = INDICTRANS[source], INDICTRANS[target]
        batch = m["ip"].preprocess_batch(texts, src_lang=src, tgt_lang=tgt)
        enc = m["tok"](batch, truncation=True, padding="longest", return_tensors="pt").to(m["device"])
        with m["torch"].no_grad():
            out = m["model"].generate(**enc, max_length=256, num_beams=4)
        decoded = m["tok"].batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        return m["ip"].postprocess_batch(decoded, lang=tgt)


# --------------------------------------------------------------------------- small LLM
EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "maxItems": 12,
            "items": {
                "type": "object",
                "properties": {
                    "symptom": {"type": "string"},
                    "bodyPart": {"type": ["string", "null"]},
                    "side": {"type": ["string", "null"], "enum": ["left", "right", "both", None]},
                    "severity": {"type": ["integer", "null"]},
                    "durationDays": {"type": ["number", "null"]},
                    "negated": {"type": "boolean"},
                    "evidence": {"type": "string"},
                },
                "required": ["symptom", "bodyPart", "side", "severity", "durationDays", "negated", "evidence"],
            },
        }
    },
    "required": ["findings"],
}

SOAP_SCHEMA = {
    "type": "object",
    "properties": {"subjective": {"type": "string"}, "objective": {"type": "string"}, "assessment": {"type": "string"}},
    "required": ["subjective", "objective", "assessment"],
}

EXTRACT_SYSTEM = (
    "You extract symptoms from what a patient said at a hospital check-in kiosk in India. The text may be in "
    "Hindi, another Indian language, English, or a mix. Return JSON only. For each symptom: 'symptom' is a short "
    "English clinical term (e.g. 'chest pain', 'fever'); 'evidence' MUST be the exact words copied from the patient's "
    "text that show it; 'negated' is true if the patient says they do NOT have it; 'severity' 0-10 only if they gave a "
    "number or a clear word like 'very severe', otherwise null; 'durationDays' only if they said how long. Never add "
    "symptoms that are not in the text. Do not diagnose."
)

SOAP_SYSTEM = (
    "You draft a SOAP note for a doctor in an Indian OPD from the consultation transcript and the recorded intake. "
    "Use ONLY facts present in the input. If something was not discussed, write 'Not discussed'. Never invent vitals, "
    "test results, doses or diagnoses. In 'assessment', list possible problems as 'Possible: ...' for the doctor to "
    "confirm. Write in plain English, short sentences. Return JSON only."
)


class LlmEngine(Engine):
    name = "llm"

    def configured(self) -> bool:
        return bool(config.LLM_GGUF) and os.path.exists(config.LLM_GGUF)

    def model_name(self) -> str:
        return os.path.basename(config.LLM_GGUF) if config.LLM_GGUF else ""

    def _load(self):
        from llama_cpp import Llama
        return Llama(model_path=config.LLM_GGUF, n_ctx=config.LLM_CTX, n_threads=config.LLM_THREADS, n_gpu_layers=config.LLM_GPU_LAYERS, verbose=False)

    def _json(self, system: str, user: str, schema: dict, max_tokens: int) -> dict:
        llm = self.get()
        with self._lock:  # llama.cpp contexts are not thread-safe
            out = llm.create_chat_completion(
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object", "schema": schema},
                temperature=0.0,
                max_tokens=max_tokens,
            )
        return json.loads(out["choices"][0]["message"]["content"])

    def extract(self, text: str, lang: str) -> dict:
        return self._json(EXTRACT_SYSTEM, f"Language hint: {lang}\nPatient said:\n{text}", EXTRACT_SCHEMA, 700)

    def soap(self, transcript: str, structured: Any, care_stream: str) -> dict:
        user = f"Care type: {care_stream}\nRecorded intake (JSON):\n{json.dumps(structured, ensure_ascii=False)[:6000]}\n\nConsultation transcript:\n{transcript[:8000]}"
        return self._json(SOAP_SYSTEM, user, SOAP_SCHEMA, 900)


# --------------------------------------------------------------------------- OCR
class OcrEngine(Engine):
    name = "ocr"

    def configured(self) -> bool:
        return config.OCR_ENGINE == "paddle"

    def model_name(self) -> str:
        return f"PaddleOCR ({','.join(config.OCR_LANGS)})" if self.configured() else ""

    def _load(self):
        from paddleocr import PaddleOCR
        return {lang: PaddleOCR(lang=("devanagari" if lang in ("hi", "mr") else lang), use_angle_cls=True, show_log=False) for lang in config.OCR_LANGS}

    def read(self, image: bytes) -> dict:
        import numpy as np
        engines = self.get()
        from PIL import Image
        img = np.array(Image.open(io.BytesIO(image)).convert("RGB"))
        best: list[dict] = []
        for _, ocr in engines.items():
            result = ocr.ocr(img, cls=True) or []
            lines = [{"text": t[1][0], "confidence": round(float(t[1][1]), 3)} for page in result if page for t in page]
            if sum(l["confidence"] for l in lines) > sum(l["confidence"] for l in best):
                best = lines
        return {"text": "\n".join(l["text"] for l in best), "lines": best}


asr = AsrEngine()
tts = TtsEngine()
translator = TranslateEngine()
llm = LlmEngine()
ocr = OcrEngine()
ENGINES = {"asr": asr, "tts": tts, "translate": translator, "llm": llm, "ocr": ocr}
