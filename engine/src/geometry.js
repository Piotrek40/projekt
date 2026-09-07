// Geometrie z UV w skali świata (tekstura powtarza się co `metersPerTile` metrów niezależnie od rozmiaru bryły),
// scalanie geometrii per materiał (mało draw calls) i deterministyczna losowość.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

// Prostopadłościan z UV w metrach. Ściany: +x,-x (d×h), +y,-y (w×d), +z,-z (w×h). uvOffset rozbija powtarzalność.
export function box(w, h, d, mpt = 2, uvOffset = [0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceSize = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4), [fw, fh] = faceSize[f];
    uv.setXY(i, uv.getX(i) * fw / mpt + uvOffset[0], uv.getY(i) * fh / mpt + uvOffset[1]);
  }
  return g;
}

// Płaszczyzna (w×h) z UV w metrach, leżąca w XY, normalna +z.
export function plane(w, h, mpt = 2, uvOffset = [0, 0]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / mpt + uvOffset[0], uv.getY(i) * h / mpt + uvOffset[1]);
  return g;
}

// Trójkątny szczyt (gable): podstawa w, wysokość h, grubość t; w płaszczyźnie XY, wyciągnięty wzdłuż z.
export function gable(w, h, t, mpt = 2) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mpt, uv.getY(i) / mpt);
  return g;
}

// Walec z UV w metrach (obwód × wysokość); do słupów, kolumn, fontanny.
export function cylinder(rTop, rBot, h, seg = 12, mpt = 2, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  const uv = g.attributes.uv, circ = Math.PI * (rTop + rBot);
  const sideCount = (seg + 1) * 2;
  for (let i = 0; i < uv.count; i++) {
    if (i < sideCount) uv.setXY(i, uv.getX(i) * circ / mpt, uv.getY(i) * h / mpt);
    else uv.setXY(i, uv.getX(i) * rTop * 2 / mpt, uv.getY(i) * rTop * 2 / mpt);
  }
  return g;
}

// Zbiera geometrie per klucz materiału i scala je w jeden mesh na materiał.
export class Batch {
  constructor() { this.groups = new Map(); }
  add(key, geometry, matrix) {
    let g = geometry.clone(); if (g.index) g = g.toNonIndexed(); // scalanie wymaga jednolitego indeksowania
    if (matrix) g.applyMatrix4(matrix);
    if (!this.groups.has(key)) this.groups.set(key, []);
    this.groups.get(key).push(g);
  }
  // wygoda: pozycja/rotacja/skala zamiast macierzy
  place(key, geometry, x, y, z, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.add(key, geometry, m);
  }
  build(materials, scene, opts = {}) {
    const meshes = [];
    for (const [key, geos] of this.groups) {
      const mat = materials[key]; if (!mat) { console.warn('brak materiału', key); continue; }
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      // opts.noShadow (RegExp na klucz): małe/cienkie elementy (girlandy, lampiony, strumienie, szyldy) nie rzucają cienia — oszczędza pass cieni
      mesh.castShadow = !(opts.noShadow?.test(key)) && (opts.castShadow ?? true); mesh.receiveShadow = opts.receiveShadow ?? true;
      // opts.renderOrder ({klucz: n}): kolejność rysowania obiektów przezroczystych (three sortuje je po odległości środka — lustro wody przykrywało kręgi)
      if (opts.renderOrder?.[key] !== undefined) mesh.renderOrder = opts.renderOrder[key];
      mesh.name = key;
      scene.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
}

export const M4 = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
