// Kramy: konstrukcja z belek i desek, baldachim z tkaniny, towar na ladzie, zaplecze.
// Układ lokalny kramu: początek na środku lady na ziemi, +x wzdłuż lady, +y w górę, +z = FRONT (do fontanny). Metry. Do świata tylko przez L().
// Motyw #7 (?nocompose=1 = pierścień jak na HEAD): stallPlacements() (funkcja czysta) — kram 0 = repoussoir na skraju pierścienia tuż za sektorem
// startowym, faza pierścienia = jego kąt; żaden kram (całe koło kolizji) w sektorze CONFIG.composition.stallFreeSector od startu. Role kramów: motyw #11.
import * as THREE from 'three';
import { box, plane, M4 } from '../../engine/src/geometry.js';
import { check } from '../../engine/src/check.js';

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
    out.push({ x, z, ry, a, rad, repoussoir: !!rep && i === 0, cloth: 'cloth' + R.int(0, P.cloth.length - 1) });
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
    B.add('planks', box(cw, 0.08, cd, T.planks.mpt), L(0, ch, 0));
    B.add('planks', box(cw, ch - 0.1, 0.06, T.planks.mpt), L(0, (ch - 0.1) / 2, cd / 2 - 0.03));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.12, ph, 0.12, T.timber.mpt), L(sx * (cw / 2 - 0.1), ph / 2, sz * (cd / 2 + 0.6)));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph - 0.05, cd / 2 + 0.6));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph + 0.35, -(cd / 2 + 0.6)));
    // baldachim: jedna połać opadająca ku przodowi, plus zwis z przodu
    const cloth = p.cloth;
    const depth = cd + 1.4, rise = 0.4, slope = Math.hypot(depth, rise);
    B.add(cloth, plane(cw + 0.5, slope, 1), L(0, ph + 0.15, 0, 0, -Math.PI / 2 + Math.atan2(rise, depth)));   // rot: rx=−1.406 → normalna (0,0,1)→(0, 0.986, 0.164) licem w górę, góra płótna (0,1,0)→(0, 0.164, −0.986): tył wyżej, płótno opada ku +z (front) — policzone
    B.add(cloth, plane(cw + 0.5, 0.35, 1), L(0, ph - 0.22, cd / 2 + 0.62));
    stalls.push({ x, z, ry, cw, ch, L, cloth, repoussoir: p.repoussoir });
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

export function placeGoods(W) {
  const { R, stalls, put } = W;
  // wektor lokalny kramu → świat tą samą macierzą L co bryła kramu (K2: bez ręcznych sin/cos)
  const stallWorld = (s, lx, lz) => new THREE.Vector3().setFromMatrixPosition(s.L(lx, 0, lz));
  const goodsSets = [
    ['wicker_basket_01', 'food_apple_01', 'food_apple_01'],
    ['ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01'],
    ['wine_bottles_01', 'wooden_bowl_01'],
    ['wooden_bowl_01', 'food_apple_01', 'ceramic_vase_01'],
  ];
  stalls.forEach((s, i) => {
    const goods = goodsSets[i % goodsSets.length];
    goods.forEach((g, j) => {
      const lx = -s.cw / 2 + 0.5 + j * (s.cw - 1) / Math.max(1, goods.length - 1) + R.range(-0.15, 0.15);
      const p = stallWorld(s, lx, -0.05);
      put(g, p.x, s.ch + 0.04, p.z, R.range(0, 6.28), 1, { collide: false });
    });
    // zaplecze kramu: beczka albo skrzynie
    const back = stallWorld(s, R.range(-0.8, 0.8), -1.4);
    put(R.pick(['wine_barrel_01', 'wooden_crate_01', 'Barrel_01']), back.x, 0, back.z, R.range(0, 6.28));
  });
}
