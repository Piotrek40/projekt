// Konfiguracja rynku: cała skala, paleta i tekstury w jednym miejscu. Reguły generatora czytają tylko stąd.
export const CONFIG = {
  seed: 7,
  plaza: { size: 44, streetWidth: 6, streetLength: 16 },
  house: { depth: 8, floorHeight: 2.9, groundFloor: 3.2, jetty: 0.35, roofPitch: 0.85, overhang: 0.55, widthMin: 6, widthMax: 9.5, floorsMin: 2, floorsMax: 3 },
  tower: { size: 7, height: 15, roofHeight: 6 },
  fountain: { radius: 3.2, rim: 0.75, columnHeight: 1.6, blockScale: 1.1 },
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
    secondLine: { distMin: 9, distMax: 16, widthMin: 6, widthMax: 9, depthMin: 7, depthMax: 9, gapMin: 0.5, gapMax: 2.5, ridgeMin: 12, ridgeMax: 17,
                  streetClear: 1, alongMax: 6, windowSpacing: 2.4, windowRows: 3, gableShare: 0.3 },
    // bramy na końcach 4 ulic: setback od osi pierzei (26 m) → 34 m od środka placu (tył pierzei 30 m, fasada domu zamykającego 38 m)
    gate: { setback: 8, span: 4, pierWidth: 2, height: 7, thickness: 2, archSpring: 3.5, bastionR: 1.6, bastionH: 9.5, bastionX: 4.6, capH: 2.4, merlons: 3 },
    // wieże w oddali (klucz far, jaśniejszy = perspektywa powietrzna): pierścień (sin a·R, cos a·R), 60–110 m od środka; policzone:
    // A (−26.6, −86) yaw 0.284 ze startu (kadr 0.15 ± 0.305), B (47.9, −87.8), C (−15.9, 78.4)
    farTowers: [{ a: Math.PI + 0.3, dist: 90, h: 40, r: 3.5 }, { a: Math.PI - 0.5, dist: 100, h: 44, r: 4 }, { a: -0.2, dist: 80, h: 32, r: 3 }],
    farColor: [0.80, 0.025, 245],   // OKLCH albedo bez tekstury: jaśniejszy i chłodniejszy niż dachy (ekran L cel 0.70–0.85, niebo 0.87)
    farBlock: { w: 12, h: 9, d: 10 },   // przybudówka przy każdej wieży (masa miasta)
    // ptaki: Points nad placem, krążą po okręgach
    birds: { count: 14, yMin: 22, yMax: 34, rMin: 8, rMax: 18, speedMin: 0.08, speedMax: 0.16, size: 1.1, color: [0.30, 0.01, 250] },
  },

  ground: {},         // tor „wieża i panorama": medalion, krawężniki, gradient wilgoci bruku, kałuże

  trees: {},          // tor „plac": lipy proceduralne przy fontannie

  greenery: {},       // tor „plac": krzewy w donicach, rabatki, skrzynki kwiatowe (na parapetach z W.sills)

  bunting: {},        // tor „kramy i rekwizyty": girlandy chorągiewek, lampiony, sznury

  props: {},          // tor „kramy i rekwizyty": cięcia skanów, role kramów, ławki, studnia, popiersie, latarnie kute

  pois: [],           // tor „UI": podpisy miejsc {name, x, z, r}

  ui: {},             // tor „UI": nazwa miejsca, zdanie nastroju, kolory HUD

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
