"""Build models/asr/<lang>/ from AI4Bharat's OFFICIAL IndicConformer checkpoint instead of the community copy.

    pip install "nemo_toolkit[asr]" onnx onnxruntime
    huggingface-cli login            # then accept the terms on the model page (gated, MIT licence)
    python scripts/convert_indicconformer.py hi

Exports the CTC branch of the hybrid CTC/RNNT model to ONNX with the metadata sherpa-onnx expects, quantises
it to int8 and writes tokens.txt — the same layout scripts/fetch_models.sh produces. Not run in CI (needs NeMo
and the gated checkpoint); after converting, check accuracy with eval/speech_eval.py before switching.
"""
import os
import sys

lang = sys.argv[1] if len(sys.argv) > 1 else "hi"
repo = f"ai4bharat/indicconformer_stt_{lang}_hybrid_ctc_rnnt_large"
out = os.path.join(os.path.dirname(__file__), "..", "models", "asr", lang)
os.makedirs(out, exist_ok=True)

import onnx  # noqa: E402
from huggingface_hub import hf_hub_download  # noqa: E402
from onnxruntime.quantization import QuantType, quantize_dynamic  # noqa: E402
import nemo.collections.asr as nemo_asr  # noqa: E402

ckpt = hf_hub_download(repo, f"indicconformer_stt_{lang}_hybrid_rnnt_large.nemo")
model = nemo_asr.models.ASRModel.restore_from(ckpt, map_location="cpu")
model.eval()
model.cur_decoder = "ctc"  # export the CTC head
if hasattr(model, "change_decoding_strategy"):
    model.change_decoding_strategy(decoder_type="ctc")

fp32 = os.path.join(out, "model.onnx")
model.export(fp32)

vocab = list(getattr(model.ctc_decoder, "vocabulary", None) or model.decoder.vocabulary)
with open(os.path.join(out, "tokens.txt"), "w", encoding="utf-8") as f:
    for i, tok in enumerate(vocab):
        f.write(f"{tok} {i}\n")
    f.write(f"<blk> {len(vocab)}\n")

m = onnx.load(fp32)
for k, v in {
    "vocab_size": str(len(vocab) + 1), "normalize_type": "per_feature", "subsampling_factor": "4",
    "model_type": "EncDecCTCModelBPE", "version": "1", "model_author": "AI4Bharat",
    "url": f"https://huggingface.co/{repo}", "comment": "CTC head of the hybrid model",
}.items():
    meta = m.metadata_props.add()
    meta.key, meta.value = k, v
onnx.save(m, fp32)

quantize_dynamic(fp32, os.path.join(out, "model.int8.onnx"), weight_type=QuantType.QUInt8)
os.remove(fp32)
print(f"wrote {out}/model.int8.onnx and tokens.txt — now run eval/speech_eval.py to compare")
