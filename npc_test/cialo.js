// Podgląd ciała NPC (etap 4, krok 2) — na telefonie i w renderze kontrolnym.
// Liczby z pliku mówią, że GLB jest poprawny; NIE mówią, czy figura wygląda jak człowiek i czy rig zgina ją
// jak człowieka. To sprawdza się okiem, a oko potrzebuje właściwych ujęć: sylwetka z przodu i z boku (umięśnienie),
// oraz POZA ZGIĘTA (tam wychodzą zapadnięte stawy i „candy wrapper" na skręcie, których w pozie T nie widać).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const el = id => document.getElementById(id);
const MODEL = '../rynek/assets/models/npc_body.glb';

// Pozy testowe. Kąty w stopniach, oś podana wprost, bo pomyłka osi jest tu najłatwiejszym błędem.
// Nazwy kości: rig "game_engine" z MPFB (konwencja Unreal) — pelvis, thigh_l, calf_l, upperarm_l, lowerarm_l…
const POZY = {
  spoczynek: {},
  krok: {   // moment podporu: prawa noga z tyłu wyprostowana, lewa z przodu zgięta, ręce w przeciwfazie
    thigh_l: ['x', 28], calf_l: ['x', -35], foot_l: ['x', 10],
    thigh_r: ['x', -18], calf_r: ['x', -8],
    upperarm_l: ['x', -22], upperarm_r: ['x', 24], lowerarm_l: ['x', -25], lowerarm_r: ['x', -30],
    spine_02: ['y', 4],
  },
  skret: {   // sam skręt przedramienia i ramienia — tu wychodzi candy wrapper, jeśli brakuje kości twist
    upperarm_l: ['x', -80], lowerarm_l: ['y', 85], hand_l: ['y', 40],
    upperarm_r: ['x', -80], lowerarm_r: ['y', -85],
  },
};

const scena = new THREE.Scene();
scena.background = new THREE.Color(0x1b1a17);
scena.add(new THREE.HemisphereLight(0xbcd3ff, 0x5a5346, 1.1));
const slonce = new THREE.DirectionalLight(0xfff1e0, 2.4);
slonce.position.set(2.5, 4, 3); slonce.castShadow = true;
slonce.shadow.mapSize.set(1024, 1024);
slonce.shadow.camera.left = -1.6; slonce.shadow.camera.right = 1.6;
slonce.shadow.camera.top = 2.4; slonce.shadow.camera.bottom = -0.2;
scena.add(slonce);
// Światło kontrowe: bez niego sylwetka zlewa się z tłem i nie widać, gdzie kończy się ciało.
const kontra = new THREE.DirectionalLight(0x9fb6d8, 0.9); kontra.position.set(-3, 2, -2.5); scena.add(kontra);
const podloga = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x6b6455, roughness: 1 }));
podloga.rotation.x = -Math.PI / 2;   // rot: rx=−π/2 → normalna (0,0,1) → (0,1,0), koło leży poziomo
podloga.receiveShadow = true; scena.add(podloga);

const kamera = new THREE.PerspectiveCamera(38, 1, 0.05, 40);
let cialo = null, kosci = new Map(), spoczynkowe = new Map();
let yaw = 0, pozaNazwa = 'spoczynek', obracaj = true;

function zastosujPoze(nazwa) {
  for (const [n, k] of kosci) { const s = spoczynkowe.get(n); k.rotation.set(s.x, s.y, s.z); }
  const p = POZY[nazwa] || {};
  const brak = [];
  for (const [nazwaKosci, [os, stopnie]] of Object.entries(p)) {
    const k = kosci.get(nazwaKosci);
    if (!k) { brak.push(nazwaKosci); continue; }
    k.rotation[os] += stopnie * Math.PI / 180;
  }
  // Brakująca kość to cicha wada: poza wygląda „prawie dobrze", a pół stawów w ogóle się nie ruszyło.
  if (brak.length) el('uwagi').textContent = `poza "${nazwa}": nie ma kości ${brak.join(', ')} — sprawdź nazwy w rigu`;
  else el('uwagi').textContent = '';
  cialo.updateMatrixWorld(true);
}

new GLTFLoader().load(MODEL, g => {
  let skin = null, tri = 0;
  g.scene.traverse(o => {
    if (o.isSkinnedMesh) {
      skin = o; o.castShadow = true; o.receiveShadow = true;
      // Skeleton liczy boundingSphere RAZ, w pozie spoczynkowej, i nigdy jej nie odświeża — przy podniesionych
      // rękach NPC potrafi zniknąć przy krawędzi ekranu. Dla podglądu wyłączamy culling.
      o.frustumCulled = false;
      const ix = o.geometry.index;
      tri += (ix ? ix.count : o.geometry.attributes.position.count) / 3;
    }
  });
  if (!skin) { el('info').textContent = 'BŁĄD: w pliku nie ma SkinnedMesh'; return; }
  cialo = g.scene; scena.add(cialo);
  for (const k of skin.skeleton.bones) { kosci.set(k.name, k); spoczynkowe.set(k.name, k.rotation.clone()); }

  const bb = new THREE.Box3().setFromObject(cialo);
  const wys = bb.max.y - bb.min.y;
  el('info').innerHTML = `<b>${wys.toFixed(3)} m</b> · ${skin.skeleton.bones.length} kości · ${Math.round(tri / 1000)}k trójkątów · `
    + `${skin.geometry.attributes.position.count} wierzchołków · materiał ${skin.material.name || '—'}`
    + `<br><small>${skin.skeleton.bones.map(b => b.name).join(' · ')}</small>`;
  zastosujPoze(pozaNazwa);
});

for (const b of document.querySelectorAll('[data-poza]')) b.addEventListener('click', () => {
  pozaNazwa = b.dataset.poza;
  for (const x of document.querySelectorAll('[data-poza]')) x.classList.toggle('akt', x === b);
  if (cialo) zastosujPoze(pozaNazwa);
});
el('obrot').addEventListener('click', () => { obracaj = !obracaj; el('obrot').classList.toggle('akt', obracaj); });

const canvas = el('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;   // jak w scenie rynku

// Sterowanie palcem: przeciągnięcie obraca figurę. Bez tego na telefonie widać tylko jedną stronę.
let dotyk = null;
canvas.addEventListener('pointerdown', e => { dotyk = e.clientX; obracaj = false; el('obrot').classList.remove('akt'); });
addEventListener('pointerup', () => { dotyk = null; });
addEventListener('pointermove', e => { if (dotyk !== null) { yaw += (e.clientX - dotyk) * 0.01; dotyk = e.clientX; } });

let last = performance.now(), acc = 0, klatki = 0; const czasy = [];
function petla(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (obracaj) yaw += dt * 0.6;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); }
  const R = 3.4;
  kamera.position.set(Math.sin(yaw) * R, 1.15, Math.cos(yaw) * R);
  kamera.lookAt(0, 0.92, 0);
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

// Hooki dla harnessu renderu (zrzuty kontrolne bez klikania).
window.__poza = n => { pozaNazwa = n; if (cialo) zastosujPoze(n); };
window.__yaw = v => { yaw = v; obracaj = false; };
window.__gotowe = () => !!cialo;
