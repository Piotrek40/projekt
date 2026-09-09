// Lineup materiałów (?lineup=1 albo ?lineup=<prefiks klucza>, np. ?lineup=plaster): zamiast rynku — dla każdego klucza W.mat kula r=0,5 m
// (roughness/odbicia HDRI) + sześcian 0,7 m z UV 1 kafel/metr (tiling tekstur w metrach) + etykieta z nazwą klucza.
// Układ: 7 kolumn co 1,5 m wzdłuż x, rzędy co 8 m w głąb (−z; przy 3 m sześciany rzędu k zasłaniały kule rzędu k+1, a cienie etykiet 2,25 m
// przy słońcu 30° = 3,9 m padały na następny rząd — §4.3.3), pierwszy rząd na z=−2; etykiety patrzą w +z (na kamerę stojącą przy z>0).
// Liczba rzędów = ceil(kluczy/7), podłoga pod WSZYSTKIMI rzędami (plane(60, 8·rows + 20) na z = −(8·rows)/2 + 6).
// Widoki: audyt/testy/views_lineup.json GENEROWANY (node audyt/testy/tools/views_lineup.mjs: widok k = {x:0, z: z0 − 8k + 6, yaw:0, pitch:−0.08}, kamera 6 m
// przed rzędem, 1280×720). mat.sign/clock powstają dopiero w buildBanners/buildTower, więc ich tu nie ma. MAT_KEYS = kolejność kluczy W.mat z materials.js
// (dla narzędzi offline: lineup_rects.mjs, views_lineup.mjs); asercja niżej pilnuje, że lista jest aktualna.
import * as THREE from 'three';
import { box, plane } from '../../engine/src/geometry.js';
import { check } from '../../engine/src/check.js';

function labelTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff'; g.font = 'bold 30px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Stałe układu — z nich audyt/testy/tools/lineup_rects.mjs liczy prostokąty pomiaru (bez renderu), więc zmiana tutaj = przeliczenie rects.
export const LINEUP = { cols: 7, step: 1.5, row: 8.0, z0: -2, r: 0.5, ySphere: 0.5, cube: 0.7, yCube: 1.55, yLabel: 2.25, camDist: 6, camPitch: -0.08, floorPad: 20 }; // camDist/camPitch: kamera widoku rzędu; floorPad: zapas podłogi za ostatnim rzędem i przed pierwszym (m)
export const MAT_KEYS = ['cobble', 'stone', 'blocks', 'slates', 'timber', 'planks', 'door', 'plaster0', 'plaster1', 'plaster2', 'plaster3', 'plaster4', 'roof0', 'roof1', 'roof2', 'roofTower', 'paint0', 'paint1', 'paint2', 'cloth0', 'cloth1', 'cloth2', 'cloth3', 'glass', 'glassLit', 'iron', 'rope', 'contact', 'water', 'jet', 'ripple', 'splash', 'wet', 'flame', 'bunting', 'paperLit', 'banner0', 'banner1', 'banner2', 'banner3'];   // = Object.keys(W.mat) po buildMaterials — odczytane z window.__lineup prawdziwego renderu, nie z pamięci.
// Lista rośnie razem z materiałami sceny. Etap 3 dołożył: rope (liny girland), contact (cień pod kramem) — bez ich wpisania
// asercja niżej oblewała, czyli KAŻDY render ?lineup=1 miał errors ≠ [] i procedura doboru koloru z §4.3.3 była zablokowana.
export const lineupRows = n => Math.ceil(n / LINEUP.cols);
export const lineupView = k => ({ name: 'row' + k, x: 0, z: LINEUP.z0 - k * LINEUP.row + LINEUP.camDist, yaw: 0, pitch: LINEUP.camPitch }); // kamera camDist m przed rzędem k
export function buildLineup(W, filter = '1') {
  const { ctx, scene, mat, B, T } = W;
  const keys = Object.keys(mat).filter(k => filter === '1' || k.startsWith(filter));
  if (filter === '1') check(keys.join() === MAT_KEYS.filter(k => !(ctx.flags.nopalette && k.startsWith('paint'))).join(), 'lineup: MAT_KEYS ≠ Object.keys(W.mat) — zaktualizuj MAT_KEYS w lineup.js i przelicz lineup_rects', { keys }); // ?nopalette=1: bez paint0..2
  const COLS = LINEUP.cols, STEP = LINEUP.step, ROW = LINEUP.row, rows = lineupRows(keys.length);
  ctx.addWalkable(0, 0, 30, 30);
  B.place('cobble', plane(60, ROW * rows + LINEUP.floorPad, T.cobble.mpt), 0, 0, -(ROW * rows) / 2 + LINEUP.camDist, 0, -Math.PI / 2); // rot: rx=−π/2 → normalna (0,0,1) → (0,1,0), podłoga licem do góry (policzone, jak layout.js); z od −ROW·rows − 4 do +16: pod wszystkimi rzędami i pod kamerą rzędu 0
  keys.forEach((k, i) => {
    const x = (i % COLS - (COLS - 1) / 2) * STEP, z = LINEUP.z0 - Math.floor(i / COLS) * ROW;
    B.place(k, new THREE.SphereGeometry(LINEUP.r, 32, 16), x, LINEUP.ySphere, z);
    B.place(k, box(LINEUP.cube, LINEUP.cube, LINEUP.cube, 1), x, LINEUP.yCube, z);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: labelTexture(k) }));
    lab.position.set(x, LINEUP.yLabel, z); scene.add(lab);   // etykieta patrzy w +z, czyli na kamerę stojącą przy z > 0
  });
  B.build(mat, scene);
  W.lineupRows = rows;
  window.__lineup = { keys, LINEUP }; // render_scene.js zapisuje to do results.json (kolejność kluczy = kolejność kul)
}
