# Etap 2 — motyw #10a „portale łukowe" (?noportal=1) — raport (cykl 1/3)

Stan wyjściowy: `6c24511` (pozycja §8 #11 dla #10: signMatrix + asercja F + stub W.bounds/W.put — osobny commit, bez zmian obrazu).
Branch feat/tor-a (po #1 → #2 → #3 → #12 → #6 → #9), worktree /home/user/wt-a, PORT 8376.

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.portal = { doorW: 1.2, doorH: 2.2, archIn: 0.6, archOut: 0.9, impostY: 1.6, t: 0.25, seg: 8, key: 'blocks', keystone: { w: 0.28, h: 0.45, up: 0.125, out: 0.05 }, threshold: { h: 0.1, d: 0.35 }, front: 0.6 }` (komentarz z policzonymi liczbami). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/buildings.js: `archRing(rIn, rOut, t, seg, mpt)` (półpierścień ExtrudeGeometry, UV w metrach; policzone w Node: bbox x ±0,9, y 0..0,9, wierzchołki nad y 0,05 mają r ∈ [0,600; 0,900] — otwór pusty; 164 tri przy seg 10, seg 8 w CONFIG); `portalArch(doorX, faceZ0)`: 2 ościeża `box(0.3, 1.6, 0.25)` blocks przy `doorX ± 0.75`, łuk na impoście 1,6 (szczyt wewn. 2,2, zewn. 2,5), zwornik `box(0.28, 0.45, 0.30)` (y 2,175–2,625, 5 cm przed oprawą), próg `box(1.8, 0.1, 0.35)` na ziemi; oprawa 0,01–0,26 m przed licem parteru `faceZ0 = d/2`. Drzwi `box(doorW, doorH, 0.1)` 2,2 m (HEAD 2,3: róg (0,6, 0,7) miałby r 0,922 > 0,88 i wystawałby za pierścień — K13 policzone: przy 2,2 r 0,849). Nadproże belkowe HEAD tylko z `?noportal=1` (wywołania `r()` bez zmian → reszta domu i sceny bez przetasowania). Kolizja oprawy (K10): `addRect` osiowy ze środkiem `LP(doorX, 0, faceZ0 + depthF/2)` (domy zamykające ulice: obszar chodzenia sięga lica) + `checkCollisionCovers`.
- `W.portals = [{x, z, ry, side, along, setback, w, doorX, faceZ, faceZ1, orielX, tr}]` — 28 wpisów, (x,z) na ziemi 0,6 m przed licem drzwi (kontrakt z greenery.js; szyldy #10b czytają doorX/faceZ1/orielX). Karczma (s2 along 6,28, doorX −0,34): (−5,94, 21,40).
- rynek/app.js: bundle (§6 p.3). Flaga `?noportal=1` (`grep flags.noportal rynek/src` → buildings.js:157) = drzwi 2,3 + nadproże HEAD.
- Lista „co ma być widać" PRZED kodem: `$SP/m10/lista_portal.md` (6 punktów); liczby K13 jednolinijkowcem (róg drzwi, szczyt łuku, plakieta/belki jetty, zasięg okiennic parteru).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] portal_L/portal_P (karczma, kamera 5,7 m, ±38°): jasna oprawa blocks (ościeża, pełny łuk z klińcami tekstury, zwornik wystający nad łuk, próg u dołu) na ciemniejszym parterze stone; drzwi w otworze, rogi drzwi niewidoczne za pierścieniem; nadproże belkowe zniknęło.
2. [x] portale_szeroki (−2,5, 11 → karczma): cały dom z portalem pośrodku parteru, okno parteru z okiennicami 1,7 m od osi drzwi nie zachodzi na ościeże.
3. [x] start_plac (kontrolny): jedyna zmiana = 3 łukowe drzwi domów pierzei N w tle (maska diff = 3 małe łuki, 0,16 %); plac, kramy, fontanna, wieża bez zmian.
4. [x] top (ortho 60 m): 0,02 % vs palette_on_top/top.png — nic nowego na placu ani w ulicach (oprawa 0,26 m przed licem pod okapem).
5. [x] W.portals: 28 wpisów (wypis z geo bundla), `check` „punkt portalu" d = 0,6 ≥ 0,595 × 28 PASS.
6. [x] Budżet: +0 draw; +9 408 tri HUD w start_plac (28 × ~166 realnych ≈ 4,7 k → ×2 z cieniem).

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1, QUALITY=high DPR=2 412×915; top 1024² DPR 1; każdy obejrzany; bez elewacji — cecha bez rx/rz, < 4 m):
- portal_on/portal_L.png, portal_P.png; portal_on2/portale_szeroki.png, start_plac.png vs portal_off/* i portal_off2/start_plac.png (?noportal=1); diff: portal_on/diff_portal_*.png, portal_on2/diff_start_plac.png (obejrzana).
- portal_on_top/top.png + diff_top.png (vs palette_on_top/top.png = stan przed cechą).
- portal_on_noinst/start_plac.png, portal_L.png (?noinst=1; portal_L obejrzany — identyczny z trybem instancji).

BUDŻET (HUD, tryb instancji; przed = ?noportal=1, po = z cechą):
- start_plac: calls 93 → 93, triangles 361 206 → 370 614 (+9 408; cel ≤ 600 k, zapas 229 k); portal_L 74 → 74 / 297 151 → 306 559; portal_P 68 → 68 / 257 025 → 266 433; portale_szeroki 81 → 81 / 347 441 → 356 849; top 118 / 418 903 (palette_on_top: 118 / 409 495). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 116 / 249 358 (po #9: 116 / 239 950), portal_L 84 / 193 785; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 28 800, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776; blocks 7 820 (portal_L).

KOLOR: n/d (bez zmian W.mat; klucze blocks/door).

ASERCJE: geo_test.sh exit 0 z korzenia worktree (okien/ram 1721, B1b 132, połaci 82, podparć B5 3164 (+28: łuk i zwornik wiszą na ościeżach, nadproże HEAD −28), B5b 10, domów 28, kramów 7, wieża walec 16, F 8 (stary łańcuch 4/8), B6 102, znanych wad 2 = KNOWN_B6 dyszel, CHECK 0; 7 uwag C kramów); rot_token.mjs buildings.js exit 0; results.errors [] w 7 renderach (on, on2, off, off2, top, noinst); grep §3.1 sin/cos = tylko dług HEAD stalls.js:10,34; grep K3 = tylko dług props.js:156-167 (chorągwie, szyld — #10b); §2.4 = 0. Nowe check(): „portal łuk" (checkInFrontOfWall środek łuku ≥ 0,130 przed licem: 0,135), „róg drzwi wystaje za pierścień łuku" (0,849 ≤ 0,88), „zwornik" (przód ≥ 0,045 przed oprawą: 0,050), „zwornik wyżej niż parter / belki jetty" (2,625 ≤ 3,15 i ≤ 3,02), „próg wyższy niż stopień" (0,1 ≤ 0,15), „okno parteru w oprawie portalu" (skraj ramy 1,675 / okiennicy 1,287 ≥ 0,95), „punkt portalu" (0,6 ≥ 0,595), checkCollisionCovers „portal" — wszystkie ×28 PASS.

DIFF (img_diff, próg 20): portal_L 6,09 %, portal_P 5,52 %, portale_szeroki 1,34 % (cecha ≥ 0,5 %); start_plac on/off 0,16 % (3 łuki pierzei N — oczekiwane); top 0,02 %; vs baza repo rynek/start_plac.png: 25,66 % (paleta #9 + wieża + …).

ZNANE BRAKI:
- Oprawa jednolita (ExtrudeGeometry bez klińców w geometrii) — klińce daje tylko tekstura blocks; profil (fazowanie, kapitele impostu) do wykończeń.
- Domy zamykające ulice: obszar chodzenia sięga lica, więc oprawa dostała własny prostokąt kolizji (gracz zatrzymuje się 0,36 m przed drzwiami zamiast na licu).
- Zwornik `keystone.out` 0,05 = 0,31 m przed licem — 1 cm za marginesem 0,3 m placu, ale na y ≥ 2,175 (nad głową gracza 1,65).
- Cykle: 1/3.
