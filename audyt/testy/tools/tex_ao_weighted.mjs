// Średnia Diffuse ważona AO (kanał R z arm): przybliża kolor "wierzchu" tekstury, który dominuje w świetle.
import { srgbToLin, linToOklch } from './oklch.mjs';
import { sharp, ASSETS_SRC } from './_sharp.mjs';
const base = `${ASSETS_SRC}/textures`; // tekstury źródłowe 2k; użycie: node tex_ao_weighted.mjs plastered_wall ...
for (const n of process.argv.slice(2)) {
  const d = await sharp(`${base}/${n}/${n}_Diffuse_2k.jpg`).resize(512, 512).raw().toBuffer({ resolveWithObject: true });
  const a = await sharp(`${base}/${n}/${n}_arm_2k.jpg`).resize(512, 512).raw().toBuffer({ resolveWithObject: true });
  const N = 512 * 512; let s = [0, 0, 0], w = 0, sTop = [0, 0, 0], nTop = 0, aoAvg = 0, roughAvg = 0;
  for (let i = 0; i < N; i++) { const ao = a.data[i * a.info.channels] / 255, rough = a.data[i * a.info.channels + 1] / 255; aoAvg += ao; roughAvg += rough;
    const rgb = [0, 1, 2].map(c => srgbToLin(d.data[i * d.info.channels + c] / 255));
    const wt = ao ** 4; rgb.forEach((v, c) => s[c] += v * wt); w += wt;
    if (ao > 0.9) { rgb.forEach((v, c) => sTop[c] += v); nTop++; } }
  const avgW = s.map(v => v / w), avgTop = sTop.map(v => v / nTop);
  console.log(n.padEnd(22), 'AO śr', (aoAvg / N).toFixed(2), 'rough śr', (roughAvg / N).toFixed(2), '| ważona AO^4', avgW.map(v => v.toFixed(3)).join(' '), JSON.stringify(linToOklch(...avgW)), '| tylko AO>0.9 (', (100 * nTop / N).toFixed(0) + '% px)', JSON.stringify(linToOklch(...avgTop)));
}
