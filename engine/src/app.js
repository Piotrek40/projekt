// Wspólny silnik scen (three.js, WebGL2): renderer, kamera pierwszoosobowa, sterowanie dotykowe,
// kolizje, poziomy jakości, HUD z pomiarem, hooki testowe. Scena dostarcza tylko buildWorld().
import * as THREE from 'three';
import { createLoaders } from 'scene-loaders';
import { setupSky } from './sky.js';
import { loadPbrSet } from './materials.js';

const DEFAULT_QUALITY = {
  high:   { dpr: 2.0, shadow: 2048, shadowRadius: 3, aniso: 8 },
  medium: { dpr: 1.5, shadow: 1024, shadowRadius: 2, aniso: 4 },
  low:    { dpr: 1.0, shadow: 1024, shadowRadius: 1, aniso: 2 },
};

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

export async function createApp(opts) {
  const player = { eyeHeight: 1.65, radius: 0.35, speed: 2.4, lookSpeed: 0.0032, start: { x: 0, z: 0, yaw: 0 }, ...opts.player };
  const QUALITY = opts.quality || DEFAULT_QUALITY;
  let qualityName = lsGet('quality') || 'medium';
  if (!QUALITY[qualityName]) qualityName = 'medium';
  let quality = QUALITY[qualityName];

  const canvas = document.getElementById('c');
  const flags = Object.fromEntries(new URLSearchParams(location.search)); // przełączniki diagnostyczne (?nosway=1 itd.)
  const diag = { contextLost: 0, restored: 0 };
  canvas.addEventListener('webglcontextlost', e => { diag.contextLost++; e.preventDefault(); });
  canvas.addEventListener('webglcontextrestored', () => { diag.restored++; });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !flags.noaa, powerPreference: 'high-performance' });
  // Znane błędy sterowników (wynik bisekcji na urządzeniu): Samsung Xclipse przez ANGLE/Vulkan psuje InstancedMesh
  // po zmianie kolejności rysowania (wierzchołki zwykłych siatek dostają macierze instancji) i dekoduje KTX2 na czarno.
  { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    if (/Xclipse/i.test(gpu) && !flags.forceinst) flags.noinst = 'gpu'; flags.gpu = gpu; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.shadowMap.enabled = !flags.noshadow;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 70, 1, 0.05, opts.far ?? 300);
  let renderCam = camera; // kamera rysowana przez pętlę; widok diagnostyczny podmienia ją (__setView({ortho}) albo ?top=1 / ?side=N)
  // Kamera ortograficzna do diagnostyki. o.top: rzut z góry (północ = góra kadru), o.size = wysokość kadru w metrach, o.x/o.z = środek.
  // o.side = 0..3 jak w layout.js (0 północ, 1 wschód, 2 południe, 3 zachód): elewacja pierzei z kamery w (x,z); near odcina fontannę i kramy.
  // MUSI być kamerą pętli loop() i __renderOnce (a nie osobnym renderer.render z zewnątrz): po __pause() ostatni zaplanowany rAF
  // rysuje jeszcze jedną klatkę i nadpisałby obraz kamerą perspektywiczną. Niebo w rzucie ortho jest czarne — nie oceniać tła.
  function orthoCam(o) {
    const s = o.size || 60, a = renderer.domElement.width / renderer.domElement.height, cx = o.x ?? 0, cz = o.z ?? 0;
    const c = new THREE.OrthographicCamera(-s / 2 * a, s / 2 * a, s / 2, -s / 2, o.near ?? 0.1, 500);
    if (o.side !== undefined) { const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][o.side], y = s / 2 - 2; c.position.set(cx, y, cz); c.lookAt(cx + dx * 100, y, cz + dz * 100); c.near = o.near ?? 16; }
    else { c.position.set(cx, 150, cz); c.up.set(0, 0, -1); c.lookAt(cx, 0, cz); }
    c.updateProjectionMatrix(); return c;
  }

  const manager = new THREE.LoadingManager();
  const loaders = createLoaders(manager, renderer);
  const progressEl = document.getElementById('progress');
  manager.onProgress = (url, loaded, total) => { if (progressEl) progressEl.textContent = `${loaded} / ${total}`; };

  // ---------- kolizje i obszar chodzenia ----------
  const circles = [];   // { x, z, r }
  const rects = [];     // { x, z, hw, hd } (osiowe)
  const walkable = [];  // { x, z, hw, hd } — suma prostokątów, po których wolno chodzić
  const ctx = {
    THREE, scene, renderer, camera, loaders, maxAniso, flags,
    get quality() { return quality; },
    aniso: () => Math.min(quality.aniso, maxAniso),
    addCircle: (x, z, r) => circles.push({ x, z, r }),
    addRect: (x, z, hw, hd) => rects.push({ x, z, hw, hd }),
    addWalkable: (x, z, hw, hd) => walkable.push({ x, z, hw, hd }),
    loadPbrSet: (name, o) => loadPbrSet(loaders, name, { aniso: Math.min(quality.aniso, maxAniso), ...o }),
    sky: async (o = {}) => setupSky(scene, await loaders.loadSky(o.file), { shadow: quality.shadow, shadowRadius: quality.shadowRadius, flags, ...o }),
    player,
    updaters: [], // funkcje (dt, t) wywoływane co klatkę (woda, płomienie itp.)
  };

  const state = { x: player.start.x, z: player.start.z, yaw: player.start.yaw, pitch: player.start.pitch ?? 0 };
  const move = { x: 0, y: 0 };
  const keys = new Set();

  function applyLook(dx, dy) {
    state.yaw -= dx * player.lookSpeed;
    state.pitch = THREE.MathUtils.clamp(state.pitch - dy * player.lookSpeed, -1.4, 1.4);
  }
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
  touchLayer.addEventListener('click', () => { if (!('ontouchstart' in window)) canvas.requestPointerLock?.(); });
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) applyLook(e.movementX, e.movementY); });
  document.addEventListener('keydown', e => keys.add(e.code)); document.addEventListener('keyup', e => keys.delete(e.code));

  const inWalkable = (x, z) => walkable.length === 0 || walkable.some(w => Math.abs(x - w.x) <= w.hw && Math.abs(z - w.z) <= w.hd);

  function resolve(nx, nz) {
    // wypchnięcie z prostokątów (rozszerzonych o promień gracza) i kół
    const r = player.radius;
    for (const b of rects) {
      const dx = nx - b.x, dz = nz - b.z, px = b.hw + r - Math.abs(dx), pz = b.hd + r - Math.abs(dz);
      if (px > 0 && pz > 0) { if (px < pz) nx = b.x + Math.sign(dx || 1) * (b.hw + r); else nz = b.z + Math.sign(dz || 1) * (b.hd + r); }
    }
    for (const c of circles) {
      const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-4) { nx = c.x + dx / d * min; nz = c.z + dz / d * min; }
    }
    return [nx, nz];
  }

  function updatePlayer(dt) {
    let mx = move.x, my = move.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my = 1; if (keys.has('KeyS') || keys.has('ArrowDown')) my = -1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx = -1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx = 1;
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const s = player.speed * dt * (keys.has('ShiftLeft') ? 2 : 1);
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
    let nx = state.x + (fx * my + Math.cos(state.yaw) * mx) * s;
    let nz = state.z + (fz * my - Math.sin(state.yaw) * mx) * s;
    [nx, nz] = resolve(nx, nz);
    if (inWalkable(nx, nz)) { state.x = nx; state.z = nz; }
    else if (inWalkable(nx, state.z)) state.x = nx;
    else if (inWalkable(state.x, nz)) state.z = nz;
    camera.position.set(state.x, player.eyeHeight, state.z);
    camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
  }

  // ---------- jakość ----------
  function applyQuality(name) {
    qualityName = name; quality = QUALITY[name]; lsSet('quality', name);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    const sun = scene.userData.sun;
    if (sun) { sun.shadow.mapSize.set(quality.shadow, quality.shadow); sun.shadow.radius = quality.shadowRadius; sun.shadow.map?.dispose(); sun.shadow.map = null; }
    const a = Math.min(quality.aniso, maxAniso);
    scene.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap']) if (m?.[k]) m[k].anisotropy = a; });
    const q = document.getElementById('q'); if (q) q.textContent = name;
    resize();
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (renderCam.isOrthographicCamera) { renderCam.left = -renderCam.top * w / h; renderCam.right = renderCam.top * w / h; renderCam.updateProjectionMatrix(); } // kadr ortho: wysokość stała, szerokość wg proporcji
  }
  window.addEventListener('resize', resize);
  document.getElementById('q')?.addEventListener('click', () => {
    const order = Object.keys(QUALITY); applyQuality(order[(order.indexOf(qualityName) + 1) % order.length]);
  });

  // ---------- pętla i pomiar ----------
  const hud = document.getElementById('hud');
  let frames = 0, acc = 0, last = performance.now(), t0 = performance.now();
  const frameTimes = [];
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    updatePlayer(dt);
    for (const u of ctx.updaters) { try { u(dt, (now - t0) / 1000, state); } catch (e) { console.error('updater', e); } }
    renderer.render(scene, renderCam);
    frames++; acc += dt; frameTimes.push(dt * 1000);
    if (acc >= 1) {
      frameTimes.sort((a, b) => a - b);
      const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)] || 0;
      const i = renderer.info.render;
      if (hud) hud.textContent = `${Math.round(frames / acc)} fps  p95 ${p95.toFixed(1)} ms | ${i.calls} draw | ${(i.triangles / 1000).toFixed(0)}k tri | DPR ${renderer.getPixelRatio().toFixed(2)} | ${renderer.domElement.width}×${renderer.domElement.height}`;
      window.__perf = { fps: frames / acc, p95, calls: i.calls, triangles: i.triangles, width: renderer.domElement.width, height: renderer.domElement.height, quality: qualityName };
      frames = 0; acc = 0; frameTimes.length = 0;
    }
    if (!window.__paused) requestAnimationFrame(loop);
  }
  // hooki testowe (headless)
  // v.ortho = {top:true,size,x,z} albo {side:0..3,size,near}: widok diagnostyczny kamerą ortograficzną (cienie tylko w promieniu shadowExtent od x/z)
  window.__setView = v => { state.x = v.x; state.z = v.z; state.yaw = v.yaw; state.pitch = v.pitch ?? 0; renderCam = v.ortho ? orthoCam(v.ortho) : camera; };
  window.__pause = () => { window.__paused = true; };
  window.__resume = () => { if (window.__paused) { window.__paused = false; last = performance.now(); requestAnimationFrame(loop); } };
  window.__renderOnce = () => { updatePlayer(0); for (const u of ctx.updaters) u(0, (performance.now() - t0) / 1000, state); renderer.render(scene, renderCam); };
  window.__dbg = { scene, renderer, camera, THREE, ctx };
  // __stats(n): rysuje jedną klatkę z hookami onBefore/AfterRender i zwraca {total, shadow, top:[{name, calls, tris}]}.
  // Hooki działają tylko w przebiegu głównym (WebGLShadowMap woła renderBufferDirect bez nich), więc total − suma = koszt przebiegu cieni.
  // Obiekty poza frustum nie są rysowane → wynik zależy od widoku (wywołuj po __setView + __renderOnce). Nazwy: klucze Batch.build i modele z put().
  window.__stats = (n = 15) => {
    const rows = new Map(), hooked = [];
    scene.traverse(o => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      const key = o.name || o.parent?.name || o.material?.name || o.type; let c0 = 0, t0 = 0;
      hooked.push([o, o.onBeforeRender, o.onAfterRender]);
      o.onBeforeRender = r => { c0 = r.info.render.calls; t0 = r.info.render.triangles; };
      o.onAfterRender = r => { const e = rows.get(key) || { name: key, calls: 0, tris: 0 }; e.calls += r.info.render.calls - c0; e.tris += r.info.render.triangles - t0; rows.set(key, e); };
    });
    renderer.render(scene, renderCam);
    for (const [o, b, a] of hooked) { o.onBeforeRender = b; o.onAfterRender = a; }
    const i = renderer.info.render, top = [...rows.values()].sort((a, b) => b.tris - a.tris);
    const sum = top.reduce((s, r) => ({ calls: s.calls + r.calls, tris: s.tris + r.tris }), { calls: 0, tris: 0 });
    return { total: { calls: i.calls, tris: i.triangles }, shadow: { calls: i.calls - sum.calls, tris: i.triangles - sum.tris }, top: top.slice(0, n) };
  };

  const loadingEl = document.getElementById('loading');
  try {
    await opts.buildWorld(ctx);
    if (flags.basic) scene.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; const conv = ms.map(m => new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color || 0xffffff, side: m.side, transparent: m.transparent, opacity: m.opacity })); o.material = Array.isArray(o.material) ? conv : conv[0]; } });
    applyQuality(qualityName);
    // widok diagnostyczny z URL (telefon / URLQUERY): ?top=1 (rzut z góry, kadr 60 m) albo ?top=90; ?side=1&ssize=30 (elewacja pierzei wschodniej)
    if (flags.top) renderCam = orthoCam({ top: true, size: +flags.top > 1 ? +flags.top : 60 });
    else if (flags.side !== undefined) renderCam = orthoCam({ side: +flags.side, size: +(flags.ssize || 30) });
    const gpu = document.getElementById('gpu');
    if (gpu) { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu.textContent = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }
    if (loadingEl) loadingEl.hidden = true;
    // ?debug=1 — nakładka diagnostyczna (tryb tekstur, rozszerzenia GPU, błędy GL, ostatnie błędy konsoli)
    if (flags.debug) {
      const d = document.createElement('pre');
      d.style.cssText = 'position:fixed;left:8px;top:64px;max-width:92vw;font:10px/1.3 ui-monospace,monospace;background:rgba(0,0,0,.7);color:#9f9;padding:6px;white-space:pre-wrap;word-break:break-all;z-index:9;pointer-events:none';
      const gl = renderer.getContext();
      const errs = [];
      window.addEventListener('error', e => errs.push(String(e.message).slice(0, 160)));
      const origErr = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); origErr(...a); };
      const origWarn = console.warn; console.warn = (...a) => { errs.push('warn: ' + a.map(String).join(' ').slice(0, 200)); origWarn(...a); };
      const update = () => {
        const i = renderer.info;
        d.textContent = JSON.stringify({ precision: renderer.capabilities.precision, flags, ...loaders.info, ...diag, cam: camera.position.toArray().map(v => +v.toFixed(2)), rot: [camera.rotation.x, camera.rotation.y].map(v => +v.toFixed(2)), move: [move.x, move.y].map(v => +v.toFixed(2)), frame: i.render.frame, glError: gl.getError(), textures: i.memory.textures, geometries: i.memory.geometries, programs: i.programs?.length, errors: errs.slice(-6) }, null, 1);
      };
      update(); setInterval(update, 2000); document.body.appendChild(d);
    }
    window.__ready = true;
    requestAnimationFrame(t => { last = t; t0 = t; loop(t); });
  } catch (err) {
    if (loadingEl) loadingEl.textContent = 'Błąd ładowania: ' + (err?.message || err);
    console.error(err);
  }
  return ctx;
}
