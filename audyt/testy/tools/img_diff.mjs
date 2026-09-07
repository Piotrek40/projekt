#!/usr/bin/env node
// Porównanie dwóch zrzutów tej samej wielkości: średnia różnica |a-b| per kanał (0-255), % pikseli z max różnicą > PRÓG (domyślnie 20).
// Użycie: node img_diff.mjs a.png b.png [próg] [diff_out.png]. Wynik JSON; kod wyjścia 1, gdy rozmiary różne.
import { sharp } from './_sharp.mjs'; // sharp z tools/node_modules (ścieżka względna, fallback bezwzględny)
const [a, b, thrArg, out] = process.argv.slice(2);
const THR = +(thrArg || 20);
const load = p => sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const [A, B] = await Promise.all([load(a), load(b)]);
if (A.info.width !== B.info.width || A.info.height !== B.info.height) { console.error('różne rozmiary', A.info, B.info); process.exit(1); }
const n = A.info.width * A.info.height; let sum = 0, over = 0, maxd = 0;
const mask = out ? Buffer.alloc(n) : null;
for (let i = 0; i < n; i++) {
  const d0 = Math.abs(A.data[i * 3] - B.data[i * 3]), d1 = Math.abs(A.data[i * 3 + 1] - B.data[i * 3 + 1]), d2 = Math.abs(A.data[i * 3 + 2] - B.data[i * 3 + 2]);
  const m = Math.max(d0, d1, d2); sum += (d0 + d1 + d2) / 3; if (m > THR) over++; if (m > maxd) maxd = m;
  if (mask) mask[i] = m > THR ? 255 : Math.min(255, m * 4);
}
const res = { a, b, width: A.info.width, height: A.info.height, meanDiff: +(sum / n).toFixed(2), pctOver: +(100 * over / n).toFixed(2), threshold: THR, maxDiff: maxd };
if (mask) { await sharp(mask, { raw: { width: A.info.width, height: A.info.height, channels: 1 } }).png().toFile(out); res.diffPng = out; }
console.log(JSON.stringify(res));
