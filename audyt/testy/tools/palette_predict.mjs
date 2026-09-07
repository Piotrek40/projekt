// Proponowana paleta „Złota godzina nad Srebrnymi Liśćmi": OKLCH → hex tintu → przewidywany kolor na ekranie (słońce/cień).
// Użycie: node palette_predict.mjs (edytuj tabelę PALETA niżej; stałe oświetlenia w agx_predict.mjs). Wyjście = cele dla measure_render.
import { oklchToHex, hexToOklch } from './oklch.mjs';
import { predict, agx } from './agx_predict.mjs';
import { linToOklch, srgbToLin } from './oklch.mjs';
const TEX = { plaster: [0.436, 0.392, 0.335], roof: [0.254, 0.185, 0.129], stone: [0.251, 0.180, 0.111], cobble: [0.279, 0.228, 0.149], planks: [0.123, 0.091, 0.064], blocks: [0.375, 0.242, 0.135], slates: [0.275, 0.227, 0.150], none: [1, 1, 1] };
export const PALETA = [
  // [nazwa, L, C, H, zestaw tekstur, rola]
  ['plaster0 kremowy',     0.90, 0.030,  85, 'plaster', 'tynk'],
  ['plaster1 piaskowy',    0.87, 0.050,  72, 'plaster', 'tynk'],
  ['plaster2 szałwiowy',   0.86, 0.035, 130, 'plaster', 'tynk'],
  ['plaster3 różany',      0.87, 0.045,  35, 'plaster', 'tynk'],
  ['plaster4 gołębi',      0.86, 0.022, 240, 'plaster', 'tynk'],
  ['paint0 zieleń butelk.',0.62, 0.070, 150, 'planks',  'drewno malowane'],
  ['paint1 bordo',         0.62, 0.090,  25, 'planks',  'drewno malowane'],
  ['paint2 indygo-szary',  0.64, 0.060, 255, 'planks',  'drewno malowane'],
  ['timber dąb',           0.70, 0.045,  55, 'planks',  'belki (bez farby)'],
  ['roof0 dachówka ciepła',0.70, 0.100,  40, 'roof',    'dach'],
  ['roof1 dachówka zgasz.',0.64, 0.070,  45, 'roof',    'dach'],
  ['roof2 łupek chłodny',  0.66, 0.025, 250, 'roof',    'dach'],
  ['roofTower miedź patyna',0.75,0.085, 175, 'slates',  'dach wieży'],
  ['cloth0 purpura',       0.45, 0.130, 340, 'none',    'tkanina heraldyczna'],
  ['cloth1 morski turkus', 0.60, 0.110, 190, 'none',    'tkanina heraldyczna'],
  ['cloth2 szafran',       0.76, 0.140,  80, 'none',    'tkanina heraldyczna'],
  ['cloth3 karmazyn',      0.50, 0.170,  25, 'none',    'tkanina heraldyczna'],
  ['stone ciepły szary',   0.82, 0.015,  80, 'stone',   'kamień parterów'],
  ['blocks fontanna',      0.80, 0.012,  85, 'blocks',  'fontanna/wieża'],
  ['cobble chłodny',       0.80, 0.010, 240, 'cobble',  'bruk'],
  ['water',                0.50, 0.070, 210, 'none',    'woda (+odbicie nieba)'],
  ['glass',                0.25, 0.020, 250, 'none',    'szkło (odbija HDRI)'],
];
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('materiał', 26), pad('OKLCH tint', 20), pad('hex', 8), pad('albedo×tex OKLCH', 30), pad('ekran słońce', 34), 'ekran cień');
for (const [name, L, C, H, tex, role] of PALETA) {
  const { hex, inGamut } = oklchToHex(L, C, H);
  const s = predict(hex, TEX[tex]), c = predict(hex, TEX[tex], { sun: 0 });
  console.log(pad(name, 26), pad(`${L} ${C} ${H}${inGamut ? '' : ' !gamut'}`, 20), pad(hex, 8), pad(`${s.albedoHex} L${s.albedoOKLCH.L} C${s.albedoOKLCH.C}`, 30), pad(`${s.out} L${s.outOKLCH.L} C${s.outOKLCH.C} H${s.outOKLCH.H}`, 34), `${c.out} L${c.outOKLCH.L} C${c.outOKLCH.C} H${c.outOKLCH.H}`);
}
console.log('--- emisja/płomień (MeshBasic/emissive → wprost do AgX, bez oświetlenia):');
for (const [name, hex, k] of [['flame ffc070 ×1', '#ffc070', 1], ['glassLit emissive ffb257 ×1.6', '#ffb257', 1.6], ['flame ffc070 ×2.5', '#ffc070', 2.5]]) {
  const lin = [1, 3, 5].map(i => srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255) * k);
  const o = agx(lin); const oh = '#' + o.map(v => Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
  console.log(pad(name, 30), 'ekran', oh, JSON.stringify(linToOklch(...o)));
}
