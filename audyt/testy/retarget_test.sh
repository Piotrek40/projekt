#!/usr/bin/env bash
# Test przeniesienia mocapu na szkielet NPC (~20 s, bez przeglądarki). Bundluje esbuildem, bo engine/src
# nie ma własnego node_modules — tak samo jak geo_test.sh. Kod wyjścia 1 przy FAIL.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
TOOLS="$ROOT/../tools/node_modules"; [ -d "$TOOLS" ] || TOOLS=/home/user/projekt/tools/node_modules
"$TOOLS/.bin/esbuild" "$HERE/retarget/entry.mjs" --bundle --format=esm --platform=node --log-level=warning \
  --alias:three="$TOOLS/three" --alias:three/examples/jsm="$TOOLS/three/examples/jsm" --outfile="$HERE/retarget/bundle.mjs"
exec node "$HERE/retarget/bundle.mjs"
