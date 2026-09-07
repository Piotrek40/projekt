#!/usr/bin/env node
// Średni kolor prostokątów zrzutu: sRGB (hex, 0-255) + OKLCH. Użycie: node color_probe.mjs <png> x0,y0,w,h [x0,y0,w,h ...]
// Bez argumentów prostokątów: cały obraz. Wynik: JSON na stdout (jedna linia na prostokąt).
import { sharp } from './_sharp.mjs'; // sharp z tools/node_modules (ścieżka względna, fallback bezwzględny)
const [png, ...rects] = process.argv.slice(2);
if (!png) { console.error('użycie: color_probe.mjs <png> x0,y0,w,h ...'); process.exit(2); }
const srgbToLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
// OKLab wg Björna Ottossona (macierze z https://bottosson.github.io/posts/oklab/)
function oklch(r, g, b) {
  const [R, G, B] = [r, g, b].map(srgbToLin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(a, bb); let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
  return { L: +L.toFixed(3), C: +C.toFixed(3), H: +H.toFixed(1) };
}
const meta = await sharp(png).metadata();
const regions = rects.length ? rects.map(s => s.split(',').map(Number)) : [[0, 0, meta.width, meta.height]];
for (const [x0, y0, w, h] of regions) {
  const { data, info } = await sharp(png).extract({ left: x0, top: y0, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height; let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  r /= n; g /= n; b /= n;
  const hex = '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  console.log(JSON.stringify({ rect: [x0, y0, w, h], rgb: [r, g, b].map(v => Math.round(v)), hex, oklch: oklch(r, g, b) }));
}
