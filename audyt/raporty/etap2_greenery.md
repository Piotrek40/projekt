# Etap 2 — motyw #greenery „zieleń: donice przy portalach, skrzynki kwiatowe, rabatki, ławki" (?nogreenery=1) — cykl 2/3, status: done

Commity: `a3d106f` (infra: W.sills w buildings.js + asercja K1 — osobny, pierwszy) + ten (cecha). Branch `claude/repo-cleanup-q1fkk3`, PORT 8126, bez worktree (tory scalone).

## Co miało być widać (lista z p.1, PRZED kodem) — odhaczone na PNG
1. [x] Donice: 6 × planter_box_01 (0,91×0,42×0,41) przy portalach domów przy placu, po stronie drzwi przeciwnej do ulicy, skraj ≥ 0,03 od oprawy (środek x = doorX ± 1,386), tył 0,03 przed licem parteru (środek 0,237 — asercja checkInFrontOfWall); w każdej 3 krzewy shrub_04_c ×3 (0,37×0,66) co 0,28 m ze spodem 0,15 pod krawędzią + płyta ziemi `soil` (folia zasłonięta) → donica.png: donica z 3 krzewami po lewej od portalu, liście ~0,5 m nad krawędzią.
2. [x] Skrzynki kwiatowe: 12 na parapetach (W.sills) okien parteru (w 0,9, wierzch 1,29) i piętra 1 (w 1,0, wierzch 4,08–4,27) bez okiennic i bez zastrzału; planks w × 0,18 × 0,18, 3 cm na parapecie + 2 wsporniki iron 0,03²×0,26 (5 cm w ścianie), ziemia 4 cm pod krawędzią, 2–3 rośliny ×1,4–1,8 → skrzynka.png (parter, 2 periwinkle), skrzynka_p1.png (piętro 1, 3 gazanie nad szyldem kielicha).
3. [x] Rabatki: 2 skrzynie planks 1,4×0,3 (deski 0,05) wokół pni lip (±6, 0), ziemia 0,25, 3 rośliny ×2,0 na pierścieniu r 0,45 co 120°, addRect 0,7×0,7 → lawka.png, start_plac.png.
4. [x] Ławki: 4 × painted_wooden_bench na r 5,6, kąty π/4 + k·π/2 → (±3,96, ±3,96), siedziskiem na zewnątrz (front·radial = 1,000 z tej samej M4), 5,35 ≥ 4,2 + 0,5 od koła fontanny i ≥ 5,2 mokrego bruku, 4,47 m od lip → lawka.png (2 ławki), start_plac.png (ławka przy fontannie po prawej, lewa za kramem).
5. [x] Budżet: start_plac 107 / 419 594 → 115 / 579 662 HUD (inst) ≤ 600 k; noinst 144 / 311 988; errors [] w obu.
6. [x] ?nogreenery=1 = stan sprzed (start_plac 107 / 419 594 = kinds_on co do trójkąta; img_diff off vs kinds_on 0,06 %).

Cykl 1 (odrzucony na PNG): 2 krzewy ×3 nie zasłaniały folii donicy; rośliny ×1,2–1,6 = cienkie łodyżki; skrzynka na oknie z zastrzałem (belka X przez skrzynkę); plan bez filtra „przed placem" stawiał 2 donice i 3 skrzynki w narożnikach, gdzie domy sąsiednich pierzei się przenikają (K8: (24,07, −21,76), (−27,59, −21,76)) — dodane `onPlaza` (|along + lx| + w/2 ≤ half) i `clearOfTower` (≥ r + w/2 + 0,1). Pierwszy render cyklu 1 poszedł na NIEPRZEBUDOWANYM bundlu (stare pozycje) — wykryte sondą macierzy instancji (`window.__dbg.scene`), nie z wyobraźni. Cykl 2: 3 krzewy co 2·shrubX = ±0,56 poza donicą 0,456 → CHECK „krzew poza donicą" ×8 i K2 FAIL (asercje zadziałały) → co shrubX.

## ZMIANY
- `rynek/src/greenery.js` (stub → 144 linii): `greeneryPlan(W)` FUNKCJA CZYSTA (własny `rng(seed + 900)`; donice z W.portals, skrzynki z W.sills, rabatki z W.trees, ławki na okręgu; pozycje na okręgach przez `M4(…, kąt)`, bez Math.sin/cos) + `buildGreenery(W)` (W.put dla modeli, W.B `planks|iron|soil` dla skrzynek/rabatek, `mat.soil` PRZED W.B.build, addRect rabatek, asercje z tych samych macierzy). Flaga `?nogreenery=1`.
- `rynek/src/config.js`: sekcja `greenery` (seedOffset, models, noShadow, soil, planters, sillBoxes, beds, benches — wszystkie liczby z komentarzem), `noShadowKeys` + `soil`, `roles.mat.soil = 'n'`.
- `rynek/src/props.js` (2 tokeny): `names` + `CONFIG.greenery.models` (bez ?nogreenery=1), `NO_SHADOW` + `CONFIG.greenery.noShadow` (kwiaty, krzewy, donica bez cienia; ławka 630 tri z cieniem).
- `rynek/src/buildings.js` (jedyna dozwolona zmiana, commit a3d106f + pole `braced`): `W.sills = [{x, y, z, ry, w, floor, side, along, setback, shut, braced}]` — środek górnej-przedniej krawędzi parapetu z tego samego `LP()` co parapet (wierzch +0,08/2, lico +0,02+0,1/2).
- `audyt/testy/test_geometria.mjs`: K1 (kontrakt W.sills, 161 parapetów, 0 fałszywych alarmów), K2 (zieleń: donice/skrzynki/rabatki/ławki z realnych bryił `GREENERY_BOUNDS` z gltf-transform inspect; `DUMP_GREENERY=1` wypisuje pozycje do kadrowania), `allSills` jak `allPortals`. `audyt/testy/geo/entry.mjs`: eksport `greeneryPlan, buildGreenery`.
- `rynek/app.js`: bundle (komenda §6 p.3).

## WIDOKI (każdy obejrzany)
- `out/render/greenery_on_a/donica.png` (18,5, −7,0, yaw −0,899, pitch −0,29): donica z 3 krzewami i ciemną ziemią po lewej od portalu (pierzeja E w cieniu), skraj przy ościeżu, nic w ścianie.
- `out/render/greenery_on_a/skrzynka.png` (18,7, −4,0, −1,016, −0,04): skrzynka na parapecie parteru, 2 periwinkle (cienkie łodygi, różowe kwiaty), wsporniki widoczne pod wysięgiem — rośliny rzadkie (ZNANE BRAKI).
- `out/render/greenery_on_c/skrzynka_p1.png` (17,5, −7,0, −1,123, 0,529): skrzynka na parapecie piętra 1 nad szyldem, 3 gazanie z pomarańczowymi kwiatami, tył przy szkle, bez zastrzału w oknie.
- `out/render/greenery_on_a/lawka.png` (6,5, 8,5, 0,227, −0,156): ławka z lewej tyłem do fontanny, druga za fontanną, rabatka z desek wokół pnia lipy z kwiatami; nic nie wisi.
- `out/render/greenery_on_b/start_plac.png`, `start_v2.png`: ławki przy fontannie (prawa cała, lewa ucięta kramem sukiennika), rabatka przy prawej lipie; donice/skrzynki na dalekich pierzejach nieczytelne (< 10 px).
- `out/render/greenery_on_top/top.png`: 4 ławki na przekątnych r 5,6, rabatki przy lipach; donice pod okapami (0,55 m + jetty) z góry niewidoczne; nic na ulicach. `elew_N.png`, `elew_E.png` (ortho side 0/1, 30 m): skrzynki piętra 1 na parapetach, nic w powietrzu (elewacja obejrzana przed zbliżeniami cyklu 2).
- diff: `greenery_on_a/diff_{donica,skrzynka,lawka}.png`, `greenery_on_c/diff_skrzynka_p1.png`, `greenery_on_b/diff_start_plac.png` (maska: ławki, rabatka, donice w tle, ptaki, cyfry HUD — nic nieoczekiwanego), `greenery_on_top/diff_top.png`.
- `greenery_on_noinst/start_plac.png`, `lawka.png` (?noinst=1): obraz jak w trybie instancji (pctOver 0,11 %).

## BUDŻET (HUD, tryb instancji, przed = ?nogreenery=1 → po)
start_plac 107 / 419 594 → **115 / 579 662** (≤ 600 k, zapas 20 k); start_v2 107 / 419 594 → 115 / 579 662; top 133 / 484 889 → 141 / 644 957; donica 69 / 278 016 → 77 / 435 792; skrzynka 69 / 278 016 → 77 / 435 792; skrzynka_p1 70 / 290 898 → 78 / 448 674; lawka 99 / 405 019 → 107 / 565 087; elew_N 82 / 439 218; elew_E 83 / 491 756. Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 144 / 311 988 (przed: 127 / 284 134), lawka 132 / 288 615; errors [].
- top-3 __stats start_plac: shrub_04_c 1 / 55 512 (18 × 3 084, bez cienia), timber 1 / 29 168, periwinkle_plant_03 1 / 27 664. Nowe: 6 modeli (+6 draw), klucz `soil` (+2 draw). Przyrost +8 draw / +160 k (szacunek z p.1: +8 / +140 k; różnica = 3. krzew i większe rośliny cyklu 2).
- Przekroczenie budżetu: brak (cięcia z §6.1 niepotrzebne; kwiaty/krzewy/donica bez cienia od razu).

## KOLOR
n/d dla palety; nowy klucz `W.mat.soil` = tint OKLCH [0,32, 0,025, 65] na `cobble` (ziemia, neutralne). Sonda (color_probe, liniowo): ziemia w donicy (`donica.png` 360,898,120,12, cień pierzei E) L 0,356 C 0,002 H 230 — ciemny neutralny (cel: ciemna ziemia, C ≤ 0,02 ✓); ławka (`lawka.png` 20,900,150,60, cień) L 0,508 C 0,036 H 33 — ciepły brąz z rodziny {15–55}. Lineup dla `soil` NIE wykonany (ZNANE BRAKI). hist_roles: n/d ([E]).

## ASERCJE
- `bash audyt/testy/geo_test.sh` exit 0 (uwagi: 3 × C kram róg słupa 1,70 > 1,6 — znane; 2 × KNOWN_B6 dyszel); sprawdzono: parapetów K1 161, zieleń K2 donic 6/skrzynek 12/rabatek 2/ławek 4, modeli put 97, B6 163 elementów w obszarze chodzenia (rabatki pokryte addRect).
- `rot_token.mjs greenery.js buildings.js props.js` exit 0 (greenery bez rx/rz); grep Math.sin/cos 0; grep K3 0; hex §4.3.6 w greenery.js 0; §2.4 (ułamek bez komentarza w nowych liniach) 0; `flags.nogreenery` w greenery.js i props.js.
- results.errors: [] we wszystkich 10 uruchomieniach render_scene (on_a ×3 cykle, on_b ×2, on_c, off_a, off_b, on_top, off_top, noinst, dbg).
- Nowe check(): donice — `count`, `środek` (checkInFrontOfWall ≥ 0,232), `w oprawie portalu` (skraj ≥ archOut + gap), `poza obrysem domu`, `krzew nie w donicy` (0,05 ≤ y ≤ h − 0,05), `krzew nie wystaje ≥ 0,3 m`, `krzew poza donicą` (±0,02), `płyta ziemi poza deskami`; skrzynki — `count`, `skrzynka w szkle okna` (onSill ≤ sillLip − glassOut − 0,01), `nie stoi na parapecie` (±0,005), `środek` (checkInFrontOfWall ≥ 0,055), `tył/przód skrzynki` (−0,03 / +0,15), `ziemia nie 0,04 pod krawędzią`, `wspornik nie pod skrzynką / nie w ścianie` (wierzch = parapet, tył ≤ −0,10, przód ≤ 0,145), `roślina poza ziemią skrzynki`; rabatki — `inna liczba niż lip`, `ziemia ponad deskami / ciaśniejsza niż odziomek / rośliny w desce`, checkCollisionCovers, `skrzynia nie 1,4 m / nie na ziemi`, `roślina poza pierścieniem` (r 0,45 ± 0,005); ławki — `nie siedziskiem na zewnątrz` (≥ 0,98), `za blisko fontanny / na mokrym bruku` (5,35 ≥ 4,7 i ≥ 5,2), `w pierścieniu kramów` (6,18 ≤ 8,4), `za blisko lipy` (4,47 ≥ 1,53). Test offline: K1, K2 (kalibracja 0 FAIL; K2 wyłapało błąd cyklu 2).

## DIFF (img_diff, próg 20)
Cecha: donica 2,09 %, skrzynka 0,58 %, skrzynka_p1 1,47 %, lawka 3,84 % (≥ 0,5 % ✓). Kontrolne: start_plac on/off 0,81 %, start_v2 0,90 % (maska = ławki, rabatka, donice w tle, ptaki, HUD), top on/off 0,06 %. Vs baza: start_plac vs kinds_on 0,83 %, vs etap2_scalone 0,94 %; ?nogreenery=1 vs kinds_on 0,06 % (flaga = stan sprzed). inst vs noinst start_plac 0,11 %.

## ZNANE BRAKI
- Rośliny na parapetach rzadkie: periwinkle_plant_03 to pojedyncza łodyga (2 sztuki na 0,9 m parapetu); 3–4 rośliny/skrzynkę = +12–24 k tri, a start_plac ma 20 k zapasu do 600 k — zostawione; ewentualnie zamiana periwinkle na celandine/gazania w `species` (bez kosztu) w następnym cyklu.
- Lineup dla nowego klucza `W.mat.soil` nie wykonany (tylko sonda w scenie, w cieniu); lineup_rects nie przeliczone po dodaniu klucza (ostatni w `Object.keys(mat)` — kolejność wcześniejszych bez zmian).
- Brak medalionu bruku (motyw #13 `ground: {}` niewykonany) — ławki stoją na okręgu r 5,6 wokół schodka fontanny, nie „przy medalionie".
- Donice tylko przy 6 z 20 domów przy placu (budżet); pominięte domy narożne (przenikanie pierzei) i domy w promieniu wieży; skrzynki tylko na oknach bez okiennic i bez zastrzału (58 % okien).
- Z kadru startowego zieleń przy fasadach nieczytelna (< 10 px); czyta się ławki i rabatka. Liście gazanii ×2,0 w rabatkach wystają ~0,15 m za deski (zamierzone, nad krawędzią 0,3 m).
- `DUMP_GREENERY=1` w teście = dodatkowy wypis (bez wpływu na asercje).
- Cykle zużyte: 2/3.
