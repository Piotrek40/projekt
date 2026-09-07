# Etap 2 — motyw #1 „cięcia skanów" (?nocuts=1) — raport WIP (cykl 1/3, render NIE ukończony)

ZMIANY: rynek/src/config.js — CONFIG.props.noShadow (osobny commit 9cafd74) + CONFIG.props.cuts { maxCount: {grass_medium_02: 0, fern_02: 2, wine_bottles_01: 1, wine_barrel_01: 4}, noShadow: [wicker_basket_01, wooden_bowl_02, carved_wooden_plate, hamburger_buns, food_pears_asian_01], glassOpacity: 0.6 };
rynek/src/props.js — put() pomija instancje ponad maxCount (bez zmiany losowań ziarna: R konsumowane przed put), materiały z KHR_materials_transmission (4 w wine_bottles_01) → alfa 0,6 + check „materiał z transmisją" (transmisja = renderTransmissionPass: cała nieprzezroczysta scena rysowana 2×; dowód z bazy: grass_medium_02 NO_SHADOW 2 calls / 156 840 tri = 2 × 10 × 7 842), treasure_chest usunięty, Lantern_01 na pieńku (stumpTop 0,571 m z bounds; 2 check()), dług §3.1 spłacony (latarnie przez L(), token ring:), rot: dla szprych i dyszla. Flaga ?nocuts=1 (grep flags.nocuts = 1).
Lista „co ma być widać" (przed kodem): $SP/cuts/lista.md — prognoza start_plac 158/818 939 → ≤ 105 / ≤ 360 000 HUD.
WIDOKI: NIE OBEJRZANE — render_scene.js (cuts_on/cuts_off/top/noinst) uruchomiony, przerwany przed pierwszym PNG (limit tury agenta).
BUDŻET: baza 158 / 818 939 (inst), 126 / 271 890 (noinst); po zmianie: NIE ZMIERZONE.
KOLOR: n/d
ASERCJE: geo_test.sh exit 0 (7 znanych „uwaga"); rot_token.mjs (z $SP/krytyk2) props.js exit 0; grep §2.4 = 0; grep §3.1 w props.js = 0; K3 grep = tylko lista długu; results.errors: NIE ZMIERZONE. Nowe check(): „materiał z transmisją", „pieniek: wysokość poza zakresem [0.3,1.2]" (0,571), „latarenka szersza niż pół pieńka" (0,122 ≤ 0,71).
DIFF: NIE ZMIERZONE
ZNANE BRAKI: brak weryfikacji na PNG i brak pomiaru budżetu (cykl 1/3 przerwany przy renderze); „wine_bottles 18→6" z promptu nieosiągalne bez edycji zasobu (18 = 9 prymitywów × 2 przebiegi; po zmianie oczekiwane 9); następny krok: bash $SP/cuts/render_all.sh → obejrzeć PNG, img_diff, uzupełnić raport, zdjąć prefiks WIP.
