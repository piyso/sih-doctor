"""Edge AI configuration from environment variables. Every model is optional."""
import os

def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()

TOKEN = env("EDGE_AI_TOKEN")               # if set, callers must send Authorization: Bearer <token>
DEVICE = env("EDGE_AI_DEVICE", "auto")     # auto | cpu | cuda | mps

# Speech recognition (recommended): per-language sherpa-onnx models on CPU, fetched by scripts/fetch_models.sh.
#   <ASR_SHERPA_DIR>/hi/  IndicConformer-hi (model.int8.onnx + tokens.txt, NeMo CTC)
#   <ASR_SHERPA_DIR>/en/  Parakeet-TDT-0.6B-v2 (encoder/decoder/joiner.int8.onnx + tokens.txt, NeMo transducer)
# Measured on edge-ai/eval: Hindi CER 2.5% clean, English WER 3.6% clean; ~0.2-0.5 s per 5 s utterance on CPU.
ASR_SHERPA_DIR = env("ASR_SHERPA_DIR")
ASR_THREADS = int(env("ASR_THREADS", "2"))

# Clinical vocabulary biasing for the English transducer: modified beam search with the hotwords in app/hotwords/en.txt.
# Measured with eval/extraction_audio.py: English extraction in an echoing hall 75.5% → 79.9% (score 3.0 over-boosts). 0 = off.
ASR_EN_HOTWORDS_SCORE = float(env("ASR_EN_HOTWORDS_SCORE", "1.5"))
# Test-time augmentation: also decode speed-perturbed copies and return them as `alternatives`; the backend combines
# the findings and the patient confirms them on screen. Measured on held-out Hindi audio at 10 dB crowd noise:
# extraction 64% → 74%. Empty = off.
ASR_TTA_SPEEDS = [float(x) for x in env("ASR_TTA_SPEEDS", "0.9,1.1").split(",") if x.strip()]
ASR_TTA_LANGS = {x.strip() for x in env("ASR_TTA_LANGS", "hi").split(",") if x.strip()}

# Optional fallback for languages without a sherpa model: a faster-whisper model name or CTranslate2 directory.
# Whisper-small scored ~76% CER on our Hindi set, so do not use it for Hindi or English when the above exist.
ASR_MODEL = env("ASR_MODEL")
ASR_COMPUTE = env("ASR_COMPUTE_TYPE", "int8")

# Read-aloud voice: Hugging Face id or local path of ai4bharat/indic-parler-tts.
TTS_MODEL = env("TTS_MODEL")
# Folder of sherpa-onnx VITS/Piper voices (one sub-folder per voice, e.g. vits-piper-hi_IN-priyamvada-medium); preferred over TTS_MODEL when set.
TTS_SHERPA_DIR = env("TTS_SHERPA_DIR")
TTS_SPEED = float(env("TTS_SPEED", "0.9"))

# Translation: IndicTrans2 English->Indic distilled model (ai4bharat/indictrans2-en-indic-dist-200M).
TRANSLATE_MODEL = env("TRANSLATE_MODEL")

# Small LLM: path to a GGUF file, e.g. Qwen2.5-3B-Instruct-Q4_K_M.gguf or sarvam-1 GGUF.
LLM_GGUF = env("LLM_GGUF")
LLM_CTX = int(env("LLM_CTX", "4096"))
LLM_THREADS = int(env("LLM_THREADS", str(max(2, (os.cpu_count() or 4) - 1))))
LLM_GPU_LAYERS = int(env("LLM_GPU_LAYERS", "-1"))

# OCR: "paddle" to enable PaddleOCR (languages from OCR_LANGS, e.g. "en,hi").
OCR_ENGINE = env("OCR_ENGINE")
OCR_LANGS = [x.strip() for x in env("OCR_LANGS", "en,hi").split(",") if x.strip()]
# Boost for the dictation profile's medicine names (per-phrase, on top of the default hotwords). Tuned on
# eval/dictation.json, checked once on eval/dictation_holdout.json and on medicine-free speech for false insertions.
ASR_DICTATION_BOOST = float(env("ASR_DICTATION_BOOST", "2.5"))  # 2.5 was best of 1.5–3.0 on the tuning set; 0 false insertions
