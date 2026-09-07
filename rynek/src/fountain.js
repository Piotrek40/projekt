// Fontanna: cembrowina, kolumna, woda (animowana normalna), schodek i kolizja.
import * as THREE from 'three';
import { cylinder } from '../../engine/src/geometry.js';

export function buildFountain(W) {
  const { ctx, scene, CONFIG, B, mat } = W;
  {
    const F = CONFIG.fountain, r = F.radius;
    const bm = F.blockScale;
    B.place('blocks', cylinder(r, r + 0.1, F.rim, 8, bm), 0, F.rim / 2, 0);
    B.place('blocks', cylinder(r + 0.25, r + 0.25, 0.14, 8, bm), 0, F.rim + 0.07, 0);
    B.place('blocks', cylinder(0.7, 0.85, F.columnHeight, 8, bm), 0, F.rim + F.columnHeight / 2, 0);
    B.place('blocks', cylinder(1.2, 1.0, 0.3, 8, bm), 0, F.rim + F.columnHeight + 0.15, 0);
    // schodek wokół
    B.place('blocks', cylinder(r + 1.1, r + 1.2, 0.18, 8, bm), 0, 0.09, 0);
    ctx.addCircle(0, 0, r + 1.0);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.05, 32), mat.water);
    water.rotation.x = -Math.PI / 2; water.position.y = F.rim - 0.1; water.receiveShadow = true;
    scene.add(water);
    if (!ctx.flags.nowater) ctx.updaters.push((dt, t) => { mat.water.normalMap.offset.set((t * 0.02) % 1, (t * 0.013) % 1); });
  }
}
