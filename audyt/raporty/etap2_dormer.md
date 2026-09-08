# Etap 2 — motyw #12a „lukarny osadzone NA połaci" (?nodormer=1) — raport (cykl 1/3)

Poprzedzający, OSOBNY commit infrastruktury (§8 #3, #11): `a794312` — checkAboveSurface, B2 oś z macierzy, B5, B5b, B6 + KNOWN_B6/KNOWN_B5B, rot_token.mjs w tools/, README testów.

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.dormer = { w: 1.4, wallT: 0.12, cheekT: 0.12, fromEave: 1.6, sink: 0.15, hFront: 1.5, win: [0.6, 0.7], winUp: 0.1, capRatio: 0.3, depth: [1.6, 2.4], capOver: 0.2, capT: 0.1, capGap: 0.07 }` (metry; komentarz roli przy każdej grupie). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/buildings.js: gałąź „kalenica ∥ x" dostaje powierzchnię połaci z §5.2 #12 — `s = rise/(topD/2+ov)`, `eaveZ`, `roofY(z)`, `roofTopY(z) = roofY + roofT/2·slope/(topD/2+ov)` (= +0,100 przy pitch 0,85; sprawdzone z macierzy płyty: 11,121 / 9,908 / 13,344 dla z 3,2 / 4,4 / 1,0); `dormer(dx)`: ściana czołowa `box(1.4, 1.65, 0.12)` ze spodem `roofTopY(zF) − 0,15` i wierzchem `roofTopY(zF) + 1,5` (zF = eaveZ − 1,6), okno 0,6 × 0,7 ze spodem `roofTopY(zF) + 0,10` + parapet/nadproże timber, daszek pulpitowy `box(1.7, 0.1, capLen)` z `rx = +capPitch` (rot: policzone) od zF + 0,2 do zBack − 0,1, gdzie zBack = zF − depth, depth = (1,5 + 0,07)/(s − tan(0,3·pitch)) obcięte do [1,6; 2,4]; 2 policzki `box(0.12, 1.8, cheekLen)` w układzie daszka (`M4(...).premultiply(capM)`), spód schowany w strychu. Te same 2 wywołania `r()` co na HEAD (decyzja 50 % + dx) → komin i reszta losowań bez zmian. Stary blok zostaje pod `ctx.flags.nodormer`. Spłata długu `rot:` w module: linie zastrzału (rz = ±atan2(fw/n, fh) → góra ku ∓x, policzone rz=+0.5 → (−0.479, 0.878, 0)) i połaci szczytowej (rz = −sx·a → okap (4.55, y, jet/2), kalenica (0, y+4.55, jet/2)); `Math.cos` zastąpione tożsamościami (`slope/(topD/2+ov)`, `hypot(1, tc)`) — grep §3.1 = 0 linii.
- audyt/testy/test_geometria.mjs: `KNOWN_B5B` opróżnione (10 lukarn HEAD naprawionych) — lista skurczyła się z 10 do 0.
- rynek/app.js: bundle rynku (komenda §6 p.3).
- Flaga: `?nodormer=1` (`grep flags.nodormer rynek/src` → buildings.js:95) = pudełko HEAD (okno 0,26–0,74 m pod wierzchem płyty).
- Lista „co ma być widać" PRZED kodem: `$SP/dormer/lista.md` (8 punktów), liczby z `$SP/dormer/proto.mjs` (prawdziwy układ seed 7) i `$SP/dormer/k13.mjs` (każda liczba z §5.2 #12 przeliczona: rise 4,952, okap (0, 9, 5.25), kalenica (0, 13.952, 0.35), roofY(3.2) 11,07, roofY(4.4) 9,86, +0,0995, kąt 0,791, hipRise 0,626, hipLen 0,833, końce naczółka (4.55, 13.326, 0.35)/(4, 13.952, 0.35); asercje checkAboveSurface i „wisi" uruchomione na tych liczbach PRZED kodem: PASS; B5b(ii) na HEAD: FAIL oczekiwany).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] 10 lukarn na tych samych domach co HEAD (s0 −27/6.1/13.9, s1 7.7/15.4/24.2, s2 −26.6/−9.0, s3 7.4/15.2): geo_test „lukarn B5b 10", 0 FAIL; elew0 pokazuje 2 (along 6.1 i 13.9), prof_N (kamera z (−10, −26) na side 1 — de facto elewacja pierzei E w cieniu) 3 (s1 7.7/15.4/24.2), elew3 2 (s3 7.4/15.2).
2. [x] Ściana czołowa STOI w połaci: lukarna_N (9.5, −6, yaw 0, pitch 0.58): obie lukarny pierzei N — spód ściany schowany w dachówce, ściana wychodzi z połaci bez szpary; z bundla geo dla s0 along 13.9: spód-lico (−2.67, 10.40, 3.65) vs wierzch płyty 10,55 (−0,15 ✓), wierzch ściany 12,05.
3. [x] Okno NAD dachówką: lukarna_N i lukarna_N2 — pełne okno z parapetem widoczne nad połacią (HEAD OFF: tylko górna połowa okna wystaje z dachówki); asercja checkAboveSurface ≥ +0,05: 10 × PASS (spód okna +0,10); B5b(ii) w teście 10/10 PASS, KNOWN_B5B pusta.
4. [x] Daszek pulpitowy z wysięgiem 0,2 m, tył wyżej niż przód: z macierzy daszka s0 along 13.9: przód (−2.67, 12.08, 3.85), tył (−2.67, 12.64, 1.15), capPitch 0,204, capLen 2,76; asercja „daszek odwrócony" (Δ > 0,2) 10 × PASS; B2 66 połaci (56 + 10 daszków) PASS. Na lukarna_N2 daszek nachylony łagodniej niż połać, cień daszka na ścianie czołowej.
5. [x] Policzki: lukarna_N2 (z ukosa) pokazuje ścianę boczną lukarny między daszkiem a połacią, bez dziury; spód policzka przy licu 10,30 < wierzch płyty tam 10,89 (schowany; z bundla geo).
6. [x] Elewacja side 0 (2048×1024, size 30): lukarny along 6.1 (okno px y ≈ 449–500, lista 472–496) i 13.9 (px ≈ 551–597, lista 568–592) jako prostokąty z oknem i daszkiem PONAD połacią; brak połaci V. Elewacja side 3: lukarny s3 7.4 i 15.2 z cieniem daszka na ścianie.
7. [x] start_plac (kontrolny): maska diff = tylko lukarna domu along 6.1 (prawy górny róg kadru) i skrawek lukarny along 13.9 przy prawej krawędzi; plac/kramy/wieża/fontanna czarne. top: obrysy bez zmian, lukarny jako małe prostokąty na połaciach od strony placu (pierzeje N i E dobrze widoczne), pctOver 0,88 %.
8. [x] Budżet: 0 nowych kluczy W.B, calls bez zmian, start_plac +960 tri HUD (lista: ≈ +1 k) — timber 27 796 → 28 036 (ramki okien), plaster/roof/glass reszta.

WIDOKI (audyt/testy/out/render/, wszystkie z noui=1&nosmoke=1&nosway=1&nowater=1; perspektywa QUALITY=high DPR=2 412×915; ortho DPR 1, elewacje 2048×1024 size 30, top 1024×1024 size 60; każdy obejrzany):
- dormer_on_elew/elew0.png (OBEJRZANA PIERWSZA), elew3.png, prof_N.png: p.1, p.6.
- dormer_on/lukarna_N.png, lukarna_N2.png vs dormer_off/*: p.2–5; diff_lukarna_N.png (maska obejrzana: dwie lukarny, nic więcej).
- dormer_on/start_plac.png + diff_start_plac.png (maska obejrzana): p.7.
- dormer_on_top/top.png + diff_top.png: p.7.
- dormer_on_noinst/lukarna_N.png, start_plac.png (?noinst=1): errors [].

BUDŻET (HUD, tryb instancji; przed = ?nodormer=1 z tego cyklu, po = z cechą):
- start_plac: calls 87 → 87, triangles 350 206 → 351 166 (+960; cel etapu ≤ 600 k: spełniony); lukarna_N 70 → 70 / 312 907 → 313 867; lukarna_N2 62 → 62 / 232 459 → 233 419; top 112 → 112 / 398 495 → 399 455; elew0 65 / 245 857, elew3 69 / 290 815, prof_N 68 / 306 611 (tylko ON). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 110 / 229 910 (po #3: 110 / 228 950), lukarna_N 77 / 170 355; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 28 036 (było 27 796), wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d (bez zmian W.mat; lineup n/d; hist_roles n/d).

ASERCJE: geo_test.sh exit 0 z korzenia worktree (okien/ram 1837, połaci 66, podparć B5 2732, lukarn B5b 10, domów 28, kramów 7, wieża walec okien/tarcz 16, B6 84 elementy, znanych wad 2 = KNOWN_B6 dyszel ×2, KNOWN_B5B pusta, CHECK nieudanych 0; 7 uwag C o kołach kramów); rot_token.mjs buildings.js exit 0 (dług HEAD 42/77/85/93 spłacony); check_test.mjs 8/8; results.errors: [] w 7 renderach (elew on, on ×3, off ×3, top on/off, noinst); grep §3.1 Math.sin/cos w buildings.js = 0; grep K3 = 0; §2.4 = 0. Nowe check(): '… lukarna wisi nad połacią' (spód ściany ≤ roofTopY − 0,05), checkAboveSurface('… lukarna okno', +0,05), '… lukarna sięga kalenicy' (zBack > jet/2 + 0,3), '… lukarna daszek odwrócony' (tył − przód > 0,2, z tej samej macierzy) — 4 × 10 PASS.

DIFF (img_diff, próg 20): lukarna_N 1,75 %, lukarna_N2 2,09 %, top 0,88 % (cecha ≥ 0,5 %); start_plac on/off 0,28 % (maska = lukarny w tle, reszta czarna); vs heights_on/start_plac (baza gałęzi po #3): 0,27 %; vs baza repo (rynek/start_plac.png): 20,5 % (wieża + cięcia + wysokości + brak winiety, jak w #3).

ZNANE BRAKI:
- Lukarny tylko na dachach z kalenicą ∥ x (jak HEAD); reguła z §5.2 #12 „na gableFront tylko gdy kalenica sąsiada niższa" NIE wdrożona (wymaga odczytu sąsiada w buildings.js; 0 lukarn na 9 domach szczytowych) — do wykończeń.
- Lukarna zawsze na połaci od placu; dla domów z płytkim spadkiem (pitch 0,74–0,82) daszek dochodzi do 2,4 m głębokości (obcięcie D.depth[1]) — długi, pulpitowy; przy pitch 0,99 (s0 along −27) 1,6 m. Bez lukarn dwuspadowych (2 płyty) — świadomie 1 daszek (klasyfikacja B2 „daszek lukarny").
- Profil lukarny (widok z boku) nie jest osiągalny elewacją ortho (near 16 m clipuje pierzeję, a sąsiedzi nakładają się w rzucie) — „na połaci" potwierdzają liczby z macierzy (spód ściany −0,15, okno +0,10) i zbliżenie z ukosa lukarna_N2.
- Kominy nadal zakopane w połaci (poza zakresem; z #3). Elewacja side 0 ma po lewej blade płaszczyzny szczytów pierzei W (clipping near ortho) — stan jak w #3, nie moja zmiana.
- Cykle: 1/3.

## Cykl 2/3 (2026-09-08) — weryfikacja na HEAD `d0ca35e` (po motywach #6 wykusze, #9 paleta, #10 portale/szyldy, #7 kompozycja/lipy)

Bez zmian kodu: bundle `rynek/app.js` przebudowany komendą §6 p.3 = identyczny z zacommitowanym (`cmp`); `geo_test.sh` exit 0 (połaci 82, lukarn B5b 10, B5 3164, B6 135, KNOWN_B6 2, CHECK 0); `rot_token.mjs buildings.js` exit 0; `check_test.mjs` 8/8. Dowód flagi z bundla geo (buildHouses ze stubem B, liczba trójkątów per klucz): `?nodormer=1` → −40 elementów, timber 27 260 → 27 020, plaster 1 844 → 1 604 (glass bez zmian: HEAD też ma 1 box szkła/lukarnę).

CO WIDAĆ (PNG z tego cyklu, `out/render/m12_*`, wszystkie `noui=1&nosmoke=1&nosway=1&nowater=1`, QUALITY=high DPR=2 412×915):
1. [x] `m12_on/lukarna_N.png` (9.5, −6, yaw 0, pitch 0.58): obie lukarny pierzei N — s0 6.1 (dachówka, okno świat (7.5, 13.8, −23)) i s0 13.9 (łupek, okno (11.3, 11.0, −22.3)) — pełne okno z parapetem i nadprożem NAD dachówką, ściana czołowa wychodzi z połaci bez szpary, daszek pulpitowy z wysięgiem; `m12_off/lukarna_N.png` (`?nodormer=1&nostep=1&nohip=1`): oba pudełka HEAD z oknem w połowie w dachówce. Maska `diff_lukarna_N.png` obejrzana: 2 lukarny + pas cienia daszka na łupku, reszta czarna; pctOver 1,88 %.
2. [x] `m12_on2/hip_E3.png` (−3, −13, yaw −2.22, pitch 0.37): lukarna s1 7.7 (okno (22, 14.8, 5.2)) na dachu najwyższego domu pierzei E, nad połacią; OFF: pudełko zakopane.
3. [x] `m12_on_top/elew1.png` (side 1, 1024², size 30): lukarna s1 7.7 jako prostokąt z oknem i daszkiem ponad połacią; `m12_on_elew/elew2w.png` (2048×1024): lukarna s2 −9.0 na dużym dachu (px ≈ 770–830); `elew3w.png`: lukarny s3 7.4 (px ≈ 1270–1310, łupek) i s3 15.2 (px ≈ 1530–1580). Brak połaci V.
4. [x] `m12_on_top/top.png` (size 60): lukarny jako jasne prostokąty na połaciach od placu (pierzeja E: 3, N: 2, W: 2, S: 2 widoczne), nic nowego na placu/ulicach.
5. [x] `m12_on2/start_plac.png` (4, 19, 0.15, 0.02) kontrolny: lukarna s0 6.1 w prawym górnym rogu (nad lipą); maska `diff_start_plac.png` (ON vs OFF 3 flagi): lukarna + 2 plamy cienia dachów pierzei S na bruku (naczółki), plac/kramy/fontanna/wieża/lipy czarne; pctOver 0,58 %. Ten sam widok vs `compose_on/start_plac.png` (render motywu #7): pctOver 0,01 % — HEAD renderuje się powtarzalnie.

BUDŻET (HUD, tryb instancji; OFF = 3 flagi razem, ON = HEAD; różnica ON−OFF to cały motyw #12): lukarna_N 82 / 334 459 → 82 / 336 371; step_W 87 / 364 149 → 87 / 366 061; hip_E3 102 / 351 628 → 102 / 353 540; start_plac 100 / 373 332 → 100 / 375 244 (+1 912, 0 draw; cel ≤ 600 k spełniony, zapas 225 k); ulica_S 79 / 322 595, top 124 / 423 531, elew1 76 / 329 049, elew2 79 / 318 193, elew3 74 / 293 309, elew2w 84 / 338 141, elew3w 79 / 313 309 (tylko ON). noinst (`?noinst=1`, `m12_on_noinst`): start_plac 122 / 249 544, hip_E3 126 / 243 138, errors []. Wszystko ≤ 250 / ≤ 700 000. top-3 __stats start_plac: timber 1 / 29 168, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776. results.errors [] w 8 uruchomieniach render_scene (m12_on, m12_on2, m12_on3, m12_off, m12_off2, m12_on_top, m12_on_elew, m12_on_noinst).

DIFF: lukarna_N 1,88 % / start_plac 0,58 % (tylko oczekiwane miejsca) / vs baza repo `rynek/start_plac.png` 31,66 % (kompozycja #7: lipy, kramy, nowy start; nie moja zmiana).

ZNANE BRAKI (bez zmian z cyklu 1; cykle 2/3): lukarny tylko na dachach ∥ x; zawsze na połaci od placu; kominy nadal w połaci (poza zakresem).
