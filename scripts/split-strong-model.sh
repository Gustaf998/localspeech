#!/usr/bin/env bash
# Zerlegt Qwen3.5-4B-Q4_K_M (2,74 GB, > 2-GiB-Browser-Limit) in ~512-MB-Shards
# und laedt sie in ein eigenes HF-Repo. wllama laedt gesplittete GGUF, wenn man
# die URL der ERSTEN Shard uebergibt (siehe src/catalog.ts, strong-Tier).
#
# Voraussetzungen:
#   - llama-gguf-split  (aus einem llama.cpp-Release: https://github.com/ggml-org/llama.cpp/releases)
#   - huggingface_hub   (pip install -U "huggingface_hub[cli]")
#   - HF-Write-Token    (huggingface-cli login  ODER  export HF_TOKEN=hf_...)
#
# Aufruf:
#   scripts/split-strong-model.sh <HF_NAMESPACE>
#   z. B.  scripts/split-strong-model.sh localspeech
set -euo pipefail

NS="${1:?Bitte HF-Namespace angeben, z. B.: scripts/split-strong-model.sh localspeech}"
REPO="$NS/Qwen3.5-4B-Q4_K_M-GGUF"
SRC_URL="https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf"
WORK="$(mktemp -d)"
BASE="Qwen3.5-4B-Q4_K_M"

echo "→ Arbeitsverzeichnis: $WORK"
echo "→ Lade $SRC_URL (2,74 GB)…"
curl -L --fail -o "$WORK/$BASE.gguf" "$SRC_URL"

echo "→ Splitte in ~512-MB-Shards…"
llama-gguf-split --split-max-size 512M "$WORK/$BASE.gguf" "$WORK/$BASE"
rm -f "$WORK/$BASE.gguf"

FIRST="$(ls "$WORK/$BASE"-*-of-*.gguf | sort | head -1 | xargs basename)"
COUNT="$(ls "$WORK/$BASE"-*-of-*.gguf | wc -l | tr -d ' ')"
echo "→ $COUNT Shards erzeugt. Erste Shard: $FIRST"

echo "→ Lade nach https://huggingface.co/$REPO …"
huggingface-cli upload "$REPO" "$WORK" . --repo-type model

echo
echo "✅ Fertig. Trage diese URL als strong-Tier-url in src/catalog.ts ein:"
echo "   https://huggingface.co/$REPO/resolve/main/$FIRST"
echo "   (ersetzt die Platzhalter-URL mit __HF_NAMESPACE__ und -of-00006)"
