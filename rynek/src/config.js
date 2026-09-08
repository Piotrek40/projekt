// Konfiguracja rynku: cała skala, paleta i tekstury w jednym miejscu. Reguły generatora czytają tylko stąd.
export const CONFIG = {
  seed: 7,
  // klucze W.B (regex), które NIE rzucają cienia (Batch.build w geometry.js): nowe małe/cienkie obiekty — girlandy, lampiony, strumienie, mokry bruk, wieże w oddali, tarcza zegara, szyld, chorągwie
  noShadowKeys: '^(bunting|paperLit|jet|wet|water|ripple|far|clock|sign|banner)', // + lustra wody i kręgi (motyw #8): płaskie dyski, cień bez sensu
  // kolejność rysowania kluczy W.B przezroczystych (Batch.build opts.renderOrder; domyślnie 0): three sortuje przezroczyste po odległości ŚRODKA obiektu,
  // więc lustro wody (opacity 0.85, środek wyżej) rysowało się PO kręgach i strumieniach i przykrywało je (motyw #8, cykl 4) — kręgi i strumienie po wodzie
  renderOrderKeys: { water: 0, jet: 1, ripple: 2 },
  plaza: { size: 44, streetWidth: 6, streetLength: 16 },
  house: { depth: 8, floorHeight: 2.9, groundFloor: 3.2, jetty: 0.35, roofPitch: 0.85, overhang: 0.55, widthMin: 6, widthMax: 9.5, floorsMin: 2, floorsMax: 3, // wymiary bazowe (słownik skali §3.7)
    // motyw #3 „różne wysokości i spadki" (?noheights=1 przywraca floorsMax 3 oraz floorHeight 2,9 / roofPitch 0,85 dla wszystkich domów):
    // liczba pięter 2–4 z ziarna głównego, wysokość kondygnacji i spadek per dom z ziarna domu; sąsiednie domy nigdy z tą samą liczbą pięter
    vary: { floorsMax: 4, floorHeight: [2.7, 3.1], roofPitch: [0.7, 1.0], minDistinctFloors: 3 }, // zakresy §5.2 #3; minDistinctFloors: pierzeje mają ≥ 3 różne liczby pięter
  },
  // wieża ratusza — motyw #2 „okrągła wieża 36 m" (tor „wieża i panorama"; ?notower2=1 przywraca starą kwadratową: size/height/roofHeight)
  tower: {
    size: 7, height: 15, roofHeight: 6,                 // stara kwadratowa (tylko z ?notower2=1)
    rTop: 3.2, rBot: 3.5, trunkH: 24, seg: 16,          // trzon: walec zbieżny (słownik skali §3.7: R 3,2, podstawa 3,5, trzon 24), 16 segmentów
    roofH: 9, roofR: 4.1, spireH: 3, ballR: 0.3,        // stożek 9 m (okap r 4,1 = 0,5 m za gzyms), iglica 3 m, kula r 0,3 → 24 + 9 + 3 = 36 m
    streetGap: 0.5, plazaIn: 2,                         // tx = −(sw/2 + rTop + 0,5) = −6,7 (0,5 m na zachód od ulicy N); tz = −half − rTop + 2 = −23,2 (trzon 2,0 m w placu, podstawa 2,3 m)
    houseGap: 0.3,                                      // przerwa krawędź ostatniego domu pierzei N-W ↔ obrys podstawy: limit krawędzi = tx − rBot − 0,3 = −10,5
    bands: [8, 15, 21], bandH: 0.4, bandOut: 0.15,      // pasy blocks: y środka, grubość, wysunięcie za lico (r trzonu tam 3,40 / 3,31 / 3,24)
    buttresses: 6, buttressW: 0.9, buttressSteps: [[3.5, 1.2], [5.4, 0.9]], // przypory co 60° od 30° (drzwi na 0°); stopnie [wysokość, głębokość radialna]
    buttressIn: 0.25,                                   // wsunięcie tyłu przypory w trzon (16-kąt: lico ścianki 0,981·r, przy rogu 0,9 m przypory jeszcze 0,11 głębiej)
    windowRows: [5.9, 10.2, 15.7, 21.6], windowW: 0.75, windowH: 1.65, // okna łukowe: y spodu (nad przyporami 5,4; między pasami), szerokość, wysokość z łukiem
    frameW: 0.18, frameOut: 0.15, frameIn: 0.15,        // oprawa łukowa blocks: szerokość, wysunięcie przed lico, zatopienie tyłu w murze
    glassOut: 0.02,                                     // szkło 2 cm przed licem (test D: |dist − rAt| ≤ 0,05)
    clock: { y: 18.6, r: 1.4, hour: 4, backR: 1.55, backT: 0.4, out: 0.035, // tarcza na S: środek y, promień; podkład blocks r 1,55 gr. 0,4; tarcza 3,5 cm przed licem (1,5 cm przed podkładem)
      face: [0.92, 0.03, 85], ring: [0.35, 0.02, 60], hands: [0.25, 0.02, 60] }, // kolory OKLCH: krem, ciemny brąz pierścienia, wskazówki
    corniceH: 0.6, corniceOut: 0.4, corniceIn: 0.1,     // gzyms pod dachem: wysokość, promień góry rTop+0,4, dołu rTop+0,1 (tuż pod y = trunkH)
    door: { w: 1.6, h: 2.8, frameW: 0.3, frameOut: 0.25, archH: 3.3 }, // portal S: drzwi (słownik: wieża 2,8 × 1,6), oprawa 0,3 wystająca 0,25, łuk do 3,3 m
    flag: { w: 1.2, h: 0.8 },                           // chorągiew u szczytu iglicy (banner2)
    yardWall: { h: 2.6, t: 0.4, zOff: -4.3 },           // mur zamykający przerwę za wieżą (od krawędzi domu do 0,2 m przed ulicą), z = tz − 4,3 = −27,5 (za obrysem podstawy −26,7)
    // dach: klucz W.mat.roofTower z materials.js — tint i zestaw w paletteOKLCH.tint.roofTower (motyw #9: [0.72, 0.085, 185] na stone_tiles_02), parametry w paletteOKLCH.params
  },
  // fontanna 3-poziomowa (fountain.js, motyw #8). Flagi: ?nofountain=1 (stara cembrowina ośmiokątna), ?nojets=1 (bez strumieni, rozbryzgu i kręgów),
  // ?nowet=1 (bez mokrego bruku), ?nowater=1 (woda/strumienie/kręgi statyczne). Wysokości bezwzględne (m, bruk y=0): obrzeże basenu rim; krawędź misy i
  // = rim + bowls[i].top; posąg stoi na rim + columnHeight + 0.35 (literał w props.js placeStatue = plinth.h), więc columnHeight MUSI być = top ostatniej misy (check w fountain.js).
  fountain: {
    radius: 3.2, rim: 0.75, columnHeight: 2.4, blockScale: 1.1,   // r zewn. basenu, obrzeże, krawędź górnej misy nad brukiem = 3.15, skala tekstury blocks (m/kafel)
    seg: 24, seedOffset: 800,                  // segmenty LatheGeometry/walców (dawniej 8 = widoczny ośmiokąt); własny rng dla rozbryzgu
    basin: { wall: 0.4, lip: 0.12, lipH: 0.1, floor: 0.4, waterBelowRim: 0.1 }, // ściana 0.4 (r wewn. 2.8), obrzeże wystaje 0.12 na górnych 0.1 m, dno y 0.4, lustro 0.1 pod obrzeżem (y 0.65)
    step: { h: 0.18, inner: 1.1, outer: 1.2 }, collide: 1.0,       // schodek r+1.1 / r+1.2 (jak dawniej), koło kolizji r+1.0 (gracz wchodzi 0.2 m na schodek — jak dawniej)
    columns: [0.45, 0.38, 0.32],               // promienie: basen→misa 1, misa 1→misa 2 (0.35–0.5 wg §5.2 #8), trzpień pod płytą posągu (cieńszy — niesie tylko płytę)
    bowls: [{ r: 1.8, depth: 0.3, top: 1.0 }, { r: 0.9, depth: 0.25, top: 2.4 }], // top = krawędź nad obrzeżem basenu (1.75 / 3.15 m nad brukiem); depth od krawędzi do spodu
    bowlShape: [[0.55, 0.8], [0.85, 0.35]],    // węzły profilu spodu misy jako ułamki (r, depth): od dziury pod kolumną do krawędzi
    bowlWall: 0.06, bowlWaterBelowRim: 0.08, waterInset: 0.02, holeInset: 0.03, sink: 0.04, // ścianka misy; lustro 0.08 pod krawędzią; lustro 0.02 od ściany; dziura 0.03 mniejsza od kolumny; kolumna zatopiona 0.04 w dnie/spodzie
    plinth: { h: 0.35, capR: 0.7, capH: 0.1 }, // trzpień + płyta = 0.35 (= props.js); płyta r 0.7 pod podstawą posągu 1.92 × 1.27 m (bounds ×11.8)
    // strumienie: 8 z krawędzi dolnej misy, 4 z górnej; QuadraticBezierCurve3(start na krawędzi, punkt kontrolny ctrlOut/ctrlUp za krawędzią, lądowanie landOut na lustrze niżej)
    jets: { count: [8, 4], r: 0.035, seg: 10, radial: 5, startIn: 0.04, startUp: 0.02, ctrlOut: [0.35, 0.35], ctrlUp: [0.45, 0.45], landOut: [0.7, 0.5], // lądowanie r 2.5 (basen r wewn. 2.8) / 1.4 (misa r wewn. 1.74)
            speed: 1.8, texRepeat: 3, opacity: 0.6, roughness: 0.2, envMapIntensity: 1.0, color: [0.93, 0.03, 215] }, // map.offset.x −= dt·speed (uv.x wzdłuż rury); tint jasny błękit OKLCH
    splash: { perJet: 40, size: 0.12, up: 2.0, out: 0.6, rate: 1.4, life: 0.6, opacity: 0.85, color: [0.70, 0.04, 230], renderOrder: 3 }, // Points: kropla 0.12 m, w górę ≤ 2.0 m/s (h = v²/2g = 20 cm — ponad lustro, na tle ściany/kolumny), w bok ≤ 0.6; cykl 0.6 s; cykle 1–2: 0.07–0.09 białe, 7 cm → niewidoczne na białej wodzie
    ripple: { rIn: 0.33, rOut: 0.45, seg: 16, perJet: 2, above: 0.01, speed: 0.6, minScale: 0.25, opacity: 0.85, color: [0.35, 0.04, 240] }, // pierścień 0.33–0.45, 2 na lądowanie (faza co ½), 0.01 nad lustrem (K5), skala 0.25→1 w 1/0.6 s, alfa 1→0; cykl 1: 0.05–0.45 biały = dysk niewidoczny; cykl 2: L 0.70/0.5 → ΔL 0.03 na lustrze L 0.76; cykl 4: lustro rysowane po kręgach przykrywało je (→ renderOrderKeys); cykl 5: L 0.50/0.6 ledwo widoczne → ciemniej i mocniej
    wet: { r: 5.2, rFull: 4.6, seg: 32, y: 0.005, color: [0.55, 0.012, 80], roughness: 0.4 }, // mokry bruk: cobble tint L 0.55 (suchy 0xb9b3aa = L 0.75), gładszy; y 0.005 + polygonOffset; pełne krycie do r 4.6, zanik alfa do 0 na r 5.2 (cykl 2: ostra krawędź)
    water: { envMapIntensity: 0.8, drift: [0.02, 0.013] }, // własny envMap (§4.1.9); cykl 1: 1.2 → lustro basenu L 0.74–0.80 C < 0.01 (białe, tint H 200 znika, kręgi niewidoczne); dryf normal mapy jak dawniej
  },
  stalls: { count: 7, ringRadius: 11.5, ringJitter: 1.5, collideR: 1.6,   // pierścień kramów R ± ringJitter (jak HEAD: R.range(−1,5, 1,5)); koło kolizji kramu (HEAD: 1,6)
    // motyw #11 „role kramów" (?nokinds=1 = stary placeGoods bez ról, bez szyldów kramów, nowe modele nieładowane). Kram i dostaje kinds[i % kinds.length]
    // (kolejność = kolejność kramów: kram 0 = repoussoir z §5.3 = sukiennik, POI „Kram sukiennika" w ui.js). cloth = baldachim (te same klucze, które seed 7
    // losował na HEAD → kadr startowy bez zmiany barw); sign = kafelek atlasu szyldów (houseDetail.sign.tiles + extraTiles); goods = [model, skala] w gniazdach
    // lady (slotX); bales = bele sukiennika (W.B, klucze cloth*, 0 draw); ground = [model, skala] na ziemi przy tylnym słupie; back = zaplecze zamiast losowania.
    kinds: [
      { name: 'sukiennik', cloth: 'cloth2', sign: 'nożyce', bales: ['cloth0', 'cloth1', 'cloth3', 'cloth2', 'cloth1'], ground: ['wicker_basket_02', 1.3] },   // kosz ×1,3 = 0,45 × 0,26 m (bounds 0,35 × 0,20)
      { name: 'piekarz',   cloth: 'cloth1', sign: 'bochen', goods: [['hamburger_buns', 1.6], ['wooden_bowl_01', 1], ['hamburger_buns', 1.6]], ground: ['wicker_basket_02', 1.3] },   // bułki ×1,6 (zasoby_etap2.md: 0,40 → 0,64 m)
      { name: 'owocarz',   cloth: 'cloth2', sign: 'jabłko', goods: [['food_pears_asian_01', 1.3], ['wicker_basket_02', 1], ['food_pears_asian_01', 1.3]], ground: ['wicker_basket_02', 1.3] },   // gruszki ×1,3 (0,16 → 0,21 m), ≤ 3 instancje
      { name: 'garncarz',  cloth: 'cloth0', sign: 'dzban',  goods: [['ceramic_vase_01', 1], ['ceramic_pot', 0.7], ['ceramic_vase_02', 1]], ground: ['ceramic_pot', 0.85] },   // garnek 0,66 m: ×0,7 na ladzie (0,46), ×0,85 na ziemi (0,56)
      { name: 'kotlarz',   cloth: 'cloth3', sign: 'młot',   goods: [['brass_pot_01', 1], ['brass_vase_01', 1], ['brass_pot_01', 1]] },
      { name: 'zielarz',   cloth: 'cloth1', sign: 'liść',   goods: [['wooden_bowl_01', 1], ['wicker_basket_02', 1], ['wooden_bowl_01', 1]], ground: ['wicker_basket_02', 1.3] },   // misy ziół + kosz
      { name: 'winiarz',   cloth: 'cloth3', sign: 'kielich', goods: [['wine_bottles_01', 1], ['ceramic_vase_01', 1], ['wooden_bowl_01', 1]], back: 'wine_barrel_01' },
    ],
    // liczby towaru (lokalne kramu: początek na środku lady na ziemi, +z = front; blat = ch + 0,04 = 0,99 ze stalls.js). seedOffset: własny strumień rng na jitter
    // i obrót towaru (W.R zużywa tyle samo losowań co stary placeGoods → reszta sceny bez przetasowania). Bele: przekrój w × w, długość len wzdłuż z (lada 1,0 →
    // 5 cm zwisu z każdej strony), rzędy 3 + 2 w rozstawie step (górna bela x = ±step/2 zachodzi na dwie dolne po step − w = 0,12 → 0,08 m przekrycia — policzone).
    // Szyld kramu: w × h z atlasu na zwisie baldachimu — środek below pod belką frontową (ph − below = 2,03: spód 1,87, wierzch 2,19 < spód belki 2,20), out przed
    // płótnem zwisu (z 1,12 + 0,04 = 1,16 > lico belki 1,15). Kosz/garnek na ziemi: (∓x, z) przy tylnym słupie po stronie przeciwnej niż zaplecze
    // (|p| 1,24 + r 0,23 = 1,47 ≤ collideR 1,6). overhang: towar może wystawać ≤ 0,15 m poza blat (check z W.bounds).
    goods: { seedOffset: 1100, slotX: [-0.8, 0, 0.8], z: -0.05, jitter: 0.1, overhang: 0.15, models: ['hamburger_buns', 'food_pears_asian_01', 'ceramic_pot', 'brass_pot_01', 'brass_vase_01', 'wicker_basket_02'],   // models: nowe modele (zasoby_etap2.md) ładowane tylko z rolami
      bale: { w: 0.28, len: 1.1, step: 0.4, rows: [3, 2] }, sign: { w: 0.52, h: 0.32, below: 0.27, out: 0.04 }, ground: { x: 0.95, z: -0.8 } },   // bele §5.2 #11 (0,28 × 0,28 × 1,1); szyld 0,52 × 0,32 = proporcja okna atlasu 256 × 158
  },
  lanterns: { count: 8, ringRadius: 15.5 },
  // sunColor: motyw #9, hipoteza (a) §4.4 zaliczona na lineupie (lineup_v1_sunA, 2026-09-07): przy 0xfff1e0 (C 0,027) plaster4 w słońcu H 219 (≥ 180), roof2 H 231 (≥ 200),
  // plaster0 C 0,025 (≥ 0,025), tynk słońce/cień 0,803/0,589 = 1,36 (≥ 1,3); przy 0xffd6a6 chłodne tynki żółkły (plaster4 H 145 C 0,006). Predyktor: agx_predict.mjs SUN.
  sky: { file: 'sky_1k.hdr', environmentIntensity: 0.6, sunIntensity: 5.0, sunColor: 0xfff1e0, minElevationDeg: 30, rotation: -0.25, shadowExtent: 22 }, // reszta jak HEAD
  // STARA paleta (heksy sprzed motywu #9) — tylko ?nopalette=1 (materials.js/props.js czytają ją zamiast paletteOKLCH); długości tablic plaster/roof/cloth
  // = liczba wariantów (layout.js losuje indeksy). Heksy sprzed motywu przeniesione tu z materials.js:9-27, :53-67 i props.js:87,179 (dług §4.3.6).
  palette: {
    plaster: [0xe3d3b2, 0xd6c39d, 0xe8dfcf, 0xc9b58f, 0xdcc7b4],
    roof: [0xb8734f, 0xa0654a, 0x8d5a45],
    cloth: [0x8c1f28, 0x1f4d3a, 0xc98a1b, 0x2b3a6b],
    timber: 0x5a4030,
    stone: 0xcfc6b8,
    water: 0x2f5a63,
    cobble: 0xb9b3aa, slates: 0xb8b4ae, door: 0x6b4a33, planks: 0xffffff, blocks: 0xffffff, glass: 0x1a222c, glassLit: 0x3a2a14, glassLitEmissive: 0xffb257, iron: 0x2b2b2e, flame: 0xffc070,
    roofTowerOKLCH: [0.75, 0.085, 200],                  // stan po motywie #2 (miedź z patyną na slates, roughness/metalness jak paletteOKLCH.params.roofTower)
    gold: 0xd9b34a, signBg: 0x3a2718, signBoard: 0x5a4030, silver: 0xd0d3d9, // pas/emblemat chorągwi (heraldry), tło i deska szyldu (signTexture); silver: liść herbu (atlas #10b)
    lanternLight: 0xffa452, smoke: 0xd8d2c8,             // PointLight latarni, cząstki dymu
  },
  // ---- sekcje Etapu 2 (każdy tor pracy wypełnia TYLKO swoją; kolory jako OKLCH [L, C, H] przez oklch() z color.js) ----

  // tor „paleta" — motyw #9 „Złota godzina nad Rynkiem Srebrnych Liści" (rynek/PROMPT.md §4.4; ?nopalette=1 = stara paleta wyżej).
  // Każdy tint jako [L, C, H, zestaw tekstur] (zestaw = klucz CONFIG.textures albo 'none' dla materiałów bez mapy); hex TYLKO przez oklch() z color.js
  // (materials.js), predykcja ekranu: audyt/testy/tools/palette_predict.mjs (czyta tę tabelę), pomiar: measure_render.mjs na lineupie (?lineup=1).
  // Cele ekranowe z predyktora (kula dotNL 1 / fasada N 0,71 / cień z AO) i reguły §4.2: rodzin 6 (≤ 7), tynki fasada N L 0,70–0,73 (ΔL 0,035),
  // mediana tynków − dachówek 0,213 (≥ 0,15), dach − belki 0,109 (≥ 0,08); chłód w cieniu plaster4 C 0,035 H 238, roof2 C 0,036 H 244.
  paletteOKLCH: {
    tint: {
      cobble:    [0.80, 0.010, 240, 'cobble'],   // bruk: neutralny z chłodnym H (na ochrowym bruku ekran H ~73; hipoteza (f): wrócić do H 80, jeśli zielonkawy)
      stone:     [0.82, 0.015, 80,  'stone'],    // parter kamienny (fasada N L 0,56)
      blocks:    [0.80, 0.012, 85,  'blocks'],   // fontanna, pasy i przypory wieży, schodki szczytów (L 0,59)
      slates:    [0.80, 0.012, 85,  'slates'],   // trzon wieży (jak blocks — jedna rodzina kamienia)
      timber:    [0.60, 0.045, 55,  'timber'],   // belki dębowe: albedo L 0,28 (HEAD 0x5a4030: 0,19 — czarne); §4.4 dawał 0,70, ale walor dach − belki wychodził 0,055 < 0,08 (predyktor z env HDRI) → 0,60: fasada N L 0,48, dach połać 0,58 − 0,48 = 0,10
      planks:    [1.00, 0.000, 0,   'planks'],   // deski wozu i lad bez tintu (jak na HEAD)
      door:      [0.55, 0.045, 55,  'planks'],   // drzwi: ciemniejszy dąb na weathered_planks (albedo L 0,22 ≥ 0,20)
      plaster0:  [0.90, 0.030, 85,  'plaster'],  // kremowy
      plaster1:  [0.92, 0.012, 90,  'plaster'],  // biel wapienna (wariant po L, nie po H)
      plaster2:  [0.86, 0.060, 145, 'plaster'],  // szałwiowy (limit C 0,06 dla H 130–260; w słońcu H ~104, w cieniu 148)
      plaster3:  [0.87, 0.050, 15,  'plaster'],  // różany (C 0,05 = limit tynku; dom z plaster3 dostaje zawsze roof2 — layout.js)
      plaster4:  [0.86, 0.060, 240, 'plaster'],  // gołębi (w słońcu neutralny H ~130, w cieniu C 0,035 H 238)
      roof0:     [0.70, 0.100, 40,  'roof'],     // dachówka ciepła (połać 0,86: L 0,55)
      roof1:     [0.64, 0.070, 45,  'roof'],     // dachówka zgaszona (połać 0,86: L 0,50)
      roof2:     [0.70, 0.050, 250, 'tiles'],    // łupek chłodny na stone_tiles_02 (neutralny w słońcu, cień C 0,036 H 244; udział slateShare)
      roofTower: [0.72, 0.085, 185, 'tiles'],    // miedź z patyną na stone_tiles_02 (kula H 157, cień H 191; na slates wychodziła oliwka)
      paint0:    [0.62, 0.070, 170, 'timber'],   // okiennice: zieleń butelkowa (rodzina patyny), na old_planks_02 (mnożnik 0,459)
      paint1:    [0.62, 0.090, 25,  'timber'],   // okiennice: bordo
      paint2:    [0.64, 0.060, 255, 'timber'],   // okiennice: indygo-szary
      cloth0:    [0.45, 0.130, 320, 'none'],     // purpura (akcent chłodny)
      cloth1:    [0.58, 0.100, 190, 'none'],     // morski turkus (max gamutu C 0,101)
      cloth2:    [0.72, 0.150, 78,  'none'],     // szafran
      cloth3:    [0.50, 0.170, 25,  'none'],     // karmazyn
      water:     [0.50, 0.070, 200, 'none'],     // woda fontanny (odbicie nieba przez environmentIntensity — §4.1.9)
      glass:     [0.25, 0.020, 250, 'none'],     // szkło ciemne (= #1a222b, jak HEAD 0x1a222c)
      iron:      [0.30, 0.005, 250, 'none'],     // żelazo (= #2c2e30 ≈ HEAD 0x2b2b2e)
    },
    params: { roofTower: { roughness: 0.55, metalness: 0.2 } },   // miedź: lekko metaliczna, matowa patyna (jak po motywie #2)
    // emisja (wprost do AgX, §4.1.6): płomień = nasycony pomarańcz × 1,6 (pred. ekran #e9a878 C 0,10; #ffc070 ×1 dawało beż #d2b691); okna świecące bez zmian
    emit: { flame: { color: [0.72, 0.185, 49], intensity: 1.6 }, glassLit: { color: [0.30, 0.042, 74], emissive: [0.82, 0.139, 68], intensity: 1.6 } }, // = #fd7a1b (≈ #ff7a1a z §4.4, który jest 0,002 poza gamutem), #3a2a14, #ffb257
    // kolory canvasów (CanvasTexture, sRGB): złoty pas/emblemat chorągwi i ramka szyldu (= #d9b34a), tło i deska szyldu (= #3a2718, #5a4030)
    canvas: { gold: [0.78, 0.129, 89], signBg: [0.29, 0.038, 59], signBoard: [0.40, 0.045, 53], silver: [0.86, 0.010, 250] },   // OKLCH z hexToOklch dawnych heksów (materials.js HEAD); silver: srebrny liść herbu miasta (atlas szyldów, motyw #10b)
    lanternLight: [0.80, 0.145, 60],   // PointLight latarni (= #ffa452)
    smoke: [0.87, 0.015, 81],          // cząstki dymu (= #d8d2c8)
    slateShare: 0.3,   // udział domów z roof2 (łupek): kwota round(slateShare·N) z ziarna (layout.js assignRoofs); dla seed 7: 8 z 28 domów (3 plaster3 + 5 losowych)
  },

  // tor „paleta" — motyw #9 okiennice (?noshutters=1; buildings.js shutters()): skrzydła box(wing, wh, t) w paint0..2 (jeden kolor na dom, strumień
  // rng(seedLocal + 6)), uchylone OD ściany o kąt open (ry = −s·open: s=−1 → ry=+0,25: zewnętrzny koniec (−0.125,0,0) → (−0.121, 0, +0.031), zawias → z −0.031 — policzone),
  // środek x = cx ± (ww/2 + gap + wing/2·cos open) (0,516 przy ww 0,75), z = lico ramy + t/2 + gap/2 + wing/2·sin open (= front + 0,131): tył przy zawiasie na front + 0,08,
  // wolny koniec na front + 0,162. Piętra: tylko okna w polach BEZ zastrzału i polach szerszych niż 2·(ww/2 + gap + wing/2·cos open + wing/2 + postClear)
  // = 1,442 m (|sx − postX| ≥ 0,125 + 0,08: 0,234 przy polu 1,50; pole 1,44 przy w 7,2 m odpada); okno zwężone do ww. Parter: ww/wing z `ground`,
  // tylko gdy zewnętrzny skraj skrzydła + edgeGap mieści się w szerokości domu. Udział share okien (osobny strumień → r() domu bez zmian).
  shutters: { share: 0.6, ww: 0.75, wing: 0.25, t: 0.04, gap: 0.02, open: 0.25, postClear: 0.08, ground: { ww: 0.9, wing: 0.45, edgeGap: 0.03 } }, // metry/rad; §5.2 #9 (ww NIE do strojenia — przelicz |sx − postX|)

  houseDetail: {      // tor „kamienice": wykusze, kroksztyny, portale, okiennice, lukarny, gzymsy, sterczyny, typy dachów
    // motyw #12a „lukarny NA połaci" (?nodormer=1 przywraca pudełko HEAD; buildings.js dormer()): lico ściany czołowej fromEave m przed okapem
    // (w głąb połaci), spód ściany sink m POD wierzchem płyty roofTopY, wierzch hFront m nad nim; okno win (szer., wys.) ze spodem winUp nad wierzchem;
    // daszek pulpitowy: nachylenie capRatio·pitch, obcięte tak, by głębokość lukarny mieściła się w depth [min, max]; wysięg capOver, grubość capT, szpara nad ścianą capGap
    dormer: { w: 1.4, wallT: 0.12, cheekT: 0.12, fromEave: 1.6, sink: 0.15, hFront: 1.5, win: [0.6, 0.7], winUp: 0.1, capRatio: 0.3, depth: [1.6, 2.4], capOver: 0.2, capT: 0.1, capGap: 0.07 }, // metry; policzone dla seed 7: 10 lukarn, depth 1,60–2,40, capPitch 0,16–0,36 rad
    // motyw #12b „szczyt schodkowy" (?nostep=1 = trójkąt HEAD; buildings.js stepGable()): udział domów szczytowych, liczba schodków [min, max],
    // wysokość schodka nad linią połaci (parapet), grubość muru t, lico muru out przed licem fasady, koniec połaci slabIn za licem (schowany w murze)
    step: { share: 0.6, steps: [4, 6], parapet: 0.35, t: 0.4, out: 0.02, slabIn: 0.1 }, // policzone dla seed 7: 3 z 6 domów szczytowych, +192 tri
    // motyw #12c „naczółek" (?nohip=1 = pełny szczyt HEAD; buildings.js hipRoof()): udział domów ∥ x („co 4. dom"), inset = o ile kalenica krótsza
    // z każdej strony (m; ścięcie w poziomie inset + okap, w pionie (inset + okap)·tan(pitch))
    hip: { share: 0.25, inset: 1.0 }, // policzone dla seed 7: 8 z 22 domów ∥ x, drop 1,34–2,37 m, +320 tri
    // motyw #6 „wykusz wieloboczny + kroksztyny" (?nooriel=1; buildings.js orielBay()): domy szersze niż minW i ze środkiem bliżej osi pierzei niż half − edgeGap
    // (= 16; |along| to środek domu), z kondygnacją nad piętrem floor (daszek chowa wierzchołek w jej bryle; na ostatniej kondygnacji przebijałby połać o 0,15 m — policzone).
    // Sześciobok o promieniu opisanym r (= bok; apotema r·cos 30° = 0,953 = wysięg przed lico piętra), seg ścian, środek na licu piętra (połowa w fasadzie);
    // okno win na 3 ścianach zewnętrznych (udział świecących litShare); stożek capR/capH (apotema podstawy 1,126 → okap 0,17 przed ścianami); pozycja |cx| ≤ min(w/2 − r − edge, cxMax);
    // kroksztyny: trójkąt prostokątny w × h, grubość t, co step pod wykuszem (2 szt. przy r 1,1), wierzch pod podwaliną piętra, pionowy bok na licu kondygnacji niżej
    oriel: { minW: 7, edgeGap: 6, floor: 1, r: 1.1, seg: 6, win: [0.6, 1.3], litShare: 0.35, capR: 1.3, capH: 0.8, edge: 0.3, cxMax: 2.5, corbel: { w: 0.35, h: 0.35, t: 0.14, step: 1.2 } }, // policzone dla seed 7: 11 domów (7 przy placu + 4 zamykające ulice), ≈ +330 tri/dom
    // motyw #10a „portale łukowe" (?noportal=1 = drzwi box 2,3 + nadproże belkowe HEAD; buildings.js portalArch()): na KAŻDYM domu oprawa w kluczu `key`
    // (blocks — jaśniejsza od parteru stone): 2 ościeża (archOut − archIn) × impostY × t, łuk pełny = półpierścień r archIn/archOut (ExtrudeGeometry, seg segmentów
    // na ćwiartkę) na wysokości impostu, zwornik keystone (w × h, wierzch up nad szczytem łuku, out przed oprawą), próg threshold (2·archOut × h × d) na ziemi;
    // oprawa od 0,01 do 0,01 + t przed licem parteru. Drzwi doorW × doorH (2,2, nie 2,3 z HEAD: róg (0,6, 2,3−1,6) miałby r 0,922 > archOut − 0,02 — wystawałby
    // za pierścień; przy 2,2: 0,849 ≤ 0,88 — policzone). front: punkt W.portals na ziemi front m przed licem drzwi (kontrakt z torem „plac", greenery.js).
    // motyw #10b „szyldy cechowe + herby" (?nosign=1 = szyld karczmy z HEAD; props.js signPlacements()/buildSigns(), materials.js signTexture() = atlas):
    // domy przy placu z udziałem share (strumień rng(seedLocal + 7), karczma s2 zawsze z kafelkiem tavernTile i napisem), szyld w × h ze środkiem na y, out przed licem
    // piętra 1 (faceZ1 = d/2 + jetty), PROSTOPADLE do fasady frontem do ulicy (signMatrix: ry = tr.ry − sign(along)·π/2, policzone 8/8), x = doorX − sign(along)·fromDoor
    // (ku ulicy; gdy wykusz bliżej niż oriel.r + orielGap → po drugiej stronie drzwi, inaczej bez szyldu); 2 płaszczyzny back-to-back w odstępie gapBack; wspornik iron
    // bracket.t² × len od bracket.back W ŚCIANIE na wysokości bracketY (szyld 3,45 ≤ 3,475 pod nim; okna piętra 1 od 4,03), 2 wieszaki hanger; plakieta herbowa plaque
    // (kwadratowe okno kafelka, ten sam kafelek) nad zwornikiem portalu: 2,65 ≥ 2,625 + 0,02, 3,01 ≤ 3,02 (belki jetty od 3,04), tylko gdy kroksztyny wykusza dalej niż
    // corbel.step/2 + corbel.t/2 + w/2 = 0,85 od doorX. Atlas: cols × rows kafelków po tile px, okno szyldu tile × win (256 × 158 ≈ 1,3 × 0,8 m).
    sign: { share: 0.4, y: 3.05, w: 1.3, h: 0.8, out: 0.8, fromDoor: 1.0, orielGap: 0.2, gapBack: 0.01, bracketY: 3.5, bracket: { t: 0.05, back: 0.1, len: 1.6 }, hanger: { t: 0.03, h: 0.1 }, // szyld, wspornik, wieszaki (m)
      plaque: { w: 0.36, h: 0.36, y: 2.83, out: 0.02 }, tiles: ['gryf', 'kielich', 'bochen', 'dzban', 'nożyce', 'młot', 'liść', 'klucz'], tavernTile: 0, tavernText: 'Pod Złotym Gryfem', // plakieta (m); kafelki = kolejność EMBLEMS w materials.js
      extraTiles: ['jabłko'],   // kafelki 8+ tylko dla szyldów kramów (motyw #11): poza pulą szyldów domów (pula = tiles → losowania domów bez zmiany); EMBLEMS = tiles + extraTiles
      atlas: { cols: 4, rows: 3, tile: 256, win: 158, plq: 112, cyText: 56 } }, // metry / px; rows 3 (motyw #11): 9 kafelków = 3 rzędy po 4, 1024 × 768 px; plq: bok kwadratowego okna plakiety wokół środka tarczy (tarcza 108 × 132, nad napisem 78 × 88 ze środkiem cyText); słownik skali §3.7: szyld 3,05 / 1,3 × 0,8 / wysięg 0,8
    portal: { doorW: 1.2, doorH: 2.2, archIn: 0.6, archOut: 0.9, impostY: 1.6, t: 0.25, seg: 8, key: 'blocks', keystone: { w: 0.28, h: 0.45, up: 0.125, out: 0.05 }, threshold: { h: 0.1, d: 0.35 }, front: 0.6 }, // metry; szczyt łuku wewn. 2,2 / zewn. 2,5, zwornik 2,175–2,625 < parter 3,2 i < belki jetty 3,04
  },

  // tor „wieża i panorama": panorama za pierzejami (skyline.js). Flagi: ?noskyline=1 (cały moduł), ?nofog=1, ?nobirds=1.
  skyline: {
    seedOffset: 400,     // własny generator rng(seed + seedOffset): kolejność losowań innych modułów nie zmienia panoramy
    groundExtent: 120,   // półwymiar płaszczyzny bruku (m); bez panoramy layout.js liczy jak dawniej (52 m). Wieże w oddali stoją na gruncie.
    // mgła: kolor EKRANOWY — Fog miesza po AgX (meshphysical.glsl.js:219), więc hex trafia na ekran 1:1. Sonda color_probe.mjs na bazowym
    // start_plac.png, pas nieba nad okapami 40,600,480,20 → #c9d5df (L 0.867 C 0.018 H 242.6); pas sąsiedni 40,620,200,20 → #cbd6df (L 0.870):
    // ΔL 0.003 ≤ 0.01, C < 0.03. Przeliczyć po każdej zmianie ?sun=/exposure/rotation nieba.
    fog: { color: 0xc9d5df, near: 60, far: 220 },
    // druga linia dachów: domy tła za każdą pierzeją — środek 9–16 m za osią pierzei (26 m → 35–42 m od środka placu), kalenice 12–17 m;
    // wzdłuż pierzei od krawędzi domu zamykającego ulicę (sw/2 + depth = 11 m) + streetClear do half + depth + alongMax
    secondLine: { distMin: 9, distMax: 16, widthMin: 5, widthMax: 8, depthMin: 7, depthMax: 9, gapMin: 0.3, gapMax: 1.5, ridgeMin: 12, ridgeMax: 17, // przerwy 0.3–1.5 m między domami
                  streetClear: 1, alongMax: 11, windowSpacing: 2.4, windowRows: 3, gableShare: 0.3, streetSideMax: 13 }, // okna co 2.4 m, 3 rzędy od góry; 30 % domów szczytem do placu
    // bramy na końcach 4 ulic: setback od osi pierzei (26 m) → 34 m od środka placu (tył pierzei 30 m, fasada domu zamykającego 38 m)
    gate: { setback: 8, span: 4, pierWidth: 2, height: 7, thickness: 2, archSpring: 3.5, bastionR: 1.6, bastionH: 9.5, bastionX: 4.6, capH: 2.4, merlons: 3 }, // łuk: nasada 3.5 m, szczyt 5.5 m; baszty r 1.6 h 9.5 + hełm 2.4
    // wieże w oddali (klucz far, jaśniejszy = perspektywa powietrzna): pierścień (sin a·R, cos a·R), 60–110 m od środka; policzone:
    // A (−26.6, −86) yaw 0.284 ze startu (kadr 0.15 ± 0.305), B (47.9, −87.8), C (−15.9, 78.4)
    farTowers: [{ a: Math.PI + 0.3, dist: 90, h: 40, r: 3.5 }, { a: Math.PI - 0.5, dist: 100, h: 44, r: 4 }, { a: -0.2, dist: 80, h: 32, r: 3 }], // a = kąt pierścienia (rad), dist/h/r w metrach
    farColor: [0.62, 0.060, 245],   // OKLCH albedo bez tekstury (#688aa8, inGamut); cykl 1: L 0.80 → ekran L 0.82 = niebo (0.86) − 0.03; cykl 2: [0.62, 0.03] → ekran L 0.744 C 0.004 (szara); cel ekran L 0.70–0.78, C ≥ 0.01, H 230–250
    farDetail: { seg: 12, baseFlare: 1.1, ledgeH: 1.2, ledgeR: 1.25, capShare: 0.3, capR: 1.3 }, // 12 segmentów (8 dawało widoczne fasety), podstawa 10 % szersza, gzyms 1.2 m × 1.25 r pod hełmem, hełm 30 % trzonu o podstawie 1.3 r
    farBlock: { w: 12, h: 9, d: 10 },   // przybudówka przy każdej wieży (masa miasta)
    // ptaki: Points nad placem, krążą po okręgach
    birds: { count: 14, yMin: 14, yMax: 24, rMin: 10, rMax: 20, speedMin: 0.08, speedMax: 0.16, size: 1.1, color: [0.30, 0.01, 250] }, // y 14–24: przy pitch 0.02 kadr sięga 36° nad horyzont = 14 m w 20 m, 30 m w 40 m (cykl 1: 22–34 m poza kadrem) // prędkość kątowa rad/s; rozmiar sprite'a 1.1 m; kolor OKLCH ciemny granat
  },

  ground: {},         // tor „wieża i panorama": medalion, krawężniki, gradient wilgoci bruku, kałuże

  // tor „plac" — motyw #7 „kompozycja startu" (?nocompose=1 = start HEAD (4, 19, yaw 0,15) i pierścień kramów bez fazy/repoussoira). Policzone (geom.mjs,
  // PerspectiveCamera(70, 412/915), oko (4,5, 1,65, 19,5), YXZ): yaw fontanny 0,227, wieży 0,257; fontanna NDC x −0,086 (cembrowina −0,57..0,43 = środkowa ⅓);
  // iglica (−6,7, 36, −23,2) NDC y 0,920 (pitch 0,06 → 0,981, 0,10 → 0,899); horyzont NDC y −0,129 = 44 % wysokości od dołu. FOV poziome ±0,305 rad.
  composition: {
    start: { x: 4.5, z: 19.5, yaw: 0.20, pitch: 0.09 },                       // §5.3; main.js
    // sektor bez kramu: CAŁE koło kolizji kramu (collideR) poza yaw [yawMin, yawMax] od startu dla kramów bliżej niż maxDist (stalls.js check „kram w sektorze startu");
    // na HEAD kram 0 (0,18, 11,97): yaw 0,521, koło do 0,336 → w sektorze (fontanna z lewej za kramem)
    stallFreeSector: { yawMin: 0.05, yawMax: 0.40, maxDist: 14 },   // rad od startu (kadr −0,105..0,505: sektor = środkowe 70 % szerokości), m
    // repoussoir = kram 0 (sukiennik po #11): na zewnętrznym skraju pierścienia (ringRadius + ringOut), tuż za sektorem po lewej: yaw = yawMax + asin(collideR/d) + margin
    // (policzone: yaw 0,621, d 8,00, (−0,16, 13,00), NDC x środka −1,43 → w kadrze prawa krawędź kramu NDC −1,0..−0,75, dół y −0,46 = dolna ⅓); faza pierścienia = jego kąt
    repoussoir: { ringOut: 1.5, margin: 0.02 },   // m za ringRadius (= ringJitter: skraj pierścienia), rad luzu za sektorem
  },

  // tor „plac" — motyw #7 lipy proceduralne (?notrees=1; trees.js treePlacements() = funkcja czysta, asercja H): count sztuk na okręgu dist wokół fontanny od kąta phase
  // (π/2 → (±6, 0): 1,6 m za schodkiem fontanny r 4,4; z kadru startowego korony przy krawędziach NDC x ±0,9..±0,97, nie zasłaniają fontanny −0,57..0,43 ani wieży −0,45..0,07).
  // Geometria (metry): pień cylinder rTop/rBot/h, odziomek, konary count od szczytu pnia (y h − in) pochylone tilt rad od pionu (rot: rz=−0,7 → (0,1,0)→(0.644, 0.765, 0),
  // czubek y 2,6 + 2,0·0,765 = 4,13, promień 1,29 — w koronie), korona: bryły ikosaedr (80 tri) blobs [{y, ring r, n, rB}] + cards kart liści size na sferze r (elewacja
  // ≥ elevMin, żeby spód karty ≥ headroom), spód każdej bryły ≥ headroom nad ziemią. Kolizja: koło collideR w osi pnia (≥ 0,8·rBot dla checkCollisionCovers).
  // Kolory OKLCH (§4.2: zieleń = rodzina szałwii H 135–145, wtórne): tinty kluczy leaf0/leaf1/leafCard mnożą teksturę canvas (liście w kolorach canvas.*).
  trees: {
    count: 2, dist: 6, phase: Math.PI / 2, seed: 700,   // seed: strumień rng(seed + i) per lipa (niezależny od W.R → reszta sceny bez przetasowania)
    trunk: { rTop: 0.2, rBot: 0.32, h: 2.8, seg: 8, root: { r: 0.42, h: 0.3 } },   // m; pień lipy ~40-letniej (obwód 2 m), 8 segmentów (48 tri)
    branches: { n: 5, rTop: 0.05, rBot: 0.1, len: 2.0, tilt: 0.7, tiltJitter: 0.15, in: 0.2 },   // m / rad; czubki y 4,13 ± jitter wewnątrz korony (check konar poza koroną)
    crown: { y: 4.6, r: 2.4, blobs: [{ y: 4.8, ring: 0, n: 1, rB: 1.4 }, { y: 4.2, ring: 1.4, n: 5, rB: [1.0, 1.3] }, { y: 5.6, ring: 0.8, n: 3, rB: [0.9, 1.1] }], cards: 36, cardSize: 1.3, cardIn: [0.75, 1.0], elevMin: -0.5 },   // m / rad; spód: bryły 4,05 − 1,3 = 2,75, karty 4,6 − 2,4·sin 0,5 − 0,65 = 2,8 ≥ headroom
    collideR: 0.45, headroom: 2.3, sway: 0.04,   // sway: amplituda falowania liści (m) przez W.sway albo kopię w trees.js; ?nosway=1 wyłącza
    tint: { leaf0: [0.70, 0.010, 140], leaf1: [0.95, 0.005, 135], leafCard: [0.92, 0.010, 135] },   // wnętrze korony ciemniejsze (× 0,7), zewnętrzne bryły i karty prawie bez tintu
    canvas: { dark: [0.45, 0.080, 145], mid: [0.60, 0.090, 140], silver: [0.80, 0.045, 135], vein: [0.86, 0.030, 130] },   // liście na canvasie (sRGB): ciemna, średnia, srebrzysta lipa, nerw
    texRepeat: 3,   // powtórzenie tekstury liści na bryle korony
  },

  greenery: {},       // tor „plac": krzewy w donicach, rabatki, skrzynki kwiatowe (na parapetach z W.sills)

  // tor „kramy i rekwizyty": girlandy chorągiewek i lampiony (bunting.js; ?nobunting=1). Liny między fasadami: E–W na z = ew[i] (side 3 → 1),
  // N–S na x = ns[i] (side 0 → 2); nie przez środek (posąg sięga 5.3 m, lina min 4.0). Kotwice na licu piętra na y (dom 3-piętrowy) albo
  // belowEave pod okapem (2 piętra → 5.8 m); zwis 1.5–2.5 m ograniczony do y_liny − minY. Chorągiewki co 0.45 m, 5 barw heraldycznych (OKLCH §4.4).
  bunting: {
    seedOffset: 500, y: 6.5, sagMin: 1.5, sagMax: 2.5, minY: 4.0, lines: 6, belowEave: 0.3, // liny 6.5 m (§3.7), zwis 1.5–2.5, środek ≥ 4.0; kotwica 0.3 pod okapem, gdy dom niższy
    ew: [-12, -6, 6, 12], ns: [-12, 12],           // 4 liny E–W (z) + 2 N–S (x) = lines
    bannerClear: 1.0, bannerShift: 1.2,            // kotwica ≥ 1 m od chorągwi (płótno 0.9 m); gdy bliżej — przesunięcie wzdłuż pierzei
    hook: { size: 0.05, len: 0.36, inWall: 0.18, out: 0.15 },   // hak żelazny: 0.18 w ścianie, 0.18 przed licem; koniec liny 0.15 przed licem (słupek wystaje 0.09)
    rope: { r: 0.015, seg: 16, radial: 4 },        // TubeGeometry: 16 × 4 × 2 = 128 tri na linę
    pennant: { spacing: 0.45, w: 0.22, h: 0.32, swayAmp: 0.05, // trójkąt 0.22 × 0.32 co 0.45 m łuku; amplituda kołysania dolnego wierzchołka 5 cm
               colors: [[0.50, 0.170, 25], [0.72, 0.150, 78], [0.58, 0.100, 190], [0.45, 0.130, 320], [0.90, 0.030, 85]] }, // karmazyn, szafran, turkus, purpura, krem
    lantern: { count: 3, r: 0.18, drop: 0.32, string: 0.16, stringR: 0.006, minY: 3.3,   // 3 na linę, kula 0.32 m pod liną; spód ≥ 3.3 (min 4.0 − 0.32 − 0.18 = 3.5)
               color: [0.88, 0.050, 80], emissive: [0.72, 0.160, 60], intensity: 1.4 },  // papier kremowy; emisja pomarańczowa ×1.4 (cykl 1: [0.80,0.12,72]×1.0 → ekran L 0.88 C 0.034 = blada kula; AgX zjada chromę, §4.1.6)
  },

  props: {            // tor „kramy i rekwizyty": cięcia skanów, role kramów, ławki, studnia, popiersie, latarnie kute
    // modele bez cienia (rzucanie cienia = drugi raz ta sama geometria w przebiegu cieni); props.js: NO_SHADOW = new Set(CONFIG.props.noShadow)
    noShadow: ['grass_medium_02', 'fern_02', 'food_apple_01', 'wooden_bowl_01', 'ceramic_vase_01', 'ceramic_vase_02', 'wine_bottles_01', 'potted_plant_02'],
    // motyw #1 „cięcia skanów" (?nocuts=1 przywraca stan bazowy: 158 draw / 818 939 tri HUD w start_plac; liczby per model z __stats bazy)
    cuts: {
      // limit instancji na model — put() pomija nadmiar w kolejności budowy (kolejność = ziarno, więc bez zmiany losowań reszty sceny);
      // baza: butelki 2 zestawy × 10 099 tri (9 prymitywów = 9 draw), beczka wina 8 × 3 246
      maxCount: { wine_bottles_01: 1, wine_barrel_01: 4 },
      // kępy zieleni u podnóża pierzei: liczba na model (baza losowała 14× z listy [trawa, paproć, trawa] → 10 traw × 7 842 tri + 4 paprocie × 6 232)
      scatter: { fern_02: 2, grass_medium_02: 0 },
      // cały towar bez cienia (także drobne modele z audyt/research/zasoby_etap2.md, ładowane przez motyw #11)
      noShadow: ['wicker_basket_01', 'wooden_bowl_02', 'carved_wooden_plate', 'hamburger_buns', 'food_pears_asian_01', 'ceramic_pot', 'brass_pot_01', 'brass_vase_01', 'wicker_basket_02'],   // + towar ról kramów (motyw #11): garnek, kocioł, wazon, kosz (także na ziemi — 0,26 m)
      // szkło butelek: KHR_materials_transmission (transmissionFactor 1) każe rendererowi rysować całą nieprzezroczystą scenę drugi raz
      // (renderTransmissionPass); zamiast tego zwykła przezroczystość alfa z tą kryciem
      glassOpacity: 0.6,   // krycie alfa szkła butelek
    },
  },

  // tor „paleta" — maska ról (?roles=1&noaa=1, world.js applyRoles): każdy mesh w jednolitym kolorze roli (MeshBasic, bez tone mappingu), niebo czarne;
  // audyt/testy/tools/hist_roles.mjs liczy dokładne heksy → 60/30/10 ± 8 (neutralne/wtórne/akcent), „inne" (bez wpisu) ≤ 3 %. Klucze W.mat w `mat`
  // (przypisanie §4.3.5), modele z W.put() w `props` po nazwie (bez wpisu → `default`); heksy kolorów ról = umowa z hist_roles.mjs, nie kolory sceny.
  roles: {
    color: { n: 0xff0000, w: 0x00ff00, a: 0x0000ff, x: 0xffffff, bg: 0x000000 },   // n neutralne, w wtórne, a akcent, x inne (bez wpisu), bg tło
    mat: { cobble: 'n', stone: 'n', blocks: 'n', slates: 'n', plaster0: 'n', plaster1: 'n', plaster2: 'n', plaster3: 'n', plaster4: 'n', roof2: 'n', far: 'n', wet: 'n', iron: 'n', glass: 'n', jet: 'n',
           roof0: 'w', roof1: 'w', roofTower: 'w', timber: 'w', planks: 'w', door: 'w', paint0: 'w', paint1: 'w', paint2: 'w', water: 'w', leaf0: 'w', leaf1: 'w', leafCard: 'w',   // leaf*: lipy (motyw #7) = zieleń bez kwiatów
           cloth0: 'a', cloth1: 'a', cloth2: 'a', cloth3: 'a', banner0: 'a', banner1: 'a', banner2: 'a', banner3: 'a', sign: 'a', clock: 'a', bunting: 'a', paperLit: 'a', flame: 'a', glassLit: 'a' },
    props: { default: 'n', horse_statue_01: 'n', gothic_statue: 'n', marble_bust_01: 'n', rock_moss_set_02: 'n',   // kamień
             wine_barrel_01: 'w', Barrel_01: 'w', wooden_crate_01: 'w', wooden_crate_02: 'w', wooden_bucket_02: 'w', wooden_stool_02: 'w', wooden_lantern_01: 'w', Lantern_01: 'w', tree_stump_01: 'w', treasure_chest: 'w',
             wicker_basket_01: 'w', wicker_basket_02: 'w', ceramic_vase_01: 'w', ceramic_vase_02: 'w', ceramic_pot: 'w', wooden_bowl_01: 'w', wooden_bowl_02: 'w', carved_wooden_plate: 'w', hamburger_buns: 'w', painted_wooden_bench: 'w', planter_box_01: 'w',
             grass_medium_02: 'w', fern_02: 'w', potted_plant_02: 'w', shrub_04_c: 'w',   // drewno, plecionka, ceramika, zieleń bez kwiatów = wtórne
             food_apple_01: 'a', food_pears_asian_01: 'a', wine_bottles_01: 'a', brass_pot_01: 'a', brass_vase_01: 'a', periwinkle_plant_03: 'a', celandine_01_c: 'a', flower_gazania_h: 'a' }, // owoce, szkło, mosiądz, kwiaty = akcent
  },

  // tor „UI" (ui.js, motyw #15; ?noui=1). Podpisy miejsc: pozycje NIE są wpisane — ui.js liczy je z W/CONFIG po kluczu `at`
  // (fountain: (0,0) + fountain.radius + step.outer; tower: W.tower ?? wzór tower.js; tavern: dom szyldu jak w props.js buildBanners;
  // stall: W.stalls z kind === 'sukiennik' (motyw #11) albo kram najbliżej startu). r = promień własny obiektu + margin; podpis w r, „podejdź bliżej…" w 2r.
  pois: [
    { name: 'Fontanna pod Srebrnymi Lipami', at: 'fountain', margin: 2.5 },   // r = 3.2 + 1.2 + 2.5 = 6.9
    { name: 'Wieża ratuszowa', at: 'tower', margin: 5 },                      // r = 3.5·√2 + 5 = 9.95 (róg wieży kwadratowej 7 m)
    { name: 'Karczma „Pod Złotym Gryfem"', at: 'tavern', margin: 2 },         // r = w/2 + 2 (dom 6.56 m → 5.28)
    { name: 'Kram sukiennika', at: 'stall', margin: 1.5 },                     // r = koło kolizji kramu 1.6 + 1.5 = 3.1
  ],
  // ekran startowy, HUD, podpisy (§5.4 promptu): kolory EKRANOWE CSS (nie materiały — bez oklch()), rozmiary w px CSS
  ui: {
    title: 'Rynek Srebrnych Liści', subtitle: 'SREBRNY BRÓD · WYBRZEŻE MIECZY',
    mood: 'Zapach chleba i mokrego kamienia; z wieży zaraz wybije czwarta.',
    enter: 'Wejdź', hint: 'Lewy kciuk: chodzenie · prawy: rozglądanie', near: 'podejdź bliżej…',
    font: '"Noto Serif", Georgia, serif',                      // bez sieci: Noto Serif (Android) → Georgia → serif
    size: { title: 34, subtitle: 13, mood: 14, button: 48, hint: 11, caption: 16 }, // px
    buttonWidth: 60, frameInset: 8, fadeMs: 600, vignetteBlur: 120,               // % szerokości; ramka 8 px od krawędzi; fade-out „Wejdź"; rozmycie winiety
    colors: { bg0: '#1a1410', bg1: '#3a2a1a', gold: '#b8892e', goldA: 'rgba(184,137,46,.8)', ink: '#e8d9b5', mood: '#cdbb95', button: '#2a1e12', hint: '#8a7a5a', vignette: 'rgba(20,12,6,.45)' },
    stallCollide: 1.6,                                          // koło kolizji kramu (stalls.js addCircle 1.6) — do promienia POI kramu
  },

  textures: {
    cobble:  { name: 'cobblestone_floor_04', mpt: 2.5 },
    plaster: { name: 'plastered_wall',       mpt: 2.0 },
    timber:  { name: 'old_planks_02',        mpt: 1.5 },
    planks:  { name: 'weathered_planks',     mpt: 2.0 },
    roof:    { name: 'roof_09',              mpt: 2.0 },
    stone:   { name: 'rustic_stone_wall_02', mpt: 2.0 },
    blocks:  { name: 'medieval_blocks_05',   mpt: 2.0 },
    slates:  { name: 'castle_wall_slates',   mpt: 2.0 },
    tiles:   { name: 'stone_tiles_02',       mpt: 2.0 },   // motyw #9: neutralna baza (lin. [0.198, 0.196, 0.171], H 106, AO 0,93) pod roof2 (łupek) i roofTower (miedź z patyną) — §4.4; 2 m/kafel jak roof/slates
  },
};
