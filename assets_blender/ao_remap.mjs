// Prostowanie krzywej wypalonego AO. Cycles bake type='AO' liczy okluzję CAŁEJ półsfery nieba — a three.js liczy to samo
// z HDRI (scene.environment). Nałożenie obu daje podwójne przyciemnienie (zmierzone: średnia mapy 0,48 = 48 % światła
// otoczenia, kram wychodził czarny). Mapa ma nieść tylko CIEŃ KONTAKTOWY, więc podnosimy półtony gammą, zostawiając
// 0 (pełny styk) i 1 (pełne otwarcie) na miejscu. Użycie: node ao_remap.mjs <in.png> <out.jpg> <cel_sredniej>
import { createRequire } from 'module';
const sharp = createRequire('/home/user/projekt/tools/package.json')('sharp');
const [src, out, celStr] = process.argv.slice(2);
const cel = +(celStr || 0.75);
const img = sharp(src).grayscale();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
// Tło atlasu (texele poza wyspami UV) jest czarne i zaniża statystykę, a przy filtrowaniu dwuliniowym wylewa się na brzegi
// wysp jako czarna obwódka. Traktujemy dokładne 0 jako tło: wykluczamy ze średniej i zamieniamy na biel (brak okluzji).
let suma = 0, uzyte = 0;
for (let i = 0; i < data.length; i++) if (data[i] !== 0) { suma += data[i]; uzyte++; }
const przed = suma / uzyte / 255;
const g = Math.log(cel) / Math.log(przed);                 // in^g przenosi średnią `przed` na `cel`, zachowując 0 i 1
const lut = new Uint8Array(256); for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, g));
for (let i = 0; i < data.length; i++) data[i] = data[i] === 0 ? 255 : lut[data[i]];
suma = 0; for (let i = 0; i < data.length; i++) suma += data[i];
await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
  .resize(1024, 1024).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
console.log(`AO: srednia po uzytych texelach ${przed.toFixed(3)} -> calosc ${(suma / data.length / 255).toFixed(3)} (gamma ${g.toFixed(3)}, uzyte ${(100*uzyte/data.length).toFixed(1)} % atlasu), zapisane ${out}`);
