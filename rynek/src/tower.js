// Wieża ratusza — landmark placu (dziś: kwadratowa, dach ostrosłupowy, wejście od strony placu).
import * as THREE from 'three';
import { box, plane, cylinder } from '../../engine/src/geometry.js';

export function buildTower(W) {
  const { ctx, CONFIG, T, B, half, sw } = W;
  {
    const tw = CONFIG.tower.size, th = CONFIG.tower.height, rh = CONFIG.tower.roofHeight;
    const tx = sw / 2 + tw / 2 + 0.5, tz = -half - tw / 2 - 0.2;
    B.place('slates', box(tw, th, tw, T.slates.mpt), tx, th / 2, tz);
    ctx.addRect(tx, tz, tw / 2, tw / 2);
    // gzyms, okna strzelnicze, zegar-tarcza, dach ostrosłupowy
    B.place('blocks', box(tw + 0.6, 0.5, tw + 0.6, T.blocks.mpt), tx, th - 0.25, tz);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, ox = Math.sin(a) * (tw / 2 + 0.01), oz = Math.cos(a) * (tw / 2 + 0.01);
      B.place('glassLit', box(0.7, 1.6, 0.08), tx + ox, th - 3.2, tz + oz, a);
      B.place('glass', box(0.5, 1.2, 0.08), tx + ox, th - 8, tz + oz, a);
      B.place('timber', box(0.9, 0.1, 0.16, T.timber.mpt), tx + ox, th - 2.35, tz + oz, a);
    }
    const roofG = new THREE.ConeGeometry(tw / 2 * 1.45, rh, 4, 1);
    roofG.rotateY(Math.PI / 4);
    { const uv = roofG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tw * 2 / T.roof.mpt, uv.getY(i) * rh / T.roof.mpt); }
    B.place('roofTower', roofG, tx, th + rh / 2, tz);
    B.place('iron', cylinder(0.05, 0.05, 2.2, 6, 1), tx, th + rh + 1.0, tz);
    B.place('banner2', plane(1.4, 0.9, 1), tx + 0.7, th + rh + 1.6, tz);
    // zadaszone wejście
    B.place('blocks', box(2.2, 0.4, 1.4, T.blocks.mpt), tx, 3.0, tz + tw / 2 + 0.6);
    B.place('door', box(1.6, 2.8, 0.1, 1.6), tx, 1.4, tz + tw / 2 + 0.03);
  }
}
