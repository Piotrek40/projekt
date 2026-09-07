#!/usr/bin/env bash
# Test numeryczny geometrii rynku BEZ przeglądarki (~1 s): bundluje esbuildem prawdziwe moduły sceny (alias three jak demo/build.sh)
# z geo/entry.mjs do geo/scene.bundle.mjs i uruchamia test_geometria.mjs. Kod wyjścia 1 przy FAIL → nie renderujesz.
# Użycie: bash audyt/testy/geo_test.sh   (to samo, co komenda w rynek/PROMPT.md §3.4)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
TOOLS="$ROOT/tools/node_modules"; [ -d "$TOOLS" ] || TOOLS=/home/user/projekt/tools/node_modules   # worktree nie ma tools/node_modules
"$TOOLS/.bin/esbuild" "$HERE/geo/entry.mjs" --bundle --format=esm --platform=node --log-level=warning \
  --alias:three="$TOOLS/three" --alias:three/addons="$TOOLS/three/examples/jsm" --outfile="$HERE/geo/scene.bundle.mjs"
exec node "$HERE/test_geometria.mjs"
