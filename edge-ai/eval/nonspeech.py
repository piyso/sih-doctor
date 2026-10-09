"""Non-speech robustness check for the speech service: sounds that are not speech must not come back as words.

    python eval/nonspeech.py synth            # tones, beeps, mains hum, fan, clicks, noise → eval/audio/nonspeech/
    ASR_SHERPA_DIR=models/asr python eval/nonspeech.py run [tag]   # transcribe every clip in hi and en

Real speech for the other side of the check is the extraction benchmark audio (eval/audio/extraction/), which the
speech gate must never reject (see app/engines.py speech_evidence).
"""
import json
import os
import sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "audio", "nonspeech")
SR = 16000


def synth():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(7)
    t = np.arange(int(3.0 * SR)) / SR
    clips = {}
    for f in (110, 220, 440, 1000, 2000):
        clips[f"tone_{f}"] = 0.3 * np.sin(2 * np.pi * f * t)
        gate = (np.floor(t * 4) % 2 == 0).astype(float)  # 4 Hz on/off beep
        clips[f"beep_{f}"] = 0.3 * np.sin(2 * np.pi * f * t) * gate
    square = np.sign(np.sin(2 * np.pi * 220 * t))
    clips["square_220_beep"] = 0.2 * square * (np.floor(t * 3) % 2 == 0)
    for base in (50, 60):
        hum = sum(0.2 / k * np.sin(2 * np.pi * base * k * t) for k in range(1, 6))
        clips[f"hum_{base}"] = hum + 0.01 * rng.standard_normal(len(t))
    white = rng.standard_normal(len(t))
    clips["white"] = 0.1 * white
    pink = np.cumsum(rng.standard_normal(len(t))); pink -= np.convolve(pink, np.ones(400) / 400, mode="same")
    clips["pink"] = 0.1 * pink / pink.std()
    fan = np.convolve(rng.standard_normal(len(t)), np.ones(30) / 30, mode="same")  # low-passed rumble
    clips["fan"] = 0.3 * fan / fan.std() * 0.3
    clicks = np.zeros(len(t)); clicks[rng.choice(len(t), 25, replace=False)] = 0.8
    clips["clicks"] = np.convolve(clicks, np.exp(-np.arange(80) / 10), mode="same") + 0.002 * rng.standard_normal(len(t))
    clips["silence_lownoise"] = 0.002 * rng.standard_normal(len(t))
    chirp = 0.3 * np.sin(2 * np.pi * (200 + 600 * t / 3) * t)
    clips["chirp"] = chirp
    ring = 0.25 * (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * (np.floor(t * 0.5 * 2) % 2 == 0)
    clips["phone_ring"] = ring
    for name, y in clips.items():
        sf.write(os.path.join(OUT, f"{name}.wav"), (y / max(1.0, np.abs(y).max() / 0.95)).astype(np.float32), SR)
    print("wrote", len(clips), "clips")


def run(tag=""):
    sys.path.insert(0, os.path.dirname(HERE))
    from app.engines import asr
    rows = []
    for f in sorted(os.listdir(OUT)):
        if not f.endswith(".wav"):
            continue
        for lang in ("hi", "en"):
            try:
                r = asr.transcribe(open(os.path.join(OUT, f), "rb").read(), lang)
            except Exception as e:  # noqa: BLE001
                r = {"text": "", "error": str(e)}
            rows.append({"clip": f[:-4], "lang": lang, "text": r.get("text", ""), "alts": r.get("alternatives", []), "speech": r.get("speech")})
    words = [r for r in rows if r["text"].strip()]
    for r in rows:
        print(f"{r['clip']:18} {r['lang']}  {r['text']!r:28} alts={r['alts']}  {r.get('speech') or ''}")
    print(f"\n{len(words)}/{len(rows)} non-speech decodes returned words")
    json.dump(rows, open(os.path.join(HERE, "results", f"nonspeech{'_' + tag if tag else ''}.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    {"synth": synth, "run": lambda: run(sys.argv[2] if len(sys.argv) > 2 else "")}[sys.argv[1]]()
