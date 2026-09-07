// Dziedziniec — scena demonstracyjna z etapu 0, teraz na wspólnym silniku (engine/).
import * as THREE from 'three';
import { createApp } from '../../engine/src/app.js';

const CONFIG = {
  courtyard: { size: 14, wallHeight: 3.2, wallThickness: 0.4 },
  sky: { sunIntensity: 3.5, environmentIntensity: 0.35, distance: 40, shadowExtent: 9 },
  textures: {
    ground: { name: 'stone_tiles_02', metersPerTile: 2.0 },
    wall:   { name: 'castle_brick_02_red', metersPerTile: 3.0 },
    plinth: { name: 'medieval_blocks_03', metersPerTile: 1.5 },
  },
  props: [
    { model: 'wooden_table_02', x: -2.6, z: -4.6, rotY: 0.15, collider: 1.0 },
    { model: 'wine_bottles_01', on: 'wooden_table_02', dx: -0.15, dz: 0.0, rotY: 0.15 },
    { model: 'Lantern_01', on: 'wooden_table_02', dx: 0.55, dz: 0.15, rotY: 0.6 },
    { model: 'Barrel_01', x: 4.6, z: -5.4, rotY: 0.4, collider: 0.5 },
    { model: 'potted_plant_02', x: -5.6, z: -1.6, rotY: 1.2, collider: 0.5 },
    { model: 'rock_moss_set_01', x: 2.6, z: 0.8, rotY: 2.1, collider: 0.9 },
    { model: 'marble_bust_01', on: 'plinth', rotY: 0.35 },
  ],
  plinth: { x: 1.4, z: -4.9, w: 0.55, h: 1.05, collider: 0.5 },
};

async function buildWorld(ctx) {
  const { scene, loaders } = ctx;
  const S = CONFIG.courtyard.size, H = CONFIG.courtyard.wallHeight, T = CONFIG.courtyard.wallThickness;
  await ctx.sky(CONFIG.sky);
  ctx.addWalkable(0, 0, S / 2, S / 2);

  const g = CONFIG.textures.ground;
  const groundSet = await ctx.loadPbrSet(g.name, { metersPerTile: g.metersPerTile });
  const groundMat = groundSet.material();
  for (const k of ['map', 'normalMap', 'aoMap']) groundMat[k].repeat.set(S / g.metersPerTile, S / g.metersPerTile);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const w = CONFIG.textures.wall;
  const wallSet = await ctx.loadPbrSet(w.name, { metersPerTile: w.metersPerTile });
  const wallMat = (rx, ry) => { const m = wallSet.material(); for (const k of ['map', 'normalMap', 'aoMap']) { m[k] = m[k].clone(); m[k].repeat.set(rx, ry); m[k].needsUpdate = true; } m.roughnessMap = m.metalnessMap = m.aoMap; return m; };
  const mLong = wallMat(S / w.metersPerTile, H / w.metersPerTile), mEnd = wallMat(T / w.metersPerTile, H / w.metersPerTile), mTop = wallMat(S / w.metersPerTile, T / w.metersPerTile);
  const wallMats = [mEnd, mEnd, mTop, mTop, mLong, mLong];
  const wallGeo = new THREE.BoxGeometry(S + 2 * T, H, T);
  for (const wl of [{ x: 0, z: -S / 2 - T / 2, rot: 0 }, { x: 0, z: S / 2 + T / 2, rot: 0 }, { x: -S / 2 - T / 2, z: 0, rot: Math.PI / 2 }, { x: S / 2 + T / 2, z: 0, rot: Math.PI / 2 }]) {
    const m = new THREE.Mesh(wallGeo, wallMats); m.position.set(wl.x, H / 2, wl.z); m.rotation.y = wl.rot; m.castShadow = m.receiveShadow = true; scene.add(m);
  }

  const p = CONFIG.plinth, pt = CONFIG.textures.plinth;
  const plinthSet = await ctx.loadPbrSet(pt.name, { metersPerTile: pt.metersPerTile });
  const plinthMat = plinthSet.material();
  for (const k of ['map', 'normalMap', 'aoMap']) plinthMat[k].repeat.set(p.w / pt.metersPerTile, p.h / pt.metersPerTile);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.w), plinthMat);
  plinth.position.set(p.x, p.h / 2, p.z); plinth.castShadow = plinth.receiveShadow = true; scene.add(plinth);
  ctx.addCircle(p.x, p.z, p.collider);

  const props = new Map([['plinth', plinth]]);
  const names = [...new Set(CONFIG.props.map(pr => pr.model))];
  const loaded = new Map(await Promise.all(names.map(async n => [n, await loaders.loadModel(n)])));
  for (const pr of CONFIG.props) {
    const obj = loaded.get(pr.model).scene.clone(true);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    obj.rotation.y = pr.rotY || 0;
    if (pr.on) {
      const parent = props.get(pr.on); const box = new THREE.Box3().setFromObject(parent);
      obj.position.set(parent.position.x + (pr.dx || 0), box.max.y, parent.position.z + (pr.dz || 0));
    } else { obj.position.set(pr.x, 0, pr.z); if (pr.collider) ctx.addCircle(pr.x, pr.z, pr.collider); }
    scene.add(obj); props.set(pr.model, obj);
  }
}

createApp({ buildWorld, player: { start: { x: 3.0, z: 4.5, yaw: Math.PI * 0.08 }, speed: 2.2 } });
