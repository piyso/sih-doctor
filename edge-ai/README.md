# Edge AI service (optional)

This service runs open models on the hospital's own machine, so patient audio and text do not leave the premises. The rest of Hospital OS works without it, using its built-in rules and the browser's own speech features.

**No language model (LLM) is used anywhere in patient intake.** Understanding what the patient said, spotting emergencies and routing are done by a deterministic clinical lexicon in the app (`frontend/src/utils/clinicalLexicon.ts`), which is measured on a frozen test set in `eval/`.

| Capability | Used for | Recommended model | Env var |
|---|---|---|---|
| Speech recognition, Hindi | Kiosk voice input | AI4Bharat **IndicConformer-hi** (MIT), CPU, via sherpa-onnx | `ASR_SHERPA_DIR` |
| Speech recognition, English | Kiosk voice input | NVIDIA **Parakeet-TDT-0.6B-v2** (CC-BY-4.0), CPU, via sherpa-onnx | `ASR_SHERPA_DIR` |
| Speech recognition, other languages | Fallback only | faster-whisper model (much weaker on Indian languages — see below) | `ASR_MODEL` |
| Read-aloud voice | Kiosk and waiting-room announcements in languages the PC has no voice for | `ai4bharat/indic-parler-tts` | `TTS_MODEL` |
| Translation | Doctor's free-text advice into the patient's language (the doctor reviews it) | `ai4bharat/indictrans2-en-indic-dist-200M` | `TRANSLATE_MODEL` |
| Small LLM (optional) | Doctor-side SOAP note drafts only (the doctor edits them) | a small instruct model in GGUF Q4_K_M | `LLM_GGUF` |
| OCR | Reading old prescriptions and lab reports | PaddleOCR (English + Devanagari) | `OCR_ENGINE=paddle` |

## Speech recognition: what we measured

Frozen test set `eval/cases.json` (40 Hindi/Hinglish, 24 Indian-English sentences), synthetic voices, crowd babble and an echoing hall. "Top 3" = the right symptom card is among the three the kiosk offers.

| | Clean / close mic | Crowd 10 dB | Crowd 5 dB | Echoing hall + 5 dB |
|---|---|---|---|---|
| Hindi IndicConformer — character error | 2.5% | 8% | 18% | 40% |
| Hindi — right card in top 3 | 35/40 | 30/40 | 21/40 | 15/40 |
| English Parakeet — word error | 3.6% | 4.8% | 7.5% | 33% |
| English — right card in top 3 | 70/72 | 69/72 | 67/72 | 48/72 |

- Whisper-small scored ~76% character error on the same Hindi clips and was 7–11× slower, so it is only a fallback.
- A speech-enhancement (denoising) model in front of recognition made every condition **worse**. The kiosk therefore records with browser noise suppression off; fix noise with a close-talk/handset microphone and press-to-talk instead.
- Speed on an Apple M4 for a 5-second answer: Hindi 150–300 ms (~0.8 GB RAM), English 370–540 ms (~1.5 GB). Expect 2–3× slower per core on an ARM cloud server — still well under a second.
- These are synthetic voices. Before go-live, record ~30 consenting people through the real kiosk microphone and re-run `eval/speech_eval.py`.

## Install (without Docker)

```bash
cd edge-ai
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
scripts/fetch_models.sh                       # Hindi + English, ~690 MB, every file SHA-256 verified
export ASR_SHERPA_DIR=models/asr EDGE_AI_TOKEN=...
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

With Docker: `docker compose --profile ai run --rm edge-ai scripts/fetch_models.sh` once, then `docker compose --profile ai up -d`.

In the backend `.env`, set `EDGE_AI_URL=http://127.0.0.1:8090` and the same `EDGE_AI_TOKEN`. **Administration › System** shows which capabilities are active.

The Hindi model is a community ONNX conversion of AI4Bharat's checkpoint, pinned by hash. To build it yourself from the official (gated, MIT) checkpoint, accept its terms on Hugging Face and run `scripts/convert_indicconformer.py`.

The English model's CC-BY-4.0 licence requires attribution: keep "Parakeet-TDT-0.6B-v2 by NVIDIA, CC-BY-4.0" in the deployment's licence notices.

## Safety design

- No model decides triage, red flags, drug interactions or doses. Those stay with deterministic rules (clinical lexicon + backend rules), which also run again on the server at check-in.
- Speech output is only text for the patient to confirm; symptom cards are added only when the patient taps them.
- The optional LLM must follow a fixed JSON schema; every extracted item must quote the input, and nothing enters the record until a person confirms it.
- Audio is processed in memory and not stored.

## Tests

- `python -m pytest tests` — runs without models (honest 503s) and, if `scripts/fetch_models.sh` has been run, end-to-end Hindi and English recognition on two recorded clips.
- `python eval/speech_eval.py synth|noise|transcribe` then `npm run eval:matcher -- ../edge-ai/eval/results/sherpa.jsonl` in `frontend/` — the full noise evaluation.
