# Surowe zasoby (Poly Haven, CC0)

Katalogi `models/`, `textures/`, `hdri/` nie są w repozytorium (62 MB). Odtworzenie:

```
cd audyt/assets_src
for m in wooden_table_02:2k Barrel_01:1k potted_plant_02:1k rock_moss_set_01:2k marble_bust_01:2k Lantern_01:1k wine_bottles_01:1k; do python3 ph_download.py model ${m%%:*} ${m##*:}; done
python3 ph_download.py hdri kloofendal_48d_partly_cloudy_puresky 1k
for t in stone_tiles_02 castle_brick_02_red medieval_blocks_03; do python3 ph_download.py texture $t 2k; done
```

Potem `bash demo/build_assets.sh` buduje `demo/assets/`.
