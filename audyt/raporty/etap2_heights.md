# Etap 2 — motyw #3 „różne wysokości i spadki" (?noheights=1) — raport (cykl 1/3)

ZMIANY:
- rynek/src/config.js: `CONFIG.house.vary = { floorsMax: 4, floorHeight: [2.7, 3.1], roofPitch: [0.7, 1.0], minDistinctFloors: 3 }` (zakresy §5.2 #3; stare `floorsMax 3`, `floorHeight 2.9`, `roofPitch 0.85` zostają jako stan dla `?noheights=1`). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/layout.js: `varyHouse(h, prev)` — liczba pięter `R.int(floorsMin, vary.floorsMax)` z ziarna GŁÓWNEGO (ta sama liczba wywołań R co na HEAD → tynki, dachy, kramy, rekwizyty bez przetasowania — sprawdzone: replika sekwencji R w prototypie = W.houses z HEAD 1:1); `h.floorHeight` i `h.pitch` z osobnego strumienia `rng(seedLocal + 1)` (buildings.js zaczyna od `rng(seedLocal)`); reguła „nie dwa takie same obok": `prev.floors === h.floors → ±1` (−1 przy maksimum albo losowo 50 %, gdy nie minimum; inaczej +1); domy zamykające ulice: 3 piętra stałe, wysokość kondygnacji i spadek per dom. `checkHeights`: 'sąsiednie domy z tą samą liczbą pięter' (pary o stykających się krawędziach, |Δ| < 0,01 m; same === 0), 'za mało różnych liczb pięter w pierzejach' (≥ 3), 'dom poza zakresami motywu #3' (per dom). Import `rng`.
- rynek/src/buildings.js: `fh = h.floorHeight`, `pitch = h.pitch` zamiast `H.floorHeight` / `H.roofPitch` (jedyna zmiana, 2 linie).
- rynek/app.js: bundle rynku (komenda §6 p.3, 914 kB).
- Flaga: `?noheights=1` (`grep flags.noheights rynek/src` → layout.js:39) = stan sprzed cechy (2–3 piętra po 2,9 m, spadek 0,85 dla wszystkich).
- Lista „co ma być widać" PRZED kodem: `$SP/heights/lista.md` (9 punktów), liczby z prototypu `$SP/heights/proto.mjs` (replika sekwencji losowań + planowana reguła; K13: asercja sąsiadów uruchomiona na tych liczbach PRZED kodem — 16 par, 0 z tą samą liczbą pięter; OFF dałoby 7). Po kodzie zweryfikowane na bundlu geo (AABB połaci): kalenice 10,50–18,62 m, piętra 2/3/4 = 3/11/10 — zgodne z prototypem (10,45–18,57 + grubość płyty/belki kalenicy).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] Piętra 2–4: 24 domy pierzei = 3/11/10 (OFF 9/15/0) — w elew0/elew1 ON domy 4-piętrowe (parter kamienny + 3 kondygnacje szachulcowe) przy obu ulicach; pierzeja_wschodnia ON: dom [−14.92..−3] side 1 ma 4 kondygnacje (OFF: 3).
2. [x] Sąsiedzi różni: 16 par, 0 z tą samą liczbą pięter (asercja PASS; geo_test exit 0). Na elewacjach żadne dwa sąsiednie domy nie mają wspólnej linii okapu ani kalenicy (OFF elew1: jedna linia okapu 9,0 m na całej długości i kalenice 13,55/13,95 — „monotonna linia kalenic" z §1).
3. [x] floorHeight 2,71–3,07, pitch 0,70–0,99 (asercja zakresów PASS) — na elew0 połacie mają widocznie różne kąty (dom [18.49..30] p 0,71 płaski, [3..9.26] p 0,82, szczyt [−23.96..−17.12] p 0,86 vs [−17.12..−10.5] p 0,76).
4. [x] Kalenice 10,45–18,57 m (OFF 9,87–13,95): elew1 ON najwyższy dom [3..12.36] (4 piętra, p 0,95) — kalenica na px y ≈ 318 z 1024 = 28 − 318/34,13 = 18,7 m (lista: 18,57 → px 322) ✓; elew0: szczyty px ~495/418 (13,3 / 15,6 m; lista 503/425) ✓, dachy prawej połowy px ~400/490/438 (16,1 / 13,4 / 14,9 m; lista 409/502/447) ✓.
5. [x] Elewacja side 0 (2048×1024, size 30, 34,13 px/m): linia schodkowa 12,5 → 13,3 → 15,6 | wieża | 16,1 → 13,4 → 14,9; OFF: 10,9 → 12,9 → 9,9 | 13,55 → 13,95 → 13,55 (prawa połowa jedna linia okapu).
6. [x] Elewacja side 1: 10,9 (zasłonięty szczytem bocznym pierzei N) → 13,0 → 15,6 | 18,6 → 14,4 → 16,5; OFF: całkowicie płaska (okap 9,0 m wszędzie).
7. [x] pierzeja_wschodnia: 4 kondygnacje z wykuszem 1,05 m (jetty 3 × 0,35) na pierwszym planie za kramem, niżej 3-piętrowy dom po prawej. Widok słabo dobrany (kram winiarza zasłania dół pierzei) — cecha widoczna, kadr do poprawy przy okazji #7.
8. [x] start_plac (kontrolny): maska diff = domy tła (szczyt N-W po lewej 2→4 piętra, domy N-E po prawej 3→4 i 3 piętra) ORAZ cienie na placu: pas przed fontanną i baldachim kramu po lewej przechodzą w cień (dom side 2 [−15..−3] 4 piętra, kalenica 16,6 m → cień 28,7 m przy elewacji słońca 30° zamiast 24 m). Plac, bruk, fontanna, kramy, wieża, niebo: bez zmian (czarne w masce). Wieża nadal dominuje: apex przy górnej krawędzi, kalenice ≤ 0,52 wysokości wieży (18,6/36).
9. [x] top: obrysy domów (along/w) bez zmian, kramy w pierścieniu, ulice puste; różnice = cieniowanie połaci (inne kąty), przesunięte cienie i cienkie linie okapów wykuszy (+0,35 m dla domów 4-piętrowych z jetty, ≥ 3,2 m nad ziemią).
10. [x] Budżet: 0 nowych kluczy W.B, calls bez zmian, start_plac +12 432 tri HUD (lista: ≤ +10 k — przekroczone o 2,4 k: 10 domów po 4 piętra zamiast prognozowanych „~30 boxów na piętro" — więcej okien/ram/belek stropowych; timber 22 576 → 27 796).

WIDOKI (audyt/testy/out/render/, wszystkie z noui=1&nosmoke=1&nosway=1&nowater=1; perspektywa QUALITY=high DPR=2 412×915; ortho DPR 1 — elewacje 2048×1024 size 30 (60 m szer. × 30 m wys., y −2..28), top 1024×1024 size 60; każdy obejrzany):
- heights_on_elew/elew0.png, elew1.png (OBEJRZANE PIERWSZE) vs heights_off_elew/*: opis w p.5–6; brak połaci V (B2 66 połaci PASS).
- heights_on/pierzeja_wschodnia.png vs heights_off/: 4 vs 3 kondygnacje tego samego domu.
- heights_on/naroznik_NE.png (−10, 10, yaw −0.9, pitch 0.2): dom side 1 [−14.92..−3] 4-piętrowy w prawej połowie kadru, baldachim kramu na pierwszym planie; OFF: 3 piętra.
- heights_on/start_plac.png (kontrolny) + heights_on/diff_start_plac.png (maska obejrzana): p.8.
- heights_on_top/top.png + diff_top.png (maska obejrzana): p.9.
- heights_on_noinst/start_plac.png, pierzeja_wschodnia.png (?noinst=1): img_diff inst vs noinst start_plac pctOver 0,24 % (szum) — obraz identyczny.

BUDŻET (HUD, tryb instancji; przed = ?noheights=1 z tego cyklu, po = z cechą):
- start_plac: calls 87 → 87, triangles 337 774 → 350 206 (+12 432 HUD ≈ +6,1 k realnych; cel etapu ≤ 600 k: spełniony, zapas 250 k); shadow 40 / 144 652.
- pierzeja_wschodnia 80 → 80 / 314 491 → 326 923; naroznik_NE 97 → 97 / 363 635 → 376 067; top 112 → 112 / 386 063 → 398 495; elew0 65 → 65 / 232 465 → 244 897; elew1 66 → 66 / 293 163 → 305 595. Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 110 / 228 950 (przed motywem, z raportu #2: 110 / 216 518), pierzeja_wschodnia 93 / 193 811; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 27 796 (było 22 576), wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d (bez zmian W.mat; lineup n/d; hist_roles n/d). Uwaga poboczna: elew1 (pierzeja E w cieniu) — bez zmian koloru, tylko geometria.

ASERCJE: geo_test.sh exit 0 z korzenia worktree (sprawdzono: okien/ram 1837, połaci 66, domów 28, kramów 7, wieża walec okien/tarcz 16, CHECK nieudanych 0; 7 znanych „uwaga" o kołach kramów; KNOWN_B6 n/d — B6 jeszcze nie ma, właściciel #12); rot_token.mjs ($SP/krytyk2) layout.js exit 0; buildings.js exit 1 = 4 trafienia długu HEAD (42/77/85/93 — nie moje linie, jedyna dozwolona zmiana w buildings.js to odczyt h.floorHeight/h.pitch; §3.3 „spłacasz w module, który zmieniasz" świadomie NIE wykonane — linie 85/93 przepisuje #12); results.errors: [] w 8 renderach (on ×3, off ×3, elew on/off, top on/off, noinst); grep §3.1 Math.sin/cos w layout.js = 0; grep K3 w layout.js = 0; §2.4 = 0. Nowe check(): 'sąsiednie domy z tą samą liczbą pięter' (same === 0 z 16 par), 'za mało różnych liczb pięter w pierzejach' (≥ 3; jest 3), 'dom poza zakresami motywu #3' (×28).

DIFF (img_diff, próg 20): pierzeja_wschodnia 24,01 %, naroznik_NE 6,12 %, elew0 14,09 %, elew1 17,23 %, top 13,38 % (cecha ≥ 0,5 % wszędzie); start_plac on/off 8,71 % — maska obejrzana: domy tła + cienie na placu (p.8), reszta czarna; vs baza gałęzi po #2 (tower2_on_sp): 8,72 % (to samo co on/off — OFF = piksel w piksel stan po #2); vs baza repo (rynek/start_plac.png): 20,52 % (wieża + cięcia + wysokości + brak winiety).

ZNANE BRAKI:
- Dłuższe cienie na placu w kadrze startowym (baldachim kramu po lewej i pas bruku przed fontanną w cieniu) — fizyczna konsekwencja wyższej pierzei S/E przy słońcu 30°; jeśli kompozycja #7 chce jasnego pierwszego planu, kandydaci: `floorsMax 3` dla side 2 albo azymut słońca — decyzja #7/#9, nie tu.
- Kominy (`buildings.js:99`, wierzch y + 2,2 na z −1,5) są ZAKOPANE w połaci dla dachów ∥ x — także na HEAD (OFF elew0/elew1: brak kominów), przy pitch 1,0 jeszcze głębiej (roofY(−1,5) ≈ y + 4,2); dym (`W.chimneys`) wychodzi z połaci. Nie moja linia (poza zakresem motywu) — do wykończeń po #12.
- Okna lukarn (§5.2 #12) przy stromszych spadkach zapadają się głębiej w połać (przy p 1,0 całe okno pod wierzchem płyty; przy p 0,7 spód 0,12 m pod) — naprawia #12 (lukarny NA połaci z `roofTopY`), następny w łańcuchu.
- Rozkład pięter z ziarna 7: tylko 3 domy 2-piętrowe (3/11/10) — reguła ±1 przy minimum zawsze daje +1; sylwetka może być za „ciężka" (10 domów 4-piętrowych, okap 11,4–12,4 m). Zmiana wag to jedna liczba w CONFIG (np. `floorsMax 4` tylko dla `w > 7`) — zostawione świadomie, do oceny krytyka na PNG.
- Widoki własne słabo dobrane (kram winiarza w pierzeja_wschodnia, baldachim w naroznik_NE) — cecha widoczna, ale najlepiej czytają ją elewacje ortho; przy #7 wybrać kadry bez kramów w pierwszym planie.
- Domy 4-piętrowe z jetty wysuwają okap 1,05 + 0,55 = 1,6 m przed lico parteru (top: cienkie linie okapów) — nad placem na wysokości ≥ 3,2 m, bez kolizji.
- rot_token.mjs wciąż w $SP/krytyk2 (kopię do tools/ robi #12); HUD (#hud) widoczny mimo noui=1 (§8 #2, #15).
- Cykle: 1/3.
