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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 70, 1, 0.05, opts.far ?? 300);

  const manager = new THREE.LoadingManager();
  const loaders = createLoaders(manager, renderer);
  const progressEl = document.getElementById('progress');
  manager.onProgress = (url, loaded, total) => { if (progressEl) progressEl.textContent = `${loaded} / ${total}`; };

  // ---------- kolizje i obszar chodzenia ----------
  const circles = [];   // { x, z, r }
  const rects = [];     // { x, z, hw, hd } (osiowe)
  const walkable = [];  // { x, z, hw, hd } — suma prostokątów, po których wolno chodzić
  const ctx = {
    THREE, scene, renderer, camera, loaders, maxAniso,
    get quality() { return quality; },
    aniso: () => Math.min(quality.aniso, maxAniso),
    addCircle: (x, z, r) => circles.push({ x, z, r }),
    addRect: (x, z, hw, hd) => rects.push({ x, z, hw, hd }),
    addWalkable: (x, z, hw, hd) => walkable.push({ x, z, hw, hd }),
    loadPbrSet: (name, o) => loadPbrSet(loaders, name, { aniso: Math.min(quality.aniso, maxAniso), ...o }),
    sky: async (o = {}) => setupSky(scene, await loaders.loadSky(o.file), { shadow: quality.shadow, shadowRadius: quality.shadowRadius, ...o }),
    player,
    updaters: [], // funkcje (dt, t) wywoływane co klatkę (woda, płomienie itp.)
  };

  const state = { x: player.start.x, z: player.start.z, yaw: player.start.yaw, pitch: 0 };
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
    for (const u of ctx.updaters) u(dt, (now - t0) / 1000, state);
    renderer.render(scene, camera);
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
  window.__setView = v => { state.x = v.x; state.z = v.z; state.yaw = v.yaw; state.pitch = v.pitch ?? 0; };
  window.__pause = () => { window.__paused = true; };
  window.__resume = () => { if (window.__paused) { window.__paused = false; last = performance.now(); requestAnimationFrame(loop); } };
  window.__renderOnce = () => { updatePlayer(0); for (const u of ctx.updaters) u(0, (performance.now() - t0) / 1000, state); renderer.render(scene, camera); };
  window.__dbg = { scene, renderer, camera, THREE, ctx };

  const loadingEl = document.getElementById('loading');
  try {
    await opts.buildWorld(ctx);
    applyQuality(qualityName);
    const gpu = document.getElementById('gpu');
    if (gpu) { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu.textContent = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }
    if (loadingEl) loadingEl.hidden = true;
    // ?debug=1 — nakładka diagnostyczna (tryb tekstur, rozszerzenia GPU, błędy GL, ostatnie błędy konsoli)
    if (new URLSearchParams(location.search).get('debug')) {
      const d = document.createElement('pre');
      d.style.cssText = 'position:fixed;left:8px;top:64px;max-width:92vw;font:10px/1.3 ui-monospace,monospace;background:rgba(0,0,0,.7);color:#9f9;padding:6px;white-space:pre-wrap;word-break:break-all;z-index:9;pointer-events:none';
      const gl = renderer.getContext();
      const errs = [];
      window.addEventListener('error', e => errs.push(String(e.message).slice(0, 160)));
      const origErr = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); origErr(...a); };
      const origWarn = console.warn; console.warn = (...a) => { errs.push('warn: ' + a.map(String).join(' ').slice(0, 200)); origWarn(...a); };
      const update = () => {
        const i = renderer.info;
        d.textContent = JSON.stringify({ ...loaders.info, glError: gl.getError(), textures: i.memory.textures, geometries: i.memory.geometries, programs: i.programs?.length, errors: errs.slice(-6) }, null, 1);
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
