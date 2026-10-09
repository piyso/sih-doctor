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
import re
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


def _change_speed(samples, speed: float):
    """Speed perturbation (tempo and pitch together), as in Kaldi-style augmentation: resample by 1/speed."""
    import numpy as np
    from fractions import Fraction
    try:
        from scipy.signal import resample_poly
        f = Fraction(1 / speed).limit_denominator(20)
        return resample_poly(samples, f.numerator, f.denominator).astype(np.float32)
    except ImportError:
        idx = np.arange(0, len(samples) - 1, speed)
        return np.interp(idx, np.arange(len(samples)), samples).astype(np.float32)


# Akshara (syllable) count of a Devanagari word: a vowel or consonant, with any virama-joined conjunct consonants.
_AKSHARA = re.compile(r"[\u0905-\u0939\u0958-\u0961](?:\u094d[\u0915-\u0939])*")


def non_speech_reason(text: str, lang: str) -> str | None:
    """Why a decode is not speech, or None. Tones, beeps, hum and fan noise come back from the Hindi CTC model as
    one-syllable fragments ("ह ह ह", "म", "है", "एक प प प प"); real Hindi decodes made only of such fragments are
    unusable noise garble too (eval/nonspeech.py and the extraction benchmark measure both sides)."""
    words = text.split()
    if not words or lang != "hi":
        return None
    syll = [len(_AKSHARA.findall(w)) for w in words]
    if all(n <= 1 for n in syll):
        return "only one-syllable fragments"
    top = max(set(words), key=words.count)
    if len(words) >= 4 and words.count(top) / len(words) >= 0.6 and len(_AKSHARA.findall(top)) <= 1:
        return "one syllable repeated"
    return None


def _bpe_vocab(model_dir: str) -> str:
    """sherpa-onnx encodes hotwords with a sentencepiece vocab; derive one from tokens.txt (ids in frequency order)."""
    path = os.path.join(model_dir, "bpe.vocab")
    if os.path.isfile(path):
        return path
    try:
        lines = open(os.path.join(model_dir, "tokens.txt"), encoding="utf-8").read().splitlines()
    except OSError:
        return ""
    try:
        with open(path, "w", encoding="utf-8") as f:
            for i, line in enumerate(lines):
                tok = line.rsplit(" ", 1)[0]
                if tok != "<blk>":
                    f.write(f"{tok}\t{-float(i)}\n")
    except OSError:  # read-only model folder: keep it next to the service instead
        path = os.path.join(tempfile.gettempdir(), f"bpe-{abs(hash(model_dir))}.vocab")
        with open(path, "w", encoding="utf-8") as f:
            for i, line in enumerate(lines):
                tok = line.rsplit(" ", 1)[0]
                if tok != "<blk>":
                    f.write(f"{tok}\t{-float(i)}\n")
    return path


def _profile_hotwords(lang: str, profile: str) -> str | None:
    """Per-request hotwords: the default list (app/hotwords/{lang}.txt) plus a profile's own list, e.g. "dictation"
    adds medicine names (app/hotwords/{lang}_dictation.txt) so the kiosk's symptom words are not diluted."""
    if not profile or not re.fullmatch(r"[a-z]{1,20}", profile):
        return None
    base = os.path.join(os.path.dirname(__file__), "hotwords")
    words: list[str] = []
    for name in (f"{lang}.txt", f"{lang}_{profile}.txt"):
        path = os.path.join(base, name)
        if os.path.isfile(path):
            own = name != f"{lang}.txt"
            # the profile's own phrases get their own boost ("telmisartan :2.5"); the default list keeps the recogniser's
            words += [f"{w.strip()} :{config.ASR_DICTATION_BOOST:g}" if own and config.ASR_DICTATION_BOOST != config.ASR_EN_HOTWORDS_SCORE else w.strip()
                      for w in open(path, encoding="utf-8") if w.strip() and not w.startswith("#")]
    return "/".join(dict.fromkeys(words)) if len(words) else None


class AsrEngine(Engine):
    """sherpa-onnx per-language models (preferred) with an optional faster-whisper fallback."""
    name = "asr"

    def __init__(self) -> None:
        super().__init__()
        self._sherpa: dict[str, Any] = {}
        self._greedy: dict[str, Any] = {}  # greedy twins of beam-search recognisers (the speech check)
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
                    kw = {}
                    hot = os.path.join(os.path.dirname(__file__), "hotwords", f"{lang}.txt")
                    if config.ASR_EN_HOTWORDS_SCORE > 0 and os.path.isfile(hot):
                        kw = dict(decoding_method="modified_beam_search", max_active_paths=4, hotwords_file=hot,
                                  hotwords_score=config.ASR_EN_HOTWORDS_SCORE, modeling_unit="bpe", bpe_vocab=_bpe_vocab(d))
                    common = dict(encoder=os.path.join(d, "encoder.int8.onnx"), decoder=os.path.join(d, "decoder.int8.onnx"),
                                  joiner=os.path.join(d, "joiner.int8.onnx"), tokens=tokens, model_type="nemo_transducer",
                                  num_threads=config.ASR_THREADS)
                    rec = sherpa_onnx.OfflineRecognizer.from_transducer(**common, **kw)
                    if kw:
                        # Beam search (needed for hotwords) invents phrases on non-speech ("I'm sorry." from a fan or a
                        # beep: 18 of 20 clips in eval/nonspeech.py); greedy decoding says nothing for all of them, so a
                        # greedy decode of the same audio is the speech check.
                        self._greedy[lang] = sherpa_onnx.OfflineRecognizer.from_transducer(**common)
                else:
                    rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
                        model=os.path.join(d, "model.int8.onnx"), tokens=tokens, num_threads=config.ASR_THREADS)
                self._sherpa[lang] = rec
                log.info("asr loaded sherpa-onnx model for %s from %s", lang, d)
            return self._sherpa[lang]

    def transcribe(self, audio: bytes, lang: str, profile: str = "") -> dict:
        dirs = _sherpa_dirs()
        if lang in dirs:
            samples, sr = decode_audio(audio)
            duration = len(samples) / sr
            if duration < 0.2:
                raise ValueError("Recording is too short")
            rec = self._recognizer(lang, dirs[lang])
            speeds = config.ASR_TTA_SPEEDS if lang in config.ASR_TTA_LANGS else []
            hotwords = _profile_hotwords(lang, profile) if lang in self._greedy else None
            streams = []
            for speed in [1.0, *speeds]:
                st = rec.create_stream(hotwords=hotwords) if hotwords else rec.create_stream()
                st.accept_waveform(sr, samples if speed == 1.0 else _change_speed(samples, speed))
                streams.append(st)
            rec.decode_streams(streams)  # one batched call; thread-safe for separate streams
            text = streams[0].result.text.strip()
            alternatives = [st.result.text.strip() for st in streams[1:]]
            reason = non_speech_reason(text, lang)
            greedy = self._greedy.get(lang)
            if greedy is not None and text and not reason:
                gs = greedy.create_stream()
                gs.accept_waveform(sr, samples)
                greedy.decode_stream(gs)
                if not gs.result.text.strip():
                    reason = "no words in a greedy decode (beam search guessed)"
            out = {"text": "" if reason else text, "language": lang, "engine": "sherpa-onnx", "durationSec": round(duration, 2),
                   "speech": not reason and bool(text)}
            if reason:
                out["rejected"] = reason
            if speeds:
                # re-decodes of the same audio at 0.9x / 1.1x make different mistakes; the backend combines findings
                # (one per speed, duplicates kept: two re-checks agreeing is evidence for the backend's vote)
                out["alternatives"] = [] if reason else [a for a in alternatives if not non_speech_reason(a, lang)]
            return out
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
    """Read-aloud for kiosk prompts.

    Preferred: sherpa-onnx VITS/Piper voices under TTS_SHERPA_DIR (CPU, ~50-150 ms per sentence,
    no torch). Fallback: ai4bharat/indic-parler-tts when TTS_MODEL is set (needs torch + parler_tts).
    """
    name = "tts"
    # Piper voice folder prefixes per language (first match on disk wins).
    VOICE_PREFIX = {"hi": "vits-piper-hi_IN-", "en": "vits-piper-en_", "mr": "vits-piper-mr_", "bn": "vits-piper-bn_", "ta": "vits-piper-ta_",
                    "te": "vits-piper-te_", "gu": "vits-piper-gu_", "kn": "vits-piper-kn_", "ml": "vits-piper-ml_", "pa": "vits-piper-pa_", "or": "vits-piper-or_"}

    def _voices(self) -> dict[str, str]:
        root = config.TTS_SHERPA_DIR
        if not root or not os.path.isdir(root):
            return {}
        out: dict[str, str] = {}
        dirs = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))
        for lang, prefix in self.VOICE_PREFIX.items():
            for d in dirs:
                if d.startswith(prefix) and any(f.endswith(".onnx") for f in os.listdir(os.path.join(root, d))):
                    out[lang] = os.path.join(root, d)
                    break
        return out

    def configured(self) -> bool:
        return bool(self._voices()) or bool(config.TTS_MODEL)

    def model_name(self) -> str:
        v = self._voices()
        if v:
            return "sherpa-onnx-vits:" + ",".join(sorted(v))
        return config.TTS_MODEL or ""

    def languages(self) -> list[str]:
        v = self._voices()
        return sorted(v) if v else (list(LANGS) if config.TTS_MODEL else [])

    def _load_voice(self, folder: str):
        import sherpa_onnx
        onnx = next(f for f in sorted(os.listdir(folder)) if f.endswith(".onnx"))
        espeak = os.path.join(folder, "espeak-ng-data")
        cfg = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=os.path.join(folder, onnx), tokens=os.path.join(folder, "tokens.txt"),
                    data_dir=espeak if os.path.isdir(espeak) else "", lexicon=""),
                num_threads=2, provider="cpu"),
            max_num_sentences=2)
        return sherpa_onnx.OfflineTts(cfg)

    def _load(self):
        voices = self._voices()
        if voices:
            return {"kind": "sherpa", "voices": voices, "loaded": {}}
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer
        dev = _device()
        model = ParlerTTSForConditionalGeneration.from_pretrained(config.TTS_MODEL).to(dev)
        tok = AutoTokenizer.from_pretrained(config.TTS_MODEL)
        desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
        return {"kind": "parler", "model": model, "tok": tok, "desc_tok": desc_tok, "device": dev, "torch": torch}

    def synthesize(self, text: str, lang: str) -> bytes:
        m = self.get()
        import soundfile as sf
        buf = io.BytesIO()
        if m["kind"] == "sherpa":
            folder = m["voices"].get(lang) or m["voices"].get("en")
            if not folder:
                raise RuntimeError(f"no voice installed for '{lang}'")
            with self._lock:
                if folder not in m["loaded"]:
                    m["loaded"][folder] = self._load_voice(folder)
            audio = m["loaded"][folder].generate(text, sid=0, speed=config.TTS_SPEED)
            sf.write(buf, audio.samples, audio.sample_rate, format="WAV")
            return buf.getvalue()
        description = "A calm female speaker speaks slowly and clearly with a warm tone. The recording is very clear with no background noise."
        d = m["desc_tok"](description, return_tensors="pt").to(m["device"])
        p = m["tok"](text, return_tensors="pt").to(m["device"])
        with m["torch"].no_grad():
            audio = m["model"].generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
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
