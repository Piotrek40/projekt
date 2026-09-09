// Podgląd RUCHU NPC (etap 4): ciało + przeniesione klipy mocap, z bliska i z dowolnej strony.
// Powód istnienia: w scenie rynku postać jest mała i zasłaniana przez kramy, a właśnie ruch jest tym,
// co w tym etapie decyduje o wyniku. Liczby (zgodność kierunków, pion miednicy, prędkość) mówią, że
// przeniesienie jest poprawne — nie mówią, czy chód wygląda jak chód.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { przygotuj, przenies, przyziem, wydzielRuchKorzenia, MAPA_ACCAD_MPFB } from '../engine/src/retarget.js';

const el = id => document.getElementById(id);
const KLIPY = ['walk_cycle', 'idle_sway', 'idle_lookaround', 'idle_arms', 'stand_to_walk', 'walk_to_stand'];

const scena = new THREE.Scene();
scena.background = new THREE.Color(0x1b1a17);
scena.add(new THREE.HemisphereLight(0xbcd3ff, 0x5a5346, 1.0));
const slonce = new THREE.DirectionalLight(0xfff1e0, 2.5);
slonce.position.set(2.5, 4, 3); slonce.castShadow = true;
slonce.shadow.mapSize.set(1024, 1024);
slonce.shadow.camera.left = -2; slonce.shadow.camera.right = 2;
slonce.shadow.camera.top = 2.6; slonce.shadow.camera.bottom = -0.2;
scena.add(slonce);
// Object3D.position jest w three.js akcesorem TYLKO DO ODCZYTU — Object.assign na nim rzuca TypeError
// i wywala cały moduł, a strona zostaje na "ładowanie…" bez żadnego innego objawu.
const kontra = new THREE.DirectionalLight(0x9fb6d8, 0.8);
kontra.position.set(-3, 2, -2.5);
scena.add(kontra);
const podloga = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x6b6455, roughness: 1 }));
podloga.rotation.x = -Math.PI / 2;   // rot: rx=−π/2 → normalna (0,0,1) → (0,1,0), koło leży poziomo
podloga.receiveShadow = true; scena.add(podloga);
// Siatka co 0,5 m: bez odniesienia na podłodze nie da się okiem ocenić, czy stopa stoi, czy sunie.
const siatka = new THREE.GridHelper(12, 24, 0x4a4438, 0x3a352c);
siatka.position.y = 0.002; scena.add(siatka);

const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
let yaw = 1.35, obracaj = false, wMiejscu = true, aktualny = 'walk_cycle';
let mieszacz = null, akcje = {}, klipy = {}, ruchy = {}, npc = null, pelvis = null;

const renderer = new THREE.WebGLRenderer({ canvas: el('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;

const loader = new GLTFLoader();
const wczytaj = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));

(async () => {
  const [cialo, ...zrodla] = await Promise.all([
    wczytaj('../rynek/assets/models/npc_body.glb'),
    ...KLIPY.map(k => wczytaj(`../rynek/assets/anim/${k}.glb`)),
  ]);
  let skin = null;
  cialo.scene.traverse(o => { if (o.isSkinnedMesh) { skin = o; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  if (!skin) { el('info').textContent = 'BŁĄD: brak SkinnedMesh w npc_body.glb'; return; }

  // Poza odniesienia to PIERWSZA KLATKA klipu stojącego, nie poza spoczynkowa BVH — ta w plikach ACCAD
  // jest śmieciem (wszystko powyżej bioder wskazuje w bok). Ta sama decyzja co w rynek/src/npc.js.
  const idle = zrodla[KLIPY.indexOf('idle_sway')];
  const przyg = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
  pelvis = przyg.pary.find(w => w.cs === 'pelvis').c;

  for (let i = 0; i < KLIPY.length; i++) {
    const k = przenies({ zrodloRoot: zrodla[i].scene, klip: zrodla[i].animations[0], pary: przyg.pary, celRoot: cialo.scene, skala: przyg.skala, fps: 30 });
    k.name = KLIPY[i];
    przyziem(k, skin, pelvis, { fps: 30 });   // najniższy wierzchołek stopy na wysokość podłogi
    ruchy[KLIPY[i]] = wydzielRuchKorzenia(k, pelvis);
    klipy[KLIPY[i]] = k;
  }

  npc = new THREE.Object3D(); npc.add(cialo.scene); scena.add(npc);
  mieszacz = new THREE.AnimationMixer(cialo.scene);
  for (const [n, k] of Object.entries(klipy)) {
    const a = mieszacz.clipAction(k);
    a.setLoop(THREE.LoopRepeat);
    akcje[n] = a;
  }
  akcje[aktualny].play();

  const odch = Math.max(...przyg.diag.odchylkaPo.map(x => x[1]));
  const v = ruchy.walk_cycle.droga / klipy.walk_cycle.duration;
  el('info').innerHTML = `${przyg.pary.length} par kości · dopasowanie ${odch.toFixed(3)}° · skala ${przyg.skala.toFixed(3)}`
    + `<br><small>cykl chodu ${klipy.walk_cycle.duration.toFixed(3)} s · krok ${ruchy.walk_cycle.droga.toFixed(3)} m · <b>${v.toFixed(3)} m/s</b></small>`;
  renderer.compile(scena, kamera);
})().catch(e => { el('info').textContent = 'BŁĄD ładowania: ' + e.message; });

for (const b of document.querySelectorAll('[data-klip]')) b.addEventListener('click', () => {
  if (!mieszacz) return;
  const n = b.dataset.klip;
  akcje[aktualny].fadeOut(0.2); akcje[n].reset().fadeIn(0.2).play();
  aktualny = n; npc.position.set(0, 0, 0);
  for (const x of document.querySelectorAll('[data-klip]')) x.classList.toggle('akt', x === b);
});
el('miejsce').addEventListener('click', () => { wMiejscu = !wMiejscu; el('miejsce').classList.toggle('akt', wMiejscu); npc.position.set(0, 0, 0); });
el('obrot').addEventListener('click', () => { obracaj = !obracaj; el('obrot').classList.toggle('akt', obracaj); });

let dotyk = null;
el('c').addEventListener('pointerdown', e => { dotyk = e.clientX; obracaj = false; el('obrot').classList.remove('akt'); });
addEventListener('pointerup', () => { dotyk = null; });
addEventListener('pointermove', e => { if (dotyk !== null) { yaw += (e.clientX - dotyk) * 0.01; dotyk = e.clientX; } });

let last = performance.now(), acc = 0, klatki = 0, ruchPoprz = new THREE.Vector3(), poprzCzas = 0;
const tmp = new THREE.Vector3(), czasy = [];
function petla(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (mieszacz) {
    mieszacz.update(dt);
    // Tryb „w miejscu" pokazuje sam klip; tryb marszu dokłada wydzielony ruch korzenia, czyli to,
    // co w grze przesuwa całą postać. Porównanie obu trybów pokazuje, czy stopy nie ślizgają się po siatce.
    if (!wMiejscu) {
      const a = akcje[aktualny], rk = ruchy[aktualny], czas = a.time;
      const { czasy: cz, xz } = rk;
      const odczyt = t => { const n = cz.length; if (t <= cz[0]) return tmp.set(xz[0], 0, xz[1]); if (t >= cz[n - 1]) return tmp.set(xz[(n - 1) * 2], 0, xz[(n - 1) * 2 + 1]); let i = 0, j = n - 1; while (j - i > 1) { const m = (i + j) >> 1; if (cz[m] <= t) i = m; else j = m; } const u = (t - cz[i]) / (cz[j] - cz[i]); return tmp.set(xz[i * 2] + (xz[j * 2] - xz[i * 2]) * u, 0, xz[i * 2 + 1] + (xz[j * 2 + 1] - xz[i * 2 + 1]) * u); };
      const teraz = odczyt(czas).clone();
      if (czas >= poprzCzas) npc.position.add(teraz.clone().sub(ruchPoprz));
      ruchPoprz.copy(teraz); poprzCzas = czas;
    }
  }
  if (obracaj) yaw += dt * 0.5;
  const w = el('c').clientWidth, h = el('c').clientHeight;
  if (el('c').width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); }
  const cel = npc ? npc.position : new THREE.Vector3();
  kamera.position.set(cel.x + Math.sin(yaw) * 3.6, 1.05, cel.z + Math.cos(yaw) * 3.6);
  kamera.lookAt(cel.x, 0.92, cel.z);
  renderer.render(scena, kamera);

  klatki++; acc += dt; czasy.push(dt * 1000);
  if (acc >= 1) {
    czasy.sort((a, b) => a - b);
    const p95 = czasy[Math.floor(czasy.length * 0.95)] || 0, i = renderer.info.render;
    el('perf').textContent = `${Math.round(klatki / acc)} fps · p95 ${p95.toFixed(1)} ms · ${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri · DPR ${renderer.getPixelRatio().toFixed(2)}`;
    el('perf').className = p95 <= 16.7 ? 'ok' : (p95 <= 20 ? 'uwaga' : 'zle');
    klatki = 0; acc = 0; czasy.length = 0;
  }
  requestAnimationFrame(petla);
}
requestAnimationFrame(petla);

// Hooki dla harnessu renderu: deterministyczne próbkowanie bez klikania.
window.__gotowe = () => !!mieszacz;
window.__klip = n => { if (!mieszacz) return; akcje[aktualny].stop(); akcje[n].reset().play(); aktualny = n; npc.position.set(0, 0, 0); ruchPoprz.set(0, 0, 0); poprzCzas = 0; };
window.__czas = t => { if (mieszacz) mieszacz.setTime(t); };
window.__yaw = v => { yaw = v; obracaj = false; };
window.__wMiejscu = v => { wMiejscu = v; npc.position.set(0, 0, 0); };
