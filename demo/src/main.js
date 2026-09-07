// Dziedziniec — scena demonstracyjna (three.js, WebGL2).
// Cel: jedna spójna przestrzeń o możliwie realistycznych materiałach, oglądana z bliska na telefonie.
// Zasoby: Poly Haven (CC0). Silnik: three.js (MIT).

import * as THREE from 'three';
// Wariant ładowania zasobów: pliki KTX2/meshopt (domyślnie) albo data URI (Artifact) — wybierany aliasem w esbuild.
import { createLoaders } from 'scene-loaders';

// ---------- konfiguracja (wszystko, co określa skalę i jakość, jest tutaj, nie w kodzie) ----------
const CONFIG = {
  courtyard: { size: 14, wallHeight: 3.2, wallThickness: 0.4 },
  player: { eyeHeight: 1.65, radius: 0.35, speed: 2.2, lookSpeed: 0.0032, start: { x: 3.0, z: 4.5, yaw: Math.PI * 0.08 } },
  // Słońce: kierunek wyliczany z najjaśniejszego punktu HDRI (jedno źródło prawdy dla nieba i cieni).
  // Otoczenie HDRI zawiera słońce wtopione w mapę, więc jego udział trzeba zmniejszyć, inaczej zalewa cienie.
  sun: { intensity: 3.5, environmentIntensity: 0.35, distance: 40 },
  quality: {
    high:   { dpr: 2.0, shadow: 2048, shadowRadius: 3, aniso: 8 },
    medium: { dpr: 1.5, shadow: 1024, shadowRadius: 2, aniso: 4 },
    low:    { dpr: 1.0, shadow: 1024, shadowRadius: 1, aniso: 2 },
  },
  // rzeczywiste wymiary (m) jednego powtórzenia tekstury wg Poly Haven
  textures: {
    ground: { name: 'stone_tiles_02', metersPerTile: 2.0 },
    wall:   { name: 'castle_brick_02_red', metersPerTile: 3.0 },
    plinth: { name: 'medieval_blocks_03', metersPerTile: 1.5 },
  },
  // rozmieszczenie obiektów: pozycja XZ, obrót, ewentualnie „stoi na” innym obiekcie
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

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);

const maxAniso = renderer.capabilities.getMaxAnisotropy();
let quality = CONFIG.quality[localStorageGet('quality') || 'medium'];
let qualityName = localStorageGet('quality') || 'medium';

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// ---------- loadery ----------
const manager = new THREE.LoadingManager();
const loaders = createLoaders(manager, renderer);

const loadingEl = document.getElementById('loading');
const progressEl = document.getElementById('progress');
manager.onProgress = (url, loaded, total) => { progressEl.textContent = `${loaded} / ${total}`; };

async function loadPbrSet(spec, repeatX, repeatY) {
  const [map, normalMap, arm] = await Promise.all([
    loaders.loadTexture(spec.name, 'diff'), loaders.loadTexture(spec.name, 'nor'), loaders.loadTexture(spec.name, 'arm'),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, arm]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = Math.min(quality.aniso, maxAniso);
  }
  // Poly Haven „arm” = AO (R), Roughness (G), Metalness (B) — dokładnie układ glTF, więc jedna tekstura obsługuje trzy kanały.
  return new THREE.MeshStandardMaterial({ map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm, metalness: 1.0, roughness: 1.0 });
}

// ---------- budowa sceny ----------
const colliders = []; // { x, z, r }
const props = new Map(); // nazwa -> Object3D
const stats = { triangles: 0 };

async function buildScene() {
  const S = CONFIG.courtyard.size, H = CONFIG.courtyard.wallHeight, T = CONFIG.courtyard.wallThickness;

  // niebo + oświetlenie otoczenia z jednego HDRI (PMREM)
  const hdr = await loaders.loadSky();
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.environment = hdr; // three r160+ filtruje automatycznie przez PMREM
  scene.environmentIntensity = CONFIG.sun.environmentIntensity;
  scene.backgroundBlurriness = 0.0;

  // słońce: kierunek z HDRI
  const sunDir = brightestDirection(hdr);
  const sun = new THREE.DirectionalLight(0xfff2e0, CONFIG.sun.intensity);
  sun.position.copy(sunDir).multiplyScalar(CONFIG.sun.distance);
  scene.userData.sunDir = sunDir;
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -S * 0.6; sc.right = S * 0.6; sc.top = S * 0.6; sc.bottom = -S * 0.6; sc.near = 5; sc.far = 70;
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.05; sun.shadow.radius = quality.shadowRadius;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  scene.add(sun, sun.target);
  scene.userData.sun = sun;

  // podłoże
  const g = CONFIG.textures.ground;
  const groundMat = await loadPbrSet(g, S / g.metersPerTile, S / g.metersPerTile);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // cztery mury (zamknięty dziedziniec), każda ściana z własnym UV, żeby cegła miała prawdziwą skalę
  const w = CONFIG.textures.wall;
  const wallMatLong = await loadPbrSet(w, S / w.metersPerTile, H / w.metersPerTile);
  const wallMatEnd = wallMatLong.clone();
  for (const k of ['map', 'normalMap', 'aoMap']) { wallMatEnd[k] = wallMatLong[k].clone(); wallMatEnd[k].repeat.set(T / w.metersPerTile, H / w.metersPerTile); wallMatEnd[k].needsUpdate = true; }
  wallMatEnd.roughnessMap = wallMatEnd.metalnessMap = wallMatEnd.aoMap;
  const wallMatTop = wallMatLong.clone();
  for (const k of ['map', 'normalMap', 'aoMap']) { wallMatTop[k] = wallMatLong[k].clone(); wallMatTop[k].repeat.set(S / w.metersPerTile, T / w.metersPerTile); wallMatTop[k].needsUpdate = true; }
  wallMatTop.roughnessMap = wallMatTop.metalnessMap = wallMatTop.aoMap;
  const wallMats = [wallMatEnd, wallMatEnd, wallMatTop, wallMatTop, wallMatLong, wallMatLong]; // +x -x +y -y +z -z
  const wallGeo = new THREE.BoxGeometry(S + 2 * T, H, T);
  const walls = [
    { x: 0, z: -S / 2 - T / 2, rot: 0 }, { x: 0, z: S / 2 + T / 2, rot: 0 },
    { x: -S / 2 - T / 2, z: 0, rot: Math.PI / 2 }, { x: S / 2 + T / 2, z: 0, rot: Math.PI / 2 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(wallGeo, wallMats);
    m.position.set(w.x, H / 2, w.z); m.rotation.y = w.rot;
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }

  // cokół pod popiersie
  const p = CONFIG.plinth, pt = CONFIG.textures.plinth;
  const plinthMat = await loadPbrSet(pt, p.w / pt.metersPerTile, p.h / pt.metersPerTile);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.w), plinthMat);
  plinth.position.set(p.x, p.h / 2, p.z); plinth.castShadow = true; plinth.receiveShadow = true;
  scene.add(plinth);
  props.set('plinth', plinth);
  colliders.push({ x: p.x, z: p.z, r: p.collider });

  // modele
  const names = [...new Set(CONFIG.props.map(pr => pr.model))];
  const loaded = new Map(await Promise.all(names.map(async n => [n, await loaders.loadModel(n)])));
  for (const pr of CONFIG.props) {
    const obj = loaded.get(pr.model).scene.clone(true);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = Math.min(quality.aniso, maxAniso); } });
    obj.rotation.y = pr.rotY || 0;
    if (pr.on) {
      const parent = props.get(pr.on);
      const box = new THREE.Box3().setFromObject(parent);
      obj.position.set(parent.position.x + (pr.dx || 0), box.max.y, parent.position.z + (pr.dz || 0));
    } else {
      obj.position.set(pr.x, 0, pr.z);
      if (pr.collider) colliders.push({ x: pr.x, z: pr.z, r: pr.collider });
    }
    scene.add(obj);
    props.set(pr.model, obj);
  }

  scene.traverse(o => { if (o.isMesh && o.geometry) { const idx = o.geometry.index; stats.triangles += (idx ? idx.count : o.geometry.attributes.position.count) / 3; } });
}

// Najjaśniejszy piksel mapy równokątnej → kierunek w świecie (konwencja three.js: u = atan2(z, x)/2π + 0.5, v = asin(y)/π + 0.5).
function brightestDirection(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = data instanceof Uint16Array;
  const ch = data.length / (W * H);
  let best = -1, bi = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * ch;
    const r = half ? THREE.DataUtils.fromHalfFloat(data[o]) : data[o];
    const g = half ? THREE.DataUtils.fromHalfFloat(data[o + 1]) : data[o + 1];
    const b = half ? THREE.DataUtils.fromHalfFloat(data[o + 2]) : data[o + 2];
    const l = r + g + b; if (l > best) { best = l; bi = i; }
  }
  const row = Math.floor(bi / W), col = bi % W;
  // flipY=true: pierwszy wiersz danych to góra pliku i trafia na v=1 (zenit)
  const v = tex.flipY ? 1 - (row + 0.5) / H : (row + 0.5) / H;
  const u = (col + 0.5) / W;
  const theta = (v - 0.5) * Math.PI, phi = (u - 0.5) * 2 * Math.PI;
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
}

// ---------- gracz i sterowanie ----------
const player = { x: CONFIG.player.start.x, z: CONFIG.player.start.z, yaw: CONFIG.player.start.yaw, pitch: 0 };
const move = { x: 0, y: 0 }; // -1..1, z joysticka lub klawiatury
const keys = new Set();

function applyLook(dx, dy) {
  player.yaw -= dx * CONFIG.player.lookSpeed;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * CONFIG.player.lookSpeed, -1.4, 1.4);
}

// dotyk: lewa część ekranu = joystick, reszta = rozglądanie (wiele palców jednocześnie)
const joy = { id: null, cx: 0, cy: 0, el: document.getElementById('joy'), knob: document.getElementById('knob'), radius: 55 };
const look = { id: null, lx: 0, ly: 0 };
const touchLayer = document.getElementById('touch');

touchLayer.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (joy.id === null && t.clientX < window.innerWidth * 0.45) {
      joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY;
      joy.el.style.left = `${t.clientX}px`; joy.el.style.top = `${t.clientY}px`; joy.el.hidden = false;
    } else if (look.id === null) { look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; }
  }
  e.preventDefault();
}, { passive: false });
touchLayer.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy;
      const len = Math.hypot(dx, dy); if (len > joy.radius) { dx *= joy.radius / len; dy *= joy.radius / len; }
      move.x = dx / joy.radius; move.y = -dy / joy.radius;
      joy.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (t.identifier === look.id) {
      applyLook(t.clientX - look.lx, t.clientY - look.ly); look.lx = t.clientX; look.ly = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; move.x = move.y = 0; joy.knob.style.transform = ''; joy.el.hidden = true; }
    if (t.identifier === look.id) look.id = null;
  }
};
touchLayer.addEventListener('touchend', endTouch); touchLayer.addEventListener('touchcancel', endTouch);

// mysz + klawiatura (do testów na komputerze)
touchLayer.addEventListener('click', () => { if (!('ontouchstart' in window)) canvas.requestPointerLock?.(); });
document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) applyLook(e.movementX, e.movementY); });
document.addEventListener('keydown', e => keys.add(e.code)); document.addEventListener('keyup', e => keys.delete(e.code));

function updatePlayer(dt) {
  let mx = move.x, my = move.y;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my = 1; if (keys.has('KeyS') || keys.has('ArrowDown')) my = -1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx = -1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx = 1;
  const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
  const s = CONFIG.player.speed * dt;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); // kierunek „przed siebie” w XZ
  // prawy wektor = (cos yaw, 0, -sin yaw)
  let nx = player.x + (fx * my + Math.cos(player.yaw) * mx) * s;
  let nz = player.z + (fz * my - Math.sin(player.yaw) * mx) * s;
  const half = CONFIG.courtyard.size / 2 - CONFIG.player.radius;
  nx = THREE.MathUtils.clamp(nx, -half, half); nz = THREE.MathUtils.clamp(nz, -half, half);
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + CONFIG.player.radius;
    if (d < min && d > 1e-4) { nx = c.x + dx / d * min; nz = c.z + dz / d * min; }
  }
  player.x = nx; player.z = nz;
  camera.position.set(player.x, CONFIG.player.eyeHeight, player.z);
  camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
}

// ---------- jakość / rozmiar ----------
function applyQuality(name) {
  qualityName = name; quality = CONFIG.quality[name]; localStorageSet('quality', name);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.shadowMap.needsUpdate = true;
  const sun = scene.userData.sun;
  if (sun) { sun.shadow.mapSize.set(quality.shadow, quality.shadow); sun.shadow.radius = quality.shadowRadius; sun.shadow.map?.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.isMesh) for (const k of ['map', 'normalMap', 'aoMap']) if (o.material?.[k]) o.material[k].anisotropy = Math.min(quality.aniso, maxAniso); });
  document.getElementById('q').textContent = name;
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
document.getElementById('q').addEventListener('click', () => {
  const order = ['low', 'medium', 'high']; applyQuality(order[(order.indexOf(qualityName) + 1) % order.length]);
});

// ---------- pętla i pomiar ----------
const hud = document.getElementById('hud');
let frames = 0, acc = 0, last = performance.now(), fpsText = '–', worst = 0;
const frameTimes = [];
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  updatePlayer(dt);
  renderer.render(scene, camera);
  frames++; acc += dt; frameTimes.push(dt * 1000);
  if (acc >= 1) {
    frameTimes.sort((a, b) => a - b);
    const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)] || 0;
    fpsText = `${Math.round(frames / acc)} fps  p95 ${p95.toFixed(1)} ms`;
    const i = renderer.info.render;
    hud.textContent = `${fpsText} | ${i.calls} draw | ${(i.triangles / 1000).toFixed(0)}k tri | DPR ${renderer.getPixelRatio().toFixed(2)} | ${renderer.domElement.width}×${renderer.domElement.height}`;
    window.__perf = { fps: frames / acc, p95, calls: i.calls, triangles: i.triangles, width: renderer.domElement.width, height: renderer.domElement.height, quality: qualityName };
    frames = 0; acc = 0; frameTimes.length = 0;
  }
  if (!window.__paused) requestAnimationFrame(loop);
}
// hooki testowe (headless): pauza pętli i pojedyncza klatka
window.__pause = () => { window.__paused = true; };
window.__resume = () => { if (window.__paused) { window.__paused = false; last = performance.now(); requestAnimationFrame(loop); } };
window.__renderOnce = () => { updatePlayer(0); renderer.render(scene, camera); };
window.__dbg = { scene, renderer, camera, THREE };

// ---------- start ----------
(async () => {
  try {
    await buildScene();
    applyQuality(qualityName);
    document.getElementById('gpu').textContent = gpuName();
    loadingEl.hidden = true;
    window.__ready = true;
    window.__setView = v => { player.x = v.x; player.z = v.z; player.yaw = v.yaw; player.pitch = v.pitch; };
    requestAnimationFrame(t => { last = t; loop(t); });
  } catch (err) {
    loadingEl.textContent = 'Błąd ładowania: ' + (err?.message || err);
    console.error(err);
  }
})();

function gpuName() {
  const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}
