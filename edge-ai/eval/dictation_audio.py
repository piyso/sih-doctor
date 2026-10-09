"""Doctor-dictation benchmark: are medicine names heard right, with and without the dictation hotword profile?

    python eval/dictation_audio.py synth     # macOS voices Rishi, Tara, Aman (Indian English) → eval/audio/dictation/
    python eval/dictation_audio.py noise     # OPD babble at 10 dB (from the Hindi extraction clips)
    ASR_SHERPA_DIR=models/asr python eval/dictation_audio.py run

Metric: share of expected medicine names found in the transcript, and word error rate on the other words
(to see that boosting medicine names does not damage the rest of the sentence).
"""
import json
import os
import re
import subprocess
import sys
import zlib

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
VOICES = ["Rishi", "Tara", "Aman"]
# DICTATION_SET=holdout runs eval/dictation_holdout.json (kept out of tuning)
SET = os.environ.get("DICTATION_SET", "")
AUDIO = os.path.join(HERE, "audio", "dictation" + (f"_{SET}" if SET else ""))
CASES = json.load(open(os.path.join(HERE, f"dictation{'_' + SET if SET else ''}.json"), encoding="utf-8"))["cases"]


def synth():
    import librosa
    os.makedirs(AUDIO, exist_ok=True)
    for i, c in enumerate(CASES):
        out = os.path.join(AUDIO, f"{i}.wav")
        if os.path.exists(out):
            continue
        aiff = out[:-4] + ".aiff"
        subprocess.run(["say", "-v", VOICES[i % 3], "-o", aiff, c["t"]], check=True)
        y, _ = librosa.load(aiff, sr=16000)
        os.remove(aiff)
        sf.write(out, np.concatenate([np.zeros(4000), y, np.zeros(4000)]).astype(np.float32), 16000)
    print("synthesised", len(CASES))


def noise():
    pool_dir = os.path.join(HERE, "audio", "extraction")
    pool = [sf.read(os.path.join(pool_dir, f), dtype="float32")[0] for f in sorted(os.listdir(pool_dir)) if re.fullmatch(r"\d+\.wav", f)][:200]
    for i in range(len(CASES)):
        x = sf.read(os.path.join(AUDIO, f"{i}.wav"), dtype="float32")[0]
        rng = np.random.default_rng(zlib.crc32(CASES[i]["t"].encode()))
        b = np.zeros(len(x), np.float32)
        for k in rng.choice(len(pool), 5, replace=False):
            o = np.tile(pool[k], int(np.ceil(len(x) / len(pool[k]))) + 1)
            s = rng.integers(0, len(o) - len(x))
            b += o[s: s + len(x)]
        y = x + b * np.sqrt(np.mean(x ** 2) / (np.mean(b ** 2) * 10 ** (10 / 10)))
        sf.write(os.path.join(AUDIO, f"{i}__babble10.wav"), (y / max(1.0, np.abs(y).max() / 0.95)).astype(np.float32), 16000)
    print("noisy variants written")


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()


def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (r[i - 1] != h[j - 1]))
    return d[len(h)], len(r)


def run():
    sys.path.insert(0, os.path.dirname(HERE))
    from app.engines import asr
    for cond in ("clean", "babble10"):
        for profile in ("", "dictation"):
            found = total = errs = words = 0
            misses = []
            for i, c in enumerate(CASES):
                f = os.path.join(AUDIO, f"{i}.wav" if cond == "clean" else f"{i}__{cond}.wav")
                hyp = norm(asr.transcribe(open(f, "rb").read(), "en", profile)["text"])
                for d in c["drugs"]:
                    total += 1
                    if d.replace(" ", "") in hyp.replace(" ", ""):
                        found += 1
                    else:
                        misses.append(f"{d} → {hyp}")
                ref = norm(c["t"])
                for d in c["drugs"]:
                    ref = ref.replace(d, " ")
                    hyp = hyp.replace(d.replace(" ", ""), " ").replace(d, " ")
                e, n = wer(norm(ref), norm(hyp))
                errs, words = errs + e, words + n
            print(f"{cond:9} profile={profile or 'default':9} medicine names {found}/{total} ({100 * found / total:.1f}%)  other-word WER {100 * errs / words:.1f}%")
            for m in misses[:6]:
                print("    miss:", m)


if __name__ == "__main__":
    {"synth": synth, "noise": noise, "run": run}[sys.argv[1]]()
