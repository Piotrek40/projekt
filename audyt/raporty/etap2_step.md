# Etap 2 — motyw #12b „szczyt schodkowy" (?nostep=1) — raport (cykl 1/3)

Poprzednie commity motywu #12: `a794312` (infrastruktura §8 #3/#11), `1b948f4` (#12a lukarny NA połaci, `audyt/raporty/etap2_dormer.md`).

ZMIANY:
- rynek/src/config.js: `CONFIG.houseDetail.step = { share: 0.6, steps: [4, 6], parapet: 0.35, t: 0.4, out: 0.02, slabIn: 0.1 }` (udział domów szczytowych, liczba schodków, wysokość schodka nad linią połaci, grubość muru, lico muru przed fasadą, koniec połaci za licem). Nowe linie z ułamkiem bez komentarza (§2.4): 0.
- rynek/src/buildings.js (gałąź `gableFront`): decyzja i liczba schodków z osobnego strumienia `rng(h.seedLocal + 2)` (r() domu i R główne bez zmian → reszta sceny bez przetasowań); `stepGable(n)`: n boxów `'blocks'` o półszerokości `(w/2 + ov)·(1 − i/n)`, spód `y + i·sh` (sh = rise/n), wierzch `spód + sh + 0,35`, grubość 0,4, lico `faceZ + 0,02` (faceZ = topD/2 + jet/2 — osobna zmienna lica); połacie i belka kalenicy skrócone z przodu o `ov + 0,1` (koniec 0,1 m za licem, w murze) — bez okapu przed szczytem; belka pionowa szczytu (HEAD) tylko dla trójkąta. Asercja `check(top ≥ roofTopG(x_wewn) + 0,05, 'schodek i pod połacią')` z wierzchem płyty `oś + 0,07·slope/hw0` (= /cos). Klucz 'blocks' istnieje → 0 draw.
- rynek/app.js: bundle (§6 p.3).
- Flaga: `?nostep=1` (`grep flags.nostep rynek/src` → buildings.js:78) = trójkątny szczyt HEAD z okapem.
- Lista „co ma być widać" PRZED kodem: `$SP/dormer/lista_step.md` (6 punktów), liczby z `$SP/dormer/proto_step.mjs` (prawdziwy układ seed 7): 6 domów szczytowych, 3 schodkowe.

CO MIAŁO BYĆ / CO WIDAĆ (odhaczone na PNG):
1. [x] 3 z 6 domów szczytowych schodkowe: s1 along −25.8 (świat (26, −25.8), 2 piętra, n=4), s2 −19.1 ((19.1, 26), 3 piętra, n=6), s3 −19.9 ((−26, 19.9), 4 piętra, n=6) — geo_test: 16 asercji „schodek pod połacią" PASS (margines ≥ 0,25); pozostałe 3 domy z trójkątem jak HEAD (elew2: dom along −13.8 side 0 nie w kadrze; elew3 lewa krawędź: trójkąt s3 −26.6 bez zmian).
2. [x] Schodki ponad połaciami: step_S (12, 10, yaw −2.61, pitch 0.64) — dom (19.1, 26): sylwetka 6 schodków z muru medieval_blocks na tle nieba, obie połacie schowane za murem, bez okapu przed szczytem; step_W (−8, 8, yaw 2.27, pitch 0.58) — dom (−26, 19.9) 4-piętrowy, 6 schodków w słońcu, górny schodek wąski (półszer. 0,62), sąsiednie dachy niżej.
3. [x] Mur 0,4 m, lico 0,02 przed fasadą: step_W — schodki wychodzą z płaszczyzny fasady bez uskoku; grubość widoczna na krawędziach schodków (cień na bocznych ściankach).
4. [ ] step_E (10, −18, yaw −1.12, pitch 0.37): dom narożny NE ZASŁONIĘTY przez sąsiedni dom pierzei E z wykuszem — w kadrze tylko skrawek muru schodków (prawa krawędź, x≈600 px, y≈880); pctOver 0,43 % < 0,5 % — widok źle dobrany, cecha na tym domu potwierdzona tylko liczbami (asercje 4 × PASS) i geo. NIE liczę jako „widać".
5. [x] Elewacja side 2 (2048×1024, size 30): dom (19.1, 26) → px x ≈ 300–490 (lustrzane: prawo = −x): 6 schodków z muru od okapu do wierzchu 13,85 m ponad sąsiednimi dachami; elewacja side 3: dom (−26, 19.9) → px x ≈ 250–460: 6 schodków do 16,45 m (najwyższy punkt pierzei W), brak połaci V.
6. [x] start_plac (kontrolny): maska diff = tylko cień schodków na bruku po prawej (dom s2 za kamerą rzuca cień ku −x−z; pas y ≈ 1080 px), nic więcej (0,21 %); vs dormer_on/start_plac (stan przed cechą): 0,22 %. top: maska = 2 domy schodkowe (cień muru na własnej połaci + wierzch muru 0,4 m przy licu) i cień na placu; obrysy bez zmian, nic nowego na placu/ulicach (0,50 %).
7. [x] Budżet: 0 nowych kluczy; start_plac +312 tri HUD (lista: ≈ +400); calls bez zmian (step_S +1 call: mesh 'blocks' wchodzi do frustum).

WIDOKI (audyt/testy/out/render/, noui=1&nosmoke=1&nosway=1&nowater=1; perspektywa QUALITY=high DPR=2 412×915; ortho DPR 1, elewacje 2048×1024 size 30, top 1024×1024 size 60; każdy obejrzany):
- step_on_elew/elew2.png, elew3.png (OBEJRZANE PIERWSZE): p.5.
- step_on/step_S.png, step_W.png, step_E.png vs step_off/*: p.2–4; diff_step_S.png (maska obejrzana: tylko szczyt schodkowy + skrócony okap).
- step_on_sp/start_plac.png vs step_off_sp/start_plac.png (?nostep=1) + diff_start_plac.png (maska obejrzana): p.6.
- step_on_top/top.png + diff_top.png vs dormer_on_top/top.png (stan przed cechą = OFF; osobny render top z ?nostep=1 pominięty — flaga sprawdzona na 4 widokach perspektywicznych): p.6.
- step_on_noinst/step_W.png, start_plac.png (?noinst=1): errors [].

BUDŻET (HUD, tryb instancji; przed = ?nostep=1, po = z cechą):
- start_plac: calls 87 → 87, triangles 351 166 → 351 478 (+312; cel ≤ 600 k spełniony); step_S 65 → 66 / 286 077 → 288 977; step_W 77 → 77 / 343 567 → 343 879; step_E 60 → 60 / 233 343 → 233 655; top 112 → 112 / 399 455 → 399 767; elew2 74 / 315 953, elew3 69 / 291 127 (tylko ON). Wszystko ≤ 250 / ≤ 700 000.
- noinst (?noinst=1): start_plac 110 / 230 222 (po #12a: 110 / 229 910), step_W 82 / 181 293; errors [] w obu.
- top-3 __stats start_plac: timber 1 / 28 000 (było 28 036: −3 belki szczytu), wooden_lantern_01 3 / 27 232, wicker_basket_01 1 / 17 776.

KOLOR: n/d (bez zmian W.mat; mur schodków = istniejący klucz 'blocks').

ASERCJE: geo_test.sh exit 0 (okien/ram 1834, połaci 66, podparć B5 2745, lukarn B5b 10, domów 28, kramów 7, wieża walec 16, B6 84, znanych wad 2 = KNOWN_B6 dyszel, CHECK nieudanych 0); rot_token.mjs buildings.js exit 0; results.errors [] w 8 renderach (elew on, on ×3, off ×3, sp on/off, top, noinst); grep §3.1 Math.sin/cos = 0; grep K3 = 0; §2.4 = 0. Nowe check(): '… schodek i pod połacią' (wierzch schodka ≥ wierzch płyty przy wewnętrznym narożniku + 0,05) — 16 × PASS (4 + 6 + 6).

DIFF (img_diff, próg 20): step_S 4,92 %, step_W 2,81 % (cecha ≥ 0,5 %); step_E 0,43 % (widok nieudany, p.4); start_plac on/off 0,21 % (cień); top vs stan przed cechą 0,50 %; vs baza repo rynek/start_plac.png: jak w #12a (20,5 %; różnica tylko cień schodków).

ZNANE BRAKI:
- Widok step_E źle dobrany (dom narożny NE zasłonięty sąsiadem) — cecha na tym domu niepokazana na PNG; pokazana na 2 z 3 domów (step_S, step_W, elew2, elew3). Do poprawy kadru przy kolejnym cyklu, jeśli krytyk zażąda.
- Mur schodków ma szerokość podstawy w + 2·ov (jak połać, żeby schować jej krawędzie) — wystaje 0,55 m poza ściany boczne domu, „wisi" na płycie połaci (B5: styk z AABB połaci); historycznie szczyt schodkowy jest w licu ścian. Alternatywa (mur w, połać docięta w x) wymaga płyty innej niż box — odłożone.
- Schodki bez gzymsów/sterczyn i bez cienia własnego wyłączonego (klucz 'blocks' rzuca cień; §8 #17 należy do #5).
- Dom z łukiem szczytu s0 along −13.8 (4 piętra, w 6,6) nie jest schodkowy (losowanie Rd < 0,6 = nie) — kompozycja pierzei N przy wieży bez schodków; zmiana = share w CONFIG.
- Cykle: 1/3.

## Cykl 2/3 (2026-09-08) — weryfikacja na HEAD `d0ca35e` (po #6/#9/#10/#7)

Bez zmian kodu (bundle identyczny, geo_test exit 0, rot_token exit 0 — szczegóły w `etap2_dormer.md`, cykl 2). Dowód flagi z bundla geo: `?nostep=1` → blocks 5 232 → 5 040 tri (−192 = 3 domy × 4/6/6 schodków × 12), timber +36 (3 belki szczytu HEAD).

CO WIDAĆ (PNG z tego cyklu):
1. [x] `m12_on/step_W.png` (−8, 8, yaw 2.27, pitch 0.58): dom (−26, 19.9) — 6 schodków muru `blocks` na tle nieba, górny wąski (półszer. 0,62), obie połacie schowane za murem, bez okapu przed szczytem; `m12_off/step_W.png` (3 flagi): trójkątny szczyt z belką pionową i łupkowym okapem. Maska `diff_step_W.png` obejrzana: tylko szczyt (schodki + skrócony okap), reszta czarna; pctOver 3,41 %.
2. [x] `m12_on_elew/elew2w.png` (side 2, 2048×1024, size 30): schodki domu (19.1, 26) — 6 stopni z muru od okapu do 13,85 m (px x ≈ 300–490, ponad dachami sąsiadów po lewej); `elew3w.png` (side 3): schodki domu (−26, 19.9) do 16,45 m = najwyższy punkt pierzei W (px x ≈ 250–450). Elewacje 1024² (size 30, `m12_on_top/elew2.png`, `elew3.png`) NIE obejmują tych domów (kadr ±15 m, domy na along −19.1 / −19.9) — dlatego dodatkowy render 2048×1024.
3. [x] `m12_on_top/top.png`: wierzch muru schodków (0,4 m przy licu) widoczny jako jasna kreska na dachach (19.1, 26) i (−26, 19.9); nic na placu/ulicach.
4. [x] `m12_on2/start_plac.png` kontrolny: maska (ON vs OFF 3 flagi) bez śladu schodków w kadrze (dom s2 −19.1 za kamerą; cień poza kadrem przy pitch 0,02) — pctOver 0,58 % pochodzi z lukarny s0 6.1 i cieni naczółków.

BUDŻET: step_W 87 / 364 149 (OFF) → 87 / 366 061 (ON, cały motyw #12); pozostałe widoki i noinst — patrz `etap2_dormer.md` cykl 2. errors [] we wszystkich.

DIFF: step_W 3,41 % / start_plac 0,58 % / vs baza repo 31,66 % (kompozycja #7).

ZNANE BRAKI (doprecyzowane, cykle 2/3):
- Trzeci dom schodkowy s1 along −25.8 (świat (26, −25.8), 2 piętra, n=4, wierzch 11,23 m) jest W CAŁOŚCI wewnątrz domu narożnego pierzei N s0 24.2 (x 18,45–29,95, z −30,35–−21,65, okap 11,44, kalenica 14,89; policzone z bundla geo) — nie da się go pokazać ŻADNĄ kamerą; wpis cyklu 1 „widok step_E źle dobrany" był nieścisły: to nie kadr, tylko zamierzone przenikanie domów narożnych (§3.2 K8). Efektywnie schodkowe są 2 z 6 domów szczytowych; poprawa (pominięcie domów narożnych w losowaniu) = zmiana `layout`/warunek `|along| < half − w/2` w `buildings.js` — odłożone, bo przetasowałaby losowanie `rng(seedLocal+2)` tylko tego domu (0 wpływu na inne), ale wymaga cyklu 3 z pełnym renderem.
- Mur schodków szerokości w + 2·ov (wystaje 0,55 m poza ściany boczne) — jak w cyklu 1.
