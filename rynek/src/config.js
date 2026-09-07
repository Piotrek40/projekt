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

  skyline: {},        // tor „wieża i panorama": druga linia dachów, wieże w oddali, bramy na końcach ulic, mgła, ptaki

  ground: {},         // tor „wieża i panorama": medalion, krawężniki, gradient wilgoci bruku, kałuże

  trees: {},          // tor „plac": lipy proceduralne przy fontannie

  greenery: {},       // tor „plac": krzewy w donicach, rabatki, skrzynki kwiatowe (na parapetach z W.sills)

  bunting: {},        // tor „kramy i rekwizyty": girlandy chorągiewek, lampiony, sznury

  props: {            // tor „kramy i rekwizyty": cięcia skanów, role kramów, ławki, studnia, popiersie, latarnie kute
    // modele bez cienia (rzucanie cienia = drugi raz ta sama geometria w przebiegu cieni); props.js: NO_SHADOW = new Set(CONFIG.props.noShadow)
    noShadow: ['grass_medium_02', 'fern_02', 'food_apple_01', 'wooden_bowl_01', 'ceramic_vase_01', 'ceramic_vase_02', 'wine_bottles_01', 'potted_plant_02'],
    // motyw #1 „cięcia skanów" (?nocuts=1 przywraca stan bazowy: 158 draw / 818 939 tri HUD w start_plac; liczby per model z __stats bazy)
    cuts: {
      // limit instancji na model — put() pomija nadmiar w kolejności budowy (kolejność = ziarno, więc bez zmiany losowań reszty sceny);
      // baza: trawa 10 × 7 842 tri, paproć 4 × 6 232, butelki 2 × 10 099 (9 prymitywów = 9 draw), beczka wina 8 × 3 246
      maxCount: { grass_medium_02: 0, fern_02: 2, wine_bottles_01: 1, wine_barrel_01: 4 },
      // cały towar bez cienia (także drobne modele z audyt/research/zasoby_etap2.md, ładowane przez motyw #11)
      noShadow: ['wicker_basket_01', 'wooden_bowl_02', 'carved_wooden_plate', 'hamburger_buns', 'food_pears_asian_01'],
      // szkło butelek: KHR_materials_transmission (transmissionFactor 1) każe rendererowi rysować całą nieprzezroczystą scenę drugi raz
      // (renderTransmissionPass); zamiast tego zwykła przezroczystość alfa z tą kryciem
      glassOpacity: 0.6,   // krycie alfa szkła butelek
    },
  },

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
