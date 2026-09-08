// Udział pikseli wg chromy OKLCH (reguła 60-30-10): neutralne C<0.03, wtórne 0.03–0.08, akcent >0.08. Pomija HUD (górne 100 px) i niebo (H 200–280 przy L>0.7).
// Z maską ról (--mask=<render ?roles=1&noaa=1> --role=0000ff): liczy TYLKO piksele, w których maska ma dokładnie ten hex (akcent 0000ff, wtórne 00ff00,
// neutralne ff0000), bez HUD (--crop=0 = bez cięcia górnych/dolnych pasów), granica akcentu 0,05 (na masce liczy się odcienie akcentów, nie ich udział).
// Wynik koszyków odcieni co 30° (udział pikseli akcentowych); koszyk „zajęty" = ≥ 5 % akcentów; §4.3.5: ≥ 3 zajęte, w tym ≥ 1 w 150–360°.
// Użycie: node hist_chroma.mjs <png> [<png>…] [--mask=roles.png --role=0000ff] [--crop=0] [--step=2]
import { srgbToLin, linToOklch } from './oklch.mjs';
import { sharp } from './_sharp.mjs';
const argv = process.argv.slice(2), files = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.slice(2), true]; }));
const crop = args.crop !== undefined ? +args.crop : (args.mask ? 0 : 1), step = +(args.step || 2);
const roleHex = (args.role || '0000ff').replace('#', '').toLowerCase();
const mask = args.mask ? await sharp(args.mask).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
const accMin = mask ? 0.05 : 0.08;
for (const f of files) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  if (mask && (mask.info.width !== info.width || mask.info.height !== info.height)) { console.error('maska ma inny rozmiar niż obraz', mask.info, info); process.exit(1); }
  let n = 0, neu = 0, sec = 0, acc = 0, sky = 0; const hues = new Array(12).fill(0);
  const y0 = crop ? 100 : 0, y1 = crop ? info.height - 120 : info.height;
  for (let y = y0; y < y1; y += step) for (let x = 0; x < info.width; x += step) { const o = (y * info.width + x) * info.channels;
    if (mask) { const m = (y * info.width + x) * 3, hex = [mask.data[m], mask.data[m + 1], mask.data[m + 2]].map(v => v.toString(16).padStart(2, '0')).join(''); if (hex !== roleHex) continue; }
    const { L, C, H } = linToOklch(srgbToLin(data[o] / 255), srgbToLin(data[o+1] / 255), srgbToLin(data[o+2] / 255));
    if (!mask && L > 0.7 && H > 200 && H < 280 && C < 0.06) { sky++; continue; }
    n++; if (C < 0.03) neu++; else if (C < accMin) sec++; else { acc++; hues[Math.floor(H / 30) % 12]++; } }
  const share = hues.map(v => 100 * v / Math.max(1, acc)), busy = share.map((v, i) => v >= 5 ? i : -1).filter(i => i >= 0);
  console.log(f.split('/').pop(), mask ? `maska ${roleHex}: ${n} px (co ${step}.)` : 'bez nieba:', `neutralne ${(100*neu/Math.max(1,n)).toFixed(0)}% | wtórne ${(100*sec/Math.max(1,n)).toFixed(0)}% | akcent (C ≥ ${accMin}) ${(100*acc/Math.max(1,n)).toFixed(0)}%` + (mask ? '' : ` | (niebo ${(100*sky/(n+sky)).toFixed(0)}% kadru)`), 'odcienie akcentów co 30°:', share.map((v, i) => `${i*30}:${v.toFixed(0)}`).join(' '));
  if (mask) console.log(`  koszyki zajęte (≥ 5 % akcentów): ${busy.length} [${busy.map(i => i * 30 + '°').join(', ')}], w 150–360°: ${busy.filter(i => i >= 5).length} → ${busy.length >= 3 && busy.some(i => i >= 5) ? 'OK' : 'FAIL'} (§4.3.5: ≥ 3, ≥ 1 w 150–360°)`);
}
