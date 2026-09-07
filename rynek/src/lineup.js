// Lineup materiałów (?lineup=1 albo ?lineup=<prefiks klucza>, np. ?lineup=plaster): zamiast rynku — dla każdego klucza W.mat kula r=0,5 m
// (roughness/odbicia HDRI) + sześcian 0,7 m z UV 1 kafel/metr (tiling tekstur w metrach) + etykieta z nazwą klucza.
// Układ: 7 kolumn co 1,5 m wzdłuż x, rzędy co 3 m w głąb (−z), pierwszy rząd na z=−2; etykiety patrzą w +z (na kamerę stojącą przy z>0).
// Widoki: audyt/testy/views_lineup.json (kamera 6 m przed rzędem, 1280×720). mat.sign powstaje dopiero w buildBanners, więc go tu nie ma.
import * as THREE from 'three';
import { box, plane } from '../../engine/src/geometry.js';

function labelTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff'; g.font = 'bold 30px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Stałe układu — z nich audyt/testy/tools/lineup_rects.mjs liczy prostokąty pomiaru (bez renderu), więc zmiana tutaj = przeliczenie rects.
export const LINEUP = { cols: 7, step: 1.5, row: 3.0, z0: -2, r: 0.5, ySphere: 0.5, cube: 0.7, yCube: 1.55, yLabel: 2.25 };
export function buildLineup(W, filter = '1') {
  const { ctx, scene, mat, B, T } = W;
  const keys = Object.keys(mat).filter(k => filter === '1' || k.startsWith(filter));
  const COLS = LINEUP.cols, STEP = LINEUP.step, ROW = LINEUP.row;
  ctx.addWalkable(0, 0, 30, 30);
  B.place('cobble', plane(60, 60, T.cobble.mpt), 0, 0, 0, 0, -Math.PI / 2);
  keys.forEach((k, i) => {
    const x = (i % COLS - (COLS - 1) / 2) * STEP, z = LINEUP.z0 - Math.floor(i / COLS) * ROW;
    B.place(k, new THREE.SphereGeometry(LINEUP.r, 32, 16), x, LINEUP.ySphere, z);
    B.place(k, box(LINEUP.cube, LINEUP.cube, LINEUP.cube, 1), x, LINEUP.yCube, z);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: labelTexture(k) }));
    lab.position.set(x, LINEUP.yLabel, z); scene.add(lab);   // etykieta patrzy w +z, czyli na kamerę stojącą przy z > 0
  });
  B.build(mat, scene);
  W.lineupRows = Math.ceil(keys.length / COLS);
  window.__lineup = { keys, LINEUP }; // render_scene.js zapisuje to do results.json (kolejność kluczy = kolejność kul)
}
