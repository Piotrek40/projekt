#!/usr/bin/env bash
# Zasoby rynku: modele (meshopt + KTX2), tekstury (KTX2), HDRI. Ciężkie skany są upraszczane.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/rynek/assets"
mkdir -p "$OUT/models" "$OUT/textures" "$OUT/hdri"
source "$ROOT/tools/build_assets_lib.sh"
model horse_statue_01 2048 & model wooden_lantern_01 1024 & wait
model wooden_crate_01 1024 & model wine_barrel_01 1024 & wait
model barrel_03 1024 & model Barrel_01 1024 & wait
model wicker_basket_01 1024 0.5 & model wooden_bucket_02 1024 & wait
model ceramic_vase_01 1024 & model ceramic_vase_02 1024 & wait
model wooden_bowl_01 1024 & model food_apple_01 1024 & wait
model treasure_chest 1024 0.25 & model wooden_stool_02 1024 & wait
model grass_medium_02 1024 & model fern_02 1024 & wait
model tree_stump_01 1024 0.4 & model rock_moss_set_02 1024 0.4 & wait
model potted_plant_02 1024 0.4 & model wine_bottles_01 1024 & wait
model Lantern_01 1024 0.5 & wait
tex cobblestone_floor_04 2048 2048 & tex plastered_wall 2048 1024 & wait
tex old_planks_02 1024 1024 & tex weathered_planks 1024 1024 & wait
tex roof_09 2048 1024 & tex rustic_stone_wall_02 2048 1024 & wait
tex medieval_blocks_05 2048 1024 & tex castle_wall_slates 1024 1024 & wait
cp "$SRC/hdri/kloppenheim_06_puresky_1k.hdr" "$OUT/hdri/sky_1k.hdr"
rm -rf "$TMP"
echo "RAZEM: $(du -sh "$OUT" | cut -f1)"
