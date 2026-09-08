# Etap 2 — motyw #7 „kompozycja startu" (?nocompose=1) — raport (cykl 1/3)

Stan wyjściowy: `5c1e440` (szyldy #10b). Worktree /home/user/wt-a (branch feat/tor-a), PORT 8376. Lipy tego samego motywu = osobna cecha `?notrees=1`, raport `etap2_trees.md` (te same rendery).
Lista „co ma być widać" Z LICZBAMI napisana PRZED kodem: `$SP/m7/lista.md` (liczby z `$SP/m7/geom.mjs`: PerspectiveCamera(70, 412/915), oko (4,5, 1,65, 19,5), YXZ yaw 0,20 pitch 0,09).

ZMIANY:
- rynek/src/config.js: `CONFIG.composition = { start: {x: 4.5, z: 19.5, yaw: 0.20, pitch: 0.09}, stallFreeSector: {yawMin: 0.05, yawMax: 0.40, maxDist: 14}, repoussoir: {ringOut: 1.5, margin: 0.02} }`; `CONFIG.stalls.ringJitter = 1.5, collideR = 1.6` (dawne literały stalls.js). §2.4 (nowe linie z ułamkiem bez komentarza): 0.
- rynek/src/main.js: `player.start` z `CONFIG.composition.start` (pitch przez `state.pitch = player.start.pitch ?? 0` w app.js — JEST); `?nocompose=1` → start HEAD (4, 19, yaw 0,15).
- rynek/src/stalls.js: nagłówek układu lokalnego; `repoussoirPlacement(C, S)` i `stallPlacements(W)` — FUNKCJE CZYSTE (eksport do geo/entry.mjs, asercja I): kram 0 = repoussoir na |p| = ringRadius + ringOut = 13,0 pod yaw = yawMax + asin(collideR/d) + margin od startu (rozwiązanie |start + d·dir| = 13 iterowane 20×; policzone: yaw 0,621, d 8,00, (−0,16, 13,00)), faza pierścienia = jego kąt (−0,012 rad); kramy 1..6 = HEAD obrócone o fazę −0,027 rad (TE SAME 4 losowania R na kram w tej samej kolejności: kąt, promień, obrót, tkanina — sprawdzone wypisem: (9,00, 7,67) → (8,91, 7,78) itd.); `W.stalls[i].repoussoir` (kolejność dla #11: sukiennik = kram 0). `checkComposition`: check „kram w sektorze startu" (całe koło kolizji poza yaw 0,05–0,40 dla d < 14), „repoussoir nie na skraju pierścienia" (± 0,01), „repoussoir nie tuż za sektorem" (0 ≤ luz ≤ 0,05; jest 0,02). Spłata długu: `stalls.js:10` → token `ring:`; `:21` baldachim → `rot: rx=−1.406 → normalna (0, 0.986, 0.164)` (policzone); `:34 stallWorld` → `new THREE.Vector3().setFromMatrixPosition(s.L(lx, 0, lz))` (grep §3.1 → 0 linii poza `ring:`).
- audyt/testy/views_rezyseria.json: pitch 0,06 → 0,09 (§8 #12; osobny commit).
- audyt/testy/geo/entry.mjs: eksport `stallPlacements, yawFrom`; test_geometria.mjs: asercja **I** (sektor bez kramu na `W.stalls`, repoussoir na skraju, luz; kalibracja na znanym-złym: pierścień `?nocompose=1` daje DOKŁADNIE 1 kram w sektorze — HEAD kram 0 (0,18, 11,97) yaw 0,521, koło do 0,336 < 0,40; policzone 2026-09-08).
- rynek/app.js: bundle (esbuild, alias ./engine/src/loaders_ktx2.js). Flaga: `grep flags.nocompose rynek/src` → stalls.js:31, :67 (main.js czyta URLSearchParams).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na compose_on/start_v2.png, 824×1830):
1. [x] Fontanna w środkowej ⅓ szerokości: NDC x −0,57..0,43 (środek −0,086) — na PNG cembrowina x ≈ 130–690 px, posąg na osi ≈ 380 px.
2. [x] Iglica (−6,7, 36, −23,2) NDC y 0,920 (`cam.project` PRZED renderem) — na PNG kula + chorągiew iglicy przy górnej krawędzi (y ≈ 75–140 px = górna ⅛), trzon wieży na osi za fontanną.
3. [x] Sektor yaw 0,05–0,40 (< 14 m) bez kramu: między kamerą a fontanną tylko bruk; repoussoir = kram 0 przy lewej krawędzi (baldachim cloth2/szafran x 0–165 px, słup, skrzynia zaplecza w dolnej ⅓: y 1150–1330 px); kram 4 (cloth3) daleko za fontanną po lewej, kram 3 (cloth0) po prawej za lipą. W `compose_off` (HEAD) kram 0 (0,18, 11,97) zasłania lewą ⅓ cembrowiny (skrzynia + baldachim nad brzegiem basenu) — zniknęło.
4. [x] Horyzont 44 % wysokości (okapy/parter na y ≈ 1000–1050 px z 1830).
5. [x] Lipy przy krawędziach (etap2_trees.md); trzy plany: kram (8 m) → lipa/fontanna (20 m) → wieża (43 m).
6. [ ] §5.3 (3) „nad okapem dachy drugiej linii" — n/d: motyw #4 (skyline) nie jest scalony na tym branchu; nad okapami samo niebo.
7. [x] §5.3 (5): calls 100 ≤ 250, triangles 375 244 ≤ 700 000, errors [].
8. [x] start_v2_lewo (yaw 0,45): kram 0 od tyłu (baldachim, 2 słupy, lada, beczka zaplecza z lewej), za nim pień i korona lipy (−6, 0), wieża po prawej.
9. [x] top: kram 0 na (−0,16, 13,0) (dół obrazu, poza pierścieniem R 11,5, 9 m od krawędzi placu), 6 kramów w pierścieniu, nic na ulicy; diff_top = obrysy 7 kramów (przesunięcie 0,3 m) + kram 0 + lipy z cieniami.

WIDOKI (audyt/testy/out/render/, URLQUERY noui=1&nosmoke=1&nosway=1&nowater=1, QUALITY=high DPR=2 412×915; ortho 1024² DPR 1; każdy obejrzany):
- compose_on/start_v2.png — kadr §5.3 zaliczony poza (3); compose_on/start_v2_lewo.png — repoussoir od tyłu, lipa za nim; compose_on/start_plac.png (kontrolny, stary start) — jak start_v2 z niższym pitch.
- compose_off/start_v2.png, start_plac.png (?nocompose=1) — kram 0 przed lewą częścią fontanny (stan HEAD).
- compose_on/diff_start_v2.png, diff_start_plac.png (obejrzane: maska = kram 0 z lewej + kram 4 za fontanną; reszta czarna).
- compose_on_top/top.png + diff_top.png (vs sign_on_top/top.png); compose_on_top/crop_woz.png (wóz vs kram 6).
- compose_on_elew/elew.png (ortho side 3 z x = 24: lipa (6,0) przed pierzeją W — elewacja dla lip); compose_on_noinst/start_v2.png, start_plac.png (?noinst=1).

BUDŻET (HUD, tryb instancji): start_v2 z kompozycją 100 / 375 244 vs ?nocompose=1 100 / 375 244 (przesunięcie kramów nic nie zmienia; +6 draw / +3 904 tri to lipy — etap2_trees.md); start_plac 100 / 375 244 (po #10b: 94 / 371 340); start_v2_lewo 99 / 381 444; top 124 / 423 531; elew 99 / 366 588. Wszystko ≤ 250 / ≤ 700 000; start_plac 375 k ≤ 600 k (zapas 225 k).
- noinst (?noinst=1): start_v2 122 / 249 544, start_plac 122 / 249 544 (po #10b: 117 / 250 084); errors []. inst vs noinst start_v2: pctOver 0,04 %.
- top-3 __stats start_v2: timber 1 / 29 168, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d (bez zmian W.mat w tej cesze; lipy — etap2_trees.md).

ASERCJE: geo_test.sh exit 0 (okien/ram 1721, B1b 132, połaci 82, B5 3164, B5b 10, domów 28, kramów 7, wieża 16, F 8, F2 9/8, **lip H 2**, put 2, B6 135, KNOWN 1, CHECK 0; 9 „uwaga": 7× C kram 1,70 > 1,6 (jak HEAD) + 2 KNOWN_B6 dyszel — uwaga: pierwszy wpis dyszla (−9,94, 10,11) przestał się pojawiać, bo kram 6 po obrocie o fazę (−9,17, 8,48)... → jest 1,80 m od niego = pokrycie kołem 1,6 + 0,35 (zbieg okoliczności, nie naprawa; wpis zostaje); rot_token.mjs stalls.js + trees.js exit 0; results.errors [] w 7 renderach (compose_on, compose_off, trees_on, trees_off, top, elew, noinst); grep §3.1 → 0 (stalls spłacone); grep K3 → tylko dług chorągwi props.js:156-158 (#5); grep hex → tylko config.js; §2.4 → 0. Nowe check(): „kram w sektorze startu" (× 7; d < 14 tylko kram 0: yaw 0,621 − 0,202 = 0,419 ≥ 0,40), „repoussoir nie na skraju pierścienia" (|p| 13,00 ± 0,01), „repoussoir nie tuż za sektorem" (luz 0,020 ∈ [0, 0,05]) — PASS; test I: 0 FAIL, kalibracja HEAD 1/7.

DIFF (img_diff, próg 20): start_v2 compose on/off 4,71 %, start_plac on/off 5,05 % (kontrolny: maska = tylko kram 0 i kram 4), top vs sign_on_top 3,25 % (kramy + lipy), vs baza repo start_plac 31,67 %, inst vs noinst 0,04 %.

ZNANE BRAKI:
- §5.3 (3) niespełnione na tym branchu (brak drugiej linii dachów — motyw #4 w innym torze); po scaleniu ponownie obejrzeć start_v2.
- §5.3 (4) „w dolnej ⅓ coś poza brukiem": jest tylko skrzynia zaplecza i słup kramu 0 w lewym dolnym rogu (12 % szerokości); kosz/kałuża/cień girlandy = motywy #11/#13/#5.
- Repoussoir to prawa krawędź kramu (NDC −1,0..−0,6) — sektor liczony dla CAŁEGO koła kolizji 1,6 m (prompt mówił „(−1, 13)": policzone yaw 0,70 = poza kadrem (NDC −1,73), więc pozycja z reguły, nie z liczby).
- Wóz (−8, 9) i kram 6 (−8,74, 6,96): odległość środków 2,17 m (HEAD 2,04) — bryły stykają się (crop_woz.png); stan sprzed motywu (wóz w props.js), nie ruszany.
- Cykle: 1/3.
