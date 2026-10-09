"""Spoken-transcript extraction benchmark: does the WHOLE voice path understand the patient?

Every speakable sentence of the extraction sets (eval/extraction_{cases,blind,holdout,final}.json) is synthesised,
mixed with hospital noise, transcribed with the SAME engine code the service runs, and the transcripts are then
scored by the backend extractor against the sets' expectations.

    python eval/extraction_audio.py synth                  # macOS voices: Lekha (hi); Rishi, Tara, Aman (en)
    python eval/extraction_audio.py noise                  # OPD crowd babble 20 / 10 / 5 dB + echoing hall (10 dB)
    ASR_SHERPA_DIR=models/asr python eval/extraction_audio.py transcribe [tag]
    cd ../backend && npx tsx tests/extraction_audio_score.ts ../edge-ai/eval/results/extraction_hyps[_tag].jsonl

Run from the edge-ai/ folder. Audio goes to eval/audio/extraction/ and results to eval/results/ (both git-ignored).
Synthetic voices are optimistic; consented recordings through the real kiosk microphone are the go/no-go test.
Romanised Hinglish lines are skipped (no voice reads them), and so are tuning lines that imitate recogniser typos.
"""
import json
import os
import re
import subprocess
import sys
import time
import zlib

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, "audio", "extraction")
SETS = ["extraction_cases", "extraction_blind", "extraction_holdout", "extraction_final"]
EN_VOICES = ["Rishi", "Tara", "Aman"]
CONDITIONS = ["clean", "babble20", "babble10", "babble5", "hall"]
HINGLISH = re.compile(r"\b(hai|hain|nahi|nahin|mein|me|se|ka|ki|ke|ko|aur|raha|rahi|rahe|hoon|hu|mujhe|mera|meri|bhi|bas|sirf|kal|din|dard|bukhar|khansi|pet|sar|ulti|dast|wala|kuch|bahut|thoda)\b", re.I)
RECOGNISER_TYPOS = re.compile(r"बताा|आऑक्सीजन|बायं|बी पी|दर्व|ख्यासी")


def clip_id(c):
    """Audio file stem for a case: a hash of language + sentence, so adding cases never misaligns audio and text."""
    return f"{zlib.crc32((c['lang'] + '|' + c['t']).encode()):08x}"


def cases():
    out = []
    for name in SETS:
        for c in json.load(open(os.path.join(HERE, f"{name}.json"), encoding="utf-8"))["cases"]:
            t = c["t"]
            devanagari = re.search(r"[ऀ-ॿ]", t)
            if devanagari and RECOGNISER_TYPOS.search(t):
                continue
            if not devanagari and HINGLISH.search(t):
                continue
            out.append(dict(c, set=name.replace("extraction_", ""), lang="hi" if devanagari else "en"))
    return out


def synth():
    import librosa
    os.makedirs(AUDIO, exist_ok=True)
    for i, c in enumerate(cases()):
        out = os.path.join(AUDIO, f"{clip_id(c)}.wav")
        if os.path.exists(out):
            continue
        voice = "Lekha" if c["lang"] == "hi" else EN_VOICES[zlib.crc32(c["t"].encode()) % len(EN_VOICES)]
        aiff = out[:-4] + ".aiff"
        subprocess.run(["say", "-v", voice, "-o", aiff, c["t"]], check=True)  # sequential: parallel `say` corrupts clips
        y, _ = librosa.load(aiff, sr=16000)
        os.remove(aiff)
        sf.write(out, np.concatenate([np.zeros(4000), y, np.zeros(4000)]).astype(np.float32), 16000)
    print("synthesised", len(cases()), "sentences")


def noise():
    from scipy.signal import fftconvolve
    cs = cases()
    clean = {i: sf.read(os.path.join(AUDIO, f"{clip_id(c)}.wav"), dtype="float32")[0] for i, c in enumerate(cs)}
    pool = [i for i, c in enumerate(cs) if c["lang"] == "hi"]  # an OPD crowd in a Hindi-belt hospital talks Hindi

    def rir(seed, rt60=0.6, sr=16000):
        r = np.random.default_rng(seed)
        t = np.arange(int(rt60 * sr)) / sr
        h = r.standard_normal(len(t)) * np.exp(-6.9 * t / rt60)
        h[: int(0.003 * sr)] = 0
        h[0] = 1.0
        return (h / np.sqrt(np.sum(h ** 2))).astype(np.float32)

    def mix(x, n, snr):
        return x + n * np.sqrt(np.mean(x ** 2) / (np.mean(n ** 2) * 10 ** (snr / 10)))

    for i, x in clean.items():
        if all(os.path.exists(os.path.join(AUDIO, f"{clip_id(cs[i])}__{c}.wav")) for c in CONDITIONS[1:]):
            continue
        rng = np.random.default_rng(zlib.crc32(cs[i]["t"].encode()))
        b = np.zeros(len(x), np.float32)
        for k in rng.choice([p for p in pool if p != i], 5, replace=False):
            o = np.tile(clean[k], int(np.ceil(len(x) / len(clean[k]))) + 1)
            s = rng.integers(0, len(o) - len(x))
            b += o[s: s + len(x)]
        b += rng.standard_normal(len(x)).astype(np.float32) * 0.05 * b.std()
        out = {"babble20": mix(x, b, 20), "babble10": mix(x, b, 10), "babble5": mix(x, b, 5),
               "hall": mix(fftconvolve(x, rir(zlib.crc32(clip_id(cs[i]).encode())))[: len(x)], fftconvolve(b, rir(7))[: len(x)], 10)}
        for cond, y in out.items():
            sf.write(os.path.join(AUDIO, f"{clip_id(cs[i])}__{cond}.wav"), (y / max(1.0, np.abs(y).max() / 0.95)).astype(np.float32), 16000)
    print("noisy variants written")


def transcribe(tag=""):
    sys.path.insert(0, os.path.dirname(HERE))
    from app.engines import asr
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    path = os.path.join(HERE, "results", f"extraction_hyps{'_' + tag if tag else ''}.jsonl")
    t0, audio_s = time.time(), 0.0
    with open(path, "w", encoding="utf-8") as out:
        for i, c in enumerate(cases()):
            for cond in CONDITIONS:
                f = os.path.join(AUDIO, f"{clip_id(c)}.wav" if cond == "clean" else f"{clip_id(c)}__{cond}.wav")
                try:
                    r = asr.transcribe(open(f, "rb").read(), c["lang"])
                    hyp, alts, audio_s = r["text"].strip(), r.get("alternatives", []), audio_s + r.get("durationSec", 0)
                except Exception:  # nothing usable was heard: every check in this case counts as missed
                    hyp, alts = "", []
                out.write(json.dumps({"i": i, "set": c["set"], "cond": cond, "lang": c["lang"], "case": c, "hyp": hyp, "alts": alts}, ensure_ascii=False) + "\n")
    print(f"wrote {path}; real-time factor {(time.time() - t0) / max(audio_s, 1e-9):.3f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "transcribe"
    {"synth": synth, "noise": noise, "transcribe": lambda: transcribe(sys.argv[2] if len(sys.argv) > 2 else "")}[cmd]()
