# Etap 2 — motyw #6 „wykusze wieloboczne + kroksztyny" (?nooriel=1) — raport (cykl 2/3; sekcja cyklu 1 niżej)

Stan wyjściowy: `5516ada` (po #12c naczółek). Bez pozycji §8 na własność (#6 nie jest właścicielem żadnej — osobnego commitu infrastruktury nie ma); zmiana testu (gałąź B1b) w tym samym commicie, bo dotyczy tylko tej cechy.

## Cykl 2/3 — weryfikacja na HEAD `b9f8a45` (po #9 paleta/okiennice, #10 portale/szyldy, #7 kompozycja/lipy) + kroksztyny pod spód wykusza przy jetty

Stan wyjściowy: `b9f8a45`; `git status` czysty; `geo_test.sh` na czystym HEAD exit 0, `rot_token.mjs buildings.js` exit 0. Lista „co ma być widać" PRZED renderem: `$SP/oriel/lista_cykl2.md` (7 punktów; p.7 dopisany PRZED kodem zmiany).

ZMIANY (cykl 2):
- rynek/src/buildings.js (`orielBay`, kroksztyny): profil kroksztynu `[[0,0],[w+ext,0],[ext,−h],[0,−h]]` z `ext = faceZ − faceZBelow` (jetty 0,35 / 0 bez jetty → trójkąt jak w cyklu 1; próg 0,01 z komentarzem: bez jetty punkty (ext,−h) i (0,−h) by się pokryły). Powód: u domów z jetty kroksztyn 0,35 z muru parteru kończył się NA osi wykusza (pod strefą jetty, nakładanie z podwaliną 0,07) — spód sześciokąta 0,95 m wisiał bez widocznego podparcia (ZNANE BRAKI cyklu 1). Teraz wierzch sięga `reach = w + ext = 0,70` → 0,35 przed oś wykusza, pod spód sześciokąta (spód sięga z 0,745 przy x = cx ± 0,67 — policzone), ścięcie 45° w × h na końcu; spód y − h = 2,85 bez zmian (nad zwornikiem 2,625 i plakietą #10b 2,65–3,01; warunek plakiety `plaqueOK` liczy tylko x — bez zmian). K13: `L(xc, y, faceZBelow, −π/2)`: (0.7,0,0) → (xc, y, faceZBelow+0.7), (0.35,−0.35,0) → (xc, y−0.35, faceZBelow+0.35) (jednolinijkowiec uruchomiony, wynik w komentarzu); normalne ścian k dla 4 pierzei policzone ponownie: ry 0 (∓0.866,0,0.5)/(0,0,1); −π/2 (−0.5,0,−0.866)/(−1,0,0)/(−0.5,0,0.866); π (±0.866,0,−0.5)/(0,0,−1); π/2 (0.5,0,0.866)/(1,0,0)/(0.5,0,−0.866).
- Nowa asercja `check()`: `'… wykusz kroksztyn i nie sięga pod spód wykusza'` — przy ext ≥ 0,01 zewnętrzny górny róg ≥ w − 0,005 = 0,345 przed osią wykusza (lico piętra); `'… kroksztyn i'` (checkInFrontOfWall) próg `reach − 0,005`. Kalibracja: `reach = w + 0,5·ext` → CHECK „nie sięga pod spód" dla wszystkich kroksztynów domów z jetty (m.in. s3 0.0, s2 14.3, s2 0.0; geo_test exit 1); po przywróceniu 0 CHECK, exit 0. „nie styka się z podwaliną": min(dOut, bt) − max(dIn, 0) = 0,16 (jetty) / 0,09 (bez) ≥ 0,05 — PASS ×22.
- rynek/src/config.js: komentarz przy `houseDetail.oriel.corbel` (reguła w + jetty; bez nowej liczby — ext wynika z geometrii domu). Nowe linie z ułamkiem bez komentarza (`git diff -U0 HEAD -- rynek/src`): 0. grep §3.1 Math.sin/cos poza `ring:`: 0.
- rynek/app.js: bundle (§6 p.3, esbuild 106 ms).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG, `audyt/testy/out/render/`, `noui=1&nosmoke=1&nosway=1&nowater=1`):
1. [x] elew2 (`oriel2_on_orto/elew2.png` HEAD, `oriel2b_on_orto/elew2.png` po zmianie — identyczne, pctOver 0; ortho 1024², side 2, size 30, OBEJRZANA PIERWSZA): 3 daszki stożkowe wykuszy między piętrem 1 a 2 przy px x ≈ 150 (dom s2 −9.0, x 10,5), 470 (dom zamykający ulicę S, x 1,0, przez przerwę ulicy), 1010 (s2 14.3, x −15,1; skraj kadru); pod nimi bryły wykuszy w tynku domu z okiennicami #9 na sąsiednich oknach. elew2 on/off (`oriel2b_off_orto`): pctOver 1,73 %.
2. [x] wykusz_L / wykusz_P (`oriel2b_on/*.png`; kamera (14,74; 17,41) yaw 2,356 / (6,26; 17,41) yaw −2,356, pitch 0,457 — cel wykusz (10,5; 4,63; 21,65)): sześcioboczna bryła, 2 widoczne ściany z oknem 0,6×1,3 (świecące / ciemne) w ramie, 4 słupki narożne, podwalina i oczep, płaski spód, skraj daszka jako ciemnoczerwony pas pod jetty piętra 2; **2 kroksztyny widoczne jako wsporniki pod środkiem spodu ze ściętym 45° czołem** (w cyklu 1: trójkąty tylko przy murze parteru — `oriel2_on/wykusz_L.png` na kodzie cyklu 1); okiennice #9 sąsiednich okien piętra 1 nie wchodzą w bryłę; szyld #10b „klucz" na prawo od wykusza ≥ 1,3 m od osi, wspornik nad kroksztynami; portal łukowy #10a pod spodem.
3. [x] start_plac (`oriel2b_on/start_plac.png` vs `oriel2_off/start_plac.png`): maska diff (`diff_start_plac.png`, obejrzana) = tylko wykusz domu zamykającego ulicę N (x −2,3; z −37,65) na prawo od wieży (mała bryła ze świecącym oknem i ciemnym daszkiem) + cyfry HUD; plac, kramy, fontanna, lipy, wieża bez zmian; pctOver 0,31 %.
4. [x] top (`oriel2b_on_orto/top.png`, obejrzany): nic nowego na placu ani w ulicach (wykusze pod okapem), on/off 0,06 %.
5. [x] noinst (`oriel2b_on_noinst/`, `?noinst=1`): wykusz_L 88 draw / 195 079 tri (obejrzany — identyczny z trybem instancji), start_plac 122 / 249 688; errors [].
6. [x] Budżet: 0 draw; +2 700 tri HUD na widok vs `?nooriel=1` (wykusz_L 275 131 → 277 975; start_plac 372 544 → 375 388); zmiana kroksztynów +144 tri HUD (profil 4-punktowy zamiast trójkąta u domów z jetty; HUD liczy z passem cieni).
7. [x] Kroksztyny pod spód wykusza (p.7 listy): maska `oriel2b_on/diffc_wykusz_L.png` (obejrzana) = wyłącznie 2 kroksztyny; pctOver kod cyklu 2 vs kod cyklu 1 (ten sam HEAD): wykusz_L 0,78 %, wykusz_P 0,63 %, start_plac 0,02 % (szum).

WIDOKI (cykl 2; każdy obejrzany): `oriel2_on_orto/{elew2,top}.png` (HEAD), `oriel2_on/{wykusz_L,wykusz_P,start_plac}.png` (HEAD), `oriel2_off/*` (`?nooriel=1`), `oriel2b_on/{wykusz_L,wykusz_P,start_plac}.png` + `diff_*.png` (vs off) + `diffc_*.png` (vs kod cyklu 1), `oriel2b_on_orto/{elew2,top}.png` + `diffoff_*.png`, `oriel2b_off_orto/*`, `oriel2b_on_noinst/{wykusz_L,start_plac}.png`.

BUDŻET (HUD, tryb instancji; przed = `?nooriel=1`, po = cykl 2): start_plac 100 → 100 draw, 372 544 → 375 388 tri (HEAD b9f8a45 z cechą: 375 244; cel ≤ 600 k, zapas 225 k); wykusz_L 71 / 275 131 → 277 975; wykusz_P 77 / 317 315 → 320 159; elew2 79 / 315 493 → 318 337; top 124 / 420 831 → 423 675. noinst: start_plac 122 / 249 688, wykusz_L 88 / 195 079 (errors []). top-3 __stats start_plac: timber 1 / 29 240 (było 29 168), wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776. Wszystko ≤ 250 / ≤ 700 000.

KOLOR: n/d (bez zmian W.mat).

ASERCJE: geo_test.sh exit 0 (okien/ram 1721, B1b 132, połaci 82, B5 3164, B5b 10, domów 28, kramów 7, wieża 16, szyldów F 8 / F2 9, lip H 2, B6 135, KNOWN 2 = dyszel wozu, CHECK nieudanych 0; 7 uwag C kramów); rot_token.mjs buildings.js exit 0; results.errors [] w 8 renderach cyklu 2 (orto HEAD, on HEAD, off, on cykl 2, noinst, orto cykl 2, orto off + kalibracja); nowa asercja „nie sięga pod spód wykusza" (próg w − 0,005 = 0,345 przed osią; skalibrowana: FAIL przy reach 0,525).

DIFF (img_diff, próg 20): wykusz_L on/off 14,74 %, wykusz_P 12,46 %, elew2 1,73 %, start_plac 0,31 % (tylko wykusz w ulicy N), top 0,06 %; zmiana cyklu 2 (kroksztyny): wykusz_L 0,78 %, wykusz_P 0,63 %, elew2 0 %, top 0,01 %, start_plac 0,02 %.

ZNANE BRAKI (po cyklu 2):
- Daszek stożkowy pod jetty piętra 2: z poziomu placu widać tylko przedni skraj (pas 0,17–0,6 m); pełny stożek zasłania bryła piętra wyżej — z założenia.
- Bez konsoli (odwrócony stożek) pod spodem — sprzeczna ze specyfikacją kroksztynów §5.2 #6 (schowałaby kroksztyny w bryle; policzone: kroksztyn w promieniu 0,62 od osi leży wewnątrz stożka o r górnym 0,85). Zamiast tego kroksztyny sięgają 0,35 przed oś przy jetty (cykl 2); u domów bez jetty jak w cyklu 1 (0,35 od muru = 0,35 przed oś).
- Z góry (top) wykusze niewidoczne (pod okapem) — brak sygnału, nie błąd.
- Dom zamykający ulicę: `cxMax` 2,5 → wykusz w pasie ±2,5 m od osi ulicy (N −2,3; E 0,1; S 1,0; W −0,9).
- Cykle: 2/3.

## Cykl 1/3 (stan wyjściowy `5516ada`)

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.oriel = { minW: 7, edgeGap: 6, floor: 1, r: 1.1, seg: 6, win: [0.6, 1.3], litShare: 0.35, capR: 1.3, capH: 0.8, edge: 0.3, cxMax: 2.5, corbel: { w: 0.35, h: 0.35, t: 0.14, step: 1.2 } }` (komentarz z policzonymi liczbami: apotema 0,953, okap daszka 0,17, 11 domów). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/buildings.js: nagłówek układu lokalnego (§3.3); `orielBay(y, faceZ, faceZBelow, faceZAbove, bt)` — wykusz na piętrze `floor` domów `w > minW && |along| < half − edgeGap && floors > floor + 1`: bryła `cylinder(r, r, fh + 0.01, seg)` plaster z `ry = π/seg` (ściana na +z; spód 1 cm pod spodem piętra — K5), środek na licu piętra (połowa w fasadzie), 3 ściany k = −1/0/+1 z oknem `box(0.6, 1.3, 0.04)` na `ap + 0.01` w układzie ściany `F(k, …) = M4(…).premultiply(L(cx, 0, faceZ, k·2π/seg))`, ramy jak okna pięter, podwalina/oczep ściany, 4 słupki narożne na wierzchołkach ±30°/±90°; daszek `cylinder(0, capR, capH, seg)` w kluczu dachu domu z podstawą 1 cm pod wierzchem wykusza; kroksztyny `prism([[0,0],[w,0],[0,−h]], t)` (trójkąt prostokątny — `gable()` z §5.2 to trójkąt równoramienny z wierzchołkiem w środku podstawy, który nie przylega do ściany) na `L(xc, y, faceZBelow, −π/2)`, 2 szt. co 1,2 m. Apotema liczona macierzą (`V(0,0,r)·M4(0,0,0,π/seg)`.z), nie ręcznym cos (§3.1 grep = 0). Elementy fasady nachodzące na wykusz (słupki, zastrzały, okna piętra wykusza; belki jetty piętra wykusza i piętra wyżej) pominięte z zachowaniem wywołań r() — reszta domu bez zmian; pozycja i światło okien z `rng(seedLocal + 4)`.
- audyt/testy/test_geometria.mjs: nowa gałąź **B1b** (elementy wykusza obrócone o k·60°, których B1 nie widzi): lico przednie okna/ramy wzdłuż WŁASNEJ normalnej ≥ apotema + 0,005 od osi wykusza (wykusz = plaster typu CylinderGeometry). Kalibracja: 0 FAIL na poprawnym kodzie (132 elementy = 11 × (3 szkła + 9 ram)); okno cofnięte o 0,05 → 33 FAIL B1b + 33 CHECK; kroksztyn 0,1 niżej i 0,1 przed ścianą → 22 FAIL B5 + 22 CHECK „nie styka się z podwaliną". Pierwszy przebieg B1b wykrył prawdziwą wadę (okno fasady w 1,2 m od osi wykusza wchodziło w bryłę) → margines ukrywania okien = pół okna + rama 0,16 + luz 0,1.
- rynek/app.js: bundle (§6 p.3).
- Flaga: `?nooriel=1` (`grep flags.nooriel rynek/src` → buildings.js:41) = stan sprzed cechy (start_plac 352 118 tri = identycznie jak po #12c).
- Lista „co ma być widać" PRZED kodem: `$SP/oriel/lista.md` (7 punktów); liczby K13: `$SP/oriel/proto.mjs` (wierzchołki sześciokąta z PRAWDZIWEJ CylinderGeometry po ry=π/6: (±0.55, ±0.953), (±1.1, 0); normalne ścian k = (∓0.866, 0, 0.5)/(0,0,1) = wzór z §5.2 #6; dla 4 pierzei iloczyn z kierunkiem do placu 0,99/0,60/0,40; kroksztyn ry=−π/2: (0.35,0,0) → (0,0,0.35); apex stożka na ostatniej kondygnacji przebijałby połać o 0,148 → warunek floors > floor + 1).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] 11 domów z wykuszem (s0 13.9; s1 −9.0/7.7; s2 −9.0/14.3; s3 −9.9/7.4; 4 zamykające ulice) — geo_test „okien/ram wykuszy B1b 132" (11 × 12); środki w świecie z `$SP/oriel/pos.mjs`: (12.36, −21.65), (21.65, −6.59), (21.65, 6.95), (10.5, 21.65), (−15.14, 21.65), (−22, 8.47), (−22, −8.71), (−2.31, −37.65), (37.65, 0.09), (1.02, 37.65), (−37.65, −0.91), y środka 4,55–4,72.
2. [x] elew2 (side 2, 2048×1024, OBEJRZANA PIERWSZA): 3 wykusze na wysokości piętra 1 (px x ≈ 650 = dom s2 −9.0 x 10,5; 960 = dom zamykający ulicę S x 1,0 przez przerwę ulicy; 1500 = s2 14.3 x −15,1) — bryła ~2,2 m z oknem świecącym/ciemnym, słupki narożne, daszek stożkowy między piętrem 1 a 2. elew1 (side 1): 3 wykusze (px 780 = s1 −9.0, 1010 = dom zamykający ulicę E, 1235 = s1 7.7), daszki widoczne jako małe ciemne kapturki.
3. [x] wykusz_L / wykusz_P (dom s2 −9.0, kamera 6 m, ±45°): sześcioboczna bryła z 2 widocznymi ścianami z oknami (świecące/ciemne, ramy), słupki narożne, belki podwaliny/oczepu, płaski spód sześciokąta, 2 kroksztyny (ciemne trójkąty prostokątne przy murze parteru pod tylną częścią spodu), daszek widoczny jako ciemnoczerwony pas pod jetty piętra 2 (z dołu widać tylko przedni skraj stożka).
4. [x] wykusz_szeroki (z (4, 8)): cały dom 4-kondygnacyjny z wykuszem na piętrze 1, stożkowy kapturek między piętrami czytelny jako mały daszek, kroksztyny pod spodem; latarnia częściowo zasłania (kadr).
5. [x] ulica_S (0, 14, yaw π): wykusz domu zamykającego ulicę S w osi ulicy (3 okna, daszek, 2 kroksztyny) — punkt skupienia perspektywy ulicy.
6. [x] start_plac (kontrolny): jedyna zmiana = mały wykusz domu zamykającego ulicę N (x −2,3, z −37,65) w dali na prawo od wieży (maska diff = tylko ta bryła, 0,31 %); plac/kramy/fontanna/wieża bez zmian. top: 0,06 % — wykusze schowane pod okapem (wysięg 0,95 m < okap piętra 2 + dachu 1,25 m przy 2 jetty) — nic nowego na placu ani w ulicach.
7. [x] Budżet: 0 draw; +3 280 tri HUD w każdym widoku (lista ≈ +3,6 k realnych; cień liczy całość).

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1; perspektywa QUALITY=high DPR=2 412×915; ortho DPR 1, elewacje 2048×1024 size 30, top 1024×1024 size 60; każdy obejrzany):
- oriel_on_elew/elew2.png (PIERWSZA), elew1.png: p.2.
- oriel_on/wykusz_L.png, wykusz_P.png, wykusz_szeroki.png vs oriel_off/* (?nooriel=1); diff_wykusz_L.png (maska = wykusz + kroksztyny, obejrzana): p.3–4.
- oriel_on_sp/ulica_S.png, start_plac.png vs oriel_off_sp/*; diff_start_plac.png (maska obejrzana): p.5–6.
- oriel_on_top/top.png + diff_top.png vs hip_on_top/top.png (stan przed cechą): p.6.
- oriel_on_noinst/wykusz_L.png (obejrzany — identyczny z trybem instancji), start_plac.png (?noinst=1): errors [].

BUDŻET (HUD, tryb instancji; przed = ?nooriel=1, po = z cechą):
- start_plac: calls 87 → 87, triangles 352 118 → 355 398 (+3 280; cel ≤ 600 k spełniony, zapas 245 k); wykusz_L 68 → 68 / 298 481 → 301 761; wykusz_P 61 → 61 / 256 289 → 259 569; wykusz_szeroki 75 → 75 / 342 615 → 345 895; ulica_S 70 → 70 / 307 729 → 311 009; top 112 → 112 / 400 407 → 403 687; elew2 74 / 319 873, elew1 66 / 310 787 (tylko ON). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 110 / 234 142 (po #12c: 110 / 230 862), wykusz_L 84 / 196 205; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 29 136 (było 28 000), wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d (bez zmian W.mat; klucze plaster/roof/timber/glass domu).

ASERCJE: geo_test.sh exit 0 z korzenia worktree (okien/ram 1721, okien/ram wykuszy B1b 132, połaci 82, podparć B5 2894, lukarn B5b 10, domów 28, kramów 7, wieża walec 16, B6 84, znanych wad 2 = KNOWN_B6 dyszel, CHECK nieudanych 0; 7 uwag C o kołach kramów); rot_token.mjs buildings.js exit 0; results.errors [] w 8 renderach (elew ×2, on ×3, off ×3, sp on/off, top, noinst); grep §3.1 Math.sin/cos w buildings.js = 0 (apotema macierzą); grep K3 = 0; §2.4 = 0. Nowe check(): '… wykusz okno k' (checkInFrontOfWall d 0,010 ≥ 0,005 wzdłuż normalnej ściany k, 33 ×), '… wykusz przód' (środek okna przedniego ≥ apotema 0,953 przed licem piętra: 0,963, 11 ×), '… wykusz kroksztyn i' (zewnętrzny górny róg ≥ 0,345 przed ścianą niżej, 22 ×), '… kroksztyn i nie styka się z podwaliną' (wierzch na y ± 0,005 i nakładanie w rzucie ≥ 0,05: 0,07 z jetty / 0,09 bez, 22 ×), '… daszek przebija lico piętra wyżej' (apex ≤ lico + 0,005: −0,35 z jetty / 0 bez, 11 ×), '… daszek bez okapu' (apotema podstawy 1,126 ≥ 0,953 + 0,1, 11 ×) — wszystkie PASS; test B1b (kalibracja wyżej).

DIFF (img_diff, próg 20): wykusz_L 10,58 %, wykusz_P 12,33 %, wykusz_szeroki 2,16 %, ulica_S 1,63 % (cecha ≥ 0,5 %); start_plac on/off 0,31 % (tylko wykusz domu w ulicy N, oczekiwane); top vs stan przed cechą 0,06 % (pod okapem); vs baza repo rynek/start_plac.png: 20,78 %.

ZNANE BRAKI:
- Daszek stożkowy pod jetty piętra 2: z poziomu placu widać tylko jego przedni skraj (pas 0,17–0,6 m), pełny stożek zasłania bryła piętra wyżej — z założenia (wierzchołek w bryle piętra); w elewacji i z dystansu czyta się jako kapturek.
- Spód wykusza to płaski sześciokąt wspornikowany 0,95 m przy 2 kroksztynach 0,35 m przy ścianie niżej (u domów z jetty kroksztyny są pod strefą jetty, nie pod przednią częścią spodu) — bez „konsoli" (odwrócony stożek), do wykończeń.
- Z góry (top) wykusze niewidoczne (pod okapem) — nie jest to błąd geometrii, tylko brak sygnału w tym widoku.
- Dom zamykający ulicę: `cxMax` 2,5 daje wykusz w pasie ±2,5 m od osi ulicy, ale nie zawsze dokładnie w osi (N: −2,3; E: 0,1; S: 1,0; W: −0,9).
- Kadr wykusz_szeroki: latarnia w pierwszym planie częściowo zasłania kroksztyny (cecha widoczna w wykusz_L/P).
- Cykle: 1/3.
