# Zasoby Etapu 2 — nowe modele CC0 (Poly Haven) i uwagi dla implementatorów

Zbudowane w obu wariantach: `rynek/assets/models/<nazwa>.glb` (KTX2 + meshopt) i `rynek/assets/models_jpg/<nazwa>.glb` (JPG + meshopt).
Wpisy: `rynek/build_assets.sh`, `rynek/build_assets_jpg.sh`, `demo_artifact/build_artifact.mjs` (SCENES.rynek.models), `audyt/research/licencje_zasobow.md`.
Warianty z zestawów (`_c`, `_03`, `_h`) wycina `tools/ph_variant.mjs` (opis w `audyt/assets_src/README.md`). Każdy model ma 1 materiał (diff/nor/arm) = 1 draw call na model w trybie instancji.
Ładowanie: dopisać nazwę do listy `names` w `initProps` (`rynek/src/props.js`) i stawiać przez `W.put(nazwa, x, y, z, ry, skala, {collide})`; `put()` sam stawia SPÓD modelu na `y`.

| nazwa | rola | tri (Pages) | wymiary m (W×H×D) | uwagi |
|---|---|---|---|---|
| shrub_04_c | krzew w donicy przy portalu | 3 084 | 0.12×0.22×0.13 | mały (22 cm) — skalować ×3 (≈65 cm) w `planter_box_01` lub `ceramic_pot`; liście to geometria (działa też w JPG) |
| planter_box_01 | donica skrzyniowa | 4 046 | 0.91×0.42×0.41 | wnętrze to czarna folia — wypełnić roślinami tak, by ją zasłonić |
| periwinkle_plant_03 | rabatka, różowe kwiaty | 2 128 | 0.17×0.30×0.15 | w skrzynkach skala 1.2–1.6; alpha MASK |
| celandine_01_c | skrzynka kwiatowa, żółte kwiaty | 2 150 | 0.26×0.18×0.19 | jw. |
| flower_gazania_h | skrzynka kwiatowa, pomarańczowe kwiaty | 1 770 | 0.34×0.17×0.33 | jw. |
| hamburger_buns | chleb u piekarza (3 bułki w rzędzie) | 3 476 | 0.40×0.06×0.11 | skalować ×1.6; na ladzie `collide:false`; NO_SHADOW |
| food_pears_asian_01 | owoce (kupka 5 gruszek) | 5 028 | 0.16×0.11×0.18 | ≤ 3 instancje; NO_SHADOW |
| ceramic_pot | garncarz — garnek z pokrywą | 3 592 | 0.66×0.37×0.50 | duży — skala 0.6–0.8 na kramie |
| brass_pot_01 | kotlarz — mosiężny kocioł | 3 760 | 0.30×0.29×0.30 | błyszczy w złotym świetle |
| wicker_basket_02 | kosz z pokrywą opartą obok | 4 462 | 0.35×0.20×0.25 | owoce kłaść na ~0.2×skala |
| wooden_crate_02 | skrzynia (inna niż _01), długa oś Z | 5 176 | 0.53×0.46×1.17 | strona z liną = +z |
| painted_wooden_bench | ławka | 630 | 1.16×0.89×0.50 | siedzisko +z (ustawiać +z ku placowi), oparcie −z |
| wooden_bowl_02 | misa | 2 798 | 0.13×0.07×0.12 | NO_SHADOW |
| carved_wooden_plate | talerz | 2 112 | 0.27×0.04×0.27 | NO_SHADOW |
| brass_vase_01 | kotlarz — wazon | 5 359 | 0.23×0.69×0.23 | 1–2 szt. |
| gothic_statue | posąg gotycki | 5 547 | 1.48×1.74×1.56 | 1 instancja, na cokole; nieregularna podstawa |
| marble_bust_01 | popiersie „założyciela" | 5 236 | 0.27×0.51×0.30 | na kolumnie |

Odrzucone (z powodem): shrub_02 i shrub_03 (rzadkie, suche, nie czytają się jako krzew/drzewko — lipa proceduralna jest lepsza), shrub_sorrel_01 (11 roślinek po 6 cm, niewidoczne), food_pomegranate_01 (pękające szwy UV po każdym uproszczeniu), jug_01 (biała porcelana XX w.), street_lamp_01/02 (wiktoriańska żeliwna z żarówką), wooden_barrels_01 (7.5 MB, zestaw 4.4 m), tree_small_02 (101 MB).

Rozmiary: Pages +11.0 MB KTX2 / +5.7 MB JPG; Artifact +1.8 MB (strona ≈ 15.4 MB z limitu 16 MB — kolejne dodatki muszą coś zastąpić).
Podglądy (scratchpad sesji): `scratchpad/e2/png/*.png`.
