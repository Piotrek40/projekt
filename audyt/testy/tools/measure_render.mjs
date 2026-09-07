// Pomiar koloru na renderze: średni kolor w prostokątach (px) → sRGB hex + OKLCH; opcjonalnie porównanie z celem.
// Użycie: node measure_render.mjs <render.png> <prostokaty.json>   gdzie JSON = [{name,x,y,w,h, target?:{L,C,H}, view?}]
// Prostokąty z polem `view` (np. z lineup_rects.json) są mierzone tylko, gdy `view` == nazwa pliku PNG bez rozszerzenia (row0.png → row0).
import fs from 'node:fs';
import { srgbToLin, linToOklch } from './oklch.mjs';
import { sharp } from './_sharp.mjs';
import { basename } from 'node:path';
const [,, png, rectsFile] = process.argv;
const viewName = basename(png, '.png');
const rects = JSON.parse(fs.readFileSync(rectsFile, 'utf8')).filter(r => !r.view || r.view === viewName);
const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;
const dH = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
let fails = 0;
for (const r of rects) {
  let R = 0, G = 0, B = 0, n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const o = (y * info.width + x) * ch; R += srgbToLin(data[o] / 255); G += srgbToLin(data[o+1] / 255); B += srgbToLin(data[o+2] / 255); n++; }
  R /= n; G /= n; B /= n;
  const lab = linToOklch(R, G, B);
  const hex = '#' + [R, G, B].map(v => Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
  let verdict = '';
  if (r.target) { const dL = Math.abs(lab.L - r.target.L), dh = dH(lab.H, r.target.H); const ok = dL <= 0.06 && (lab.C < 0.02 || dh <= 15); if (!ok) fails++; verdict = ` | cel L${r.target.L} H${r.target.H} → ΔL=${dL.toFixed(3)} ΔH=${dh.toFixed(1)}° ${ok ? 'OK' : 'FAIL'}`; }
  console.log(`${r.name.padEnd(16)} ${hex}  L=${lab.L.toFixed(3)} C=${lab.C.toFixed(3)} H=${lab.H.toFixed(1)}${verdict}`);
}
if (rects.some(r => r.target)) { console.log(fails ? `NIEZALICZONE: ${fails}` : 'WSZYSTKIE OK'); process.exit(fails ? 1 : 0); }
