// Konfiguracja rynku: cała skala, paleta i tekstury w jednym miejscu. Reguły generatora czytają tylko stąd.
export const CONFIG = {
  seed: 7,
  // klucze W.B (regex), które NIE rzucają cienia (Batch.build w geometry.js): nowe małe/cienkie obiekty — girlandy, lampiony, strumienie, mokry bruk, wieże w oddali, tarcza zegara, szyld, chorągwie
  noShadowKeys: '^(bunting|paperLit|jet|wet|water|ripple|far|clock|sign|banner)', // + lustra wody i kręgi (motyw #8): płaskie dyski, cień bez sensu
  // kolejność rysowania kluczy W.B przezroczystych (Batch.build opts.renderOrder; domyślnie 0): three sortuje przezroczyste po odległości ŚRODKA obiektu,
  // więc lustro wody (opacity 0.85, środek wyżej) rysowało się PO kręgach i strumieniach i przykrywało je (motyw #8, cykl 4) — kręgi i strumienie po wodzie
  renderOrderKeys: { water: 0, jet: 1, ripple: 2 },
  plaza: { size: 44, streetWidth: 6, streetLength: 16 },
  house: { depth: 8, floorHeight: 2.9, groundFloor: 3.2, jetty: 0.35, roofPitch: 0.85, overhang: 0.55, widthMin: 6, widthMax: 9.5, floorsMin: 2, floorsMax: 3 },
  tower: { size: 7, height: 15, roofHeight: 6 },
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
  stalls: { count: 7, ringRadius: 11.5 },
  lanterns: { count: 8, ringRadius: 15.5 },
  sky: { file: 'sky_1k.hdr', environmentIntensity: 0.6, sunIntensity: 5.0, sunColor: 0xffd6a6, minElevationDeg: 30, rotation: -0.25, shadowExtent: 22 },
  // paleta: ciepłe tynki, ciemny dąb, dachówka; baldachimy i chorągwie w barwach heraldycznych
  palette: {
    plaster: [0xe3d3b2, 0xd6c39d, 0xe8dfcf, 0xc9b58f, 0xdcc7b4],
    roof: [0xb8734f, 0xa0654a, 0x8d5a45],
    cloth: [0x8c1f28, 0x1f4d3a, 0xc98a1b, 0x2b3a6b],
    timber: 0x5a4030,
    stone: 0xcfc6b8,
    water: 0x2f5a63,
  },
  // ---- sekcje Etapu 2 (każdy tor pracy wypełnia TYLKO swoją; kolory jako OKLCH [L, C, H] przez oklch() z color.js) ----

  paletteOKLCH: {},   // tor „paleta": rodziny barw z rolami (tynki, dachy, drewno malowane, tkaniny, kamień, woda, emisja)

  houseDetail: {},    // tor „kamienice": wykusze, kroksztyny, portale, okiennice, lukarny, gzymsy, sterczyny, typy dachów

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

  trees: {},          // tor „plac": lipy proceduralne przy fontannie

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

  // tor „kramy i rekwizyty": cięcia skanów, role kramów, ławki, studnia, popiersie, latarnie kute
  props: {
    noShadow: ['grass_medium_02', 'fern_02', 'food_apple_01', 'wooden_bowl_01', 'ceramic_vase_01', 'ceramic_vase_02', 'wine_bottles_01', 'potted_plant_02'], // modele z W.put() bez cienia (NO_SHADOW w props.js)
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
  },
};
