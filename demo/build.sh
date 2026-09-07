#!/usr/bin/env bash
# Bundluje scenę: app.js (pliki KTX2/meshopt) i demo_artifact/app_inline.js (zasoby data URI, bez WASM).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ESB="$ROOT/tools/node_modules/.bin/esbuild"
COMMON=(--bundle --minify --alias:three="$ROOT/tools/node_modules/three" --alias:three/addons="$ROOT/tools/node_modules/three/examples/jsm")
"$ESB" "$ROOT/demo/src/main.js" "${COMMON[@]}" --format=esm --outfile="$ROOT/demo/app.js" --alias:scene-loaders="$ROOT/demo/src/loaders_ktx2.js"
mkdir -p "$ROOT/demo_artifact"
"$ESB" "$ROOT/demo/src/main.js" "${COMMON[@]}" --format=iife --outfile="$ROOT/demo_artifact/app_inline.js" --alias:scene-loaders="$ROOT/demo/src/loaders_inline.js"
