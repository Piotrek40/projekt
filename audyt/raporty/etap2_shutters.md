# Etap 2 — motyw #9 „okiennice paint0..2" (?noshutters=1) — raport (cykl 1/3)

Stan wyjściowy: commit palety (ten sam motyw #9, `etap2_palette.md`) — klucze `paint0..2` na old_planks_02 z `CONFIG.paletteOKLCH.tint`.

ZMIANY:
- rynek/src/config.js: `CONFIG.shutters = { share: 0.6, ww: 0.75, wing: 0.25, t: 0.04, gap: 0.02, open: 0.25, postClear: 0.08, ground: { ww: 0.9, wing: 0.45, edgeGap: 0.03 } }` (komentarz z policzonymi liczbami: środek x cx ± 0,516, z front + 0,131, zawias 0,030, wolny koniec 0,092, pole ≥ 1,442).
- rynek/src/buildings.js: `braced[i]` zapamiętuje zastrzały pól (`r()` domu bez zmian); `shutterOK(field, cx, ground)`, `shutterReach(ww, wing)`, `shutters(cx, wy, wh, faceZ, ww, wing, id, posts)`: skrzydło `box(wing, wh, t)` w `paint<Rs.int(0,2)>` (kolor per dom ze strumienia `rng(seedLocal + 6)`), `L(cx + s·(ww/2 + gap + tipX), wy, frameFace + t/2 + gap/2 + |tipZ|, −s·open)` — `tipX/tipZ` = koniec skrzydła po obrocie `open` PRZEZ M4 (0,121 / 0,031; bez ręcznego cos/sin — §3.1 grep 0), `frameFace = faceZ + 0,07` (lico ramy `box(…,0.1)` na +0,02). Piętra: okno w polu bez zastrzału, pole ≥ 1,442 m, udział share → okno zwężone do `ww` 0,75, skrzydła 0,25; parter (lico d/2, bez słupków): skrzydła 0,45 przy oknie 0,9, gdy zewnętrzny skraj + 0,03 mieści się w w/2. Elementy nachodzące na wykusz pomijane (zasięg okiennic + luz 0,1). Pierwsza wersja dostała znak przesunięcia z odwrotnie (koniec +x po ry>0 idzie w −z; zawias lądował 8 cm W ŚCIANIE, d = −0,081) — złapane przez check() w geo_test (484 CHECK), naprawione `Math.abs` → 0.
- Asercje z TEJ SAMEJ macierzy skrzydła: `zawias nie przy ramie` (0,02 ≤ d ≤ 0,05; = 0,030), `wolny koniec nie na zewnątrz` (d ≥ 0,08; = 0,092 piętro / 0,142 parter), `okiennica w słupku` (|sx − postX| ≥ 0,125 + 0,08; 0,234 przy polu 1,50, minimum 0,206 przy polu 1,442), `okiennica poza obrysem domu`. K13: liczby §5.2 #9 sprawdzone jednolinijkowcem dla 4 pierzei i obu skrzydeł (0,030 / 0,092) PRZED kodem; pola między słupkami policzone dla w 6–22: 1,44–1,78 m (prompt: 1,50–1,58) → warunek szerokości pola (w 7,2 m → 1,44 < 1,442 odpada).
- rynek/app.js: bundle. Flaga `?noshutters=1` (`grep flags.noshutters rynek/src` → buildings.js) = stan bez okiennic (start_plac 87 / 355 398 = paleta bez okiennic); `?nopalette=1` też je wyłącza (brak kluczy paint*).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
5. [x] shutters_on/okiennice_L.png, okiennice_P.png (dom s0 6.1 — plaster2, 4 piętra; kamera (2, −16) yaw −0,6 / (10, −16) yaw 0,58, pitch 0,41): skrzydła zielone (paint0) po obu stronach okien TYLKO w polach bez zastrzału (pola z zastrzałem: okna szerokie bez skrzydeł), okna z okiennicami węższe (0,75); skrzydła uchylone OD ściany — z ±45° widoczne jako klin (wolny koniec dalej od tynku niż zawias przy ramie); nie wchodzą w słupki (asercja + PNG: szpara między skrzydłem a słupkiem).
6. [x] Parter: palette_on/paleta_N.png dół (y ≈ 1030–1100): zielone skrzydła 0,45 przy oknach parteru domów N; w okiennice_P okno parteru bez okiennic (udział 0,6 / warunek obrysu) — zgodnie z regułą.
7. [x] Kolory per dom: paleta_N — dom plaster3 i plaster1: zieleń butelkowa; paleta_E — skrzydła bordo (paint1) na domu plaster2/1 pierzei E w cieniu (ciemnoczerwone paski); elew0: zielone na domach s0 −13.8 i 6.1; elew1: ciemne (w cieniu). Reszta sceny bez przetasowania: diff maski = wyłącznie paski skrzydeł (palette_on/diff_shutters_paleta_N.png obejrzany).
8. [x] Budżet: +6 draw (3 klucze paint × 2 przebiegi), +5 808 tri HUD w start_plac.

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1, QUALITY=high DPR=2 412×915; ortho 1024²): shutters_on/okiennice_L.png, okiennice_P.png vs shutters_off_zbl/* (?noshutters=1) + shutters_on/diff_okiennice_*.png; palette_on/{paleta_N,paleta_E,start_plac}.png vs shutters_off/* (paleta bez okiennic) + palette_on/diff_shutters_*.png; palette_on_top/elew0.png (side 0, OBEJRZANA PIERWSZA — okiennice mają ry, elewacja rozstrzyga: skrzydła po obu stronach okien, zawias przy ramie), elew1.png (side 1), top.png (nic nowego na placu — okiennice 0,16 m przed licem pod okapem); palette_on_noinst/start_plac.png, paleta_N.png (?noinst=1).

BUDŻET (HUD, tryb instancji; przed = ?noshutters=1, po = z okiennicami):
- start_plac: calls 87 → 93, triangles 355 398 → 361 206 (+5 808; cel ≤ 600 k, zapas 239 k); paleta_N 80 → 86 / 348 023 → 353 831; paleta_E 71 → 77 / 316 155 → 321 963; okiennice_L 65 → 71 / 283 375 → 289 183; okiennice_P 61 → 67 / 229 029 → 234 837; top 118 / 409 495; elew0 70 / 249 689; elew1 72 / 316 595. Wszystko ≤ 250 / ≤ 700 000.
- noinst: start_plac 116 / 239 950, paleta_N 102 / 218 283; errors [].
- top-3 __stats start_plac: timber 1 / 29 136, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: paint0..2 na lineupie (etap2_palette.md): słońce kula L 0,50–0,55, ściana +z 0,43–0,45 (pred 0,45–0,50), cień 0,25–0,30 — zaliczone kryterium Δab (lineup_v2: 21/21 w rzędzie 2; cień: 21/21); w scenie bez osobnej sondy (skrzydło 0,25 m = 8 px w elewacji — za wąskie na prostokąt 12 px).

ASERCJE: geo_test.sh exit 0 (nowe check() PASS: zawias 0,030 / wolny koniec 0,092 / słupek ≥ 0,206 / obrys — pierwsza wersja ze złym znakiem: 484 CHECK = 2 asercje × 242 skrzydła → 0); rot_token.mjs buildings.js exit 0 (`rot:` przy `L(…, −s·open)`); results.errors [] w shutters_on, shutters_off_zbl, palette_on, shutters_off, top/elew, noinst; grep §3.1 = 0 w buildings.js (tipX/tipZ przez M4); §2.4 = 0.

DIFF (img_diff, próg 20): okiennice_L 2,45 %, okiennice_P 2,98 %, paleta_N 1,53 %, paleta_E 1,24 % (cecha ≥ 0,5 %); start_plac (kontrolny) 0,41 % — tylko paski skrzydeł na domach w tle; top: bez zmian na placu.

ZNANE BRAKI:
- Skrzydła bez ramy/listew (płaski box 0,25 × wh × 0,04) — z dystansu czytają się jako ciemne paski; detal (deskowanie, zawiasy iron) do wykończeń.
- Parter: okiennice tylko tam, gdzie skrzydło 0,45 mieści się w obrysie (|cx| ≤ w/2 − 0,943) — przy oknach blisko narożnika ich nie ma.
- Bez cienia własnego wyłączonego (`CONFIG.noShadowKeys` z §8 #17 należy do #5 — po scaleniu dodać `paint` do wyrażenia).
- Cykle: 1/3.
