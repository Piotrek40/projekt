// OKLCH <-> sRGB dla skryptów pomiarowych — jedna implementacja w rynek/src/color.js (ta sama, której używa scena);
// tu tylko adapter: skrypty badawcze (agx_predict, palette_predict, measure_render…) oczekują hex jako łańcucha '#rrggbb'.
import { oklchToHex as toHexNum } from '../../../rynek/src/color.js';
export { srgbToLin, linToSrgb, linToOklab, oklabToLin, linToOklch, hexToOklch } from '../../../rynek/src/color.js';
export function oklchToHex(L, C, H) { const r = toHexNum(L, C, H); return { hex: r.hexStr, linear: r.linear, inGamut: r.inGamut }; }
