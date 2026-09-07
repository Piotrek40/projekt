// Test referencyjny rynek/src/color.js (OKLCH ↔ sRGB) — wartości z oklch.com, tolerancja ±0.005 (L, C) / ±0.5° (H). Exit 1 przy FAIL.
// Uruchom: node audyt/testy/tools/color_test.mjs
import { hexToOklch, oklchToHex, oklch } from '../../../rynek/src/color.js';
const REF = [['#ffffff', 1.000, 0.000, null], ['#ff0000', 0.628, 0.258, 29.2], ['#0000ff', 0.452, 0.313, 264.1]];
let fails = 0;
for (const [hex, L, C, H] of REF) {
  const o = hexToOklch(hex);
  const ok = Math.abs(o.L - L) <= 0.005 && Math.abs(o.C - C) <= 0.005 && (H === null || Math.abs(o.H - H) <= 0.5);
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${hex} → L ${o.L} C ${o.C} H ${o.H}  (ref L ${L} C ${C} H ${H ?? '—'})`);
}
// w drugą stronę (kolor.md §3.2) + tożsamość hex → oklch → hex
for (const [lch, exp] of [[[0.89, 0.035, 85], '#e5dac1'], [[0.55, 0.12, 25], '#ad524d'], [[0.45, 0.13, 340], '#82326c']]) {
  const r = oklchToHex(...lch); const ok = r.hexStr === exp && r.inGamut; if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${lch}] → ${r.hexStr} inGamut=${r.inGamut} (oczekiwane ${exp})`);
}
{ const g = oklchToHex(0.60, 0.11, 190); const ok = !g.inGamut; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} [0.6,0.11,190] poza gamutem → inGamut=${g.inGamut} (oczekiwane false)`); }
{ const n = oklch(0.89, 0.035, 85); const ok = n === 0xe5dac1; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} oklch() zwraca liczbę 0x${n.toString(16)} (oczekiwane 0xe5dac1)`); }
console.log(fails ? `FAIL (${fails})` : 'OK'); process.exit(fails ? 1 : 0);
