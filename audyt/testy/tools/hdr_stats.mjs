// Prosty dekoder Radiance RGBE (nowe RLE) — liczy średni kolor HDRI, medianę, i kolor najjaśniejszego piksela (słońce).
// Użycie: node hdr_stats.mjs ../../../rynek/assets/hdri/sky_1k.hdr
import fs from 'node:fs';
import { linToOklch } from './oklch.mjs';
const buf = fs.readFileSync(process.argv[2]);
let pos = 0; const lines = [];
while (true) { let e = buf.indexOf(10, pos); const s = buf.toString('latin1', pos, e); pos = e + 1; if (s === '') break; lines.push(s); }
let e = buf.indexOf(10, pos); const dim = buf.toString('latin1', pos, e); pos = e + 1;
const m = dim.match(/-Y (\d+) \+X (\d+)/); const H = +m[1], W = +m[2];
const px = new Float32Array(W * H * 3);
for (let y = 0; y < H; y++) {
  if (buf[pos] !== 2 || buf[pos+1] !== 2) throw new Error('stare RLE');
  pos += 4; const row = new Uint8Array(W * 4);
  for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let cnt = buf[pos++]; if (cnt > 128) { cnt -= 128; const v = buf[pos++]; for (let i = 0; i < cnt; i++) row[c * W + x++] = v; } else { for (let i = 0; i < cnt; i++) row[c * W + x++] = buf[pos++]; } } }
  for (let x = 0; x < W; x++) { const ex = row[3 * W + x]; const f = ex ? 2 ** (ex - 136) : 0; const o = (y * W + x) * 3; px[o] = row[x] * f; px[o+1] = row[W + x] * f; px[o+2] = row[2 * W + x] * f; }
}
let sum = [0,0,0], sumUp = [0,0,0], nUp = 0, best = -1, bi = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; const w = Math.cos((0.5 - (y + 0.5) / H) * Math.PI); // waga cos(szerokości)
  sum[0] += px[o] * w; sum[1] += px[o+1] * w; sum[2] += px[o+2] * w; const l = px[o] + px[o+1] + px[o+2]; if (l > best) { best = l; bi = o; }
  if (y < H / 2) { sumUp[0] += px[o] * w; sumUp[1] += px[o+1] * w; sumUp[2] += px[o+2] * w; nUp += w; } }
let nAll = 0; for (let y = 0; y < H; y++) nAll += W * Math.cos((0.5 - (y + 0.5) / H) * Math.PI);
const avg = sum.map(v => v / nAll), up = sumUp.map(v => v / nUp), sunc = [px[bi], px[bi+1], px[bi+2]];
const chroma = v => { const n = v.map(x => x / Math.max(...v)); return n.map(x => x.toFixed(3)).join(' '); };
console.log(`${W}x${H}`);
console.log('średnia całej sfery (linear)', avg.map(v => v.toFixed(3)).join(' '), 'znormalizowana R G B', chroma(avg), 'OKLCH (zn.)', JSON.stringify(linToOklch(...avg.map(v => v / Math.max(...avg)))));
console.log('średnia górnej półkuli (niebo)', up.map(v => v.toFixed(3)).join(' '), 'znormalizowana', chroma(up), 'OKLCH (zn.)', JSON.stringify(linToOklch(...up.map(v => v / Math.max(...up)))));
console.log('najjaśniejszy piksel (słońce)', sunc.map(v => v.toFixed(1)).join(' '), 'znormalizowany', chroma(sunc), 'wysokość [deg]', ((0.5 - (Math.floor(bi / 3 / W) + 0.5) / H) * 180).toFixed(1));
