# Etap 2 — moduł „buildings": poprawki po krytyce r1 (K8/K9 kominy, zastrzały × okna, mur schodków, ślepe ściany boczne) — raport

Problemy z `problemy_r1.json` (moduł buildings): 4 „ważne". Wszystkie potwierdzone na PNG rundy (`audyt/testy/out/render/etap2_r1/…`) i liczbami na bundlu geo, naprawione w JEDNYM cyklu, zweryfikowane na 16 renderach.

ZMIANY:
- rynek/src/buildings.js:
  1. zastrzały: `braced[i] = draw && i % 2 === 1` (zastrzał TYLKO w polu nieparzystym; parzyste = okna — §5.2 „przęsła co 1,6 m: parzyste okno, nieparzyste X"), okno w każdym polu bez zastrzału (parzyste zawsze, nieparzyste z udziałem `windowShare`); sekwencja `r()` domu identyczna z HEAD (te same wywołania: losowanie zastrzału, znak, okno, świecenie) → tynki/drzwi/lukarny/kramy bez przetasowań;
  2. komin NA KALENICY (`?nochimridge=1` = HEAD): `chx` wzdłuż kalenicy `endGap` od jej końców (naczółek: kalenica krótsza o `hipIn`; szczyt: od tyłu do lica), `chimTop = ridge.topY + above`; `check(chimTop − roofTopAt(chx, chz) ≥ minAbove)` z `roofTopAt` TEJ SAMEJ połaci (odbicie względem `z = jet/2`; szczyt `roofTopG(x)`); `W.chimneys = [{x, y, z, side, along, setback}]`;
  3. `stepGable()`: mur `w + 2·side` (side 0,04; HEAD `w + 2·ov` = 0,55 m poza ścianą boczną w powietrzu), schodek i od `roofTopG(hwAt(i))` (0: od stropu) do `roofTopG(hwAt(i+1)) + parapet`; płyta połaci dla schodków kończy się `out` m WEWNĄTRZ muru (`xEnd = w/2 + side − out`, długość `slope·xEnd/hw0`, środek = środek odcinka kalenica→koniec), bez okapu bocznego; `check(hwS ≤ w/2 + 0,05)`, `check(bottom ≤ roofTopG(hw))`;
  4. ściany boczne (`?nosidewall=1`): `sideWall(sx, f, …)` na piętrach (podwalina, oczep, słupki co 1,6 m, zastrzały w polach nieparzystych z obrotem `rx` — rot: policzone (0,1,0) → (0, 0.857, 0.514) — okna w parzystych z `ry = sx·π/2` + `checkInFrontOfWall` wzdłuż `facadeNormal(tr.ry + sx·π/2)`), `sideWallGround` (okno parteru 0,9 × 1,1 na z = 0), `sideWallAttic` (dom ∥ x: słup królewski + 2 okna poddasza 0,6 × 0,7 po obu stronach kalenicy, `check` krawędzi szczytu); strumień `rng(seedLocal + 8)`.
- rynek/src/layout.js: `markOpenSides(houses)` → `h.open = [−x, +x]` (krawędź bez sąsiada w pierzei, `|krawędź| < half`, nie dom zamykający); `check(n === 8)` (2 na pierzeję: krawędź ulicy; N-W: krawędź przy luce wieży −10,5).
- rynek/src/props.js: `smokerChimneys(W)` (funkcja czysta): kominy z wierzchem w kadrze startu (kamera `CONFIG.composition.start`, fov/oko z `bunting.clockClear`, aspect 412/915, `|NDC| ≤ 1 − margin`), najbliższe `max`; `check(≥ 2)`. HEAD `i % 4 === 1` nie trafiał w kadr.
- rynek/src/config.js: `houseDetail.timber { braceShare 0.5, windowShare 0.75 }`, `houseDetail.chimney { w 0.9, above 0.9, endGap 1.0, minAbove 0.6 }`, `houseDetail.sideWall { field 1.6, braceShare 0.5, windowShare 0.8, litShare 0.35, win, groundWin, atticWin, atticZ 1.2, atticY 1.0 }`, `houseDetail.step.side 0.04`, `props.smoke { max 6, margin 0.05 }`.
- audyt/testy/test_geometria.mjs: rejestrator zapisuje trójkąty `roof*` (`pos`); `roofSurfaceY(L, x, z)` (pion × trójkąty); nowe asercje: B7 (komin − dach ≥ 0,6, 1 komin/dom), B8 (AABB zastrzału ∩ AABB okna = ∅), B5c (mur schodków `|x| ≤ w/2 + 0,05`, schodek nie wisi nad połacią), B1c (okna ścian bocznych na licu `±w/2 + 0,01`), M (dym: 2..max kominów, każdy w kadrze); B5b(ii) tylko dla okien bez obrotu (okna poddasza ścian bocznych → B1c). geo/entry.mjs eksportuje `smokerChimneys`.
- rynek/app.js: bundle.
- Flagi: `?nosidewall=1`, `?nochimridge=1` (`grep -n "flags\.no" rynek/src/buildings.js`).

KALIBRACJA ASERCJI (`$SP/r1b/kalib.mjs`, bundle HEAD ze stash vs roboczy): HEAD → B7 FAIL 28/28 (krytyk: 26/28 przy progu 0 — tu próg 0,6), B8 przecięć 137 (189 zastrzałów × 368 okien; krytyk: 148/316 okien), B5c FAIL 3/3 (mur ±4,75 vs ściana ±4,20 itd.); roboczy → 0 / 0 / 0; roboczy z `?nochimridge=1` → B7 28/28 (flaga przywraca HEAD).

WIDOKI (każdy obejrzany):
- bld_r1_a/ulica_brama.png — obie ściany boczne z belkami, słupkami, oknami (lewa 5 okien + okno parteru, prawa 4 + okno parteru); sonda 40,400,100,300 → #4e5b67 L 0,465 (HEAD #566e82 jednolity) — żadna jednolita plama > 100 × 400 px; brama i dom zamykający bez zmian.
- bld_r1_a/woz_krytyk.png (kamera krytyka −5, 12.5, yaw 0.9) — szałwiowy szczyt ma siatkę belek, 2 rzędy okien, w szczycie słup królewski + 2 okna poddasza (1 świecące), komin na kalenicy w prawym górnym rogu.
- bld_r1_a/karczma_szyld.png — zastrzał w polu bez okna, świecące okno bez belki przez szkło.
- bld_r1_b/pierzeja_wschodnia.png — kominy na kalenicach (2 widoczne), zastrzały obok okien.
- bld_r1_b/caption_tower_cam.png (kadr podpisu „Wieża ratuszowa") — ściana +x domu przy luce wieży: belki, okna, zastrzały (HEAD: 45 % kadru jednolity tynk).
- bld_r1_elew/elew_side0..3.png — kominy na KAŻDEJ kalenicy (8/4/6/6 widocznych; HEAD side1/2/3: 0), żaden zastrzał nie przecina okna.
- bld_r1_c/schodki_19.png — mur schodkowy domu s3 along −19.9 w licu ścian bocznych (HEAD: 0,55 m w powietrzu), płyta połaci schowana w murze.
- bld_r1_b/start_plac.png, bld_r1_c/start_v2.png — kominy na dachach pierzei N; bld_r1_dym/start_v2_dym.png — 3 smugi dymu w kadrze (kominy s0 along 6.1 / −13.8 / 0.0).
- bld_r1_off/{ulica_brama,wieza}.png — z `nosidewall=1&nochimridge=1` = HEAD (img_diff vs on: 9,5 % / 0,8 %).

BUDŻET (HUD, tryb instancji): start_plac 115/579 662 → 114/599 991 (cel ≤ 600 000: margines 9 tri — ściany boczne ≈ 6,5 k real, +61 okien pięter ≈ 3 k real); pierzeja_wschodnia 92/514 814 → 90/511 529; ulica_brama 86/437 802 → 83/425 629; woz (kamera krytyka) 97/539 461; karczma_szyld 84/413 002 → 82/425 609; wieza 97/536 766 → 94/524 593; elewacje 80–85 / 445–501 k. noinst start_plac 150 / 350 933, errors []. top-3 start_plac: shrub_04_c 55 512, flower_gazania_h 38 940, timber 32 312.

KOLOR: n/d (bez zmian W.mat).

ASERCJE: geo_test.sh exit 0 (B7 28 kominów, B8 106 × 429 przecięć 0, B5c 3, B1c 71 okien, M 3/28 w kadrze; 7 „uwaga" C kramów jak dotąd; KNOWN_* 0); rot_token.mjs exit 0 (buildings/layout/props); §2.4 grep → 0; results.errors [] × 16 widoków (5 uruchomień).

DIFF: start_plac vs ground_r1_on2 (baza po commicie layout r1) pctOver 0,8 % (fasady: zastrzały/okna, kominy, ptaki); ulica_brama vs etap2_r1 10,9 %; elew_side1 vs etap2_r1_diag 17,4 % (kominy + okna + zastrzały).

ZNANE BRAKI: start_plac 599 991 HUD = 9 tri pod celem 600 k (twardy limit 700 k); beczka/latarnia przy ścianie bocznej (propozycja krytyka) pominięte — latarnie to props (limit 4 świateł), beczka wymagałaby put() w buildings; ściany boczne domów zamykających ulice bez belek (niewidoczne z ulicy: za domami narożnymi); trójkątne szczyty (bez schodków) nadal bez okien poddasza od placu. Cykl 1/3.
