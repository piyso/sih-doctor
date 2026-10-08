"""Speech-recognition evaluation for the kiosk: synthesise the frozen test set, add hospital noise, transcribe
with the SAME engine code the service runs, then score with the frontend matcher.

    python eval/speech_eval.py synth        # macOS only: voices Lekha (hi), Rishi/Tara/Aman (en-IN)
    python eval/speech_eval.py noise        # crowd babble 10/5/0 dB + echoing hall (RT60 0.6 s) + 5 dB
    ASR_SHERPA_DIR=models/asr python eval/speech_eval.py transcribe
    cd ../frontend && npm run eval:matcher -- ../edge-ai/eval/results/sherpa.jsonl

Synthetic voices are optimistic. The real go/no-go test is consented recordings of real patients and staff
through the actual kiosk microphone, dropped into eval/audio/ with the same file names.
Run from the edge-ai/ folder. Audio is written to eval/audio/ (git-ignored).
"""
import json
import os
import subprocess
import sys
import time
import zlib

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, "audio")
CASES = json.load(open(os.path.join(HERE, "cases.json"), encoding="utf-8"))
EN_VOICES = ["Rishi", "Tara", "Aman"]


def sentences():
    for i, c in enumerate(CASES["hi"]):
        yield f"hi_{i}", c[0]
    for i, c in enumerate(CASES["en"]):
        yield f"en_{i}", c[0]
    for i, c in enumerate(CASES["ooc"]):
        yield f"ooc_{i}", c[0]


def synth():
    import librosa
    os.makedirs(AUDIO, exist_ok=True)
    for sent, text in sentences():
        voices = EN_VOICES if text.isascii() and sent.startswith("en_") else (["Rishi"] if text.isascii() else ["Lekha"])
        for k, voice in zip("abc", voices):
            out = os.path.join(AUDIO, f"{sent}_{k}.wav")
            aiff = out[:-4] + ".aiff"
            subprocess.run(["say", "-v", voice, "-o", aiff, text], check=True)  # sequential: parallel `say` corrupts clips
            y, _ = librosa.load(aiff, sr=16000)
            os.remove(aiff)
            sf.write(out, np.concatenate([np.zeros(4000), y, np.zeros(4000)]).astype(np.float32), 16000)
    print("synthesised", len([f for f in os.listdir(AUDIO) if "__" not in f]), "clips")


def noise():
    from scipy.signal import fftconvolve
    clean = {f[:-4]: sf.read(os.path.join(AUDIO, f), dtype="float32")[0] for f in sorted(os.listdir(AUDIO)) if f.endswith(".wav") and "__" not in f}
    pool = [k for k in clean if not k.startswith("en_")]  # an OPD crowd in a Hindi-belt hospital talks Hindi

    def rir(seed, rt60=0.6, sr=16000):
        r = np.random.default_rng(seed)
        t = np.arange(int(rt60 * sr)) / sr
        h = r.standard_normal(len(t)) * np.exp(-6.9 * t / rt60)
        h[: int(0.003 * sr)] = 0
        h[0] = 1.0
        return (h / np.sqrt(np.sum(h ** 2))).astype(np.float32)

    def mix(x, n, snr):
        return x + n * np.sqrt(np.mean(x ** 2) / (np.mean(n ** 2) * 10 ** (snr / 10)))

    for key, x in clean.items():
        rng = np.random.default_rng(zlib.crc32(key.encode()))
        sent = key.rsplit("_", 1)[0]
        others = [k for k in pool if k.rsplit("_", 1)[0] != sent]
        b = np.zeros(len(x), np.float32)
        for k in rng.choice(others, 5, replace=False):
            o = np.tile(clean[k], int(np.ceil(len(x) / len(clean[k]))) + 1)
            s = rng.integers(0, len(o) - len(x))
            b += o[s : s + len(x)]
        b += rng.standard_normal(len(x)).astype(np.float32) * 0.05 * b.std()
        out = {"b10": mix(x, b, 10), "b5": mix(x, b, 5), "b0": mix(x, b, 0),
               "rev5": mix(fftconvolve(x, rir(zlib.crc32(key.encode())))[: len(x)], fftconvolve(b, rir(7))[: len(x)], 5)}
        for cond, y in out.items():
            sf.write(os.path.join(AUDIO, f"{key}__{cond}.wav"), (y / max(1.0, np.abs(y).max() / 0.95)).astype(np.float32), 16000)
    print("noisy variants written")


def transcribe():
    sys.path.insert(0, os.path.dirname(HERE))
    from app.engines import asr
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    out_path = os.path.join(HERE, "results", "sherpa.jsonl")
    total_audio = total_proc = 0.0
    with open(out_path, "w", encoding="utf-8") as out:
        for f in sorted(os.listdir(AUDIO)):
            if not f.endswith(".wav"):
                continue
            key, _, cond = f[:-4].partition("__")
            sent = key.rsplit("_", 1)[0]
            text = dict(sentences()).get(sent, "")
            lang = "en" if text.isascii() else "hi"
            data = open(os.path.join(AUDIO, f), "rb").read()
            t = time.time()
            r = asr.transcribe(data, lang)
            total_proc += time.time() - t
            total_audio += r.get("durationSec", 0)
            out.write(json.dumps({"key": key, "sent": sent, "cond": cond or "clean", "hyp": r["text"]}, ensure_ascii=False) + "\n")
    print(f"wrote {out_path}; real-time factor {total_proc / max(total_audio, 1e-9):.3f}")


if __name__ == "__main__":
    {"synth": synth, "noise": noise, "transcribe": transcribe}[sys.argv[1] if len(sys.argv) > 1 else "transcribe"]()
