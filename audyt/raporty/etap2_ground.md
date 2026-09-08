# Etap 2 — poprawki r1 (reżyseria), moduł „layout": motyw #13 „bruk" (`?noground=1`) + wóz na pierwszym planie (`?nocart2=1`)

Problemy krytyka (runda 1): (1) `hist_roles` na `start_v2` FAIL: neutralne 76,2 % / wtórne 18,7 % / akcent 4,9 % — dolna połowa kadru to sam bruk w cieniu pierzei S, wóz (−8, 9) w żadnym z 12 widoków i 2,17 m od kramu 6; brak `CONFIG.ground`, medalionu, kałuż. (2) Pustka bruku pierwszego planu: sonda `300,1500,200,100` L 0,46 C 0,004, §5.3 (4) „w dolnej ⅓ coś poza brukiem" spełniał tylko słup kramu 0.

## Co miało być widać (lista sprzed kodu, liczby policzone `pos2.mjs`/`cart2.mjs` na kamerze §5.3: (4,5, 1,65, 19,5) yaw 0,20 pitch 0,09, FOV 70, 412×915)
1. Wóz na (5,0, 12,5) ry 0,9 + π: podłoże NDC (0,91, −0,49) px (785, 1362), wierzch skrzyni px 1074, skrzynia NDC x 0,29..0,96, koło NDC (0,54, −0,47) — w dolnej ⅓, ucięty prawą krawędzią, nachodzi tylko na prawy skraj cembrowiny (rogi yaw ≤ 0,111 < lewy skraj dolnej misy 0,137 − 0,02).
2. Beczka drewniana `wine_barrel_01` (4,7, 14,4) NDC (0,80, −0,62..−0,36), kosz `wicker_basket_01` (4,15, 14,15) NDC x ≈ 0,5 — przy latarni 0 (5,93, 14,32).
3. Kałuże `wet` (3,0, 15,4) r 0,6 NDC (−0,48, −0,69) i (4,6, 16,0) r 0,4 NDC (0,74, −0,84), brzeg nieregularny (r·(1 ± 0,25), rng(1300 + i)).
4. Medalion `roof2` (łupek na `stone_tiles_02`): pierścień 6,0–7,2 + 8 promieni 7,35–8,2 (szer. 0,5 m przy 7,2) — widoczny z góry; w kadrze startu pas przy px y ≈ 1190–1203 (NDC z = +7,2 → (−0,49, −0,31)).
5. `hist_roles` na `?roles=1&noaa=1`: n ≤ 68 %, w ≥ 22 %; `errors []`, budżet.

## ZMIANY
- `rynek/src/config.js`: `ground: { medallion: {…}, puddles: {…} }` (wszystkie liczby + policzone NDC w komentarzach); `props.cart: { x, z, ry, collideR, shaft, legacy, bowlClear, foreground }`.
- `rynek/src/layout.js`: `buildGround(W)` na końcu `buildLayout` (`?noground=1`): pierścień + 8 sektorów `RingGeometry` (theta = a − π/2, policzone: a 0,5 → środek (3,73, 0, 6,83)) z UV w metrach świata jak `buildWet`, `check()` środka każdego promienia (kąt ± 0,01 rad, promień ± 5 cm); kałuże `CircleGeometry` z obwodem × (1 ± jitter), atrybut RGBA (mat.wet), `check()`: poza pierścieniem kramów (|p| − r ≥ 14,6), w placu, ≥ 0,25 od latarni, bez nachodzenia, środek AABB ≤ r·jitter + 1 cm od CONFIG. `W.puddles` dla props.js.
- `rynek/src/props.js`: `buildCart` z `CONFIG.props.cart` (`?nocart2=1` → `legacy` (−8, 9, 0,7)); koło pod dyszlem `L(−2,2, 0, 0)` r 0,6 + `checkCollisionCovers` obu belek dyszla z TEJ SAMEJ macierzy (dług KNOWN_B6 spłacony); `checkCartPlacement`: koło wozu poza kramami/latarniami/lipami/kałużami, w placu, rogi skrzyni ze startu yaw ≤ yaw misy − bowlClear, czubek dyszla ≥ 1,6 + 0,35 od kramów; `checkForegroundProp` (beczka/kosz: plac, kałuże, latarnie, koło wozu, para); `put(…, { force: true })` omija `cuts.maxCount` dla celowych ustawień (beczka 5. przy limicie rozsypki 4).
- `audyt/testy/test_geometria.mjs`: `KNOWN_B6 = []` (dyszel naprawiony); B6 pomija płaskie nakładki na bruku (wierzch ≤ 2 cm, grubość ≤ 2 cm) — medalion/kałuże nie są przeszkodą; G: koło wozu i koło pod dyszlem z CONFIG obecne w kolizjach, beczka/kosz przez `put`; bryła `wicker_basket_01` (0,38 × 0,29 × 0,12) z `gltf-transform inspect`.
- `audyt/testy/views_rynek.json`: widok `woz` → kamera (1,5, 13,5) yaw −1,0 (stara patrzyła na (−8, 9)).
- Flagi: `?noground=1` (layout.js:105), `?nocart2=1` (props.js:132/151/154).

## WIDOKI (obejrzane)
- `audyt/testy/out/render/ground_r1_on2/start_v2.png`: wóz z kołem w prawej dolnej ćwiartce (ucięty krawędzią, nachodzi na prawy skraj cembrowiny — misy i posąg wolne, fontanna nadal w środkowej ⅓), drewniana beczka i kosz przy prawej krawędzi, dwie ciemniejsze, chłodniejsze kałuże na bruku na dole; medalion w tym kadrze ledwo widoczny (pas za wozem). ✔ 1–3, 4 słabo.
- `…/ground_r1_on2/start_plac.png`: to samo z kamery HEAD — wóz i beczka po prawej, kałuża dolna-lewa. ✔
- `…/ground_r1_on2/woz.png`: nowy widok wozu z (1,5, 13,5) — koło ze szprychami, skrzynia, kram 1 w tle. ✔
- `…/ground_r1_top2/top_20.png`, `top_60.png` (`?nofog=1` — z mgłą far 140 rzut z góry jest wyprany, `ground_r1_top/`): medalion = ciemny pierścień z 8 promieniami wokół fontanny, ławki między mokrym brukiem a pierścieniem, lipy na pierścieniu; wóz (5,0, 12,5) z dyszlem ku kramowi 1, beczka, kałuże jako ciemne plamy; stara pozycja (−8, 9) pusta; nic na ulicach. ✔
- `…/ground_r1_top/elew_side2.png`: elewacja S — pierzeja zasłania plac (cechy płaskie, wóz bez nowych rx/rz) — bez informacji.
- `…/ground_r1_roles/start_v2.png`: maska ról.
- Cykl 1 (`ground_r1_on/start_v2.png`, odrzucony): `Barrel_01` = czerwona beczka STALOWA z piktogramem, kałuże `water` r 1,0 = turkusowe plandeki 600 px → cykl 2: `wine_barrel_01` z `force`, kałuże `wet` r 0,6/0,4 z nieregularnym brzegiem.

## BUDŻET (HUD, tryb instancji; przed = etap2_r1)
- `start_v2`: 115 draw / 579 662 tri → **114 / 595 855** (+16 k: beczka 3 246 ×2 (cień), wóz przeniesiony, medalion 8·(32·2+2) tri, kałuże 2·24); `start_plac`: 115 / 579 662 → 114 / 595 855; `woz` (nowa kamera): 99 / 526 854 → 93 / 538 063; `top_60`: 131 / 628 k → 140 / 661 150.
- noinst `start_v2`: **152 draw / 344 715 tri**, errors [].
- top-3 `__stats` start_v2: shrub_04_c 55 512, timber 29 240, periwinkle_plant_03 27 664 (bez zmian).
- Cel etapu ≤ 600 k HUD w start_plac: 595 855 — na granicy (margines 4 k).

## KOLOR
- `hist_roles` start_v2 (`?roles=1&noaa=1&noui=1`): **neutralne 67,3 % | wtórne 27,8 % | akcent 4,8 % | inne 0,2 %** → OK (było 76,2 / 18,7 / 4,9 / 0,2 FAIL). Cel krytyka n ≤ 68, w ≥ 22 spełniony.
- Sondy `start_v2` (on2 vs off): bruk pierwszego planu `300,1500,200,100` #5a5e62 L 0,48 C 0,009 H 248 (r1: L 0,46 C 0,004) — bruk w cieniu bez zmian (fizyka: cień pierzei S przy elewacji 30°); kałuża 1 `150,1540,100,50` **L 0,503 C 0,015 H 245** vs bruk pod nią (off) L 0,447 C 0,008 → +0,056 L i chłodniejsza (odbicie nieba na gładszym `wet`); kałuża 2 `680,1660,80,40` L 0,456 C 0,015 H 258 vs off L 0,461 C 0,003; skrzynia wozu `640,1300,60,80` L 0,37 H 40; beczka `700,1400,80,80` L 0,38 C 0,021 H 45 (drewno w cieniu, §4.2 0,32–0,40 ✔).
- lineup: n/d (bez zmian `W.mat`).

## ASERCJE
- `bash audyt/testy/geo_test.sh` → OK, exit 0: B6 163 elementów, KNOWN 0 (było 2), CHECK nieudanych 0; 7 „uwaga" C kram (jak HEAD). `rot_token.mjs layout.js props.js` exit 0. §2.4 grep → 0. grep `Math.sin/cos` → 0 poza `ring:`. grep hex → tylko config.js.
- `results.errors: []` w 7 renderach (on, on2, off, roles, noinst, top, top2).
- Nowe `check()`: medalion (rIn ≥ wet.r + 0,5; rIn ≥ ławki + 0,3; promienie ≤ 8,4; środek każdego sektora na kącie/promieniu), kałuże (pierścień kramów, plac, latarnie, nachodzenie, środek AABB), wóz (kramy/latarnie/lipy/kałuże/plac, misy ze startu, dyszel vs kramy, `checkCollisionCovers` dyszla), beczka/kosz (plac, kałuże, latarnie, koło wozu, para). Kalibracja: cykl 1 oblał „wóz zasłania fontannę" przy progu na cembrowinie (0,114 > 0,066) — przy 8 m pas na prawo od cembrowiny ma 1,4 m, więc próg przeniesiony na dolną misę (policzone 0,111 ≤ 0,117) z komentarzem w config.js.

## DIFF
- `img_diff off→on2 start_v2`: pctOver **9,42 %** (maska: wóz, beczka, kosz, dwie kałuże, cienki pas medalionu — `ground_r1_on2/diff_start_v2.png`).
- `off vs etap2_r1/start_v2`: 3,36 % — wyłącznie girlandy (f17584b clockClear), wieża w oddali (skyline) i ptaki, czyli cudze commity po r1, nie ta cecha (`diff_off_vs_r1.png`).
- `start_plac r1 → on2`: 12,34 % (wóz + beczka + kałuże + girlandy jw.).

## ZNANE BRAKI
- Problem 2 (bruk pierwszego planu L 0,46): NIE ruszany — L bruku w cieniu wynika z elewacji słońca 30° (cień pierzei S 20,8 m), zmiana na 38° = przeliczenie stałych dotNL §4.1.4 i lineup (poza zakresem poprawki modułu layout; `environmentIntensity` odrzucona przez krytyka pomiarem). Pierwszy plan ma teraz drewno (wóz, beczka, kosz) i chłodniejsze kałuże (+0,056 L, C 0,015 H 245), ale sam bruk został L 0,48.
- Medalion w kadrze startu prawie niewidoczny (pas 15 px za wozem, ten sam L co bruk w cieniu) — widoczny z góry i z bliska; tint `roof2` L 0,70 na tiles (albedo 0,40 vs bruk 0,49) daje mały kontrast L, różnica głównie we wzorze płyt. Ciemniejszy klucz = nowy `W.mat` (lineup) — zostawione dla motywu #9.
- Kałuże z kluczem `wet` liczą się jako neutralne (60/30/10 bez ich udziału); `hist_roles` OK dzięki wozowi i beczce.
- `start_plac` 595 855 HUD — 4 k pod celem etapu 600 k.
- Cykle: 2/3.
