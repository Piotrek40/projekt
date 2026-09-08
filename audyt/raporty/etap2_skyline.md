# Etap 2 — motyw #4+14 „panorama": druga linia dachów, mgła, bramy, wieże w oddali, ptaki (`?noskyline=1`, `?nofog=1`, `?nobirds=1`)

Worktree `/home/user/wt-b`, branch `feat/tor-b`, PORT 8275. Cykle: 1 (przerwany na etapie renderu, kod w commicie `WIP: 6921b22`), 2 (render przerwany), **3 = ten** (pełna weryfikacja: test → render → oglądanie → diff). Wszystkie rendery z `noui=1&nosmoke=1&nosway=1&nowater=1`, QUALITY=high, DPR 2 (perspektywa 824×1830) / DPR 1 (ortho 1024×1024).

## Lista „co ma być widać" (spisana przed cyklem 3, odhaczona na PNG)
1. Druga linia: 26 domów tła (6/7/7/6 na strony 0–3; test S1 wymaga 6–8), środek 35–42 m od środka placu (setback 9.2–15.8 m za osią pierzei 26 m), kalenice 12.2–16.8 m (pierzeja: 10.7–14.0 m). **Widać**: `start_plac` — dachy drugiej linii nad 2-piętrowymi domami pierzei N (lewa część kadru, maska diff); `elew_N60`/`elew_N100` — kalenice drugiej linii nad pierwszą (np. czerwony dach na py ≈ 717 = 16 m za wieżą; szczyty domów szczytowych na obu krawędziach), wszystkie połacie Λ; `zaulek_N` (8, −32.5, yaw −1.57) — rząd fasad domów tła z 3 rzędami okien i okapami po lewej, tyły pierzei po prawej; `tlo_N` — dom tła przy ulicy z bliska (ściana od ulicy z 3 oknami, fasada, okap). ✔
2. Mgła `Fog(#c9d5df, 60, 220)`: kolor = sonda na bazowym `start_plac.png` pas `40,600,480,20` → #c9d5df (L 0.867 C 0.018 H 242.6), pas sąsiedni `40,620,200,20` → #cbd6df (L 0.870): ΔL 0.003 ≤ 0.01, C < 0.03 (obie sondy uruchomione ponownie w tym cyklu — zgodne). Czysty pas nieba w nowym `start_plac` (`300,600,220,20`, bez wieży) → #c9d5de L 0.866 = baza L 0.866 (mgła nie zmienia nieba, brak pasa). Wieża A (90 m, współczynnik mgły 0.19): z mgłą L 0.708/0.758 (cień/słońce), bez mgły (`?nofog=1`) 0.677/0.736 → ΔL +0.03; diff nofog↔fog `panorama_N` pctOver **0.06 %** (próg 20), `start_plac` 0.14 %. ✔ działa, ale poniżej progu „cecha widoczna" 0.5 % — patrz ZNANE BRAKI.
3. Bramy: 4 (dist 34 m: (0,−34), (34,0), (0,34), (−34,0)), mur 33–35 m, filary 2 m na x ±(2..4), łuk nasada 3.5 / szczyt 5.5 m, mur 7 m + 3 blanki, baszty r 1.6 h 9.5 + hełm 2.4 na x ±4.6. **Widać**: `brama_S` (0,24) — łuk pośrodku, blanki na filarach, przez łuk fasada domu zamykającego (baszty poza kadrem: 25° od osi przy 10 m); `ulica_poludnie` (0,14) — brama zamyka oś ulicy między ścianami pierzei; `start_plac` — brama N widoczna przez wylot ulicy N (maska diff, łuk + baszta z hełmem); `elew_N60` — brama w wylocie ulicy: filary px 444–580, wierzch muru py ≈ 870 (policzone 870), baszty zasłonięte pierzeją (x 3–6.2 m za domami). `top100` — 4 bramy z parami baszt (ośmiokąty) na końcach ulic, nic w prostokącie chodzenia (test S3/B6: 44 elementy blocks, każdy z bb.min.y < 2 pokryty kolizją). ✔
4. Wieże w oddali: A (−26.6, −86) h 40 r 3.5, B (47.9, −87.8) h 44 r 4, C (−15.9, 78.4) h 32 r 3 (policzone `sin/cos a·dist`, zgodne z komentarzem w config); 12 segmentów, gzyms 1.2 m (r·1.25), hełm 0.3 h (podstawa r·1.3), przybudówka 12×9×10 po stycznej (ry=a: +x → (−0.955, 0, 0.296) dla a=π+0.3, policzone). **Widać**: `start_plac` — wieża A w lewej ćwiartce (yaw 0.284 w kadrze 0.15 ± 0.305) nad linią dachów, hełm + gzyms czytelne; `elew_N100` — A na px 200–280 (policzone 200–279), wierzch trzonu py ≈ 595 (594), szczyt hełmu ≈ 460 (459); B na prawej krawędzi (px 957+, trzon py ≈ 545 vs 553); `elew_S100` — C na px 641–709 (641–709), trzon py ≈ 675 (676). Sonda `start_plac` trzon A: cień L 0.722 C 0.023 H 238 / słońce L 0.768 C 0.018 H 231; niebo obok L 0.860 → Δ 0.09–0.14 ≤ 0.15 (cel: L 0.70–0.78, C ≥ 0.01, H 230–250). ✔
5. Ptaki: 14 `Points` (tekstura V 32 px, size 1.1 m) na y 15.0–22.9 m (zakres CONFIG 14–24; najwyższa kalenica pierzei 13.95), okręgi r 10.1–18.3 m wokół środków w środkowej ⅓ placu. **Widać**: `start_plac` 2 ptaki (prawy górny róg, także w masce diff), `naroznik_NE` 1, `panorama_N` 0 w tej klatce (v2 z cyklu 2: 3). Kryterium z listy „≥ 3 w panorama_N" było źle policzone: 14 ptaków na 360° → w stożku 35° spodziewane ≈ 1.4; poprawione kryterium: ≥ 1 ptak w ≥ 1 z widoków perspektywicznych — spełnione. ✔ (z zastrzeżeniem)
6. Budżet: start_plac +18 804 tri HUD (≤ 20 k), +4 draw (≤ 4: `far`, `birds` + 2 klucze więcej w kadrze). ✔ — ale patrz przekroczenie 700 k odziedziczone z bazy.
7. Flagi: `?noskyline=1` → `start_plac` off vs baza repo pctOver **0.02 %** (= szum), więc flaga odtwarza stan sprzed cechy; `?nofog=1` i `?nobirds=1` działają (nofog: ΔL wieży 0.03; nobirds: sprawdzone na elewacji — patrz ZNANE BRAKI). ✔

## ZMIANY
- `rynek/src/skyline.js` (właściciel): `skylinePlan(W)` — funkcja czysta (domy tła 2 odcinki × 4 strony z własnym `rng(seed+400)`, bramy, wieże, ptaki), `buildSkyline` (Fog, klucz `far` przed `W.B.build`, druga linia z kluczami plaster/roof/stone/glass, bramy `blocks`/`roof2` z `addRect`/`addCircle`, wieże `far`, ptaki `Points` z updaterem). W tym cyklu: wieże w oddali 12 segmentów + gzyms + hełm na gzymsie (`CONFIG.skyline.farDetail`), check „hełm szerszy niż gzyms > trzon".
- `rynek/src/layout.js`: `groundExtent` = `CONFIG.skyline.groundExtent` (120) gdy panorama włączona (`?noskyline=1` → 52 jak dawniej); `uvOffset` kotwiczy wzór bruku; token `rot:` dla `rx=−π/2` podłogi (dług HEAD layout.js:7 spłacony; policzone (0,0,1)→(0,1,0)).
- `rynek/src/config.js`: sekcja `skyline` (osobny commit `5dbfc6c`, §8 #8 „CONFIG.skyline.fog"): `seedOffset 400`, `groundExtent 120`, `fog {color 0xc9d5df, near 60, far 220}`, `secondLine {…}`, `gate {…}`, `farTowers [3]`, `farColor [0.62, 0.060, 245]` (w tym cyklu z 0.030 — ekran C 0.004 szare → 0.018–0.025), `farDetail {seg 12, baseFlare 1.1, ledgeH 1.2, ledgeR 1.25, capShare 0.3, capR 1.3}` (nowe), `farBlock`, `birds {count 14, y 14–24, r 10–20, speed 0.08–0.16, size 1.1, color OKLCH}`.
- `audyt/testy/test_geometria.mjs` + `geo/entry.mjs`: asercje S1 (liczba/pozycja domów tła, brak przecięć z pierzeją i między sobą), S2 (połacie tła: kalenica > okap z osi macierzy), S3 (elementy bram: między tyłem pierzei a domem zamykającym; B6 — kolizja dla bb.min.y < 2), S4 (wieże 60–110 m, na gruncie ≤ groundExtent − 2; ptaki ≥ 13.95 m; nic pod ziemią). Stub `W.mat`, `W.scene`, `ctx.updaters`.
- `rynek/app.js`: bundle rynku (komenda §6 p.3).
- Flagi URL: `?noskyline=1`, `?nofog=1`, `?nobirds=1` (`grep -n "flags\.no\(skyline\|fog\|birds\)" rynek/src/*.js` → layout.js:8, skyline.js:53/55/65).

## WIDOKI (cykl 3; wszystkie obejrzane)
`audyt/testy/out/render/` (poza repo):
- `sky3_on/panorama_N.png` (4,10, yaw 0.15, pitch 0.14): wieża A błękitna z gzymsem i hełmem nad dachami pierzei N; 0 ptaków w tej klatce. `sky3_off/panorama_N.png`: bez wieży.
- `sky3_on/brama_S.png` (0,24, yaw 3.14, pitch 0.12): łuk bramy, blanki, dom zamykający przez łuk.
- `sky3_on/naroznik_NE.png` (−12,12, yaw −0.785, pitch 0.18): 1 ptak, hełm wieży B za wieżą ratusza; widok zdominowany baldachimem — nieużyty do diffu.
- `sky3_on2/start_plac.png` (kontrolny): wieża A (lewa ćwiartka), 2 ptaki, dachy drugiej linii po lewej, brama N w wylocie ulicy. `sky3_off2/start_plac.png` = baza.
- `sky3_on2/ulica_poludnie.png` (0,14, yaw 3.14, pitch 0.08): brama zamyka oś ulicy S.
- `sky3_on2/tlo_N.png` (0,−31, yaw −1.2, pitch 0.15): dom tła z bliska (filar bramy zasłania lewą połowę — słaby kadr, zostawiony jako dowód).
- `sky3_on3/zaulek_N.png` (8,−32.5, yaw −1.57, pitch 0.12): zaułek między tyłami pierzei N a fasadami drugiej linii.
- `sky3_top/top100.png` (ortho 100 m): 26 domów tła wokół pierzei, 4 bramy + 8 baszt na końcach ulic, nic na placu/ulicy.
- `sky3_top/elew_N100.png`, `elew_N60.png` (side 0), `elew_S100.png` (side 2): oglądane PRZED zbliżeniami; wszystkie połacie Λ, wieże A/B/C i brama na policzonych px (wyżej).
- `sky3_nofog/{panorama_N,start_plac}.png`: bez mgły; `sky3_top_nobirds/elew_N60.png`: elewacja bez ptaków.
- maski: `sky3_on/diff_panorama_N.png`, `diff_brama_S.png`, `sky3_on2/diff_start_plac.png`, `diff_ulica_poludnie.png`, `diff_tlo_N.png`, `diff_start_plac_vs_baza.png`, `sky3_off2/diff_start_plac_vs_baza.png`, `sky3_nofog/diff_*.png`.

## BUDŻET (HUD = pass cieni + główny; `__stats` z klatki zrzutu)
| widok | off (noskyline) calls/tri | on calls/tri | Δ |
|---|---|---|---|
| start_plac (inst) | 152 / 818 939 | **156 / 837 743** | +4 / +18 804 |
| start_plac (**noinst**) | 123 / 282 218 (cykl 1) | **123 / 284 426** | +0 / +2 208; errors [] |
| panorama_N | 151 / 827 573 | 155 / 846 377 | +4 / +18 804 |
| brama_S | 60 / 438 227 | 64 / 450 947 | +4 / +12 720 |
| ulica_poludnie | 73 / 512 291 | 77 / 525 011 | +4 / +12 720 |
| tlo_N | 59 / 199 215 | 62 / 211 751 | +3 / +12 536 |
| zaulek_N | 53 / 185 362 | 57 / 198 082 | +4 / +12 720 |
| top100 (ortho) | baza top_60: 186 / 903 323 | 184 / 922 127 | (inny kadr) |
| elew_N100 / elew_S100 / elew_N60 | — | 75 / 483 879; 80 / 526 987; 75 / 483 879 | |
Top-3 `__stats` start_plac: grass_medium_02 156 840, wooden_lantern_01 53 696, wine_barrel_01 51 936 (skany; klucz `far` w tlo_N: 396 tri). `calls ≤ 250` w każdym widoku ✔. `triangles ≤ 700 000`: **NIE w trybie instancji dla start_plac/panorama_N/top** — baza HEAD ma 818 939 (przekroczenie 118 939 odziedziczone, cięcia skanów = motyw #1 §5.2); udział panoramy +18 804 HUD (≈ +9 k realnych). W `noinst` (tryb telefonu) 284 426 ✔. Cel etapu ≤ 600 k HUD nie leży w tym module.

## KOLOR
lineup / hist_roles: n/d (bez zmian w `W.mat` poza nowym kluczem `far` bez tekstury). Sondy w scenie: (1) mgła — 2 pasy bazy #c9d5df / #cbd6df (ΔL 0.003); (2) niebo nad okapami on vs baza L 0.866 / 0.866; (3) wieża A start_plac cień L 0.722 C 0.023 H 238; (4) słońce L 0.768 C 0.018 H 231; (5) niebo obok L 0.860 C 0.020 H 243.5; (6) hełm A panorama_N L 0.769 C 0.019 H 233. Tint `far` [0.62, 0.060, 245] = #688aa8 (inGamut).

## ASERCJE
- `bash audyt/testy/geo_test.sh` (z korzenia worktree): **OK, exit 0**; 7 znanych „uwaga: C kram" (tolerowane); `panorama: domów tła 26, połaci 52, elementów bram 44, wież 3, ptaków 14`; `asercji CHECK nieudanych 0`. KNOWN_B6: brak (B6 z §8 #11 nie istnieje jeszcze na tym branchu; S3 sprawdza B6 dla bram).
- `rot_token.mjs` (`$SP/krytyk2/`, w `tools/` jeszcze nie ma — §8 #11 należy do #12): `skyline.js` exit 0, `layout.js` exit 0 (dług layout.js:7 spłacony).
- grep `Math.sin/cos` poza `ring:` → 0; grep K3 → 0; literały z ułamkiem bez komentarza (vs `claude/repo-cleanup-q1fkk3`) → 0.
- `results.errors: []` we wszystkich 9 renderach (on ×3, off ×2, noinst, ortho ×2, nofog).
- Nowe `check()` w skyline.js: mgła near<far≤camera.far; dom tła: `nearDist ≥ half+depth+0.3`, okap ≥ 3 / kalenica w zakresie; połać: kalenica > okap + 0.5 z TEJ SAMEJ macierzy i końce na ridgeY/eaveY ± 2 cm (K1); okno: `checkInFrontOfWall` ≥ 0.005 (K4) dla fasady i ściany od ulicy; brama: dist między tyłem pierzei + 0.5 a domem zamykającym − 1; filar/baszta `checkCollisionCovers` z tej samej macierzy (K10); łuk ≥ 2 m nad ulicą i w obrysie muru ± 1 cm; wieże: 60–110 m, `reach ≤ groundExtent − 2`, `checkAboveGround`, hełm > gzyms > trzon; ptaki: y w [13.95, 40] ∩ [yMin, yMax].

## DIFF (próg 20)
- z cechą: panorama_N on/off pctOver **3.63 %**, brama_S **28.66 %**, tlo_N 78.27 %, ulica_poludnie 9.69 %, start_plac on/off **4.06 %** (maska: wieża A, dachy drugiej linii, brama N w ulicy, 2 ptaki + cienki szum krawędzi bruku — płaszczyzna 52 → 120 m zmienia precyzję UV; meanDiff 3.75).
- kontrolny: start_plac off vs baza repo **0.02 %** (szum) → bez nieoczekiwanych zmian z wyłączoną cechą; start_plac on vs baza 4.06 % = wyłącznie elementy panoramy + szum bruku.
- mgła: nofog vs fog panorama_N 0.06 %, start_plac 0.14 % (poniżej 0.5 %).

## ZNANE BRAKI
1. **Mgła słabo widoczna**: z parametrami z §5.2 #4 (near 60, far 220) wieże w 80–100 m dostają 13–25 % mgły → ΔL 0.03 na wieży A; diff pctOver 0.06 %. Perspektywę powietrzną robi głównie tint `far`. Nie zmieniałem near/far (liczby z promptu); propozycja dla krytyka: far 220 → 140 dałoby 33–57 % na wieżach przy < 1 % na drugiej linii.
2. **Budżet 700 k tri w trybie instancji** przekroczony już na bazie (818 939); panorama dokłada +18.8 k HUD. Cięcia skanów (§5.2 #1) poza tym motywem. `noinst` 284 426 ✔.
3. **Domy tła rzucają cień** (klucze plaster/roof/stone/glass współdzielone z pierzeją; `CONFIG.noShadowKeys` §8 #17 z motywu #5 nie ma jeszcze na tym branchu). Do przełączenia po scaleniu: osobne klucze `bgPlaster*/bgRoof*` (+~4 draw) i prefiks w `noShadowKeys` (`far` już pasuje do wzoru `^(…|far|…)`).
4. **Ptaki**: 14 na 360° → w kadrze 35° średnio 1.4; `panorama_N` w tym cyklu 0, `start_plac` 2. Kryterium z listy (≥ 3) było błędnie policzone; nie stroiłem liczby ptaków w górę (Points = 1 draw, ale każdy widok statyczny to loteria).
5. **Kwadrat ~13 px dokładnie w środku (511,511) każdej elewacji ortho** — obecny także z `?nobirds=1` (241 ciemnych px w obu) i w elewacji z cyklu 1; nie z tego modułu (sprite/Points o stałym rozmiarze px „przyklejony" do osi kamery ortho — do sprawdzenia w app.js/sky.js/props.js przez właściciela; w widokach perspektywicznych niewidoczny).
6. `tlo_N` to słaby kadr (filar bramy zasłania połowę); lepszy dowód drugiej linii to `zaulek_N` i elewacje.
7. HUD nadal widoczny mimo `noui=1` (§8 #2, motyw #15) — sondy omijają pasek HUD (y ≥ 100 px).
Cykle zużyte: 3/3 (1 i 2 bez zamkniętej weryfikacji, 3 zamknięty).

## Poprawka po rundzie 1 krytyki (reżyseria, „ważny": §5.3 (3) — nad okapem pierzei N samo niebo) — 2026-09-08

**Problem (potwierdzony)**: `etap2_r1/start_v2.png` vs `krytyk_r1_noskyline/start_v2.png` → pctOver 0 %, z kadru znikał tylko ptak. Przyczyny policzone rzutem kamery startowej
(`PerspectiveCamera(70, 412/915)`, oko (4.5, 1.65, 19.5), yaw 0.20, pitch 0.09): (1) domy tła stały tylko przy |along| ≥ 12 m (odcinki A/B), a jedyna luka w kadrze nad
pierzeją N — yaw 0.037–0.165 między lewą krawędzią domu along 6.1 a okapem hełmu wieży (r 4.1) — patrzy na oś ulicy N, gdzie za domem zamykającym (kalenica 13.2 m →
NDC y 0.138) nic nie stało; (2) kalenice 12–17 m w 57 m dawały NDC 0.13–0.25, czyli poniżej kalenic pierzei (0.20 dla 2 pięter … 0.34 dla 4); (3) wieża w oddali A
(a = π + 0.3 → (−26.6, −86), yaw 0.284 ze startu) stała dokładnie za wieżą główną (yaw 0.165–0.344 do wysokości NDC 0.62 na okapie hełmu) — komentarz w config.js liczył
kadr dla starego startu 0.15. Alternatywa krytyka distMin 9 → 5 jest niewykonalna: asercja „wchodzi w pierzeję" (nearDist ≥ 30.3) wymaga setback ≥ 4.3 + d/2 = 7.8–8.8 m.

**Zmiany** (`rynek/src/config.js` sekcja `skyline`, `rynek/src/skyline.js`, `audyt/testy/test_geometria.mjs` S1/S5, `audyt/testy/geo/entry.mjs`):
1. **Tylna linia** `?nobackrow=1` (`secondLine.back`): trzeci odcinek domów tła na osi każdej ulicy, along −12..12 (inner = sw/2 + depth + streetClear), najbliższa ściana
   ≥ tył domu zamykającego (46 m) + 0.3, oś w 46.3–50.3 + d/2 m → 70–76 m od oka startu; 12 domów (3 na ulicę), bez okien bocznych (fasada już patrzy w ulicę).
   Asercje: `check` „tylna linia nie za domem zamykającym" (nearDist, pas |along| + w/2 ≤ 12), S1 w teście (2–5 domów na ulicę, kalenice w zakresie).
2. **Kalenice domów tła 12–17 → 18–22 m** (wszystkie odcinki; §5.2 krytyka): w 57 m NDC 0.26–0.36 → ≥ 0.04 nad 2-piętrowymi domami pierzei; w 72 m (tylna linia) 0.196–0.275
   → +0.06..+0.14 nad domem zamykającym N.
3. **Wieża A** a = π + 0.3 → π + 0.072: (−6.5, −89.8), yaw 0.100 ze startu, hełm ±0.043 rad mieści się w luce 0.037–0.165; szczyt hełmu 53.2 m → NDC y 0.523 (+0.385 nad sylwetką).
4. **Mgła far 220 → 140** (propozycja z ZNANYCH BRAKÓW p.1): tylna linia 65–76 m → 6–20 %, wieża A 109 m → 61 %, kraniec bruku 120 m → 75 %.
5. **`startVisibility(W, houses, towers)`** — funkcja czysta w skyline.js (eksport do bundla testu): kamera jak §5.3, sylwetka 1. linii = odcinki (yaw → NDC y) kalenicy,
   4 krawędzi okapu i 4 krawędzi szczytów każdego domu pierzei (z domami zamykającymi) + wieża główna do szerokości okapu hełmu; element tła „widoczny", gdy próbka kalenicy
   (5 na dom) / szczyt hełmu jest w kadrze (|NDC x| ≤ 0.9, przed kamerą) i ≥ 0.04 NDC nad sylwetką w swoim yaw. `check()` w `skylinePlan`: ≥ 2 domy tła i ≥ 1 wieża
   (`secondLine.startVisible`). Wynik dla seed 7: tło s0 along −15.3 +0.059, along −9.0 tył +0.076, along −1.3 tył +0.060; wieża A +0.385 (na HEAD: 0 i 0). Test S5 loguje listę.

**Widoki** (`audyt/testy/out/render/`; DPR 2, `noui=1&nosmoke=1&nosway=1&nowater=1`):
- `skyfix_on/start_v2.png` — na prawo od wieży głównej blada wieża A (szczyt y ≈ 450 px = NDC 0.51), nad domem zamykającym ulicę N (y 790–850) dach tylnej linii
  (px 440–600, y 720–790), przy lewej krawędzi dach 2. linii nad niskim domem pierzei; fontanna i iglica bez zmian. `skyfix_off/start_v2.png` (`?noskyline=1`) — kontrola.
- `skyfix_on/diff_start_v2.png` — różnice tylko: wieża A, pas dachu tylnej linii, brama, dachy 2. linii po lewej, ptaki.
- `skyfix_on/start_plac.png` — wieża A i dach tylnej linii w tym samym miejscu, reszta kadru bez regresji.
- `skyfix_on2/start_v2_lewo.png` — dachy 2. linii (18–22 m) nad 2–3-piętrowymi domami pierzei N-W (px 0–100 y 580–650; px 230–330 y 650–700).
- `skyfix_on2/ulica_N.png` (0, −24, yaw 0, pitch 0.12) — brama, nad murem dach domu zamykającego, nad nim hełm wieży A i fragment dachu tylnej linii (px 520–700).
- `skyfix_top/elew_N.png` (ortho side 0, 60 m) — 2. linia wystaje nad dachy pierzei N, wieża A za wieżą główną (elewacja patrzy wzdłuż −z). `skyfix_top/top.png` (120 m) utonął
  w mgle (ortho > 60 m) — bez wartości; `skyfix_top2/top_N.png` (70 m, `?nofog=1&boxes=1`, `ortho:{x:0,z:-44}` — x/z trzeba podać W `ortho`, app.js:200) — plan: pierzeja N
  (dół), brama z basztami, dom zamykający (prostokąt kolizji 22 m), za nim 3 domy tylnej linii z luzem od jego tyłu, odcinki A/B po bokach; bez nakładania brył.

**Budżet** (HUD, instancje): start_v2 115 draw / 579 662 → **584 502** tri (+4 840: 12 domów tylnej linii, wyższe bryły tynku bez nowych tri), start_plac 115 / 584 502,
ulica_N 75 / 394 256, start_v2_lewo 113 / 580 184; `?noskyline=1` 113 / 567 522. **noinst** start_v2: 148 / 324 624, errors []. top-3 `__stats` bez zmian (shrub_04_c 55 512,
timber 29 168, periwinkle 27 664). Wszystkie widoki errors [].

**Diff** (próg 20): start_v2 on/off **pctOver 2.54 %** (meanDiff 2.57; kryterium ≥ 0.5 %), start_plac on/off 3.29 %, start_v2 vs `etap2_r1` 1.32 %.

**Asercje**: `geo_test.sh` exit 0 (S1 z tylną linią, S5 nowe; E 0 CHECK); `rot_token.mjs skyline.js` exit 0; liczby bez komentarza w diffie rynek/src: 0.

**Znane braki po poprawce**: wieża A przy far 140 jest bardzo blada (61 % mgły) — czytelna jako sylwetka, do oceny krytyka; „≥ 3 kalenice w sektorze yaw 0.05–0.35"
z propozycji krytyka jest geometrycznie nieosiągalne (sektor to w 90 % wieża główna i luka 9 m szerokości), kryterium zastąpione asercją na całym kadrze (≥ 2 domy + ≥ 1 wieża).
