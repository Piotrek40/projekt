// Kierunek słońca sceny (§3.1 p.7): jak engine/src/sky.js — najjaśniejszy piksel HDR + rotation −0,25 + minElevation 30° (CONFIG.sky wpisane niżej na sztywno;
// po zmianie ?sky=/rotation przeliczyć). Użycie: node sundir.mjs [plik.hdr] → sunDir (0.498, 0.5, 0.709), azymut 35,1°, elewacja 30°.
// Kierunek słońca jak w engine/src/sky.js (brightestDirection + rotation -0.25 + minElevation 30°) — z pliku HDR przez RGBELoader-podobny dekoder
import fs from 'node:fs';
import { existsSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), local = resolve(here, '../../../rynek/assets/hdri/sky_1k.hdr');
const buf = fs.readFileSync(process.argv[2] || (existsSync(local) ? local : '/home/user/projekt/rynek/assets/hdri/sky_1k.hdr'));
let pos = 0; while (true) { let e = buf.indexOf(10, pos); const s = buf.toString('latin1', pos, e); pos = e + 1; if (s === '') break; }
let e = buf.indexOf(10, pos); const dim = buf.toString('latin1', pos, e); pos = e + 1;
const m = dim.match(/-Y (\d+) \+X (\d+)/); const H = +m[1], W = +m[2];
let best = -1, bi = 0;
for (let y = 0; y < H; y++) { pos += 4; const row = new Uint8Array(W * 4);
  for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let cnt = buf[pos++]; if (cnt > 128) { cnt -= 128; const v = buf[pos++]; for (let i = 0; i < cnt; i++) row[c * W + x++] = v; } else { for (let i = 0; i < cnt; i++) row[c * W + x++] = buf[pos++]; } } }
  for (let x = 0; x < W; x++) { const ex = row[3*W+x]; const f = ex ? 2 ** (ex - 136) : 0; const l = (row[x]+row[W+x]+row[2*W+x]) * f; if (l > best) { best = l; bi = y * W + x; } } }
const row = Math.floor(bi / W), col = bi % W;
// RGBELoader: flipY = true (sprawdź w examples/jsm/loaders/RGBELoader.js)
for (const flipY of [true, false]) {
  const v = flipY ? 1 - (row + 0.5) / H : (row + 0.5) / H; const u = (col + 0.5) / W;
  const theta = (v - 0.5) * Math.PI, phi = (u - 0.5) * 2 * Math.PI;
  let d = [Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)];
  // applyAxisAngle(Y, -0.25)
  const a = -0.25, c = Math.cos(a), s = Math.sin(a); d = [c * d[0] + s * d[2], d[1], -s * d[0] + c * d[2]];
  const minEl = 30 * Math.PI / 180; if (Math.asin(d[1]) < minEl) { const h = Math.cos(minEl) / Math.hypot(d[0], d[2]); d = [d[0] * h, Math.sin(minEl), d[2] * h]; }
  console.log('flipY', flipY, 'sunDir', d.map(v => +v.toFixed(3)), 'azymut atan2(x,z) deg', (Math.atan2(d[0], d[2]) * 180 / Math.PI).toFixed(1), 'elewacja', (Math.asin(d[1]) * 180 / Math.PI).toFixed(1));
}
