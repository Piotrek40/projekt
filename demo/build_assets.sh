#!/usr/bin/env bash
# Buduje zoptymalizowane zasoby demo z surowych plików Poly Haven (CC0).
# Wymaga: node_modules w tools/ (gltf-transform), toktx (KTX-Software) w PATH.
# Kolor/ARM: KTX2 ETC1S (mały plik, mała pamięć GPU). Normalne: KTX2 UASTC (ETC1S psuje normalne).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GT="$ROOT/tools/node_modules/.bin/gltf-transform"
SRC="$ROOT/audyt/assets_src"
OUT="$ROOT/demo/assets"
TMP="$(mktemp -d)"

model() { # nazwa rozmiar_tekstur
  local n=$1 sz=$2; local t="$TMP/$n"
  "$GT" optimize "$SRC/models/$n/$n.gltf" "$t.a.glb" --compress meshopt --texture-compress false --simplify false --join true --flatten true >/dev/null 2>&1
  "$GT" resize "$t.a.glb" "$t.b.glb" --width "$sz" --height "$sz" >/dev/null 2>&1
  "$GT" etc1s "$t.b.glb" "$t.c.glb" --slots "{baseColorTexture,metallicRoughnessTexture,occlusionTexture,emissiveTexture}" --quality 160 --jobs 2 >/dev/null 2>&1
  node "$ROOT/tools/ktx_normals.mjs" "$t.c.glb" "$OUT/models/$n.glb" 3 >/dev/null 2>&1
  echo "model $n $sz -> $(du -h "$OUT/models/$n.glb" | cut -f1)"
}
tex() { # nazwa rozmiar
  local n=$1 sz=$2; local d="$SRC/textures/$1"
  toktx --t2 --genmipmap --resize ${sz}x${sz} --assign_oetf srgb   --encode etc1s --clevel 1 --qlevel 160 "$OUT/textures/${n}_diff.ktx2" "$d/${n}_Diffuse_2k.jpg" >/dev/null 2>&1
  toktx --t2 --genmipmap --resize ${sz}x${sz} --assign_oetf linear --encode etc1s --clevel 1 --qlevel 160 "$OUT/textures/${n}_arm.ktx2"  "$d/${n}_arm_2k.jpg" >/dev/null 2>&1
  # normalne: UASTC z RDO (mniejszy plik), rozmiar wg 3. argumentu (domyślnie jak reszta)
  local nsz=${3:-$sz}
  toktx --t2 --genmipmap --resize ${nsz}x${nsz} --assign_oetf linear --encode uastc --uastc_quality 1 --uastc_rdo_l 2 --zcmp 18 "$OUT/textures/${n}_nor.ktx2" "$d/${n}_nor_gl_2k.jpg" >/dev/null 2>&1
  echo "tex $n $sz -> $(du -ch "$OUT/textures/${n}"_*.ktx2 | tail -1 | cut -f1)"
}
model marble_bust_01 2048 & model wooden_table_02 2048 & wait
model rock_moss_set_01 2048 & model Barrel_01 1024 & wait
model potted_plant_02 1024 & model Lantern_01 1024 & wait
model wine_bottles_01 1024 & wait
# tekstury podłoża/murów zbudowane wcześniej; odkomentuj, żeby przebudować:
# tex stone_tiles_02 2048 2048 & tex castle_brick_02_red 2048 1024 & wait

cp "$SRC/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr" "$OUT/hdri/sky_1k.hdr"
rm -rf "$TMP"
echo "RAZEM: $(du -sh "$OUT" | cut -f1)"
