#!/usr/bin/env node
// Prostokąty pomiaru koloru (12 px) na lineupie materiałów (?lineup=1) — liczone z projekcji kamery, BEZ renderu, więc deterministyczne.
// Układ z rynek/src/lineup.js (LINEUP: 7 kolumn co 1,5 m, rzędy co 8 m od z=−2, kula r 0,5 na y 0,5, sześcian 0,7 na y 1,55);
// kamery z audyt/testy/views_lineup.json (oko 1,65 m, fov 70, kadr --w×--h, domyślnie 1280×720 przy DPR 1), każdy rząd = widok row<k>.
// Na każdej kuli: „sun" = widoczny punkt o największym n·sunDir (dociągnięty do wnętrza tarczy, żeby 12 px mieściło się w kuli),
// „shade" = o najmniejszym n·sunDir; „cube" = środek ściany +z sześcianu. Pole dotNL mówi, ile słońca faktycznie pada na plamę
// (kamera patrzy na −z, słońce jest na NE, więc plama „sun" ma dotNL < 1 — cel z palette_predict „ekran słońce" dotyczy dotNL = 1).
// sunDir jak w engine/src/sky.js: najjaśniejszy piksel sky_1k.hdr → kierunek (konwencja equirect three, flipY=true jak RGBELoader),
// obrót CONFIG.sky.rotation, min. elewacja CONFIG.sky.minElevationDeg — liczony tu dekoderem RGBE; albo --sun=x,y,z (pole sunDir z results.json).
// Kolejność kluczy = Object.keys(W.mat) z materials.js (MAT_KEYS w lineup.js) albo --results=<results.json renderu lineupu> (pole lineup.keys).
// Użycie: node lineup_rects.mjs [--views=../views_lineup.json] [--out=../lineup_rects.json] [--w=1280] [--h=720] [--sun=x,y,z] [--results=…]
//         [--overlay=<row0.png>] rysuje prostokąty na kopii PNG (<nazwa>_rects.png) do obejrzenia.
// Wynik: JSON [{name, view, key, kind, x, y, w, h, dotNL, normal, tint, set, ao}] — measure_render.mjs mierzy tylko wpisy z view == nazwa PNG (row0.png → row0)
// i liczy cel z pól tint (hex z CONFIG.paletteOKLCH.tint[key] przez oklch()), set (zestaw tekstur), ao (AO zestawu z agx_predict.mjs), normal (→ irradiancja otoczenia z HDRI, hdr_env.mjs).
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { TOOLS_DIR, sharp } from './_sharp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
const W = +(args.w || 1280), H = +(args.h || 720), PATCH = 12, EYE = 1.65, FOV = 70;
const threeDir = fs.existsSync(resolve(TOOLS_DIR, 'tools/node_modules/three')) ? resolve(TOOLS_DIR, 'tools/node_modules/three') : '/home/user/projekt/tools/node_modules/three';
// bare 'three' / 'three/addons/…' w modułach sceny → tools/node_modules/three (jak alias w demo/build.sh)
registerHooks({ resolve(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(resolve(threeDir, 'build/three.module.js')).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: pathToFileURL(resolve(threeDir, 'examples/jsm', spec.slice('three/addons/'.length))).href, shortCircuit: true };
  return next(spec, ctx);
} });
const THREE = await import(pathToFileURL(resolve(threeDir, 'build/three.module.js')).href);
const { LINEUP, MAT_KEYS } = await import(pathToFileURL(resolve(TOOLS_DIR, 'rynek/src/lineup.js')).href);
const { CONFIG } = await import(pathToFileURL(resolve(TOOLS_DIR, 'rynek/src/config.js')).href);
const { oklchToHex } = await import(pathToFileURL(resolve(TOOLS_DIR, 'rynek/src/color.js')).href);
const { AO } = await import(pathToFileURL(resolve(here, 'agx_predict.mjs')).href);
const keys = args.results ? JSON.parse(fs.readFileSync(args.results, 'utf8')).at(-1).lineup.keys : MAT_KEYS;
// pola koloru prostokąta: tint (hex) i zestaw z CONFIG.paletteOKLCH.tint[key] = [L, C, H, zestaw]; klucze bez wpisu (banner*, glassLit, flame) bez celu
const colorOf = k => { const t = CONFIG.paletteOKLCH?.tint?.[k]; return t ? { tint: oklchToHex(t[0], t[1], t[2]).hexStr, set: t[3], ao: AO[t[3]] ?? 1 } : {}; };
const views = JSON.parse(fs.readFileSync(args.views || resolve(here, '../views_lineup.json'), 'utf8'));

// --- sunDir jak w sky.js (brightestDirection + rotation + minElevation) -------------------------------------------------
function readRGBE(file) { // Radiance RGBE, nowe RLE (jak hdr_stats.mjs)
  const buf = fs.readFileSync(file); let pos = 0;
  while (true) { const e = buf.indexOf(10, pos); const s = buf.toString('latin1', pos, e); pos = e + 1; if (s === '') break; }
  const e = buf.indexOf(10, pos); const m = buf.toString('latin1', pos, e).match(/-Y (\d+) \+X (\d+)/); pos = e + 1;
  const Hh = +m[1], Ww = +m[2], px = new Float32Array(Ww * Hh * 3);
  for (let y = 0; y < Hh; y++) {
    if (buf[pos] !== 2 || buf[pos + 1] !== 2) throw new Error('stare RLE');
    pos += 4; const row = new Uint8Array(Ww * 4);
    for (let c = 0; c < 4; c++) { let x = 0; while (x < Ww) { let cnt = buf[pos++]; if (cnt > 128) { cnt -= 128; const v = buf[pos++]; for (let i = 0; i < cnt; i++) row[c * Ww + x++] = v; } else { for (let i = 0; i < cnt; i++) row[c * Ww + x++] = buf[pos++]; } } }
    for (let x = 0; x < Ww; x++) { const ex = row[3 * Ww + x]; const f = ex ? 2 ** (ex - 136) : 0; const o = (y * Ww + x) * 3; px[o] = row[x] * f; px[o + 1] = row[Ww + x] * f; px[o + 2] = row[2 * Ww + x] * f; }
  }
  return { px, W: Ww, H: Hh };
}
function sunDirFromHdr(file, flipY = true) {
  const { px, W: Ww, H: Hh } = readRGBE(file); let best = -1, bi = 0;
  for (let i = 0; i < Ww * Hh; i++) { const l = px[i * 3] + px[i * 3 + 1] + px[i * 3 + 2]; if (l > best) { best = l; bi = i; } }
  const row = Math.floor(bi / Ww), col = bi % Ww, v = flipY ? 1 - (row + 0.5) / Hh : (row + 0.5) / Hh, u = (col + 0.5) / Ww;
  const theta = (v - 0.5) * Math.PI, phi = (u - 0.5) * 2 * Math.PI;
  const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)).applyAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.sky.rotation);
  const minEl = THREE.MathUtils.degToRad(CONFIG.sky.minElevationDeg);
  if (Math.asin(dir.y) < minEl) { const h = Math.cos(minEl) / Math.hypot(dir.x, dir.z); dir.set(dir.x * h, Math.sin(minEl), dir.z * h); }
  return dir;
}
const sun = args.sun ? new THREE.Vector3(...args.sun.split(',').map(Number)).normalize() : sunDirFromHdr(resolve(TOOLS_DIR, 'rynek/assets/hdri', CONFIG.sky.file));

// --- projekcja ------------------------------------------------------------------------------------------------------------
function cameraFor(v) { const c = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 300); c.position.set(v.x, EYE, v.z); c.rotation.set(0, 0, 0, 'YXZ'); c.rotation.y = v.yaw; c.rotation.x = v.pitch ?? 0; c.updateMatrixWorld(true); return c; }
const proj = (p, cam) => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
const rectAt = ([px, py]) => ({ x: Math.round(px - PATCH / 2), y: Math.round(py - PATCH / 2), w: PATCH, h: PATCH });
const rects = [];
keys.forEach((k, i) => {
  const col = i % LINEUP.cols, row = Math.floor(i / LINEUP.cols);
  const x = (col - (LINEUP.cols - 1) / 2) * LINEUP.step, z = LINEUP.z0 - row * LINEUP.row;
  const view = views.reduce((b, v) => Math.abs(v.z - z - 6) < Math.abs(b.z - z - 6) ? v : b); // widok stojący ~6 m przed tym rzędem
  const cam = cameraFor(view), center = new THREE.Vector3(x, LINEUP.ySphere, z);
  const toCam = cam.position.clone().sub(center), dist = toCam.length(), v = toCam.normalize();
  const Rpx = LINEUP.r * (H / 2) / (dist * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));      // promień kuli w px
  const maxSin = Math.max(0.2, 0.92 - PATCH / Math.SQRT2 / Rpx), th = Math.asin(maxSin);       // plama w całości wewnątrz tarczy
  const sPerp = sun.clone().sub(v.clone().multiplyScalar(sun.dot(v))); const hasPerp = sPerp.length() > 1e-6; sPerp.normalize();
  const normalToward = s => { const ang = Math.acos(THREE.MathUtils.clamp(s.dot(v), -1, 1)); return ang <= th || !hasPerp ? (ang <= th ? s.clone() : v.clone()) : v.clone().multiplyScalar(Math.cos(th)).addScaledVector(sPerp.clone().multiplyScalar(Math.sign(s.dot(sPerp))), Math.sin(th)); };
  const nSun = normalToward(sun), nShade = normalToward(sun.clone().negate());
  const nf = n => n.toArray().map(v => +v.toFixed(3));   // normalna plamy → measure_render liczy z niej irradiancję otoczenia z HDRI (hdr_env.mjs)
  for (const [kind, n] of [['sun', nSun], ['shade', nShade]]) rects.push({ name: `${k}_${kind}`, view: view.name, key: k, kind, ...rectAt(proj(center.clone().addScaledVector(n, LINEUP.r), cam)), dotNL: +Math.max(0, n.dot(sun)).toFixed(2), normal: nf(n), ...colorOf(k) });
  rects.push({ name: `${k}_cube`, view: view.name, key: k, kind: 'cube', ...rectAt(proj(new THREE.Vector3(x, LINEUP.yCube, z + LINEUP.cube / 2), cam)), dotNL: +Math.max(0, sun.z).toFixed(2), normal: [0, 0, 1], ...colorOf(k) });
});
const out = args.out || resolve(here, '../lineup_rects.json');
fs.writeFileSync(out, JSON.stringify(rects, null, 1).replace(/\n\s+("|\d|-)/g, ' $1').replace(/\n }/g, ' }'));
console.log(`sunDir ${sun.toArray().map(v => +v.toFixed(4))} | kluczy ${keys.length}, prostokątów ${rects.length} → ${out}`);
for (const v of views) { const r = rects.filter(r => r.view === v.name); if (r.length) console.log(`${v.name}: ${r.length / 3} kul, dotNL sun ${r.find(r => r.kind === 'sun').dotNL} / shade ${r.find(r => r.kind === 'shade').dotNL} / cube ${r.find(r => r.kind === 'cube').dotNL}`); }
if (args.overlay) { // podgląd: prostokąty na kopii PNG
  const view = basename(args.overlay, '.png'), r = rects.filter(r => r.view === view), col = { sun: '#ff0', shade: '#0ff', cube: '#f0f' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${r.map(q => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="${col[q.kind]}" stroke-width="2"/>`).join('')}</svg>`;
  const dst = args.overlay.replace(/\.png$/, '_rects.png');
  await sharp(args.overlay).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(dst); console.log('podgląd:', dst);
}
