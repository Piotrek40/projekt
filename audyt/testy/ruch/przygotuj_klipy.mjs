// Wytworzenie KOMPLETU danych pomiarowych dla test_ruch.mjs z surowych BVH (ACCAD, CC-BY 3.0):
//   BVH → GLB (three r185, bez Blendera) → harmonogram kontaktu <klip>.kontakt.json → manifest.json
//   + syntetyczne dane dla K9 (log odtwarzania silnika) i K12 (harmonogram mrugnięć), których w mocapie nie ma.
//
// Użycie:
//   node audyt/testy/ruch/przygotuj_klipy.mjs <katalog_z_BVH_ACCAD> <katalog_wyjściowy>
//   RUCH_KLIPY=<katalog_wyjściowy> node audyt/testy/test_ruch.mjs
//
// SKALA: 0,01 — ACCAD jest w centymetrach (pułapka 9 z briefu: global_scale 0,01 daje ~1,78 m; stała CMU
// 0,056444 jest udokumentowana WYŁĄCZNIE dla ASF/AMC). Podłoga klipu ląduje na y = 0 (minimum wysokości stawu
// kostki/palca w całym klipie), miednica startuje w (0, ·, 0).
// FileReader: GLTFExporter r185 używa go do zamiany Bloba na ArrayBuffer, a node go nie ma — 1-linijkowy shim.
globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend(); }); } };
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { THREE, BVHLoader, TOOLS } from './three.mjs';
import { zaladujGLB, probkuj } from './probka.mjs';
import { wyznaczHarmonogram, zapiszHarmonogram } from './kontakt.mjs';
const { GLTFExporter } = await import(pathToFileURL(path.join(TOOLS, 'three/examples/jsm/exporters/GLTFExporter.js')).href);

const SKALA = 0.01;
const [ZRODLO, WYJSCIE] = process.argv.slice(2);
if (!ZRODLO || !WYJSCIE) { console.error('użycie: node przygotuj_klipy.mjs <katalog BVH ACCAD> <katalog wyjściowy>'); process.exit(1); }
fs.mkdirSync(WYJSCIE, { recursive: true });

// Dobór klipów: 1 wzorcowy chód + 2 chody „mają oblać" + 1 wzorcowy idle + 2 idle „mają oblać".
const ZADANIA = [
  ['chod_M1', 'Male1_B3_Walk.bvh'], ['chod_M2', 'Male2_B3_Walk.bvh'], ['bieg_M2', 'Male2_C3_Run.bvh'],
  ['stanie_F1', 'Female1_A01_Stand.bvh'], ['kolysanie_F1', 'Female1_A02_Sway.bvh'], ['stanie_M1', 'Male1_A1_Stand.bvh'],
];

for (const [nazwa, plik] of ZADANIA) {
  const src = path.join(ZRODLO, plik);
  if (!fs.existsSync(src)) { console.log(`POMINIĘTO ${nazwa}: brak ${src}`); continue; }
  const res = new BVHLoader().parse(fs.readFileSync(src, 'utf8'));
  const root = res.skeleton.bones[0];
  const grupa = new THREE.Group(); grupa.name = 'skala_' + SKALA; grupa.scale.setScalar(SKALA);
  // atrapa SkinnedMesh: bez skóry GLTFLoader wczyta kości jako zwykłe Object3D, a nie Bone
  const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05), c = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(c * 4), 4));
  const wg = new Float32Array(c * 4); for (let i = 0; i < c; i++) wg[i * 4] = 1;
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wg, 4));
  const sm = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ name: 'atrapa' })); sm.name = 'atrapa';
  sm.add(root); grupa.add(sm); sm.bind(res.skeleton);
  const scena = new THREE.Scene(); scena.add(grupa);
  const mixer = new THREE.AnimationMixer(scena); mixer.clipAction(res.clip).play();
  const N = Math.round(res.clip.duration * 60), v = new THREE.Vector3();
  const stopy = res.skeleton.bones.filter(b => /Foot|ToeBase/i.test(b.name));
  let yg = Infinity, x0 = 0, z0 = 0;
  for (let i = 0; i < N; i++) {
    mixer.setTime(i / 60); scena.updateMatrixWorld(true);
    for (const b of stopy) { b.getWorldPosition(v); if (v.y < yg) yg = v.y; }
    if (i === 0) { root.getWorldPosition(v); x0 = v.x; z0 = v.z; }
  }
  grupa.position.set(-x0, -yg, -z0);
  mixer.setTime(0); scena.updateMatrixWorld(true);
  res.clip.name = nazwa;
  const out = await new Promise((r, j) => new GLTFExporter().parse(scena, r, j, { binary: true, animations: [res.clip] }));
  const dst = path.join(WYJSCIE, nazwa + '.glb');
  fs.writeFileSync(dst, Buffer.from(out));
  let info = `${nazwa}: ${plik} → ${nazwa}.glb (${out.byteLength} B, ${res.clip.duration.toFixed(2)} s)`;
  if (/^(chod|bieg)/.test(nazwa)) {
    const g = await zaladujGLB(dst);
    const h = wyznaczHarmonogram(g.scena, g.klipy[0], { nazwa });
    zapiszHarmonogram(dst.replace(/\.glb$/, '.kontakt.json'), h);
    info += `, harmonogram: podpór L/P ${h.stopy.L.length}/${h.stopy.P.length}`;
  }
  console.log(info);
}

// K9 i K12: mocap nie zawiera ani logu odtwarzania silnika, ani kanału mrugnięć (morph targets odpadły).
// Dane syntetyczne z ustalonym ziarnem — powtarzalne między uruchomieniami.
let ziarno = 20240909;
const los = () => { ziarno = (ziarno * 1103515245 + 12345) % 2147483648; return ziarno / 2147483648; };
const gauss = () => Math.sqrt(-2 * Math.log(los() + 1e-12)) * Math.cos(2 * Math.PI * los());
const log = (n, T, cv) => ({ hz: 60, czasyCykli: Array.from({ length: n }, () => +(T * (1 + cv * gauss())).toFixed(6)) });
const zapisz = (n, o) => fs.writeFileSync(path.join(WYJSCIE, n), JSON.stringify(o, null, 1) + '\n');
zapisz('log_silnika_dobry.json', log(40, 1.12, 0.02));
zapisz('log_silnika_metronom.json', log(40, 1.12, 0.002));
zapisz('log_silnika_rozjazd.json', log(40, 1.12, 0.09));
const mrug = (n, sr, j, cz) => { let t = 40, o = []; for (let i = 0; i < n; i++) { t += Math.round((sr + j * (los() - 0.5)) * 60); o.push({ start: t, koniec: t + cz + Math.round(los() * 4) }); } return { fps: 60, czasS: (t + 60) / 60, mrugniecia: o }; };
zapisz('mrugniecia_dobre.json', mrug(15, 3.5, 2.6, 8));
zapisz('mrugniecia_metronom.json', { fps: 60, czasS: 55, mrugniecia: Array.from({ length: 15 }, (_, i) => ({ start: 40 + i * 210, koniec: 40 + i * 210 + 10 })) });
console.log('zapisano log_silnika_*.json i mrugniecia_*.json');
console.log(`\nUWAGA: manifest.json z listą przypadków i ZNANYMI ODSTĘPSTWAMI (oczekiwaneFail) NIE jest generowany —\nto jest dokument decyzyjny, pisany ręcznie. Wzorzec: audyt/testy/ruch/manifest.wzor.json`);
