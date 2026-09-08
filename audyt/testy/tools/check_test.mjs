// Test asercji engine/src/check.js na liczbach z buildings.js/layout.js (CONFIG.house), bez przeglądarki (~1 s).
// Uruchom: node audyt/testy/tools/check_test.mjs → oczekiwane 8 nieudanych asercji (celowo złe dane: 7 FAIL + 1 dodatkowy wpis pary koplanarnej)
// i 0 fałszywych alarmów w wierszach OK; kod wyjścia 1, gdy liczba ≠ 8.
// 'three' w check.js to bare import, którego Node nie znajdzie z engine/src (three leży w tools/node_modules), więc hook resolve
// (module.registerHooks, Node ≥ 22.15) kieruje 'three' na ../../../tools/node_modules/three — ten sam plik, który importuje test (jedna kopia three, bez bundla).
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
let threeDir = resolve(here, '../../../tools/node_modules/three');
if (!existsSync(threeDir)) threeDir = '/home/user/projekt/tools/node_modules/three'; // worktree nie ma tools/node_modules
const threeUrl = pathToFileURL(resolve(threeDir, 'build/three.module.js')).href;
registerHooks({ resolve(spec, ctx, next) { return spec === 'three' ? { url: threeUrl, shortCircuit: true } : next(spec, ctx); } });
const THREE = await import(threeUrl);
const { check, checkInFrontOfWall, checkHeight, checkAboveGround, checkNoCoplanar, checkCollisionCovers, checkAboveSurface, facadeNormal, checkFailures } = await import('../../../engine/src/check.js');

const M4 = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
const H = { depth: 8, floorHeight: 2.9, groundFloor: 3.2, jetty: 0.35 }, half = 22;
// dom na pierzei wschodniej (side 1): sideTransform → x = half + depth/2, ry = -PI/2; fasada lokalne +z → świat -x
const tr = { x: half + H.depth / 2, z: 5, ry: -Math.PI / 2 };
const L = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry));
const n = facadeNormal(tr.ry); console.log('normalna fasady side1', n.toArray().map(v => +v.toFixed(2)));
const jet = H.jetty, fd = H.depth + jet, front = jet / 2 + fd / 2; // jak w buildings.js dla 1. piętra
const y = H.groundFloor + H.floorHeight * 0.55;
console.log('OK   okno front+0.01 :', checkInFrontOfWall('okno', L(0, y, front + 0.01), L(0, y, front), n));   // z buildings.js: okno 1 cm przed licem
console.log('FAIL okno front-0.02 :', checkInFrontOfWall('okno_zle', L(0, y, front - 0.02), L(0, y, front), n)); // celowo w ścianie
console.log('OK   posąg 2.6 m      :', checkHeight('horse_statue_01', new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 3.1, 1)), 2.6 / 3.1, 2.4, 2.8));
console.log('FAIL latarnia 5 m     :', checkHeight('wooden_lantern_01', new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)), 5, 0.4, 0.7));
console.log('OK   nad ziemią       :', checkAboveGround('beczka', new THREE.Box3(new THREE.Vector3(-0.4, -0.01, -0.4), new THREE.Vector3(0.4, 0.9, 0.4))));
console.log('FAIL pod ziemią       :', checkAboveGround('pień', new THREE.Box3(new THREE.Vector3(-0.4, -0.3, -0.4), new THREE.Vector3(0.4, 0.9, 0.4))));
// koplanarne: dwa plane 'cloth0' w tym samym z (z-fighting) vs. przesunięte o 1 cm
const p = (z) => { const g = new THREE.PlaneGeometry(2, 1); g.applyMatrix4(M4(0, 2, z)); return g; };
console.log('FAIL koplanarne       :', checkNoCoplanar('cloth0', [p(1.0), p(1.0)]));
console.log('OK   1 cm odstępu     :', checkNoCoplanar('cloth0', [p(1.0), p(1.01)]));
// kolizja: dom side 0 w=8 d=8 przy tr → addRect(tr.x, tr.z, w/2, d/2) jak w buildings.js
const houseBox = new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 12, 4)).applyMatrix4(M4(3, 0, -26));
console.log('OK   rect domu        :', checkCollisionCovers('dom', houseBox, { x: 3, z: -26, hw: 4, hd: 4 }));
console.log('FAIL rect za mały     :', checkCollisionCovers('dom', houseBox, { x: 3, z: -26, hw: 2, hd: 4 }));
console.log('OK   koło beczki      :', checkCollisionCovers('Barrel_01', new THREE.Box3(new THREE.Vector3(9.6, 0, -7.4), new THREE.Vector3(10.4, 0.9, -6.6)), { x: 10, z: -7, r: 0.36 })); // put(): r = max(w,d)/2*0.9
console.log('FAIL koło obok        :', checkCollisionCovers('Barrel_01', new THREE.Box3(new THREE.Vector3(9.6, 0, -7.4), new THREE.Vector3(10.4, 0.9, -6.6)), { x: 12, z: -7, r: 0.36 }));
// nad połacią (motyw #12): spód okna lukarny vs wierzch płyty roofTopY(zFront) = 10.716 (PROMPT §5.2 #12, y 9, jet 0.7, pitch 0.85, zFront 3.65)
console.log('OK   okno lukarny +0.10:', checkAboveSurface('lukarna okno', L(0, 10.716 + 0.10, 3.65), 10.716, 0.05));  // spód okna 0.10 nad wierzchem
console.log('FAIL okno HEAD −0.44   :', checkAboveSurface('lukarna okno HEAD', L(0, 9.50, 4.42), 9.94, 0.05));     // HEAD: spód 9.50 vs wierzch 9.94 — zakopane
console.log('nieudanych asercji:', checkFailures(), '(oczekiwane 8: 7 FAIL + 1 dodatkowy wpis pary koplanarnej)');
process.exit(checkFailures() === 8 ? 0 : 1);
