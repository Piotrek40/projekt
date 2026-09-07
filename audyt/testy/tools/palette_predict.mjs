// Paleta „Złota godzina nad Rynkiem Srebrnych Liści" (rynek/PROMPT.md §4.4): OKLCH tint → hex → albedo (tint × tekstura) → kolor na ekranie.
// Źródło tabeli: CONFIG.paletteOKLCH.tint z rynek/src/config.js (klucz W.mat → [L, C, H, zestaw tekstur]) — ta sama tabela, z której
// materials.js robi materiały; gdy sekcja jest pusta (HEAD przed motywem #9), tabela PALETA niżej = §4.4. Stałe oświetlenia w agx_predict.mjs
// (słońce 5,0 × ffd6a6, env 0,6, AgX 1,15; mnożniki TEX i AO z map arm). Kolumny: kula lineupu (dotNL 1) / fasada N (0,71) / cień z AO (sun 0).
// Sprawdza zasady §4.2: rodziny odcieni ≤ 7 (łańcuch tintów z ΔH ≤ 15° po sortowaniu, cyklicznie), C tintu wg roli, ΔL ≤ 0,06 w roli
// (tynki na fasadzie N; roof0/roof1 na połaci 0,86), walory (mediana L tynków − mediana L dachów ≥ 0,15; L dach − L belki ≥ 0,08).
// Użycie: node palette_predict.mjs [--sun=fff1e0] [--env=0.8]   (nadpisanie słońca/otoczenia jak ?sun=&env= w world.js — do hipotez (a)/(d)).
import { oklchToHex, linToOklch, srgbToLin } from './oklch.mjs';
import { predict, agx, TEX, AO, setSun, setEnv } from './agx_predict.mjs';
import { CONFIG } from '../../../rynek/src/config.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
if (args.sun) setSun('#' + args.sun.replace('#', ''));
if (args.env) setEnv(+args.env);

// [klucz, L, C, H, zestaw] — §4.4 (używane tylko, gdy CONFIG.paletteOKLCH.tint jest puste)
export const PALETA = [
  ['plaster0', 0.90, 0.030, 85, 'plaster'], ['plaster1', 0.92, 0.012, 90, 'plaster'], ['plaster2', 0.86, 0.060, 145, 'plaster'],
  ['plaster3', 0.87, 0.050, 15, 'plaster'], ['plaster4', 0.86, 0.060, 240, 'plaster'],
  ['paint0', 0.62, 0.070, 170, 'timber'], ['paint1', 0.62, 0.090, 25, 'timber'], ['paint2', 0.64, 0.060, 255, 'timber'],
  ['timber', 0.70, 0.045, 55, 'timber'], ['door', 0.55, 0.045, 55, 'planks'],
  ['roof0', 0.70, 0.100, 40, 'roof'], ['roof1', 0.64, 0.070, 45, 'roof'], ['roof2', 0.70, 0.050, 250, 'tiles'], ['roofTower', 0.72, 0.085, 185, 'tiles'],
  ['cloth0', 0.45, 0.130, 320, 'none'], ['cloth1', 0.58, 0.100, 190, 'none'], ['cloth2', 0.72, 0.150, 78, 'none'], ['cloth3', 0.50, 0.170, 25, 'none'],
  ['stone', 0.82, 0.015, 80, 'stone'], ['blocks', 0.80, 0.012, 85, 'blocks'], ['slates', 0.80, 0.012, 85, 'slates'], ['cobble', 0.80, 0.010, 240, 'cobble'],
  ['water', 0.50, 0.070, 200, 'none'], ['glass', 0.25, 0.020, 250, 'none'], ['iron', 0.30, 0.005, 250, 'none'],
];
const fromConfig = Object.entries(CONFIG.paletteOKLCH?.tint || {}).map(([k, v]) => [k, ...v]);
const rows = fromConfig.length ? fromConfig : PALETA;
console.log(fromConfig.length ? `tabela: CONFIG.paletteOKLCH.tint (${rows.length} wpisów)` : `tabela: PALETA §4.4 (${rows.length} wpisów; CONFIG.paletteOKLCH.tint puste)`);

// rola z nazwy klucza — do limitów C tintu (§4.2) i walorów
const roleOf = k => /^plaster/.test(k) ? 'tynk' : /^(stone|blocks|slates|cobble)$/.test(k) ? 'kamień' : /^(roof|paint)/.test(k) ? 'dach/drewno mal.' : /^(timber|door)$/.test(k) ? 'belki' : /^cloth/.test(k) ? 'akcent' : 'inne';
const cMax = { tynk: 0.05, 'kamień': 0.02, 'dach/drewno mal.': 0.10, belki: 0.05 };
const pad = (s, n) => String(s).padEnd(n);
const fmt = o => `L${o.outOKLCH.L.toFixed(2)} C${o.outOKLCH.C.toFixed(3)} H${Math.round(o.outOKLCH.H)}`;
console.log(pad('klucz', 10), pad('OKLCH tint', 17), pad('hex', 8), pad('zestaw', 8), pad('albedo L/C/H', 20), pad('kula (dotNL 1)', 22), pad('fasada N (0,71)', 22), 'cień (sun 0, AO)');
export const out = {};
let bad = 0;
for (const [k, L, C, H, set] of rows) {
  const { hex, inGamut } = oklchToHex(L, C, H);
  const tex = TEX[set] || TEX.none, ao = AO[set] ?? 1;
  const kula = predict(hex, tex, { sun: 1, ao }), fasN = predict(hex, tex, { sun: 0.71, ao }), cien = predict(hex, tex, { sun: 0, ao });
  const polac = predict(hex, tex, { sun: 0.86, ao });
  out[k] = { L, C, H, set, hex, inGamut, kula: kula.outOKLCH, fasN: fasN.outOKLCH, cien: cien.outOKLCH, polac: polac.outOKLCH, albedo: kula.albedoOKLCH };
  const role = roleOf(k), flags = [];
  if (!inGamut) flags.push('!GAMUT');
  const lim = cMax[role]; const limC = role === 'tynk' && H >= 130 && H <= 260 ? 0.06 : lim;
  if (limC !== undefined && C > limC + 1e-9) flags.push(`C>${limC}`);
  if (role === 'belki' && kula.albedoOKLCH.L < 0.20) flags.push('albedo L<0.20');   // §4.2: belki/drzwi albedo L ≥ 0,20 (dziś timber 0x5a4030 daje 0,19)
  if (flags.length) bad++;
  console.log(pad(k, 10), pad(`${L} ${C} ${H}`, 17), pad(hex, 8), pad(set, 8), pad(`${kula.albedoOKLCH.L.toFixed(2)} ${kula.albedoOKLCH.C.toFixed(3)} ${Math.round(kula.albedoOKLCH.H)}`, 20), pad(fmt(kula), 22), pad(fmt(fasN), 22), fmt(cien), flags.join(' '));
}
// --- reguły §4.2 --------------------------------------------------------------------------------------------------------------------
const chromatic = rows.filter(r => r[2] >= 0.01);
const hues = chromatic.map(r => r[3]).sort((a, b) => a - b);
let fam = 1; for (let i = 1; i < hues.length; i++) if (hues[i] - hues[i - 1] > 15) fam++;
if (hues.length > 1 && (hues[0] + 360 - hues[hues.length - 1]) <= 15) fam = Math.max(1, fam - 1); // łańcuch przez 0°
console.log(`rodzin: ${fam} (ΔH ≤ 15° między sąsiadami po sortowaniu, tinty z C ≥ 0,01: ${hues.join(' ')})${fam > 7 ? '  !!! > 7' : ''}`);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const tynki = rows.filter(r => /^plaster/.test(r[0])).map(r => out[r[0]].fasN.L), dachy = rows.filter(r => /^roof[01]$/.test(r[0])).map(r => out[r[0]].polac.L);
const belki = out.timber ? out.timber.fasN.L : NaN;
const walor1 = med(tynki) - med(dachy), walor2 = med(dachy) - belki;
console.log(`walory: mediana L tynków (fasada N) ${med(tynki).toFixed(3)} − mediana L dachówek (połać 0,86) ${med(dachy).toFixed(3)} = ${walor1.toFixed(3)} (≥ 0,15 ${walor1 >= 0.15 ? 'OK' : 'FAIL'}); dach − belki ${walor2.toFixed(3)} (≥ 0,08 ${walor2 >= 0.08 ? 'OK' : 'FAIL'})`);
const dLt = Math.max(...tynki) - Math.min(...tynki), dLd = dachy.length > 1 ? Math.max(...dachy) - Math.min(...dachy) : 0;
console.log(`ΔL w roli: tynki fasada N ${dLt.toFixed(3)} (≤ 0,06 ${dLt <= 0.06 ? 'OK' : 'FAIL'}); roof0/roof1 połać 0,86 ${dLd.toFixed(3)} (≤ 0,06 ${dLd <= 0.06 ? 'OK' : 'FAIL'})`);
const cool = rows.filter(r => r[3] >= 200 && r[3] <= 260 && /^(plaster|roof)/.test(r[0])).map(r => `${r[0]} cień C${out[r[0]].cien.C.toFixed(3)} H${Math.round(out[r[0]].cien.H)}`);
console.log('chłód w cieniu (duże powierzchnie H 200–260, cel C ≥ 0,025 na POMIARZE):', cool.join('; '));
console.log('--- emisja/płomień (MeshBasic/emissive → wprost do AgX, bez oświetlenia):');
const em = CONFIG.paletteOKLCH?.emit || {};
for (const [name, hex, k] of [['flame', em.flame ? oklchToHex(...em.flame.color).hex : '#ff7a1a', em.flame?.intensity ?? 1.6], ['glassLit emissive', em.glassLit ? oklchToHex(...em.glassLit.emissive).hex : '#ffb257', em.glassLit?.intensity ?? 1.6]]) {
  const lin = [1, 3, 5].map(i => srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255) * k);
  const o = agx(lin); const oh = '#' + o.map(v => Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
  console.log(pad(`${name} ${hex} ×${k}`, 30), 'ekran', oh, JSON.stringify(linToOklch(...o)));
}
if (bad) console.log(`UWAGA: ${bad} wpisów poza zakresami §4.2 (flagi w tabeli)`);
