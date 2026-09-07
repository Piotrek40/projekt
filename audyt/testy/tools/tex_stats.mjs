// Średnia jasność tekstur Diffuse (sRGB -> linear -> OKLCH) przez sharp. Użycie: node tex_stats.mjs plastered_wall roof_09 ...
import { sharp, ASSETS_SRC } from './_sharp.mjs';
import { srgbToLin, linToOklch } from './oklch.mjs';
const base = `${ASSETS_SRC}/textures`; // tekstury źródłowe 2k (audyt/assets_src, względnie od repo)
const names = process.argv.slice(2);
for (const n of names) {
  const f = `${base}/${n}/${n}_Diffuse_2k.jpg`;
  const { data, info } = await sharp(f).resize(256, 256, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, rs = 0, gs = 0, bs = 0; const N = info.width * info.height;
  for (let i = 0; i < N; i++) { const R = data[i*3]/255, G = data[i*3+1]/255, B = data[i*3+2]/255; rs += R; gs += G; bs += B; r += srgbToLin(R); g += srgbToLin(G); b += srgbToLin(B); }
  r /= N; g /= N; b /= N; rs /= N; gs /= N; bs /= N;
  const hex = '#' + [rs, gs, bs].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  console.log(n.padEnd(22), 'sRGB avg', hex, 'linear avg', [r, g, b].map(v => v.toFixed(3)).join(' '), 'OKLCH', JSON.stringify(linToOklch(r, g, b)));
}
