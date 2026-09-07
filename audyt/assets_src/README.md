# Surowe zasoby (Poly Haven, CC0)

Katalogi `models/`, `textures/`, `hdri/` nie są w repozytorium (62 MB). Odtworzenie:

```
cd audyt/assets_src
for m in wooden_table_02:2k Barrel_01:1k potted_plant_02:1k rock_moss_set_01:2k marble_bust_01:2k Lantern_01:1k wine_bottles_01:1k; do python3 ph_download.py model ${m%%:*} ${m##*:}; done
python3 ph_download.py hdri kloofendal_48d_partly_cloudy_puresky 1k
for t in stone_tiles_02 castle_brick_02_red medieval_blocks_03; do python3 ph_download.py texture $t 2k; done
```

Potem `bash demo/build_assets.sh` buduje `demo/assets/`.

## Rynek (Etap 1 i 2)

```
cd audyt/assets_src
for m in wooden_crate_01 wine_barrel_01 barrel_03 Barrel_01 wicker_basket_01 wooden_bucket_02 ceramic_vase_01 ceramic_vase_02 wooden_bowl_01 food_apple_01 treasure_chest wooden_stool_02 wooden_lantern_01 horse_statue_01 grass_medium_02 fern_02 tree_stump_01 rock_moss_set_02 potted_plant_02 wine_bottles_01 Lantern_01 marble_bust_01; do python3 ph_download.py model $m 1k; done
# Etap 2
for m in shrub_04 planter_box_01 periwinkle_plant celandine_01 flower_gazania hamburger_buns food_pears_asian_01 ceramic_pot brass_pot_01 wicker_basket_02 wooden_crate_02 painted_wooden_bench wooden_bowl_02 carved_wooden_plate brass_vase_01 gothic_statue; do python3 ph_download.py model $m 1k; done
python3 ph_download.py hdri kloppenheim_06_puresky 1k
for t in cobblestone_floor_04 plastered_wall old_planks_02 weathered_planks roof_09 rustic_stone_wall_02 medieval_blocks_05 castle_wall_slates fabric_pattern_07; do python3 ph_download.py texture $t 2k; done
```

Zestawy roślin Poly Haven (shrub_04, periwinkle_plant, celandine_01, flower_gazania) zawierają kilka wariantów obok siebie — do gry trafia jeden,
wycięty przez `node tools/ph_variant.mjs` (robi to `rynek/build_assets.sh` na początku; źródło pochodne `models/<nazwa_wariantu>/` wskazuje
tekstury zestawu). `food_pears_asian_01` dostaje w miejscu wypieczone transformacje węzłów (`ph_variant.mjs ... all`), bo `gltf-transform join`
zostawiłby rotację pierwszego węzła i `W.put()` liczyłby zawyżony bbox. Potem `bash rynek/build_assets.sh` i `bash rynek/build_assets_jpg.sh`.
