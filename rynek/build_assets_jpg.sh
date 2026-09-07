#!/usr/bin/env bash
# Awaryjne zasoby JPG dla GPU, które nie dekodują KTX2 (np. Samsung Xclipse przez ANGLE/Vulkan).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/rynek/assets"
source "$ROOT/tools/build_assets_lib.sh"
model_jpg horse_statue_01 1024 0.6 & model_jpg wooden_lantern_01 1024 0.4 & model_jpg wooden_crate_01 1024 0.6 & model_jpg wine_barrel_01 1024 0.3 & wait
model_jpg Barrel_01 1024 & model_jpg wicker_basket_01 1024 0.2 & model_jpg wooden_bucket_02 1024 0.5 & model_jpg ceramic_vase_01 1024 0.3 & wait
model_jpg ceramic_vase_02 1024 0.3 & model_jpg wooden_bowl_01 1024 0.2 & model_jpg food_apple_01 512 0.2 & model_jpg treasure_chest 1024 0.1 & wait
model_jpg wooden_stool_02 1024 0.4 & model_jpg grass_medium_02 1024 & model_jpg fern_02 1024 & model_jpg tree_stump_01 1024 0.15 & wait
model_jpg rock_moss_set_02 1024 0.15 & model_jpg potted_plant_02 1024 0.12 & model_jpg wine_bottles_01 1024 0.35 & model_jpg Lantern_01 1024 0.2 & wait
# Etap 2 (warianty z zestawów tworzy rynek/build_assets.sh przez tools/ph_variant.mjs — uruchom go najpierw).
model_jpg shrub_04_c 512 0.5 & model_jpg planter_box_01 1024 0.5 & model_jpg periwinkle_plant_03 512 0.4 & model_jpg celandine_01_c 512 0.5 & wait
model_jpg flower_gazania_h 512 0.5 & model_jpg hamburger_buns 512 0.3 & model_jpg food_pears_asian_01 1024 0.4 & model_jpg ceramic_pot 1024 & wait
model_jpg brass_pot_01 1024 & model_jpg wicker_basket_02 512 0.25 & model_jpg wooden_crate_02 1024 & model_jpg painted_wooden_bench 1024 & wait
model_jpg wooden_bowl_02 512 0.6 & model_jpg carved_wooden_plate 512 & model_jpg brass_vase_01 1024 0.25 & model_jpg gothic_statue 512 0.2 & wait
model_jpg marble_bust_01 1024 0.3 & wait
for t in cobblestone_floor_04:2048 plastered_wall:1024 old_planks_02:1024 weathered_planks:1024 roof_09:1024 rustic_stone_wall_02:1024 medieval_blocks_05:1024 castle_wall_slates:1024 fabric_pattern_07:1024; do tex_jpg ${t%%:*} ${t##*:}; done
rm -rf "$TMP"; echo "JPG EXIT 0"
