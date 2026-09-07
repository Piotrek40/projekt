// Udział ról w kadrze (§4.3.5, 60-30-10) na masce ról: render z ?roles=1&noaa=1 (world.js) maluje każdy mesh jednolitym kolorem roli z CONFIG.roles:
// neutralne #ff0000, wtórne #00ff00, akcent #0000ff, inne (bez wpisu) #ffffff, tło (niebo) #000000. Liczy DOKŁADNE heksy (bez AA piksele
// krawędzi są mieszane → „reszta"); udziały n/w/a/inne liczone bez tła. Kryterium: n 60 ± 8, w 30 ± 8, a 10 ± 8, inne ≤ 3 %.
// Użycie: node hist_roles.mjs <roles.png> [<roles.png>…]   (exit 1, gdy poza zakresem)
import { sharp } from './_sharp.mjs';
let bad = 0;
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cnt = { n: 0, w: 0, a: 0, inne: 0, tlo: 0, reszta: 0 };
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r === 255 && g === 0 && b === 0) cnt.n++; else if (r === 0 && g === 255 && b === 0) cnt.w++; else if (r === 0 && g === 0 && b === 255) cnt.a++;
    else if (r === 255 && g === 255 && b === 255) cnt.inne++; else if (r === 0 && g === 0 && b === 0) cnt.tlo++; else cnt.reszta++;
  }
  const N = cnt.n + cnt.w + cnt.a + cnt.inne, pc = v => (100 * v / Math.max(1, N)).toFixed(1);
  const okN = Math.abs(100 * cnt.n / N - 60) <= 8, okW = Math.abs(100 * cnt.w / N - 30) <= 8, okA = Math.abs(100 * cnt.a / N - 10) <= 8, okI = 100 * cnt.inne / N <= 3;
  const ok = okN && okW && okA && okI; if (!ok) bad++;
  console.log(`${f.split('/').pop()}: neutralne ${pc(cnt.n)}% | wtórne ${pc(cnt.w)}% | akcent ${pc(cnt.a)}% | inne ${pc(cnt.inne)}% (bez tła; tło ${(100 * cnt.tlo / (data.length / 3)).toFixed(1)}% kadru, piksele mieszane ${(100 * cnt.reszta / (data.length / 3)).toFixed(2)}%) → ${ok ? 'OK' : 'FAIL'} (60/30/10 ± 8, inne ≤ 3)`);
}
process.exit(bad ? 1 : 0);
