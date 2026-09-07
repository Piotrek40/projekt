// Konfiguracja rynku: cała skala, paleta i tekstury w jednym miejscu. Reguły generatora czytają tylko stąd.
export const CONFIG = {
  seed: 7,
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
    roofOKLCH: [0.75, 0.085, 200],                      // miedź z patyną na zestawie slates (§4.4 (c): na slates tylko [0.75, 0.085, 200] = #66bec3); tor „paleta" przepina na stone_tiles_02
    roofParams: { roughness: 0.55, metalness: 0.2 },    // §1: nowy klucz miedzi = slates.material({ params: { roughness: 0.55, metalness: 0.2 } })
  },
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
  },

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
      // baza: butelki 2 zestawy × 10 099 tri (9 prymitywów = 9 draw), beczka wina 8 × 3 246
      maxCount: { wine_bottles_01: 1, wine_barrel_01: 4 },
      // kępy zieleni u podnóża pierzei: liczba na model (baza losowała 14× z listy [trawa, paproć, trawa] → 10 traw × 7 842 tri + 4 paprocie × 6 232)
      scatter: { fern_02: 2, grass_medium_02: 0 },
      // cały towar bez cienia (także drobne modele z audyt/research/zasoby_etap2.md, ładowane przez motyw #11)
      noShadow: ['wicker_basket_01', 'wooden_bowl_02', 'carved_wooden_plate', 'hamburger_buns', 'food_pears_asian_01'],
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
           roof0: 'w', roof1: 'w', roofTower: 'w', timber: 'w', planks: 'w', door: 'w', paint0: 'w', paint1: 'w', paint2: 'w', water: 'w',
           cloth0: 'a', cloth1: 'a', cloth2: 'a', cloth3: 'a', banner0: 'a', banner1: 'a', banner2: 'a', banner3: 'a', sign: 'a', clock: 'a', bunting: 'a', paperLit: 'a', flame: 'a', glassLit: 'a' },
    props: { default: 'n', horse_statue_01: 'n', gothic_statue: 'n', marble_bust_01: 'n', rock_moss_set_02: 'n',   // kamień
             wine_barrel_01: 'w', Barrel_01: 'w', wooden_crate_01: 'w', wooden_crate_02: 'w', wooden_bucket_02: 'w', wooden_stool_02: 'w', wooden_lantern_01: 'w', Lantern_01: 'w', tree_stump_01: 'w', treasure_chest: 'w',
             wicker_basket_01: 'w', wicker_basket_02: 'w', ceramic_vase_01: 'w', ceramic_vase_02: 'w', ceramic_pot: 'w', wooden_bowl_01: 'w', wooden_bowl_02: 'w', carved_wooden_plate: 'w', hamburger_buns: 'w', painted_wooden_bench: 'w', planter_box_01: 'w',
             grass_medium_02: 'w', fern_02: 'w', potted_plant_02: 'w', shrub_04_c: 'w',   // drewno, plecionka, ceramika, zieleń bez kwiatów = wtórne
             food_apple_01: 'a', food_pears_asian_01: 'a', wine_bottles_01: 'a', brass_pot_01: 'a', brass_vase_01: 'a', periwinkle_plant_03: 'a', celandine_01_c: 'a', flower_gazania_h: 'a' }, // owoce, szkło, mosiądz, kwiaty = akcent
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
    tiles:   { name: 'stone_tiles_02',       mpt: 2.0 },   // motyw #9: neutralna baza (lin. [0.198, 0.196, 0.171], H 106, AO 0,93) pod roof2 (łupek) i roofTower (miedź z patyną) — §4.4; 2 m/kafel jak roof/slates
  },
};
