#!/usr/bin/env bash
# Bundluje sceny (demo, rynek): app.js (pliki KTX2/meshopt) i *_inline.js (zasoby data URI, bez WASM — do Artifact).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# worktree agenta nie ma tools/node_modules (gitignore) — wtedy bierzemy zależności z głównego repo
NM="$ROOT/tools/node_modules"; [ -d "$NM" ] || NM="/home/user/projekt/tools/node_modules"
ESB="$NM/.bin/esbuild"
COMMON=(--bundle --minify --alias:three="$NM/three" --alias:three/addons="$NM/three/examples/jsm")
for scene in demo rynek; do
  "$ESB" "$ROOT/$scene/src/main.js" "${COMMON[@]}" --format=esm --outfile="$ROOT/$scene/app.js" --alias:scene-loaders="$ROOT/engine/src/loaders_ktx2.js"
  mkdir -p "$ROOT/demo_artifact"
  "$ESB" "$ROOT/$scene/src/main.js" "${COMMON[@]}" --format=iife --outfile="$ROOT/demo_artifact/${scene}_inline.js" --alias:scene-loaders="$ROOT/engine/src/loaders_inline.js"
done
