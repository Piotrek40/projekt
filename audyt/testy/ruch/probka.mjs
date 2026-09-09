// Próbkowanie klipu: GLB → pozycje ŚWIATOWE stawów co 1/fps sekundy.
// Mechanika (wymuszona przez zadanie i sprawdzona na three r185): GLTFLoader.parse w node → AnimationMixer,
// mixer.setTime(t) (setTime zeruje czas i przewija od zera, więc kolejność próbek nie ma znaczenia),
// root.updateMatrixWorld(true), pozycja = elementy 12/13/14 matrixWorld (getWorldPosition robi to samo, ale alokuje).
import fs from 'node:fs';
import { THREE, GLTFLoader, BVHLoader } from './three.mjs';
import { mapujRig } from './rig.mjs';

export async function zaladujGLB(plik) {
  const buf = fs.readFileSync(plik);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
  return { scena: gltf.scene, klipy: gltf.animations, plik };
}

export function zaladujBVH(plik, { skala = 1 } = {}) {
  const res = new BVHLoader().parse(fs.readFileSync(plik, 'utf8'));
  const grupa = new THREE.Group(); grupa.scale.setScalar(skala); grupa.add(res.skeleton.bones[0]);
  const scena = new THREE.Group(); scena.add(grupa);
  return { scena, klipy: [res.clip], plik, szkielet: res.skeleton };
}

// Ślad (trace): { fps, dt, n, role: [...], p: { rola: Float64Array(3n) }, mapa }
// p[rola][3i+0..2] = x,y,z stawu w klatce i. Klatek n = round(duration*fps), t_i = i/fps, ostatnia < duration.
// `punkty` = punkty wirtualne przyczepione sztywno do kości (np. PIĘTA, której rig nie ma jako stawu):
// { pietaL: { kosc: 'kostkaL', offset: [x, y, z] } }, offset w LOKALNYM układzie tej kości (jednostki kości, nie metry!).
export function probkuj(scena, klip, { fps = 60, nadpisz = {}, role, punkty = {} } = {}) {
  const mapa = mapujRig(scena, { nadpisz, ...(role ? { role } : {}) });
  const obecne = Object.keys(mapa.role);
  const wirt = Object.entries(punkty).map(([nazwa, def]) => {
    const b = mapa.role[def.kosc]; if (!b) throw new Error(`probkuj: punkt ${nazwa} wisi na roli ${def.kosc}, której rig nie ma`);
    return { nazwa, b, v: new THREE.Vector3(...def.offset) };
  });
  const n = Math.max(2, Math.round(klip.duration * fps));
  const dt = 1 / fps;
  const mixer = new THREE.AnimationMixer(scena);
  const akcja = mixer.clipAction(klip); akcja.play();
  const p = {}, tmp = new THREE.Vector3();
  for (const r of obecne) p[r] = new Float64Array(3 * n);
  for (const w of wirt) p[w.nazwa] = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) {
    mixer.setTime(i * dt);
    scena.updateMatrixWorld(true);
    for (const r of obecne) {
      const e = mapa.role[r].matrixWorld.elements, a = p[r];
      a[3 * i] = e[12]; a[3 * i + 1] = e[13]; a[3 * i + 2] = e[14];
    }
    for (const w of wirt) {
      tmp.copy(w.v).applyMatrix4(w.b.matrixWorld);
      const a = p[w.nazwa]; a[3 * i] = tmp.x; a[3 * i + 1] = tmp.y; a[3 * i + 2] = tmp.z;
    }
  }
  akcja.stop(); mixer.uncacheClip(klip);
  return { fps, dt, n, czas: klip.duration, role: obecne.concat(wirt.map(w => w.nazwa)), p, mapa, nazwaKlipu: klip.name };
}

// --- drobne pomocniki na ślad ---
export const X = (s, r, i) => s.p[r][3 * i], Y = (s, r, i) => s.p[r][3 * i + 1], Z = (s, r, i) => s.p[r][3 * i + 2];
export const kanal = (s, r, os) => { const o = { x: 0, y: 1, z: 2 }[os], a = s.p[r], out = new Float64Array(s.n); for (let i = 0; i < s.n; i++) out[i] = a[3 * i + o]; return out; };
// Rzut poziomy na oś jednostkową d=[dx,dz]
export function rzut(s, r, dx, dz) { const a = s.p[r], out = new Float64Array(s.n); for (let i = 0; i < s.n; i++) out[i] = a[3 * i] * dx + a[3 * i + 2] * dz; return out; }
