# Edge AI service (optional)

This service runs open models on the hospital's own machine, so patient audio and text do not leave the premises. The rest of Hospital OS works without it, using its built-in rules and the browser's own speech features.

| Capability | Used for | Suggested model | Env var |
|---|---|---|---|
| Speech recognition | Kiosk voice input (instead of the browser's cloud speech) | `large-v3` (best), `medium` (CPU), or an Indic Whisper fine-tune converted to CTranslate2 | `ASR_MODEL` |
| Read-aloud voice | Kiosk and waiting-room announcements in languages the PC has no voice for | `ai4bharat/indic-parler-tts` | `TTS_MODEL` |
| Translation | Doctor's free-text advice into the patient's language (the doctor reviews it) | `ai4bharat/indictrans2-en-indic-dist-200M` | `TRANSLATE_MODEL` |
| Small LLM | Extra symptoms from free speech (the patient confirms each one); SOAP note drafts (the doctor edits them) | Qwen2.5-3B-Instruct or Sarvam-1 in GGUF Q4_K_M | `LLM_GGUF` |
| OCR | Reading old prescriptions and lab reports | PaddleOCR (English + Devanagari) | `OCR_ENGINE=paddle` |

## Safety design

- The language model never decides triage, red flags, drug interactions or doses. Those stay with the deterministic rules in the backend.
- The model output must follow a fixed JSON schema (grammar-constrained decoding).
- Every extracted symptom has to quote the patient's own words. The backend throws away anything that doesn't appear in the input.
- Nothing from the model goes into the record until a person confirms it.

## Hardware

| Setup | What runs well |
|---|---|
| CPU only, 16 GB RAM | ASR `medium` int8 (~1x real time), LLM 3B Q4 (~10 tokens/s), translation |
| Apple Silicon 16 GB | All of the above, faster (Metal) |
| NVIDIA GPU 8 GB+ | ASR `large-v3`, Parler-TTS, LLM 7B |

## Install (without Docker)

```bash
cd edge-ai
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-models.txt        # or only the backends you need
export ASR_MODEL=medium LLM_GGUF=/models/qwen2.5-3b-instruct-q4_k_m.gguf EDGE_AI_TOKEN=...
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

In the backend `.env`, set `EDGE_AI_URL=http://127.0.0.1:8090` and the same `EDGE_AI_TOKEN`. **Administration › System** shows which capabilities are active.

## Tests

`python -m pytest tests` runs without any model and checks that the service reports missing models honestly and refuses requests cleanly.
