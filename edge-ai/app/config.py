"""Edge AI configuration from environment variables. Every model is optional."""
import os

def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()

TOKEN = env("EDGE_AI_TOKEN")               # if set, callers must send Authorization: Bearer <token>
DEVICE = env("EDGE_AI_DEVICE", "auto")     # auto | cpu | cuda | mps

# Speech recognition: a faster-whisper model name or a local CTranslate2 directory.
# Good choices: "large-v3" (best multilingual), "medium", or an Indic fine-tune converted to CT2.
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
