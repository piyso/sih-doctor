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

# Optional fallback for languages without a sherpa model: a faster-whisper model name or CTranslate2 directory.
# Whisper-small scored ~76% CER on our Hindi set, so do not use it for Hindi or English when the above exist.
ASR_MODEL = env("ASR_MODEL")
ASR_COMPUTE = env("ASR_COMPUTE_TYPE", "int8")

# Read-aloud voice: Hugging Face id or local path of ai4bharat/indic-parler-tts.
TTS_MODEL = env("TTS_MODEL")

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
