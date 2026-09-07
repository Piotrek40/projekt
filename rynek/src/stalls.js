// Kramy: konstrukcja z belek i desek, baldachim z tkaniny, towar na ladzie, zaplecze.
import { box, plane, M4 } from '../../engine/src/geometry.js';

export function buildStalls(W) {
  const { ctx, R, CONFIG, P, T, B } = W;
  const stalls = [];
  for (let i = 0; i < CONFIG.stalls.count; i++) {
    const a = (i / CONFIG.stalls.count) * Math.PI * 2 + R.range(-0.15, 0.15);
    const rad = CONFIG.stalls.ringRadius + R.range(-1.5, 1.5);
    const x = Math.sin(a) * rad, z = Math.cos(a) * rad, ry = a + Math.PI + R.range(-0.2, 0.2); // front do fontanny
    const L = (lx, ly, lz, lry = 0, lrx = 0, lrz = 0) => M4(lx, ly, lz, lry, lrx, lrz).premultiply(M4(x, 0, z, ry));
    const cw = 2.6, cd = 1.0, ch = 0.95, ph = 2.3;
    B.add('planks', box(cw, 0.08, cd, T.planks.mpt), L(0, ch, 0));
    B.add('planks', box(cw, ch - 0.1, 0.06, T.planks.mpt), L(0, (ch - 0.1) / 2, cd / 2 - 0.03));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.12, ph, 0.12, T.timber.mpt), L(sx * (cw / 2 - 0.1), ph / 2, sz * (cd / 2 + 0.6)));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph - 0.05, cd / 2 + 0.6));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph + 0.35, -(cd / 2 + 0.6)));
    // baldachim: jedna połać opadająca ku przodowi, plus zwis z przodu
    const cloth = 'cloth' + R.int(0, P.cloth.length - 1);
    const depth = cd + 1.4, rise = 0.4, slope = Math.hypot(depth, rise);
    B.add(cloth, plane(cw + 0.5, slope, 1), L(0, ph + 0.15, 0, 0, -Math.PI / 2 + Math.atan2(rise, depth)));
    B.add(cloth, plane(cw + 0.5, 0.35, 1), L(0, ph - 0.22, cd / 2 + 0.62));
    stalls.push({ x, z, ry, cw, ch, L, cloth });
    // kolizja: prostokąt przybliżony kołem (kramy są obrócone)
    ctx.addCircle(x, z, 1.6);
    W.dbgCircle?.(x, z, 1.6); W.dbgAxes?.(x, 0.05, z, ry, 1.2); // ?boxes=1: L(0,0,0) kramu, niebieska oś +z = front (do fontanny)
  }
  W.stalls = stalls;
}

export function placeGoods(W) {
  const { R, stalls, put } = W;
  // wektor lokalny kramu → świat
  const stallWorld = (s, lx, lz) => ({ x: s.x + Math.sin(s.ry) * lz + Math.cos(s.ry) * lx, z: s.z + Math.cos(s.ry) * lz - Math.sin(s.ry) * lx });
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
