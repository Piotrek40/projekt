// Kolor: OKLCH ↔ sRGB (Björn Ottosson, oklab 2020; macierze z https://bottosson.github.io/posts/oklab/). Bez zależności od three.
// Paleta w CONFIG ma być zapisana jako [L, C, H] (L 0–1, C 0–~0.37, H w stopniach), a hex liczony przez oklch(L, C, H) — hex to
// kolor POSTRZEGANY (three: setHex = sRGB → linear). Wynik poza gamutem sRGB jest obcinany; inGamut mówi, czy obcięto (taki kolor
// nie wchodzi do CONFIG — obniż C). Test referencyjny: audyt/testy/tools/color_test.mjs (#ffffff L 1.000; #ff0000 L .628 C .258 H 29.2; #0000ff L .452 C .313 H 264.1).
export const srgbToLin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
export const linToSrgb = c => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
export function linToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
          1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
          0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_];
}
export function oklabToLin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [ 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
// linear RGB → {L, C, H}
export function linToOklch(r, g, b) {
  const [L, a, bb] = linToOklab(r, g, b);
  const C = Math.hypot(a, bb); let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
  return { L: +L.toFixed(3), C: +C.toFixed(3), H: +H.toFixed(1) };
}
// hex (liczba 0xrrggbb albo '#rrggbb') → {L, C, H}
export function hexToOklch(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => srgbToLin(v / 255));
  return linToOklch(r, g, b);
}
// OKLCH → {hex: liczba (do `color:` w materiale), hexStr: '#rrggbb', linear: [r,g,b], inGamut}
export function oklchToHex(L, C, H) {
  const h = H * Math.PI / 180;
  const rgb = oklabToLin(L, C * Math.cos(h), C * Math.sin(h));
  const clip = v => Math.min(1, Math.max(0, v));
  const bytes = rgb.map(v => Math.round(linToSrgb(clip(v)) * 255));
  const inGamut = rgb.every(v => v >= -0.002 && v <= 1.002);
  const hex = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return { hex, hexStr: '#' + bytes.map(v => v.toString(16).padStart(2, '0')).join(''), linear: rgb.map(v => +v.toFixed(4)), inGamut };
}
// użycie w materials.js: sets.plaster.material({ color: oklch(...P.plaster[i]) })
export const oklch = (L, C, H) => oklchToHex(L, C, H).hex;
