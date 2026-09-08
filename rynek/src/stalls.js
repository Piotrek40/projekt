// Kramy: konstrukcja z belek i desek, baldachim z tkaniny, towar na ladzie, zaplecze.
// Układ lokalny kramu: początek na środku lady na ziemi, +x wzdłuż lady, +y w górę, +z = FRONT (do fontanny). Metry. Do świata tylko przez L().
// Motyw #7 (?nocompose=1 = pierścień jak na HEAD): stallPlacements() (funkcja czysta) — kram 0 = repoussoir na skraju pierścienia tuż za sektorem
// startowym, faza pierścienia = jego kąt; żaden kram (całe koło kolizji) w sektorze CONFIG.composition.stallFreeSector od startu.
// Motyw #11 (?nokinds=1 = stary placeGoods): role kramów z CONFIG.stalls.kinds — stallGoodsPlan() (funkcja czysta: bele sukiennika, szyld kramu z atlasu,
// towar w gniazdach lady, kosz na ziemi, zaplecze), buildStallGoods() dodaje z niego geometrię/modele i asercje.
import * as THREE from 'three';
import { box, plane, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall } from '../../engine/src/check.js';
import { signTileUV, tilePlane } from './props.js';

// yaw kamery (app.js: yaw 0 = −z, przód (−sin yaw, 0, −cos yaw)) w kierunku punktu (x, z) ze startu
export const yawFrom = (start, x, z) => Math.atan2(-(x - start.x), -(z - start.z));

// Repoussoir: kram na okręgu |p| = rad wokół fontanny, widziany ze startu pod yaw = yawMax + asin(collideR/d) + margin (koło kolizji tuż za sektorem);
// d z równania |start + d·dir| = rad (pierwiastek bliższy), iterowane, bo yaw zależy od d. Policzone (seed-niezależne): yaw 0,621, d 8,00, (−0,16, 13,00).
export function repoussoirPlacement(C, S) {
  const st = C.start, sec = C.stallFreeSector, rad = S.ringRadius + C.repoussoir.ringOut;
  let d = rad, yaw = 0, dir = new THREE.Vector3();
  for (let i = 0; i < 20; i++) {   // 20 iteracji: zbieżność do < 1e−9 po ~6
    yaw = sec.yawMax + Math.asin(S.collideR / d) + C.repoussoir.margin;
    dir = new THREE.Vector3(0, 0, -1).applyMatrix4(M4(0, 0, 0, yaw));   // przód kamery przy tym yaw (obrót jak w app.js, bez ręcznych sin/cos)
    const b = 2 * (st.x * dir.x + st.z * dir.z), c = st.x * st.x + st.z * st.z - rad * rad;
    d = (-b - Math.sqrt(b * b - 4 * c)) / 2;
  }
  const x = st.x + dir.x * d, z = st.z + dir.z * d;
  return { x, z, a: Math.atan2(x, z), rad, d, yaw };
}

// Pozycje i kolejność kramów (funkcja czysta; te same 4 losowania R na kram W TEJ SAMEJ KOLEJNOŚCI co na HEAD: kąt, promień, obrót, tkanina →
// kramy 1..6 = pozycje HEAD obrócone o fazę −0,027 rad, reszta sceny bez przetasowania): kąt a_i = faza + i/count·2π + jitter, promień R ± ringJitter,
// front do fontanny ry = a + π (± jitter). Kram 0 z kompozycją = repoussoir (bez jitteru).
export function stallPlacements(W) {
  const { R, CONFIG, ctx, P } = W, S = CONFIG.stalls, C = ctx.flags.nocompose ? null : CONFIG.composition;
  const rep = C ? repoussoirPlacement(C, S) : null, phase = rep ? rep.a : 0;
  const out = [];
  for (let i = 0; i < S.count; i++) {
    const da = R.range(-0.15, 0.15), dr = R.range(-S.ringJitter, S.ringJitter), dry = R.range(-0.2, 0.2);   // jitter kąta / promienia / obrotu jak HEAD
    const a = rep && i === 0 ? rep.a : phase + (i / S.count) * Math.PI * 2 + da, rad = rep && i === 0 ? rep.rad : S.ringRadius + dr;
    const x = Math.sin(a) * rad, z = Math.cos(a) * rad, ry = a + Math.PI + (rep && i === 0 ? 0 : dry); // ring: pozycja na pierścieniu kramów, front do fontanny
    const clothDraw = 'cloth' + R.int(0, P.cloth.length - 1), kind = ctx.flags.nokinds ? null : S.kinds[i % S.kinds.length];   // losowanie tkaniny ZAWSZE (strumień jak HEAD); z rolą baldachim z kinds
    out.push({ x, z, ry, a, rad, repoussoir: !!rep && i === 0, cloth: kind ? kind.cloth : clothDraw, kind: kind ? kind.name : null });
  }
  return out;
}

export function buildStalls(W) {
  const { ctx, CONFIG, T, B } = W;
  const stalls = [];
  const places = stallPlacements(W);
  for (const p of places) {
    const { x, z, ry } = p;
    const L = (lx, ly, lz, lry = 0, lrx = 0, lrz = 0) => M4(lx, ly, lz, lry, lrx, lrz).premultiply(M4(x, 0, z, ry));
    const cw = 2.6, cd = 1.0, ch = 0.95, ph = 2.3;
    // Kram, który jest MODELEM (CONFIG.stalls.model, Etap 3): geometrii proceduralnej nie budujemy — wymiary zostają,
    // bo czyta je towar, szyld kramu i POI. Model stawia initProps (props.js) po wczytaniu modeli. ?nomodel=1 = wersja proceduralna.
    // Wariant inline (Artifact) NIE dostaje modelu: strona jednoplikowa ma 15,41 MB z limitu 16 MB, a model + AO to ok. 0,5 MB.
    // Tam zostaje kram proceduralny. Pages i wersja lokalna używają modelu. (Zapisane w audyt/RAPORT.md §6c.)
    const asModel = !ctx.flags.nomodel && W.loaders?.mode !== 'inline' && p.kind === CONFIG.stalls.model.kind;
    if (asModel) {
      // Cień kontaktowy: decal na bruku pod kramem. AO wypalone w modelu przyciemnia model, ale nie ziemię obok niego —
      // bez tego słup stoi na bruku bez styku (porównanie „styk drewna z brukiem" przed/po nie pokazywało różnicy).
      const Ct = CONFIG.stalls.model.contact;
      if (Ct && !ctx.flags.nocontact) B.add('contact', plane(Ct.w, Ct.d, 1), L(0, Ct.y, 0, 0, -Math.PI / 2));   // rx=−π/2: lico płaszczyzny (0,0,1) → (0,1,0), czyli w górę — policzone
      stalls.push({ x, z, ry, cw, cd, ch, ph, L, cloth: p.cloth, repoussoir: p.repoussoir, kind: p.kind, model: true });
      ctx.addCircle(x, z, CONFIG.stalls.collideR);
      W.dbgCircle?.(x, z, CONFIG.stalls.collideR); W.dbgAxes?.(x, 0.05, z, ry, 1.2);
      continue;
    }
    B.add('planks', box(cw, 0.08, cd, T.planks.mpt), L(0, ch, 0));
    B.add('planks', box(cw, ch - 0.1, 0.06, T.planks.mpt), L(0, (ch - 0.1) / 2, cd / 2 - 0.03));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.12, ph, 0.12, T.timber.mpt), L(sx * (cw / 2 - 0.1), ph / 2, sz * (cd / 2 + 0.6)));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph - 0.05, cd / 2 + 0.6));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph + 0.35, -(cd / 2 + 0.6)));
    // baldachim: jedna połać opadająca ku przodowi, plus zwis z przodu
    const cloth = p.cloth;   // z rolą kramu = kinds[i].cloth (stallPlacements), bez ról = losowany jak HEAD
    const depth = cd + 1.4, rise = 0.4, slope = Math.hypot(depth, rise);
    B.add(cloth, plane(cw + 0.5, slope, 1), L(0, ph + 0.15, 0, 0, -Math.PI / 2 + Math.atan2(rise, depth)));   // rot: rx=−1.406 → normalna (0,0,1)→(0, 0.986, 0.164) licem w górę, góra płótna (0,1,0)→(0, 0.164, −0.986): tył wyżej, płótno opada ku +z (front) — policzone
    B.add(cloth, plane(cw + 0.5, 0.35, 1), L(0, ph - 0.22, cd / 2 + 0.62));
    // krokwie pod płótnem (poprawka po zrzutach z telefonu: spód baldachimu z bliska był płaską plamą koloru):
    // ta sama macierz co połać płótna, 5 cm niżej (normalna połaci (0, 0.986, 0.164) — przesunięcie w y wystarcza)
    for (const rx of CONFIG.stalls.rafters) B.add('timber', box(0.07, slope, 0.05, T.timber.mpt), L(rx * (cw + 0.5) / 2, ph + 0.15 - 0.05, 0, 0, -Math.PI / 2 + Math.atan2(rise, depth)));
    stalls.push({ x, z, ry, cw, cd, ch, ph, L, cloth, repoussoir: p.repoussoir, kind: p.kind });   // cd/ph/kind: motyw #11 (towar, szyld kramu, POI sukiennika w ui.js)
    // kolizja: prostokąt przybliżony kołem (kramy są obrócone)
    ctx.addCircle(x, z, CONFIG.stalls.collideR);
    W.dbgCircle?.(x, z, CONFIG.stalls.collideR); W.dbgAxes?.(x, 0.05, z, ry, 1.2); // ?boxes=1: L(0,0,0) kramu, niebieska oś +z = front (do fontanny)
  }
  W.stalls = stalls;
  if (!ctx.flags.nocompose) checkComposition(W, places);
}

// Asercje motywu #7 (na liczbach seed 7 PRZED kodem: kram 0 yaw 0,621 − asin(1,6/8,00) = 0,419 ≥ 0,40; kramy 1/6 poza kadrem (yaw −0,36 / 0,81), reszta > 14 m):
// żaden kram bliżej niż maxDist nie ma koła kolizji w sektorze [yawMin, yawMax]; repoussoir na |p| = ringRadius + ringOut i tuż za sektorem (margines ≤ 0,05).
function checkComposition(W, places) {
  const C = W.CONFIG.composition, S = W.CONFIG.stalls, st = C.start, sec = C.stallFreeSector;
  for (const p of places) {
    const d = Math.hypot(p.x - st.x, p.z - st.z); if (d >= sec.maxDist) continue;
    const yaw = yawFrom(st, p.x, p.z), half = Math.asin(S.collideR / d);
    check(yaw + half <= sec.yawMin || yaw - half >= sec.yawMax, 'kram w sektorze startu', { x: p.x, z: p.z, d, yaw, half });
  }
  const rep = places.find(p => p.repoussoir);
  check(!!rep && Math.abs(Math.hypot(rep.x, rep.z) - (S.ringRadius + C.repoussoir.ringOut)) < 0.01, 'repoussoir nie na skraju pierścienia', rep);   // 0,01: tolerancja float
  if (rep) { const d = Math.hypot(rep.x - st.x, rep.z - st.z), gap = yawFrom(st, rep.x, rep.z) - Math.asin(S.collideR / d) - sec.yawMax; check(gap >= 0 && gap <= 0.05, 'repoussoir nie tuż za sektorem', { gap, d }); }   // 0,05 rad ≥ margin 0,02
}

// Towar na kramach: z rolami (motyw #11) buildStallGoods, z ?nokinds=1 stary rozkład HEAD (placeGoodsLegacy).
export function placeGoods(W) { if (W.ctx.flags.nokinds) placeGoodsLegacy(W); else buildStallGoods(W); }

// Stary towar (HEAD): 4 zestawy modeli po kolei, zaplecze losowe. Liczba losowań W.R na kram = 2·|zestaw| + 3 — stallGoodsPlan zużywa DOKŁADNIE tyle samo (legacyDraws).
const LEGACY_GOODS = [
  ['wicker_basket_01', 'food_apple_01', 'food_apple_01'],
  ['ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01'],
  ['wine_bottles_01', 'wooden_bowl_01'],
  ['wooden_bowl_01', 'food_apple_01', 'ceramic_vase_01'],
];
// Losowania W.R kramu i w kolejności HEAD (jitter x i obrót każdego towaru, x zaplecza, wybór modelu zaplecza, obrót zaplecza); zwraca tylko zaplecze.
function legacyDraws(R, i) {
  const goods = LEGACY_GOODS[i % LEGACY_GOODS.length], jit = goods.map(() => [R.range(-0.15, 0.15), R.range(0, 6.28)]);   // jitter ±0,15 i obrót 0–2π jak HEAD
  return { goods, jit, backX: R.range(-0.8, 0.8), backName: R.pick(['wine_barrel_01', 'wooden_crate_01', 'wicker_basket_01']), backRy: R.range(0, 6.28) };   // zaplecze x ±0,8, model, obrót — jak HEAD
}
function placeGoodsLegacy(W) {
  const { R, stalls, put } = W;
  // wektor lokalny kramu → świat tą samą macierzą L co bryła kramu (K2: bez ręcznych sin/cos)
  const stallWorld = (s, lx, lz) => new THREE.Vector3().setFromMatrixPosition(s.L(lx, 0, lz));
  stalls.forEach((s, i) => {
    const d = legacyDraws(R, i);
    d.goods.forEach((g, j) => {
      const lx = -s.cw / 2 + 0.5 + j * (s.cw - 1) / Math.max(1, d.goods.length - 1) + d.jit[j][0];   // gniazda co (cw − 1)/(n − 1) od 0,5 m od krawędzi — jak HEAD
      const p = stallWorld(s, lx, -0.05);
      put(g, p.x, s.ch + 0.04, p.z, d.jit[j][1], 1, { collide: false });   // spód na blacie (ch + pół deski 0,08) — jak HEAD
    });
    // zaplecze kramu: beczka albo skrzynie
    const back = stallWorld(s, d.backX, -1.4);   // 1,4 m za ladą — jak HEAD
    put(d.backName, back.x, 0, back.z, d.backRy);
  });
}

// Plan towaru z ról (funkcja czysta — asercja J w audyt/testy/test_geometria.mjs): dla kramu i rola K = kinds[i % n]. Wszystko w układzie lokalnym kramu
// (+z = front) przez s.L; blat = ch + 0,04 (wierzch deski lady 0,08 na ch). Zwraca [{s, kind, bales: [{key, m, row}], sign: {m, tile, center, valance, normal},
// goods: [{name, scale, lx, lz, x, y, z, ry}], ground: {…}|null, back: {name, x, z, ry}}]. Jitter/obroty z własnego strumienia rng(seed + seedOffset);
// W.R zużywa legacyDraws (te same losowania co HEAD → chorągwie, scatter i reszta sceny bez przetasowania).
export function stallGoodsPlan(W) {
  const { R, CONFIG, stalls } = W, S = CONFIG.stalls, G = S.goods, Sg = CONFIG.houseDetail.sign, tiles = [...Sg.tiles, ...(Sg.extraTiles ?? [])];
  const Rg = rng(CONFIG.seed + G.seedOffset), wp = m => new THREE.Vector3().setFromMatrixPosition(m);
  return stalls.map((s, i) => {
    const K = S.kinds[i % S.kinds.length], d = legacyDraws(R, i), top = s.ch + 0.04, out = { s, kind: K.name, bales: [], goods: [], ground: null };   // 0,04 = pół deski lady (stalls.js box 0,08 na ch)
    // bele sukiennika: piramida rows[0] + rows[1], przekrój w × w, długość len wzdłuż z; górny rząd na dolnym (y + w)
    if (K.bales && !s.model) { const { w, step, rows, len, yaw, lenVar } = G.bale, Rb = rng(CONFIG.seed + G.seedOffset + G.bale.jitterSeed); let k = 0;   // s.model: rolki są już w modelu z Blendera   // rolki wzdłuż lady: rozstaw wzdłuż x, długość wzdłuż z
      rows.forEach((n, row) => { for (let j = 0; j < n; j++) {   // własny strumień Rb: obrót i długość rolek nie przesuwają gniazd towaru (Rg)
        const x = (j - (n - 1) / 2) * step, y = top + w / 2 + row * w, ry = Rb.range(-yaw, yaw), bl = len * (1 - Rb.range(0, lenVar));
        out.bales.push({ key: K.bales[k++ % K.bales.length], m: s.L(x, y, 0, ry), row, x, y, ry, len: bl });   // obrót wokół y: oś rolki zostaje pozioma, więc spód nadal y − w/2
      } }); }
    // szyld kramu: kafelek roli z atlasu na zwisie baldachimu (zwis: plane 0,35 na (0, ph − 0,22, cd/2 + 0,62) w buildStalls), out przed płótnem
    const valZ = s.cd / 2 + 0.62, signY = s.ph - G.sign.below, tile = tiles.indexOf(K.sign);   // 0,62: z płótna zwisu w buildStalls
    out.sign = { tile, m: s.L(0, signY, valZ + G.sign.out), center: wp(s.L(0, signY, valZ + G.sign.out)), valance: wp(s.L(0, s.ph - 0.22, valZ)), normal: new THREE.Vector3(0, 0, 1).transformDirection(M4(0, 0, 0, s.ry)), y0: signY - G.sign.h / 2, y1: signY + G.sign.h / 2 };   // 0,22: y płótna zwisu (ph − 0,22) w buildStalls
    // towar w gniazdach lady (x = slotX ± jitter, z = G.z), spód na blacie
    for (const [j, [name, scale]] of (K.goods ?? []).entries()) { const lx = G.slotX[j % G.slotX.length] + Rg.range(-G.jitter, G.jitter), lz = G.z, p = wp(s.L(lx, 0, lz)); out.goods.push({ name, scale, lx, lz, x: p.x, y: top, z: p.z, ry: Rg.range(0, Math.PI * 2) }); }
    // kosz/garnek na ziemi przy tylnym słupie po stronie przeciwnej niż zaplecze (x zaplecza z legacyDraws)
    if (K.ground) { const lx = -Math.sign(d.backX || 1) * G.ground.x, lz = G.ground.z, p = wp(s.L(lx, 0, lz)); out.ground = { name: K.ground[0], scale: K.ground[1], lx, lz, x: p.x, y: 0, z: p.z, ry: Rg.range(0, Math.PI * 2) }; }
    const back = wp(s.L(d.backX, 0, -1.4)); out.back = { name: K.back ?? d.backName, x: back.x, z: back.z, ry: d.backRy, lx: d.backX };   // −1,4: zaplecze jak HEAD
    return out;
  });
}

// Geometria i modele z planu ról + asercje (liczby z CONFIG.stalls.goods; bryły modeli z W.bounds — nie ręcznie).
export function buildStallGoods(W) {
  const { B, put, bounds, CONFIG, ctx, stalls } = W, S = CONFIG.stalls, G = S.goods, A = CONFIG.houseDetail.sign.atlas;
  const plan = stallGoodsPlan(W);
  check(new Set(plan.map(p => p.kind)).size === Math.min(S.count, S.kinds.length), 'role kramów się powtarzają', { kinds: plan.map(p => p.kind) });
  if (!ctx.flags.nocompose) check(stalls[0].kind === 'sukiennik' && stalls[0].repoussoir, 'repoussoir nie jest sukiennikiem (§5.3)');   // §5.3: kram sukiennika jako repoussoir
  const size = (name, scale) => { const b = bounds.get(name); return { w: (b.max.x - b.min.x) * scale, d: (b.max.z - b.min.z) * scale, h: (b.max.y - b.min.y) * scale }; };
  for (const p of plan) {
    const { s } = p, id = `kram ${p.kind} (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`, top = s.ch + 0.04, { w } = G.bale;   // blat = ch + pół deski 0,08
    for (const b of p.bales) {
      // bela = ROLKA sukna na wałku, wzdłuż lokalnego z (poprawka po zrzutach z telefonu: sześciany 0,28 m czytały się z bliska jak klocki).
      // rotateX(+π/2) na GEOMETRII (+y → +z), nie w macierzy — asercje spodu liczone z b.m zostają w mocy.
      B.add(b.key, cylinder(w / 2, w / 2, b.len, G.bale.seg, 1).rotateX(Math.PI / 2), b.m);
      // wałek: ta sama oś, wystaje `out` z obu końców sukna — bez niego denko rolki jest płaskim wielokątem i czyta się jak plastikowa rura
      const co = G.bale.core;
      B.add('timber', cylinder(co.r, co.r, b.len + 2 * co.out, co.seg, 1).rotateX(Math.PI / 2), b.m);
      check(co.r < w / 2 && b.len + 2 * co.out <= s.cd + 2 * G.overhang, `${id}: wałek beli grubszy od sukna albo dłuższy niż lada + zwis`, { r: co.r, len: b.len + 2 * co.out });
      const lo = new THREE.Vector3(0, -w / 2, 0).applyMatrix4(b.m).y;   // spód beli z TEJ SAMEJ macierzy
      check(Math.abs(lo - (top + b.row * w)) < 0.005, `${id}: bela rzędu ${b.row} nie leży na ${b.row ? 'dolnych belach' : 'blacie'}`, { lo, top });   // 0,005: tolerancja float
      if (b.row) check(p.bales.filter(o => o.row === 0 && Math.min(o.x + w / 2, b.x + w / 2) - Math.max(o.x - w / 2, b.x - w / 2) >= 0.05).length >= 2, `${id}: górna bela bez dwóch podpór`, { x: b.x });   // przekrycie ≥ 0,05 m z dwiema dolnymi (jest 0,08)
    }
    check(p.bales.length === 0 || G.bale.len <= s.cd + 2 * G.overhang, `${id}: bela dłuższa niż lada + zwis`, { len: G.bale.len });
    // obrócone rolki nie mogą wejść w sąsiednią w rzędzie: półzasięg w x = len/2 · sin(yaw) + w/2 · cos(yaw) ≤ step/2
    check(p.bales.length === 0 || G.bale.len / 2 * Math.sin(G.bale.yaw) + w / 2 * Math.cos(G.bale.yaw) <= G.bale.step / 2 + 1e-9, `${id}: obrócone rolki zachodzą na siebie`, { yaw: G.bale.yaw, step: G.bale.step });
    if (!ctx.flags.nosign) {   // ?nosign=1: mat.sign to szyld tekstowy HEAD, bez atlasu — szyldy kramów pomijane
      check(p.sign.tile >= 0, `${id}: brak kafelka szyldu w atlasie`, { sign: S.kinds.find(k => k.name === p.kind).sign });
      if (p.sign.tile >= 0) B.add('sign', tilePlane(G.sign.w, G.sign.h, signTileUV(p.sign.tile, A)), p.sign.m);
      check(p.sign.normal.dot(new THREE.Vector3(0, 0, 1).transformDirection(p.sign.m)) >= 0.98, `${id}: szyld nie frontem kramu`);   // 0,98 jak test A
      checkInFrontOfWall(`${id} szyld`, p.sign.center, p.sign.valance, p.sign.normal, 0.01);   // K5: ≥ 0,01 przed płótnem (próg bezwzględny, nie z CONFIG — kalibracja: out −0,04 ma oblać)
      check(p.sign.center.clone().sub(p.sign.valance).dot(p.sign.normal) <= G.sign.out + 0.005, `${id}: szyld dalej niż out od zwisu`);   // 0,005: tolerancja float
      check(p.sign.y1 <= s.ph - 0.1 - 0.005 && p.sign.y1 <= s.ph - 0.22 + 0.175 && p.sign.y0 >= s.ph - 0.22 - 0.175 - 0.05, `${id}: szyld poza zwisem / w belce`, { y0: p.sign.y0, y1: p.sign.y1 });   // belka box 0,1 na ph − 0,05 → spód ph − 0,1; zwis 0,35 na ph − 0,22; szyld może zwisać ≤ 0,05 pod płótnem
    }
    for (const g of p.goods) {
      const sz = size(g.name, g.scale), r = Math.max(sz.w, sz.d) / 2;   // obrót ry dowolny → obrys kołem
      check(Math.abs(g.lx) + r <= s.cw / 2 + G.overhang && Math.abs(g.lz) + r <= s.cd / 2 + G.overhang, `${id}: ${g.name} wystaje poza blat`, { lx: g.lx, lz: g.lz, r });
      const ok = put(g.name, g.x, g.y, g.z, g.ry, g.scale, { collide: false });
      check(ok, `${id}: ${g.name} obcięty limitem cuts.maxCount`);
    }
    if (p.ground) {
      const sz = size(p.ground.name, p.ground.scale), r = Math.max(sz.w, sz.d) / 2, gd = p.ground;
      check(Math.hypot(gd.lx, gd.lz) + r <= S.collideR, `${id}: ${gd.name} na ziemi poza kołem kolizji kramu`, { lx: gd.lx, lz: gd.lz, r });
      check(Math.hypot(gd.lx - p.back.lx, gd.lz + 1.4) >= r + Math.max(...Object.values(size(p.back.name, 1)).slice(0, 2)) / 2, `${id}: ${gd.name} wchodzi w zaplecze`, { lx: gd.lx, backX: p.back.lx });   // −1,4: z zaplecza jak HEAD
      check(Math.hypot(Math.abs(gd.lx) - (s.cw / 2 - 0.1), Math.abs(gd.lz) - (s.cd / 2 + 0.6)) >= r + 0.06, `${id}: ${gd.name} w słupie`, { lx: gd.lx, lz: gd.lz });   // słup 0,12 na (±(cw/2 − 0,1), ±(cd/2 + 0,6)) ze stalls.js
      put(gd.name, gd.x, gd.y, gd.z, gd.ry, gd.scale);
    }
    put(p.back.name, p.back.x, 0, p.back.z, p.back.ry);
  }
  W.stallGoods = plan;
}
