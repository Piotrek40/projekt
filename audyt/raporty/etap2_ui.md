# Etap 2 — motyw #15 „UI: ekran startowy, HUD, joystick, podpisy POI, winieta" (`?noui=1`, `?hud=1`)

Worktree `/home/user/wt-b`, branch `feat/tor-b`, PORT 8275. Rendery sceny z `noui=1&nosmoke=1&nosway=1&nowater=1`, QUALITY=high, DPR 2 (824×1830) / DPR 1 (ortho 1024×1024); zrzuty UI osobnym skryptem `audyt/testy/ui_shot.js` (§5.4; 412×915 @2 = 824×1830, QUALITY high, bez flag). Pozycje §8 #2 (`?noui=1` w app.js), #8 (`CONFIG.ui`, `CONFIG.pois`), #16 (winieta w `#vignette`, nie `#touch`) = pierwszy, osobny commit `ad5e47f`. §8 #15 (nowa baza zrzutów) pominięte zgodnie z poleceniem — robi agent po scaleniu.
**Cykle: 2/3** (cykl 1 = `6372d28`: kod UI; `ui_shot.js` uruchamiany 3× tylko z powodu własnych błędów skryptu/pozycji kamer demonstracyjnych. Cykl 2 = weryfikacja na HEAD po commicie fontanny `3922c60` + naprawa znanego braku 1: przycisk „Wejdź" 60 % EKRANU (`vw`), nie kontenera; zrzuty `ui_v4/`, `ui4_noui/`, `ui4_noinst/`, `ui4_top/`).

## Lista „co ma być widać" (spisana PRZED kodem w scratchpadzie `ui/lista.md`, odhaczona na PNG)
1. `start_screen.png` (PRZED „Wejdź", po `__ready`): pełnoekranowa nakładka (scena nie prześwituje), tło `#1a1410` z radialem `#3a2a1a`, ramka 1 px `#b8892e` 8 px od krawędzi (na PNG linia na px ≈ 16), „Rynek Srebrnych Liści" 34 px serif `#e8d9b5` (.04em), „SREBRNY BRÓD · WYBRZEŻE MIECZY" 13 px `#b8892e`, zdanie nastroju 14 px kursywa `#cdbb95`, przycisk „Wejdź" 48 px × 60 % (494 px z 824), `#e8d9b5` na `#2a1e12`, podpis 11 px `#8a7a5a`. **Widać** (`ui_v3/start_screen.png`) ✔ wszystko; zmierzone na PNG (sharp, złota ramka): ramka ekranu x = 16 px (= 8 px CSS ✔), przycisk y 998–1093 = 96 px (= 48 px CSS ✔), przycisk x 194–629 = **436 px = 52.9 % ekranu** — to 60 % KONTENERA po `padding: 24px` (824 − 96 = 728 → 437 px), nie 60 % ekranu (494 px). **Cykl 2** (`ui_v4/start_screen.png`, `--ui-btn-w` w `vw`): przycisk x 164–659 = **496 px = 60.2 % z 824** (cel 494 ± 2 ✔), wys. 998–1093 = 96 px ✔, środek 411.5 (= 824/2 ✔), ramka x 16 ✔; tytuł/kapitaliki/zdanie/podpis bez zmian ✔. `startVisible: true`.
2. `hud.png` (800 ms po tapnięciu, fade 600 ms): bez ekranu startowego (`startHiddenAfterEnter: true`), scena ze startu (4, 19, yaw 0.15), winieta w rogach, bez tekstu fps/draw (`hudHidden: true`), przycisk jakości jako pergaminowa zakładka dół-prawo, bez podpisu POI (karczma d 10.71 > 2r 10.56; `captionAtStart.hidden: true`). **Widać** ✔. Winieta zmierzona (`hud.png` vs `hud_novig.png` — ten sam kadr, `#vignette.hidden`): róg 0,0,40×40 L 0.806 → **0.637 (ΔL −0.169)**, róg 784,0 L 0.791 → 0.623 (ΔL −0.168), róg 0,1790 L 0.473 → 0.389 (ΔL −0.084), środek 392,900 L 0.613 → 0.613 (ΔL 0). `img_diff` hud_novig vs hud: pctOver **14.56 %**, maska `ui_v1/diff_vignette.png` = pas przy wszystkich krawędziach, środek czarny ✔.
3. `caption.png` (0, 6.5): d 6.5 < r 6.9 → „Fontanna pod Srebrnymi Lipami" 16 px serif, dół-środek, płytka z ramką `#b8892e` ✔. `caption_far.png` (−8.6, −6.02; 10.5 m od fontanny ∈ (r, 2r = 13.8), 5.5 m od najbliższego kramu): „podejdź bliżej…" kursywą (`far: true`) ✔. `caption_tower.png` (0, −19; d 9.70 < r 9.95): „Wieża ratuszowa" ✔ (w kadrze głównie dom narożny pierzei N, kamień wieży w prawym górnym rogu — wieża stoi ZA pierzeją, kompozycja to motywy #2/#7).
4. `hud_joy.png`: syntetyczny touchstart (100, 700) + touchmove (130, 690): pierścień 110 px złoty `rgba(184,137,46,.8)`, gałka `#b8892e` przesunięta o (30, −10) ✔ (`joyVisible: true`).
5. `render_scene.js` z `noui=1` (`ui_noui/start_plac.png`): bez winiety — rogi L 0.718 / 0.635 = **identyczne** z `fountain6_on2/start_plac.png` (poprzedni commit, ten sam URL), bez podpisu, bez ekranu startowego; `img_diff` vs `fountain6_on2`: pctOver **0.05 %** (meanDiff 0.12 — ptaki); calls/tri bez zmian ✔.
6. POI z W/CONFIG (test U, `geo_test.sh`): fontanna (0.00, 0.00) r 6.90 d(start) 19.42; wieża (7.00, −25.70) r 9.95 d 44.80 (= `addRect` wieży z tower.js); karczma (−6.28, 22.00) r 5.28 d 10.71 (dom szyldu: side 2, along 6.28, w 6.56); kram (0.18, 11.97) r 3.10 d 8.00 (kram najbliżej startu — do czasu `kind: 'sukiennik'` z motywu #11). Start poza r każdego ✔; wieża osiągalna: punkt placu (7, −21.7) w 4.0 m ≤ r ✔.

## ZMIANY
- `engine/src/app.js` (infra `ad5e47f`): po parsowaniu flag `?noui=1` ustawia `hidden` na `#vignette`, `#caption`, `#start` (elementy opcjonalne — demo bez nich działa).
- `rynek/index.html` (infra): elementy `#vignette` (fixed, inset 0, `pointer-events:none`, `box-shadow: inset 0 0 120px rgba(20,12,6,.45)`, z-index 2), `#caption` (dół-środek, 16 px serif, płytka; `.far` = mniejsza kursywa), `#start` (radial, `.frame` 8 px, h1/sub/mood/`#enter`/hint, `transition: opacity 600ms`, `.out`), style `body.ui` dla `#joy`/`#knob`/`#q` (pergamin); `[hidden]` → `display:none`. Zmienne `--ui-*` z fallbackami = wartości §5.4. Bez klasy `body.ui` (noui) wygląd jak dawniej.
- `rynek/src/config.js` (infra): `pois` (4 wpisy `{name, at, margin}` — pozycje NIE wpisane), `ui` (teksty, font, `size`, `buttonWidth 60`, `frameInset 8`, `fadeMs 600`, `vignetteBlur 120`, `colors` ekranowe CSS, `stallCollide 1.6`).
- `rynek/src/ui.js` (PRZEPISANY ze stuba; cykl 2: `applyTheme` emituje `--ui-btn-w` w `vw` zamiast `%` — 60 % ekranu; `index.html` fallback `60vw`, komentarz w `CONFIG.ui.buttonWidth`): `poiPlan(W)` — funkcja czysta: fontanna (0,0) + `fountain.radius + step.outer`; wieża `W.tower ?? wzór tower.js` (kontrakt dla motywu #2: `W.tower = {x, z, r}`); karczma = ten sam dom co szyld (`props.js buildBanners`), środek lica fasady z `sideTransform(side, along, −depth/2)`; kram = `kind === 'sukiennik'` albo najbliższy startu; `check()`: nazwa/promień, |x|,|z| ≤ `groundExtent`, start poza r, wieża osiągalna z placu. `applyTheme` (zmienne CSS z CONFIG.ui, `body.ui`), `initStart` (teksty, „Wejdź" → `.out` → `hidden` po `fadeMs`; `window.__enter`), `initCaption` (updater w `ctx.updaters`: najbliższy POI wg d/r, DOM tylko przy zmianie), `initUI` (`?noui` return, `?hud=1` pokazuje `#hud`/`#gpu`, `W.pois`, `window.__pois`).
- `audyt/testy/ui_shot.js` (NOWY, §5.4): http-server + Chromium jak `render_scene.js`; `start_screen` (po `__ready`, `__pause`), „Wejdź" → `hud`, `hud_novig` (winieta wyłączona — do sondy), `hud_joy` (syntetyczny TouchEvent), 3 pozycje podpisów przez `__setView` + pętla; `results.json` z flagami DOM i `window.__pois`.
- `audyt/testy/geo/entry.mjs`: eksport `poiPlan`; `audyt/testy/test_geometria.mjs`: asercja **U** (liczba POI, wieża = prostokąt kolizji tower.js, karczma = lico domu szyldu, kram na kramie, fontanna (0,0), start poza r).
- `rynek/app.js`: bundle (komenda §6 p.3).
- Flagi: `?noui=1` (app.js:27, ui.js:84), `?hud=1` (ui.js). Koszt GPU: 0 (DOM).

## WIDOKI (obejrzane; `audyt/testy/out/render/`, poza repo)
- **Cykl 2** (HEAD po `3922c60`): `ui_v4/start_screen.png` — przycisk 496 px (60 %), reszta jak v3; `ui_v4/hud.png` — winieta w rogach (0,0 L 0.806 → 0.637, środek 392,900 L 0.63 = 0.63), zakładka „high", bez licznika; `ui_v4/hud_joy.png` — złoty pierścień + gałka (30, −10); `ui_v4/caption.png` „Fontanna pod Srebrnymi Lipami", `caption_far.png` „podejdź bliżej…", `caption_tower.png` „Wieża ratuszowa" (kadr: dom narożny, jak w cyklu 1); `ui4_noui/start_plac.png` — bez winiety (rogi `#9cadbd` L 0.739 / `#8695a4` L 0.662 = scena), bez podpisu i ekranu, licznik HUD jak dawniej (znane braki 5); `ui4_noinst/start_plac.png` — ten sam kadr w noinst; `ui4_top/top.png` — kramy w pierścieniu, fontanna 3-poziomowa w środku, nic na ulicach.
- `ui_v3/start_screen.png` — ekran startowy: ramka, tytuł, kapitaliki, zdanie nastroju, „Wejdź", podpis sterowania; scena niewidoczna.
- `ui_v3/hud.png` — scena po „Wejdź": winieta w rogach, zakładka „high" dół-prawo, brak licznika, brak podpisu.
- `ui_v3/hud_joy.png` — joystick złoty z gałką przesuniętą w prawo-górę. `ui_v1/hud_novig.png` + `ui_v1/diff_vignette.png` — maska winiety.
- `ui_v3/caption.png` — podpis fontanny; `ui_v3/caption_far.png` — „podejdź bliżej…"; `ui_v3/caption_tower.png` — podpis wieży (kadr: dom narożny + kamień wieży w rogu).
- `ui_noui/start_plac.png` (kontrolny, noui) — jak `fountain6_on2`; `ui_noinst/start_plac.png` (telefon); `ui_top/top.png` (ortho 60 m) — kramy w pierścieniu, nic nowego na placu (UI nie ma geometrii).

## BUDŻET (HUD = pass cieni + główny; `__stats`)
| widok | przed (raport #8) | po (noui) | Δ |
|---|---|---|---|
| start_plac (inst) | 159 / 852 371 | **159 / 852 371** | 0 / 0 |
| start_plac (**noinst**) | 124 / 294 472 | **124 / 294 472** | 0 / 0; errors [] |
| top (ortho 60) | 187 / 936 755 | 187 / 936 755 | 0 / 0 |
| **cykl 2** start_plac (inst) `ui4_noui` | 158 / 852 371 (`f8v_final`) | **158 / 852 371** | 0 / 0; errors [] |
| **cykl 2** start_plac (noinst) `ui4_noinst` | 123 / 294 472 (`f8v_noinst`) | **123 / 294 472** | 0 / 0; errors [] |
| **cykl 2** top `ui4_top` | 186 / 936 755 | **186 / 936 755** | 0 / 0; errors [] |
Top-3 `__stats` start_plac: grass_medium_02 156 840, wooden_lantern_01 53 696, wine_barrel_01 51 936. `calls ≤ 250` ✔; `triangles ≤ 700 000`: w `noinst` (telefon) ✔ 294 472, w trybie instancji NIE (odziedziczone 852 371 — cięcia skanów = motyw #1; UI 0 tri).

## KOLOR
lineup / hist_roles: n/d (bez zmian `W.mat`). Sondy (color_probe, `hud.png` vs `hud_novig.png`, ten sam kadr): róg 0,0 `#afc2d5` L 0.806 → `#828c98` L 0.637; róg 784,0 L 0.791 → 0.623; róg 0,1790 L 0.473 → 0.389; środek 392,900 `#95806d` L 0.613 → 0.613 (winieta nie sięga środka). `ui_noui/start_plac.png` rogi `#96a6b5` L 0.718 / `#7e8c9a` L 0.635 = `fountain6_on2` co do bajtu.

## ASERCJE
- `bash audyt/testy/geo_test.sh`: **OK, exit 0**; 7 znanych „uwaga: C kram"; nowy wiersz `POI: …` (liczby w p.6); `asercji CHECK nieudanych 0`.
- `rot_token.mjs`: w `tools/` nie ma (§8 #11 należy do #12); ui.js nie ma `L()`/`M4`/`place` z obrotem — n/d. grep `Math.sin/cos` w ui.js → 0; K3 → 0; ułamki bez komentarza (`git diff -U0 0e52577 -- rynek/src`) → **0**; hex poza config → 15 = lista długu §4.3.6 (ui.js na liście wyjątków, ale kolory i tak w CONFIG.ui); `check_test.mjs` → 7 oczekiwanych FAIL (check.js nietknięty).
- `results.errors: []` we wszystkich: `ui_noui`, `ui_noinst`, `ui_top`, `ui_shot` v1–v3; cykl 2: `ui_v4` (ui_shot), `ui4_noui`, `ui4_noinst`, `ui4_top`. `geo_test.sh` na HEAD `3922c60` i po poprawce: OK, exit 0 (7 znanych „uwaga"). Ułamki bez komentarza w nowych liniach (`git diff -U0 0e52577 -- rynek/src`): 0. `rot_token.mjs` nadal nie ma w `tools/` (§8 #11 = #12) — ui.js bez obrotów, n/d.
- Nowe `check()` w `poiPlan`: „POI bez nazwy lub promienia", „POI poza światem" (≤ groundExtent), „POI podpisany już na starcie (start w r)", „wieża nieosiągalna w promieniu podpisu"; test U w `test_geometria.mjs`.
- K13: liczby z §5.4 przepisane do CONFIG.ui 1:1; pozycje POI nie z promptu, tylko z W (test U porównuje z kolizją wieży i domem szyldu); kamery demonstracyjne policzone wzorem §3.6 (yaw −2.182, −0.807).

## DIFF (próg 20)
- z cechą: `hud.png` vs `hud_novig.png` (winieta) **14.56 %** (maska: pas przy krawędziach); ekran startowy vs scena = 100 % z definicji (nakładka nieprzezroczysta).
- **cykl 2**: `ui_v4/hud` vs `hud_novig` **14.57 %** (winieta); `ui4_noui/start_plac` vs `f8v_final/start_plac` (HEAD fontanny, ten sam URL) **0.07 %** (meanDiff 0.26 — ptaki), vs `ui_noui` (cykl 1) 0.10 %, vs baza repo 9.07 % (jak w raporcie #8); `ui4_top/top` vs `ui_top/top` **0 %**.
- kontrolny (noui, cykl 1): `ui_noui/start_plac` vs `fountain6_on2/start_plac` **0.05 %** (ptaki); `ui_top/top` vs `fountain6_top/top` 0.02 %; vs baza repo 9.08 % (= panorama + girlandy + fontanna z poprzednich motywów, jak w raporcie #8).

## ZNANE BRAKI
1. ~~Przycisk „Wejdź" 60 % kontenera (437 px), nie ekranu~~ — NAPRAWIONE w cyklu 2 (`vw`): 496 px = 60.2 % z 824 (zmierzone `ui_v4/start_screen.png`).
2. `caption_tower.png`: podpis działa, ale kamera w r wieży stoi 3 m od pierzei N, więc w kadrze jest dom narożny; wieża wchodzi w plac dopiero po motywie #2 (tz + R = −20). Kontrakt dla #2: `W.tower = {x, z, r}` — wtedy fallback ze wzorem tower.js w ui.js przestaje być używany.
3. Kram sukiennika = kram najbliżej startu (0.18, 11.97) do czasu `kind: 'sukiennik'` (motyw #11) / repoussoir z #7; nazwa podpisu już właściwa.
4. Podpis w `2r` pokazuje tylko „podejdź bliżej…" (bez nazwy) — literalnie wg §5.4; jeśli ma być z nazwą, jeden tekst w CONFIG.ui.near.
5. HUD fps/draw (`#hud`, `#gpu`) i przycisk `#q` w renderach `noui=1` zostają jak dawniej (żeby `img_diff` vs stare bazy = 0); ukrywa je tylko warstwa UI (bez `?hud=1`). Nowa baza zrzutów (§8 #15) — po scaleniu.
6. Czcionka: w headless Chromium serif fallback (nie Noto Serif) — na telefonie Noto Serif; metryki tekstu mogą się różnić o kilka px.
