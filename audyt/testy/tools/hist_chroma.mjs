// Udział pikseli wg chromy OKLCH (reguła 60-30-10): neutralne C<0.03, wtórne 0.03–0.08, akcent >0.08. Pomija HUD (górne 100 px) i niebo (H 200–280 przy L>0.7).
import { srgbToLin, linToOklch } from './oklch.mjs';
import { sharp } from './_sharp.mjs';
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  let n = 0, neu = 0, sec = 0, acc = 0, sky = 0; const hues = new Array(12).fill(0);
  for (let y = 100; y < info.height - 120; y += 2) for (let x = 0; x < info.width; x += 2) { const o = (y * info.width + x) * info.channels;
    const { L, C, H } = linToOklch(srgbToLin(data[o] / 255), srgbToLin(data[o+1] / 255), srgbToLin(data[o+2] / 255));
    if (L > 0.7 && H > 200 && H < 280 && C < 0.06) { sky++; continue; }
    n++; if (C < 0.03) neu++; else if (C < 0.08) sec++; else { acc++; hues[Math.floor(H / 30)]++; } }
  console.log(f.split('/').pop(), `bez nieba: neutralne ${(100*neu/n).toFixed(0)}% | wtórne ${(100*sec/n).toFixed(0)}% | akcent ${(100*acc/n).toFixed(0)}% | (niebo ${(100*sky/(n+sky)).toFixed(0)}% kadru)`, 'odcienie akcentów co 30°:', hues.map((v, i) => `${i*30}:${(100*v/Math.max(1,acc)).toFixed(0)}`).join(' '));
}
