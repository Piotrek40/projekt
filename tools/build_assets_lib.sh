# Funkcje budujące zasoby (źródło: audyt/assets_src, wynik: $OUT). Wymaga gltf-transform w tools/node_modules i toktx w PATH.
GT="$ROOT/tools/node_modules/.bin/gltf-transform"
SRC="$ROOT/audyt/assets_src"
TMP="$(mktemp -d)"
model() { # nazwa rozmiar_tekstur [simplify_ratio]
  local n=$1 sz=$2 simp=${3:-}; local t="$TMP/$n"
  local simpargs=(--simplify false); [ -n "$simp" ] && simpargs=(--simplify true --simplify-ratio "$simp" --simplify-error 0.01)
  "$GT" optimize "$SRC/models/$n/$n.gltf" "$t.a.glb" --compress meshopt --texture-compress false "${simpargs[@]}" --join true --flatten true >/dev/null 2>&1
  "$GT" resize "$t.a.glb" "$t.b.glb" --width "$sz" --height "$sz" >/dev/null 2>&1
  "$GT" etc1s "$t.b.glb" "$t.c.glb" --slots "{baseColorTexture,metallicRoughnessTexture,occlusionTexture,emissiveTexture}" --quality 160 --jobs 2 >/dev/null 2>&1
  node "$ROOT/tools/ktx_normals.mjs" "$t.c.glb" "$OUT/models/$n.glb" 3 >/dev/null 2>&1
  echo "model $n $sz${simp:+ (simplify $simp)} -> $(du -h "$OUT/models/$n.glb" | cut -f1)"
}
tex() { # nazwa rozmiar [rozmiar_normalnej]
  local n=$1 sz=$2; local d="$SRC/textures/$1"; local nsz=${3:-$sz}
  toktx --t2 --genmipmap --resize ${sz}x${sz} --assign_oetf srgb   --encode etc1s --clevel 1 --qlevel 160 "$OUT/textures/${n}_diff.ktx2" "$d/${n}_Diffuse_2k.jpg" >/dev/null 2>&1
  toktx --t2 --genmipmap --resize ${sz}x${sz} --assign_oetf linear --encode etc1s --clevel 1 --qlevel 160 "$OUT/textures/${n}_arm.ktx2"  "$d/${n}_arm_2k.jpg" >/dev/null 2>&1
  toktx --t2 --genmipmap --resize ${nsz}x${nsz} --assign_oetf linear --encode uastc --uastc_quality 1 --uastc_rdo_l 2 --zcmp 18 "$OUT/textures/${n}_nor.ktx2" "$d/${n}_nor_gl_2k.jpg" >/dev/null 2>&1
  echo "tex $n $sz/$nsz -> $(du -ch "$OUT/textures/${n}"_*.ktx2 | tail -1 | cut -f1)"
}
model_jpg() { # nazwa rozmiar_tekstur [simplify_ratio] — GLB z meshopt i teksturami JPG (fallback)
  local n=$1 sz=$2 simp=${3:-}
  local simpargs=(--simplify false); [ -n "$simp" ] && simpargs=(--simplify true --simplify-ratio "$simp" --simplify-error 0.01)
  mkdir -p "$OUT/models_jpg"
  "$GT" optimize "$SRC/models/$n/$n.gltf" "$OUT/models_jpg/$n.glb" --compress meshopt --texture-compress auto --texture-size "$sz" "${simpargs[@]}" --join true --flatten true >/dev/null 2>&1
  echo "model_jpg $n $sz -> $(du -h "$OUT/models_jpg/$n.glb" | cut -f1)"
}
tex_jpg() { # nazwa rozmiar — tekstury JPG (fallback); używa node/sharp
  local n=$1 sz=$2; local d="$SRC/textures/$1"
  node -e "
const sharp=require('$ROOT/tools/node_modules/sharp'); const fs=require('fs');
const maps=[['diff','Diffuse',82,'4:2:0'],['nor','nor_gl',88,'4:4:4'],['arm','arm',80,'4:4:4']];
(async()=>{ for (const [m,f,q,c] of maps){ const src=['$d/${n}_'+f+'_2k.jpg','$d/${n}_'+f+'_1k.jpg'].find(fs.existsSync); if(!src) continue;
  await sharp(src).resize($sz,$sz).jpeg({quality:q,chromaSubsampling:c}).toFile('$OUT/textures/${n}_'+m+'.jpg'); } })();"
  echo "tex_jpg $n $sz"
}
