#!/usr/bin/env bash
# Downloads the speech-recognition models into models/asr/<lang>/ and verifies every file's SHA-256.
#
#   scripts/fetch_models.sh            # Hindi + English (~690 MB)
#   scripts/fetch_models.sh hi         # one language
#
# Then run the service with ASR_SHERPA_DIR=models/asr (see README).
#
# Hindi: AI4Bharat IndicConformer-hi (MIT), CTC head in ONNX int8. This copy is a community conversion
#   (huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx) pinned by hash. To build it yourself
#   from AI4Bharat's official checkpoint instead, use scripts/convert_indicconformer.py.
# English: NVIDIA Parakeet-TDT-0.6B-v2 (CC-BY-4.0 — keep the attribution in the app's About/licences page),
#   official sherpa-onnx int8 release from github.com/k2-fsa/sherpa-onnx.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${ASR_SHERPA_DIR:-models/asr}"
LANGS=("$@")
[ $# -eq 0 ] && LANGS=(hi en)

HF=https://huggingface.co/parismitaglobalsolutions/indicconformer-sherpa-onnx/resolve/main
PK=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
verify() { # file expected-hash
  local got; got=$(sha "$1")
  if [ "$got" != "$2" ]; then echo "SHA-256 mismatch for $1 (got $got) — refusing to use it" >&2; rm -f "$1"; exit 1; fi
  echo "ok  $1"
}
get() { # url file hash
  if [ -f "$2" ] && [ "$(sha "$2")" = "$3" ]; then echo "ok  $2 (cached)"; return; fi
  curl -fSL --retry 3 -o "$2.part" "$1" && mv "$2.part" "$2" && verify "$2" "$3"
}

for lang in "${LANGS[@]}"; do
  mkdir -p "$DEST/$lang"
  case "$lang" in
    hi)
      get "$HF/hi/model.int8.onnx" "$DEST/hi/model.int8.onnx" 915c71e04dd7e5378a4057fdebb252b3a587188e4e99db6d7ce0909ad5ad05fa
      get "$HF/tokens.txt" "$DEST/hi/tokens.txt" ee60967630213f31951817ac8b402b92ec18cce80718a24a49b388e56672dfb2
      ;;
    en)
      if [ "$(sha "$DEST/en/encoder.int8.onnx" 2>/dev/null)" != a32b12d17bbbc309d0686fbbcc2987b5e9b8333a7da83fa6b089f0a2acd651ab ]; then
        tmp=$(mktemp -d)
        curl -fSL --retry 3 -o "$tmp/pk.tar.bz2" "$PK"
        verify "$tmp/pk.tar.bz2" 157c157bc51155e03e37d2466522a3a737dd9c72bb25f36eb18912964161e1ad
        tar xjf "$tmp/pk.tar.bz2" -C "$tmp"
        mv "$tmp"/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/{encoder,decoder,joiner}.int8.onnx "$tmp"/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/tokens.txt "$DEST/en/"
        rm -rf "$tmp"
      fi
      verify "$DEST/en/encoder.int8.onnx" a32b12d17bbbc309d0686fbbcc2987b5e9b8333a7da83fa6b089f0a2acd651ab
      verify "$DEST/en/decoder.int8.onnx" b6bb64963457237b900e496ee9994b59294526439fbcc1fecf705b31a15c6b4e
      verify "$DEST/en/joiner.int8.onnx" 7946164367946e7f9f29a122407c3252b680dbae9a51343eb2488d057c3c43d2
      verify "$DEST/en/tokens.txt" ec182b70dd42113aff6c5372c75cac58c952443eb22322f57bbd7f53977d497d
      ;;
    *) echo "No pinned model for '$lang' yet. Supported: hi en" >&2; exit 1 ;;
  esac
done
echo "Models ready in $DEST. Start the service with ASR_SHERPA_DIR=$DEST"
