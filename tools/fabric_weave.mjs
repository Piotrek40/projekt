// Buduje mapę albedo tkaniny (fabric_pattern_07_diff) z lokalnej mapy AO tej samej tkaniny.
// PO CO: materiały cloth0..3 miały tylko normalMap i roughnessMap, więc przy roughness 1 i miękkim świetle HDRI
// płótno kramów renderowało się jako JEDNA płaska wartość RGB (krytyka zrzutu z telefonu: „sukno jako płaskie plamy").
// Poly Haven ma dla tej tkaniny mapy koloru (col_1/col_2/col_03), ale to wzór w kratę piknikową — zniszczyłby paletę OKLCH.
// Zamiast tego bierzemy splot z AO i normalizujemy go tak, żeby ŚREDNIA W LINIOWYM wynosiła dokładnie 1,0:
// wtedy tint × mapa ma tę samą jasność średnią co sam tint i kalibracja palety zostaje w mocy, a splot staje się widoczny.
// Użycie: node tools/fabric_weave.mjs <ao.jpg> <out.jpg> [kontrast]
import { createRequire } from 'module';
const sharp = createRequire('/home/user/projekt/tools/package.json')('sharp');
const [src, out, kStr] = process.argv.slice(2);
const k = +(kStr || 0.45);                       // ile splotu przepuszczamy: 1 = pełny kontrast AO, 0 = płasko
const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = v => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
const { data, info } = await sharp(src).grayscale().raw().toBuffer({ resolveWithObject: true });
const lin = new Float32Array(data.length);
let sum = 0;
for (let i = 0; i < data.length; i++) { lin[i] = toLin(data[i]); sum += lin[i]; }
const mean = sum / data.length;
// Bez skalowania część wartości wychodzi POWYŻEJ 1,0 i toSrgb je klamruje — zmierzone przy k = 0,85:
// 35,3 % pikseli lądowało na czystej bieli, czyli jedna trzecia splotu nie niosła żadnej informacji,
// a rzeczywista średnia liniowa zapisanej mapy wynosiła 0,936, nie 1,0 (komentarz w materials.js był fałszywy).
// Skalujemy więc tak, żeby MAKSIMUM wypadło dokładnie na 1,0 — nic się nie obcina — i zwracamy zmierzoną
// średnią, którą materiał kompensuje mnożnikiem koloru (CONFIG.paletteOKLCH.fabricWeaveMean).
const vals = new Float32Array(data.length);
let vmax = 0;
for (let i = 0; i < data.length; i++) { const v = 1 + k * (lin[i] / mean - 1); vals[i] = v; if (v > vmax) vmax = v; }
const scale = 1 / vmax;
const outBuf = Buffer.allocUnsafe(data.length);
let sum2 = 0, clipped = 0;
for (let i = 0; i < data.length; i++) { const v = vals[i] * scale; sum2 += v; if (v >= 0.9999) clipped++; outBuf[i] = toSrgb(v); }
await sharp(outBuf, { raw: { width: info.width, height: info.height, channels: 1 } })
  .toColorspace('b-w').jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toFile(out);
const meanOut = sum2 / data.length;
console.log(`splot: ${info.width}×${info.height}, kontrast ${k}, srednia AO ${mean.toFixed(3)}`);
console.log(`  maksimum przed skalowaniem ${vmax.toFixed(4)} -> po skalowaniu 1,0; obcietych pikseli ${(100 * clipped / data.length).toFixed(2)} %`);
console.log(`  SREDNIA LINIOWA MAPY = ${meanOut.toFixed(5)}  -> wpisz CONFIG.paletteOKLCH.fabricWeaveMean = ${meanOut.toFixed(5)}`);
console.log(`  zapisane ${out}`);
