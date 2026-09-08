// Pomiar koloru na renderze: średni kolor prostokątów (px, uśrednianie W LINIOWYM) → sRGB hex + OKLCH; porównanie z celem.
// Użycie: node measure_render.mjs <render.png> <prostokaty.json> [--sunk=1] [--sun=fff1e0] [--env=0.8]
//   JSON = [{name, x, y, w, h, view?, target?:{L,C,H}, tint?:'#rrggbb', set?:'plaster', dotNL?, ao?, normal?:[x,y,z] | env?:'wall'|'up'|[r,g,b]}]
// Prostokąty z polem `view` (np. z lineup_rects.json) są mierzone tylko, gdy `view` == nazwa pliku PNG bez rozszerzenia (row0.png → row0).
// Cel liczony NA MIEJSCU z pól prostokąta: predict(tint, TEX[set], {sun: dotNL·sunk, env, ao}) (agx_predict.mjs); `target` {L,C,H} tylko, gdy nie ma `tint`.
// --sunk: mnożnik intensywności słońca względem 5,0 (render z ?sunint=0 → --sunk=0); --sun/--env jak ?sun=&env= w world.js (hipotezy §4.4).
// Kryterium (§4.3.4): ok = ΔL ≤ 0,06 ∧ hypot(Δa, Δb) ≤ 0,025 (odległość w OKLab; przy C 0,025 obrót o 15° to Δab 0,0065 — mniej niż błąd predyktora,
// więc „ΔH ≤ 15°" oblewałoby fałszywie). Exit 1 = są niezaliczone.
import fs from 'node:fs';
import { srgbToLin, linToOklch, linToOklab, oklabToLin } from './oklch.mjs';
import { predict, TEX, AO, ROUGH, setSun, setEnv } from './agx_predict.mjs';
import { sharp } from './_sharp.mjs';
import { irradiance } from './hdr_env.mjs';
import { basename } from 'node:path';
const pos = process.argv.slice(2).filter(a => !a.startsWith('--')), [png, rectsFile] = pos;
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.slice(2), true]; }));
const sunk = args.sunk !== undefined ? +args.sunk : 1;
if (args.sun) setSun('#' + args.sun.replace('#', ''));
if (args.env) setEnv(+args.env);
const viewName = basename(png, '.png');
const rects = JSON.parse(fs.readFileSync(rectsFile, 'utf8')).filter(r => !r.view || r.view === viewName);
const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;
const toHex = lin => '#' + lin.map(v => Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
let fails = 0, judged = 0;
for (const r of rects) {
  let R = 0, G = 0, B = 0, n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const o = (y * info.width + x) * ch; R += srgbToLin(data[o] / 255); G += srgbToLin(data[o+1] / 255); B += srgbToLin(data[o+2] / 255); n++; }
  R /= n; G /= n; B /= n;
  const lab = linToOklch(R, G, B), [Lp, ap, bp] = linToOklab(R, G, B);
  let verdict = '', target = null;
  // env: jawne 'wall'|'up'|[r,g,b] albo z normalnej plamy (irradiancja HDRI, hdr_env.mjs)
  if (r.tint) { const p = predict(r.tint, TEX[r.set] ?? TEX.none, { sun: (r.dotNL ?? 1) * sunk, env: r.env ?? (r.normal ? irradiance(r.normal) : 'wall'), ao: r.ao ?? AO[r.set] ?? 1, rough: r.rough ?? ROUGH[r.set] ?? 1 }); target = { L: p.outOKLCH.L, C: p.outOKLCH.C, H: p.outOKLCH.H, lin: p.outLin }; }
  else if (r.target) { const h = r.target.H * Math.PI / 180; target = { ...r.target, lin: oklabToLin(r.target.L, r.target.C * Math.cos(h), r.target.C * Math.sin(h)) }; }
  if (target) {
    const [Lt, at, bt] = linToOklab(...target.lin);
    const dL = Math.abs(Lp - Lt), dab = Math.hypot(ap - at, bp - bt), ok = dL <= 0.06 && dab <= 0.025;
    judged++; if (!ok) fails++;
    verdict = ` | cel ${toHex(target.lin)} L${target.L.toFixed(3)} C${target.C.toFixed(3)} H${target.H.toFixed(0)} → ΔL=${dL.toFixed(3)} Δab=${dab.toFixed(3)} ${ok ? 'OK' : 'FAIL'}`;
  }
  console.log(`${r.name.padEnd(16)} ${toHex([R, G, B])}  L=${lab.L.toFixed(3)} C=${lab.C.toFixed(3)} H=${lab.H.toFixed(1)}${r.dotNL !== undefined ? ` dotNL=${r.dotNL}` : ''}${verdict}`);
}
if (judged) { console.log(fails ? `NIEZALICZONE: ${fails} z ${judged}` : `WSZYSTKIE OK (${judged})`); process.exit(fails ? 1 : 0); }
