// Średnia jasność ZBUDOWANEJ tekstury (plik jpg/ktx2→nie, tylko jpg/png): node tex_stats_built.mjs rynek/assets/textures/<nazwa>_diff.jpg ...
import { srgbToLin, linToOklch } from './oklch.mjs';
import { sharp } from './_sharp.mjs';
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).resize(256, 256).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0; const N = info.width * info.height, ch = info.channels;
  for (let i = 0; i < N; i++) { r += srgbToLin(data[i*ch]/255); g += srgbToLin(data[i*ch+1]/255); b += srgbToLin(data[i*ch+2]/255); }
  r /= N; g /= N; b /= N;
  console.log(f.split('/').pop().padEnd(32), info.width + 'x' + info.height, 'linear avg', [r, g, b].map(v => v.toFixed(3)).join(' '), JSON.stringify(linToOklch(r, g, b)));
}
