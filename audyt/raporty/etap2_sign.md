# Etap 2 — motyw #10b „szyldy cechowe + herby" (?nosign=1) — raport (cykl 1/3)

Stan wyjściowy: `d8b72ab` (portale #10a) po `6c24511` (§8 #11: signMatrix + asercja F + stub W.bounds/W.put). Worktree /home/user/wt-a, PORT 8376.

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.sign = { share: 0.4, y: 3.05, w: 1.3, h: 0.8, out: 0.8, fromDoor: 1.0, orielGap: 0.2, gapBack: 0.01, bracketY: 3.5, bracket: { t: 0.05, back: 0.1, len: 1.6 }, hanger: { t: 0.03, h: 0.1 }, plaque: { w: 0.36, h: 0.36, y: 2.83, out: 0.02 }, tiles: [gryf, kielich, bochen, dzban, nożyce, młot, liść, klucz], tavernTile: 0, tavernText: 'Pod Złotym Gryfem', atlas: { cols: 4, rows: 2, tile: 256, win: 158, plq: 112, cyText: 56 } }`; `paletteOKLCH.canvas.silver = [0.86, 0.010, 250]` (+ `palette.silver` dla ?nopalette). §2.4: 0.
- rynek/src/materials.js: `signTexture(col, A, text)` = ATLAS 1024 × 512 (4 × 2 kafelki po 256 px, okno szyldu 256 × 158 ≈ 1,3 × 0,8 m): deska, złota ramka, tarcza „heater" w kolorze pola `W.hex.fields` = cloth0..3 (§4.2: te same kolory heraldyczne), godło rysowane ścieżkami canvas (`EMBLEMS`, 8 szt.; złote, ciemne na szafranie, liść srebrny), kafelek 0 z napisem karczmy pod mniejszą tarczą. Stary szyld tekstowy → `signTextTexture` (tylko ?nosign=1). `W.hex.fields`, `W.hex.silver`.
- rynek/src/props.js: `signPlacements(W)` (funkcja CZYSTA na `W.portals`, eksport do geo/entry.mjs — asercja F2): domy przy placu (bez setback) z udziałem share ze strumienia `rng(seedLocal + 7)` (r() domu bez zmian), karczma s2 zawsze z kafelkiem 0; kafelki z puli bez powtórzeń (8 godeł na 9 szyldów: bochen 2×); x = doorX − sign(along)·1,0 (ku ulicy), przy wykuszu bliżej niż r + 0,2 = 1,3 → druga strona drzwi; `m = signMatrix(tr, along, {y, faceZ: faceZ1, out})` (ry = tr.ry − sign(along)·π/2 — front do ulicy), `mBack = M4(0,0,−0.01,π)·m`, wspornik `F(0, 3.5, faceZ1 − 0.1 + 0.8)`, 2 wieszaki, plakieta `F(doorX − x, 2.83, faceZ + 0.02)` (bez niej, gdy kroksztyny wykusza bliżej niż 0,85 od doorX). `buildSigns(W)`: mat.sign = atlas (jednostronny, 2 płaszczyzny `tilePlane` z UV kafelka `signTileUV`), iron wspornik/wieszaki, plakieta z kwadratowym oknem 112 px wokół środka tarczy. `buildBanners`: `?nosign=1` → szyld HEAD, ale jedną macierzą `M4(0,3.05,0.8,π/2)·M4(t)` (= stary łańcuch T·R·T·R, policzone — spłata długu K3 props.js:141-142; lustro K2 zostaje celowo jako stan sprzed cechy).
- rynek/src/buildings.js: `seedLocal` w wpisie W.portals.
- audyt/testy/test_geometria.mjs: **F2** — `signPlacements` na W.portals z 28 izolowanych `buildHouses`: każdy szyld n·dirToStreet ≥ 0,9, druga płaszczyzna odwrócona, środek 0,8 przed licem piętra 1 na y 3,05, tył wspornika ≤ −0,05 (w ścianie), odległość od osi wykusza ≥ 1,3, w obrysie domu; ≥ 3 szyldy i karczma z kafelkiem 0. Wynik: 9 szyldów, 8 plakiet, 0 FAIL. geo/entry.mjs eksportuje `signPlacements`.
- rynek/app.js: bundle. Flaga `?nosign=1` (`grep flags.nosign rynek/src` → props.js:161).
- Lista „co ma być widać" PRZED kodem: `$SP/m10/lista_sign.md`; liczby K13: normalna karczmy (+1,0,0) i pozycja (−4,94, 3,05, 21,2) policzone jednolinijkowcem PRZED kodem i potwierdzone wypisem z geo bundla.

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] szyld_L (sign_on2): szyld karczmy prostopadle do fasady nad portalem, napis „Pod Złotym Gryfem" CZYTELNY (nie lustrzany), gryf złoty na purpurowej tarczy, złota ramka; wspornik iron nad szyldem wchodzący w ścianę, 2 wieszaki. szyld_P (sign_on, z drugiej strony): ta sama treść czytelna (druga płaszczyzna) — nie lustro.
2. [x] karczma_szyld (widok z views_rynek, kamera patrzy w +z): szyld widoczny z boku pod ostrym kątem (front ku ulicy = +x), z HEAD (sign_off2) w tym widoku był lustrzany napis na wprost — zmiana zgodna z F.
3. [x] pierzeja_S_szyldy (−1, 13 → dom s2 14,3): szyld „młot" na turkusowej tarczy prostopadle z fasady nad portalem, poniżej okien piętra 1, front ku kamerze (ulica po stronie +x); herb nad zwornikiem. 9 szyldów w scenie (s1 −25,8 nożyce, s1 −9,0 kielich, s2 −26,6 dzban, s2 −9,0 klucz (bez plakiety — kroksztyny), s2 6,3 gryf, s2 14,3 młot, s2 24,5 liść, s3 15,2 bochen, s3 24,3 bochen).
4. [x] Herb: plakieta 0,36 m z tarczą (kwadratowe okno 112 px — po 1. renderze okno 158 px łapało fragment napisu „od Złotym Gryfe"; poprawione, sign_on2/szyld_L: sama tarcza) nad zwornikiem, pod belkami jetty; 2 cm przed licem.
5. [x] Bez kolizji z wykuszem/kroksztynami: F2 0 FAIL; s2 −9,0 (wykusz 0,85 od drzwi) bez plakiety.
6. [x] Budżet: +1 draw w start_plac (sign w kadrze: 93 → 94), +726 tri HUD; start_plac diff 0,03 % (szyldy pierzei N za małe/za daleko), top 0,01 %.

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1, QUALITY=high DPR=2 412×915; top 1024² DPR 1; każdy obejrzany; bez elewacji — cecha bez rx/rz, < 4 m):
- sign_on2/szyld_L.png (po poprawce plakiety), sign_on/szyld_P.png, sign_on/pierzeja_S_szyldy.png vs sign_off/* (?nosign=1); diff: sign_on2/diff_szyld_L.png (maska = szyld + wspornik + plakieta, obejrzana), sign_on/diff_szyld_P.png, sign_on/diff_pierzeja_S.png (obejrzana: tylko szyld).
- sign_on2/karczma_szyld.png, start_plac.png vs sign_off2/*; sign_on2/diff_start_plac.png, diff_karczma_szyld.png.
- sign_on_top/top.png + diff_top.png (vs portal_on_top/top.png).
- sign_on_noinst/start_plac.png, szyld_L.png (?noinst=1; szyld_L obejrzany — identyczny z trybem instancji).

BUDŻET (HUD, tryb instancji; przed = ?nosign=1, po = z cechą):
- start_plac: calls 93 → 94, triangles 370 614 → 371 340 (+726; cel ≤ 600 k, zapas 229 k); szyld_L 74 → 74 / 306 559 → 307 283; szyld_P 68 → 68 / 266 433 → 267 157; pierzeja_S_szyldy 81 → 82 / 361 305 → 362 031; karczma_szyld 75 → 75 / 319 543 → 320 267; top 118 / 419 627 (portal_on_top 418 903). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 117 / 250 084 (po #10a: 116 / 249 358), szyld_L 84 / 194 509; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 28 800, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d dla lineupu (klucz `sign` = CanvasTexture sRGB bez tintu, poza MAT_KEYS jak na HEAD); kolory atlasu z palety: pola tarcz = heksy cloth0..3 z `paletteOKLCH.tint`, godło/ramka `canvas.gold`, deska `canvas.signBoard`, liść `canvas.silver` — bez nowych rodzin odcieni.

ASERCJE: geo_test.sh exit 0 (okien/ram 1721, B1b 132, połaci 82, B5 3164, B5b 10, domów 28, kramów 7, wieża 16, F 8 (stary łańcuch 4/8), **F2 9 szyldów / 8 plakiet**, put 2, B6 102, KNOWN 2, CHECK 0); rot_token.mjs props.js + buildings.js exit 0; results.errors [] w 7 renderach (sign_on, sign_on2, sign_off, sign_off2, top, noinst); grep K3 = tylko dług chorągwi props.js:156-158 (#5) — szyld spłacony; grep §3.1 = dług stalls.js; grep hex §4.3.6 = tylko config.js; §2.4 = 0. Nowe check() w buildSigns (× 9): „tyłem do ulicy" (n·dirToStreet > 0,9: 1,00), „druga płaszczyzna nie tyłem" (< −0,9), „środek" (checkInFrontOfWall ≥ 0,795: 0,800), „wspornik nie w ścianie / krótszy niż szyld" (−0,1 ≤ −0,05; 1,5 ≥ 1,45), „szyld nie pod wspornikiem / za nisko" (3,45 ≤ 3,475; 2,65 ≥ 2,6), plakieta (× 8): „w zworniku" (2,65 ≥ 2,645), „w belkach jetty" (3,01 ≤ 3,02), checkInFrontOfWall ≥ 0,015 (0,020); „szyldy: mniej niż 3 albo brak karczmy" — wszystkie PASS.

DIFF (img_diff, próg 20): szyld_L 5,85 %, szyld_P 2,25 %, pierzeja_S_szyldy 0,56 %, karczma_szyld 1,15 % (cecha ≥ 0,5 %); start_plac on/off 0,03 % (kontrolny — bez zmian poza szyldami pierzei N w tle); top 0,01 %; vs baza repo: 25,66 %.

ZNANE BRAKI:
- Godła to proste sylwetki canvas (gryf = tułów + skrzydło + głowa z dziobem) — z 2 m czytelne jako herb, z bliska schematyczne; klucz/nożyce uproszczone.
- Szyld to 2 płaszczyzny (bez deski-bryły): krawędź boczna zerowej grubości; z boku (karczma_szyld) widać tylko front pod ostrym kątem.
- Bez `CONFIG.noShadowKeys` (§8 #17 — #5): klucz `sign` rzuca cień jak na HEAD; po scaleniu dodać `sign` do wyrażenia (już w liście promptu).
- Szyldy tylko na domach przy placu (domy zamykające ulice: along = 0 → brak „strony ulicy"); udział 0,4 dał 9 szyldów (8 z losowania + karczma).
- Cykle: 1/3 (poprawka okna plakiety w tym samym cyklu przed renderem off).

## Cykl 2/3 — weryfikacja na HEAD `7dc2274` (po #7 lipy/kompozycja, #6 cykl 2, #12 cykl 2, #9 cykl 2)

Kod cechy bez zmian (bundle przebudowany — identyczny z HEAD). Pozycje szyldów z geo bundla (`$SP/m10/signs_pos.mjs`) bez zmian: 9 szyldów (s1 −25,8 nożyce, s1 −9,0 kielich, s2 −26,6 dzban, s2 −9,0 klucz bez plakiety, s2 6,3 gryf (−4,94, 3,05, 21,2) n (+1,0,0), s2 14,3 młot (−12,38, 3,05, 20,85), s2 24,5 liść, s3 15,2 bochen, s3 24,3 bochen), 8 plakiet; kamery policzone wzorem §3.6 (patrz etap2_portal.md, cykl 2).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG cyklu 2):
1. [x] `m10c2_on/szyld_L.png` (kamera od strony +x = frontu): „Pod Złotym Gryfem" czytelne (nie lustro), gryf złoty na purpurowej tarczy, złota ramka; wspornik iron w ścianie nad szyldem, 2 wieszaki; plakieta z tarczą nad zwornikiem portalu.
2. [x] `m10c2_on/szyld_P.png` (kamera od strony −x): ta sama treść czytelna z drugiej płaszczyzny — nie lustro; plakieta nad łukiem widoczna z boku.
3. [x] `m10c2_on2/pierzeja_S_szyldy.png`: szyld „młot" (turkusowa tarcza) prostopadle z fasady domu s2 14,3, front ku kamerze (+x), pod belkami jetty, obok wykusza (bez kolizji); plakieta nad zwornikiem.
4. [x] `m10c2_on2/karczma_szyld.png` (views_rynek, kamera patrzy +z): szyld widoczny krawędzią pod ostrym kątem (front +x), plakieta na wprost nad łukiem — zgodne z F (na HEAD sprzed cechy w tym widoku był lustrzany napis na wprost).
5. [x] `m10c2_on/start_plac.png`: kontrolny — maska diff on/off (obejrzana) = tylko 3 łuki pierzei N + HUD, 0,40 %; szyldy pierzei N poza progiem (za małe z 40 m).
6. [x] `m10c2_on_top/top.png`: 0,02 % vs off — szyldy pod okapem niewidoczne, nic na placu.
7. [x] `m10c2_on_noinst/szyld_L.png` (`?noinst=1`, obejrzany): identyczny (0,06 %); errors [].

BUDŻET cyklu 2: jak w etap2_portal.md (cykl 2) — start_plac 100 / 375 388 (inst) i 122 / 249 688 (noinst), szyld_L 77 / 322 723 (inst) i 88 / 205 553 (noinst); on/off obu cech razem: start_plac 99 → 100 draw (+1 = klucz `sign` w kadrze), 365 254 → 375 388 tri. errors [] w 7 renderach.
DIFF: szyld_L 9,15 % (szyld + portal razem, maska obejrzana), pierzeja_S_szyldy 3,66 %, start_plac 0,40 %, top 0,02 %; vs baza repo 31,67 %.
ASERCJE: geo_test.sh exit 0 na HEAD 7dc2274 (F 8/8, stary łańcuch 4/8; F2 9 szyldów / 8 plakiet; CHECK 0); rot_token props.js exit 0; results.errors [] ×7.
ZNANE BRAKI: bez zmian z cyklu 1 (godła schematyczne; szyld = 2 płaszczyzny bez grubości; `sign` bez `CONFIG.noShadowKeys` do czasu §8 #17 przez #5; szyldy tylko na domach przy placu). Cykle: 2/3 (weryfikacja na HEAD, bez zmian kodu).
