# Etap 2 — motyw #12c „naczółek" (?nohip=1) — raport (cykl 1/3)

Poprzednie commity motywu #12: `a794312` (infrastruktura §8 #3/#11), `1b948f4` (#12a lukarny, `etap2_dormer.md`), `a917a68` (#12b szczyt schodkowy, `etap2_step.md`).

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.hip = { share: 0.25, inset: 1.0 }` (udział domów ∥ x — „co 4. dom"; o ile kalenica krótsza z każdej strony). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/buildings.js: lokalny `prism(points, t, mpt)` (Shape + ExtrudeGeometry wyśrodkowany w z, UV w metrach jak `gable()`; bez zmian w engine/); gałąź „kalenica ∥ x": decyzja z osobnego strumienia `rng(h.seedLocal + 3) < share` (r() domu bez zmian; z `?nohip=1` = HEAD: 2 box połaci + 2 trójkąty + belka). `hipRoof(hipIn)`: `drop = (hipIn + ov)·tan(pitch)`, `yb = y + rise − drop`, `hw = drop/s`, `slant = hypot(hipIn + ov, drop)`, `tilt = atan2(hipIn + ov, drop)`; naczółek = `gable(2hw, slant, 0.14)` w kluczu dachu na `L(sx·(w/2+ov), yb, jet/2, −sx·π/2, tilt)` (rot: policzone — apex trafia w `(sx·(w/2−hipIn), y+rise, jet/2)` z Δ 0 dla 8 domów × 2); połacie = sześciokąty `prism(hexa, 0.14)` w płaszczyźnie stoku (okap w + 2ov, kalenica w − 2·hipIn, ukośny styk `vS = slope·(1 − hw/(topD/2+ov))`) na `L(0, y, jet/2 ± (topD/2+ov), 0, ∓(π/2 − a))` (rot: policzone — kalenica w `(0, y+rise, jet/2)`); ściany szczytowe = trapez `prism([[−topD/2,0],[topD/2,0],[hipIn,hCut],[−hipIn,hCut]], 0.3)` z `hCut = rise − hipIn·tan(pitch)` (wierzch w płycie naczółka przy licu zewnętrznym); belka kalenicy `w − 2·hipIn`. Lukarna na domu z naczółkiem: `|dx| ≤ w/2 − hipIn − 0,7 − 0,3` (poza naczółkiem). Nie zmieniono geometrii z §5.2 „box(hipLen, 0.14, 1.3)" — ta bryła (0,83 × 1,3 m) leżałaby POD pełnymi połaciami box (połać w rejonie naczółka jest wyżej niż płyta naczółka); liczby z promptu przeliczone (hipRise 0,626, hipLen 0,833, końce (4.55, 13.33, 0.35)/(4.0, 13.95, 0.35)) i odnotowane w `$SP/dormer/k13.mjs`.
- audyt/testy/test_geometria.mjs: wierzch płyty dla B5b z `±0,07` wzdłuż normalnej (wyższy z dwóch) — płyta z Extrude (sześciokąt tylnej połaci) ma normalną w dół.
- rynek/app.js: bundle (§6 p.3).
- Flaga: `?nohip=1` (`grep flags.nohip rynek/src` → buildings.js:111) = pełne szczyty HEAD.
- Lista „co ma być widać" PRZED kodem: `$SP/dormer/lista_hip.md` (7 punktów), liczby i K13 orientacji: `$SP/dormer/proto_hip.mjs` (8 domów × 2 naczółki: apex Δ 0; 8 × 2 połacie: kalenica zgodna).

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] 8 z 22 domów ∥ x z naczółkiem: s0 13.9 / 24.2, s1 −18.3 / 7.7 / 24.2, s2 −9.0 / 6.3 / 0 — geo_test „połaci 82" (66 + 16 naczółków, B2 wszystkie PASS z klasyfikacją z macierzy: 'naczółek' = płyta cienka w z, spadek wzdłuż lokalnego y, kalenica po osi x), asercje 'naczółek odwrócony' / 'naczółek nie na kalenicy' 16 × PASS.
2. [x] Sylwetka z uciętymi narożnikami: elew1 (side 1, 2048×1024) — najwyższy dom pierzei E (along 7.7, px x ≈ 1080–1440): kalenica krótsza, ukosy na obu końcach (px y ≈ 315→380 = 18,57 → 16,4 m ✓ lista 322→395); domy along 24.2 (prawa krawędź) i −18.3 (lewa, px 290–480) z ukosami na obu końcach. elew2 (side 2): dom (9, 26) → px ≈ 480–920: oba górne narożniki ścięte (16,58 → 14,95 m); dom (−6,3, 26) → px 1120–1300: jw.
3. [x] hip_E (0, 0, yaw −1.91, pitch 0.58): dom along 7.7 — lewy narożnik dachu ścięty trójkątem dachówki, trapezowa ściana szczytowa pod nim, kalenica kończy się przed krawędzią domu; prawy koniec za kadrem/sąsiadem. (Kadr nieszczęśliwy: górna połowa to podstawa fontanny — kamera w (0,0) stoi w cokole; dom w dolnej połowie widoczny w całości.)
4. [x] hip_S (4, 8, yaw −2.87, pitch 0.64): dom (9, 26) 4-piętrowy z lukarną — prawy górny narożnik dachu ścięty (naczółek), lewy poza kadrem; cecha subtelna (0,74 %).
5. [x] ulica_S (0, 14, yaw 3.14, pitch 0.30): dom zamykający ulicę S (w 22, z 42) — kalenica skrócona, oba końce dachu ścięte; maska diff = cały dach (nowe UV sześciokąta) + narożniki; także domy flankujące ulicę (s2 6.3 po lewej, s2 −9 po prawej — oba z naczółkiem) mają inne UV połaci.
6. [x] start_plac (kontrolny): maska = dach domu s0 13.9/24.2 przy prawej krawędzi (UV + narożnik) i cienkie paski cieni dachów pierzei S na bruku; plac/kramy/wieża/fontanna czarne (0,37 %). top: 8 dachów z ukośnymi szwami naczółków w narożnikach (np. dom N-E px 680–1000: trójkąty na końcach), obrysy bez zmian, nic nowego na placu (4,41 % = UV całych płyt + cienie).
7. [x] Budżet: 0 draw; start_plac +640 tri HUD (lista ≈ +0,7 k).

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1; perspektywa QUALITY=high DPR=2 412×915; ortho DPR 1, elewacje 2048×1024 size 30, top 1024×1024 size 60; każdy obejrzany):
- hip_on_elew/elew1.png, elew2.png (OBEJRZANE PIERWSZE): p.2.
- hip_on/hip_E.png, hip_S.png, ulica_S.png vs hip_off/* (?nohip=1); diff_hip_E.png, diff_ulica_S.png (maski obejrzane): p.3–5.
- hip_on_sp/start_plac.png vs hip_off_sp/start_plac.png + diff_start_plac.png (maska obejrzana): p.6.
- hip_on_top/top.png + diff_top.png vs step_on_top/top.png (stan przed cechą): p.6.
- hip_on_noinst/hip_E.png, start_plac.png (?noinst=1): errors [].

BUDŻET (HUD, tryb instancji; przed = ?nohip=1, po = z cechą):
- start_plac: calls 87 → 87, triangles 351 478 → 352 118 (+640; cel ≤ 600 k spełniony, zapas 248 k); hip_E 77 → 77 / 342 398 → 343 038; hip_S 73 → 73 / 325 283 → 325 923; ulica_S 70 → 70 / 307 089 → 307 729; top 112 → 112 / 399 767 → 400 407; elew1 66 / 307 507, elew2 74 / 316 593 (tylko ON). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 110 / 230 862 (po #12b: 110 / 230 222), hip_E 90 / 194 862; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 28 000, wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.
- Łącznie motyw #12 (a+b+c) w start_plac: 350 206 → 352 118 tri HUD (+1 912), calls 87 → 87; noinst 229 910 → 230 862 (bez pomiaru przed #12a: 228 950 z raportu #3).

KOLOR: n/d (bez zmian W.mat).

ASERCJE: geo_test.sh exit 0 (okien/ram 1834, połaci 82, podparć B5 2761, lukarn B5b 10, domów 28, kramów 7, wieża walec 16, B6 84, znanych wad 2 = KNOWN_B6 dyszel, CHECK nieudanych 0); rot_token.mjs buildings.js exit 0; check_test.mjs 8/8; results.errors [] w 9 renderach (elew, on ×3, off ×3, sp on/off, top, noinst); grep §3.1 Math.sin/cos = 0; grep K3 = 0; §2.4 = 0. Nowe check(): '… naczółek odwrócony' (apex.y > base.y + 0,5), '… naczółek nie na kalenicy' (|apex − LP(sx·(w/2−hipIn), y+rise, jet/2)| < 0,01) — 16 × PASS.

DIFF (img_diff, próg 20): ulica_S 2,83 %, hip_E 1,20 %, hip_S 0,74 % (cecha ≥ 0,5 %); start_plac on/off 0,37 % (dach przy krawędzi + cienie); top vs stan przed cechą 4,41 % (UV 8 płyt + cienie); vs baza repo rynek/start_plac.png: 20,57 %.

ZNANE BRAKI:
- Naczółki przy WYŻSZYM sąsiedzie chowają się w jego ścianie szczytowej (np. s0 13.9 lewy koniec przy domu 6.1) — bez błędu geometrii, ale bez efektu wizualnego; widoczne 5 z 8 domów (końce przy niższym sąsiedzie lub wolne).
- Zmiana UV całej połaci (box → sześciokąt Extrude: te same metry na kafel, inne pochodzenie współrzędnych) — dachówka na 8 domach ma inne przesunięcie wzoru; bez wpływu na kolor (ten sam materiał).
- Styk naczółka z połacią: obie płyty grubości 0,14 stykają się osiami → rowek/grzbiet ± 0,07 m na szwie (niewidoczny w renderach; do gąsiorów w wykończeniach).
- Ściana szczytowa trapezowa ma przy wewnętrznym licu 0,23 m szczeliny pod płytą naczółka (w strychu, zamkniętym) — niewidoczna.
- Udział 0,25 dał 8 z 22 (36 %) — więcej niż „co 4."; zmiana = jedna liczba w CONFIG.
- Widok hip_E z kamerą w cokole fontanny (górna połowa kadru = kamień) — do poprawy kadru, cecha widoczna w dolnej połowie.
- Cykle: 1/3.
