# Etap 2 — motyw #1 „cięcia skanów" (?nocuts=1) — raport (cykl 2/3; cykl 1 przerwany przed PNG, commit WIP 6b74a99)

ZMIANY:
- rynek/src/config.js — CONFIG.props.noShadow (osobny commit 9cafd74, §8 #8) oraz CONFIG.props.cuts: maxCount { wine_bottles_01: 1, wine_barrel_01: 4 } (limit instancji w put(), nadmiar pomijany w kolejności budowy), scatter { fern_02: 2, grass_medium_02: 0 } (§5.2 #1 / §8 #8: liczba kęp zieleni na model), noShadow [wicker_basket_01, wooden_bowl_02, carved_wooden_plate, hamburger_buns, food_pears_asian_01] (cały towar bez cienia, także drobne modele z audyt/research/zasoby_etap2.md), glassOpacity 0.6.
- rynek/src/props.js — put() liczy wywołania per model i pomija ponad maxCount (losowania ziarna zużyte przed put → reszta sceny bez zmian); pętla kęp zieleni: 14 losowań jak w bazie (ten sam strumień R), z cięciami stawiane tylko pierwsze CONFIG.props.scatter[model] kęp + check „za mało losowań"; materiały z KHR_materials_transmission (4 w wine_bottles_01, 1 w Lantern_01) → transmission 0, transparent, opacity 0.6 + check „materiał z transmisją" (transmisja = WebGLRenderer.renderTransmissionPass: cała nieprzezroczysta scena rysowana 2×; dowód z bazy: grass NO_SHADOW 2 calls / 156 840 tri = 2 × 10 × 7 842); treasure_chest nieładowany i niestawiany (10 332 tri + cień); Lantern_01 przeniesiona z wieka skrzyni na pieniek tree_stump_01 (stumpTop = 0,571 m z bounds; check 0,3–1,2 m i „latarenka szersza niż pół pieńka": 0,122 ≤ 0,71); dług §3.1 spłacony (latarnie przez L(), token ring:), rot: dla szprych i dyszla wozu.
- rynek/app.js — bundle rynku (esbuild, komenda §6 p.3).
- Flaga: ?nocuts=1 (grep flags.nocuts w rynek/src = 1 trafienie) = stan sprzed cięć (skrzynia, latarenka na wieku, 10 traw + 4 paprocie, 8 beczek, 2 zestawy butelek z transmisją).
- Lista „co ma być widać" PRZED kodem: $SP/cuts/lista.md (cykl 1 + uzupełnienie cyklu 2 z liczbami zweryfikowanymi w Node: pieniek 0,571 m, latarenka 0,122×0,294×0,097, butelki 9 prymitywów, tri grass 7 842 / fern 6 232 / beczka 3 246 / skrzynia 10 332 / kosz 4 444).

WIDOKI (audyt/testy/out/render/, wszystkie z noui=1&nosmoke=1&nosway=1&nowater=1, QUALITY=high DPR=2; każdy obejrzany):
- cuts_on/kram_butelki.png (7, 1.5, yaw −0.773, pitch −0.113 → kram i=2 (10.1, −1.7)): na ladzie 1 zestaw = 4 butelki jako szkło alfa, etykiety czytelne, bez czarnych plam; cuts_off: te same 4 butelki z transmisją — różnica tylko w szkle (pctOver 0,43 %).
- cuts_on_k6/kram6.png (−5, 3, yaw 2.407, pitch −0.117 → kram i=6 (−8.7, 7.1)): lada BEZ butelek (tylko misa po prawej); cuts_off_k6: 3 butelki po lewej stronie lady. W głębi pieniek z latarenką.
- cuts_on/skrzynia.png (5, −1 → (9, 0, −7)): bruk bez skrzyni i latarenki (cuts_off: skrzynia z latarenką na wieku + jej cień). Widoczna też zmiana przy murze N-E (kępa trawy/beczka).
- cuts_on/pieniek.png (−13, 13 → (−17, 0.57, 16)): pieniek, na jego wierzchu mała latarenka Lantern_01 (0,29 m, ok. 30×75 px), stoi, nie wisi i nie tonie w pniu.
- cuts_on_b/mur_wsch.png (17, 14, yaw −0.25): u podnóża pierzei wschodniej 0 kęp trawy; cuts_off_b: 1 kępa trawy i beczka wina przy murze (obie wycięte).
- cuts_on_b/start_plac.png (kontrolny): kadr jak w bazie tej gałęzi (wieża #2 WIP, fontanna, kramy); różnice tylko punktowe (pctOver 0,23 %).
- cuts_on_top/top.png (ortho 1024, size 60): 7 kramów w pierścieniu, fontanna, wóz, nic nowego na placu/ulicach; przy pierzejach brak kęp trawy (cuts_off_top: kępy i beczki przy murach). Elewacja: n/d (cecha bez rx/rz i poniżej 4 m; jedyne obroty to istniejące szprychy/dyszel z tokenem rot:).
- cuts_on_noinst/start_plac.png i kram_butelki.png (?noinst=1): obraz identyczny z trybem instancji.

BUDŻET (HUD, tryb instancji; przed = ?nocuts=1 na tej gałęzi):
- start_plac: calls 154 → 87, triangles 825 548 → 337 774 (baza repo 158 / 818 939); shadow 43/179 540 → 40/138 436. Cel etapu ≤ 600 k HUD: spełniony z zapasem 262 k.
- kram_butelki 134/813 526 → 87/341 284; skrzynia 140/847 830 → 74/323 789; pieniek 64/456 299 → 66/250 955; mur_wsch 71/507 971 → 65/277 695; kram6 137/819 298 → 82/348 425; top 181/909 924 → 112/386 063.
- noinst (?noinst=1): start_plac 110 / 216 518 (baza 126 / 271 890), kram_butelki 101 / 194 884; errors [] w obu.
- top-3 __stats start_plac po zmianie: wooden_lantern_01 3/27 232, timber 1/22 576, wicker_basket_01 1/17 776 (przed: grass_medium_02 2/156 840, wooden_lantern_01 4/53 696, wine_barrel_01 2/51 936). wine_bottles_01: 18 → 13 calls (9 prymitywów + 4 szklane DoubleSide transparent rysowane w 2 przebiegach), 40 396 → 17 419 tri.
- Rozbiór oszczędności: zniknięcie przebiegu transmisji ≈ −320 k (każdy nieprzezroczysty obiekt był rysowany 2×), trawa −78 k, skrzynia −10 k + cień, beczki −13 k, paprocie −12 k, cienie koszy/towaru −18 k.

KOLOR: n/d (bez zmian W.mat; szkło butelek: alfa 0,6 zamiast transmisji — obejrzane, bez pomiaru sondą).

ASERCJE: geo_test.sh exit 0 (7 znanych „uwaga" o kołach kramów); rot_token.mjs ($SP/krytyk2) rynek/src/props.js exit 0; grep §2.4 (nowe linie z ułamkiem bez komentarza) = 0; grep §3.1 Math.sin/cos w props.js = 0 poza ring: (stalls.js:10,34 = dług HEAD, moduł nie zmieniany); K3 grep = tylko lista długu (chorągwie, szyld); results.errors: [] we wszystkich 9 renderach (on/off/top/noinst). Nowe check(): „materiał z transmisją (drugi przebieg renderera)", „pieniek: wysokość poza zakresem pieńka" (0,3–1,2; 0,571), „latarenka szersza niż pół pieńka" (0,122 ≤ 0,5·1,426), „scatter: za mało losowań na liczbę kęp z CONFIG.props.scatter".

DIFF (img_diff, próg 20): skrzynia 1,38 % (maska = skrzynia + latarenka + cień + kępa/beczka przy murze), kram6 0,56 % (butelki na ladzie), kram_butelki 0,43 % (tylko szkło — cecha w tym kadrze to zmiana materiału), mur_wsch 0,32 % (beczka + kępa trawy), pieniek 0,09 % (latarenka 0,29 m z 5 m), start_plac kontrolny 0,23 % (punktowe: kępy przy murach, beczki), top 0,05 %. Vs baza repo (audyt/testy/out/render/rynek/start_plac.png): 14,18 % — zdominowane przez okrągłą wieżę motywu #2 (WIP na tej gałęzi) i brak winiety; nie do przypisania cięciom.

ZNANE BRAKI:
- „wine_bottles 18→6" z §5.2 #1 dotyczyło draw calls: 18 = 9 prymitywów × 2 przebiegi (transmisja), nie 18 instancji (w bazie były 2 zestawy); po zmianie 13 calls dla 1 zestawu (4 szklane prymitywy DoubleSide+transparent = 2 przebiegi każdy; do 9 trzeba by forceSinglePass — nie ruszane).
- Cecha jest oszczędnością budżetu, wizualnie drobna: w kadrze kram_butelki pctOver 0,43 % (< 0,5 %); widoki z cechą ≥ 0,5 % to skrzynia i kram6.
- HUD (#hud) widoczny na renderach mimo noui=1 (§8 #2, właściciel #15) — wspólne dla wszystkich motywów.
- Pozycja §8 #8 „CONFIG.props.scatter" nie jest osobnym commitem: osobnym commitem toru jest 9cafd74 (CONFIG.props.noShadow); scatter wszedł z cechą, bo pętla po nim JEST cechą.
- Cykle: 2/3 (cykl 1 = kod + przerwany render; cykl 2 = weryfikacja + scatter).
