// Irradiancja otoczenia z HDRI dla zadanej normalnej: E(n) = (1/π) ∫ L(ω) max(0, n·ω) dω (to, co PMREM daje materiałowi o roughness 1 —
// łącznie z tarczą słońca zapisaną w HDRI, więc normalna ku słońcu dostaje z samego `environment` więcej niż średnia sfery: na sky_1k.hdr
// E(sunDir) ≈ 2× E(−sunDir); dlatego cel plamy lineupu liczy się z jej normalnej, nie ze stałej ENV_SPHERE). Konwencja pikseli jak sky.js/sundir.mjs
// (equirect three, flipY), obrót CONFIG.sky.rotation wokół y; wynik BEZ environmentIntensity (mnoży agx_predict przez 0,6·ENV_K).
// Użycie: import { irradiance } …; irradiance([0,1,0]) → [r,g,b] liniowe; node hdr_env.mjs → tabela dla góry/sfery/ścian/słońca (kalibracja: 'up' vs ENV_UP).
import fs from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const local = resolve(here, '../../../rynek/assets/hdri/sky_1k.hdr');
export const HDR_FILE = existsSync(local) ? local : '/home/user/projekt/rynek/assets/hdri/sky_1k.hdr';
export const ROTATION = -0.25;   // CONFIG.sky.rotation (config.js) — po zmianie przeliczyć
function readRGBE(file) { // Radiance RGBE, nowe RLE (jak lineup_rects.mjs)
  const buf = fs.readFileSync(file); let pos = 0;
  while (true) { const e = buf.indexOf(10, pos); const s = buf.toString('latin1', pos, e); pos = e + 1; if (s === '') break; }
  const e = buf.indexOf(10, pos); const m = buf.toString('latin1', pos, e).match(/-Y (\d+) \+X (\d+)/); pos = e + 1;
  const H = +m[1], W = +m[2], px = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    if (buf[pos] !== 2 || buf[pos + 1] !== 2) throw new Error('stare RLE');
    pos += 4; const row = new Uint8Array(W * 4);
    for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let cnt = buf[pos++]; if (cnt > 128) { cnt -= 128; const v = buf[pos++]; for (let i = 0; i < cnt; i++) row[c * W + x++] = v; } else { for (let i = 0; i < cnt; i++) row[c * W + x++] = buf[pos++]; } } }
    for (let x = 0; x < W; x++) { const ex = row[3 * W + x]; const f = ex ? 2 ** (ex - 136) : 0; const o = (y * W + x) * 3; px[o] = row[x] * f; px[o + 1] = row[W + x] * f; px[o + 2] = row[2 * W + x] * f; }
  }
  return { px, W, H };
}
let cache = null;
function texels(file = HDR_FILE, rotation = ROTATION) { // kierunek i waga (dω) każdego piksela, raz
  if (cache) return cache;
  const { px, W, H } = readRGBE(file), n = W * H, dir = new Float32Array(n * 3), dw = new Float32Array(n);
  const c = Math.cos(rotation), s = Math.sin(rotation);
  for (let y = 0; y < H; y++) { const v = 1 - (y + 0.5) / H, theta = (v - 0.5) * Math.PI, ct = Math.cos(theta), st = Math.sin(theta), w = (2 * Math.PI / W) * (Math.PI / H) * ct;
    for (let x = 0; x < W; x++) { const u = (x + 0.5) / W, phi = (u - 0.5) * 2 * Math.PI; let dx = ct * Math.cos(phi), dz = ct * Math.sin(phi); const rx = c * dx + s * dz, rz = -s * dx + c * dz; const i = y * W + x; dir[i * 3] = rx; dir[i * 3 + 1] = st; dir[i * 3 + 2] = rz; dw[i] = w; } }
  return cache = { px, dir, dw, n };
}
export function irradiance(nrm) {
  const { px, dir, dw, n } = texels(); const l = Math.hypot(...nrm), nx = nrm[0] / l, ny = nrm[1] / l, nz = nrm[2] / l; let r = 0, g = 0, b = 0;
  for (let i = 0; i < n; i++) { const d = nx * dir[i * 3] + ny * dir[i * 3 + 1] + nz * dir[i * 3 + 2]; if (d <= 0) continue; const w = d * dw[i]; r += px[i * 3] * w; g += px[i * 3 + 1] * w; b += px[i * 3 + 2] * w; }
  return [r / Math.PI, g / Math.PI, b / Math.PI];
}
if (process.argv[1]?.endsWith('hdr_env.mjs')) {
  const f = v => v.map(x => +x.toFixed(3)).join(' ');
  const sun = [0.498, 0.5, 0.709];
  for (const [name, nrm] of [['góra (0,1,0) — ENV_UP/0.6 = 0.814 0.952 1.178', [0, 1, 0]], ['ściana +z (fasada N)', [0, 0, 1]], ['ściana +x (fasada W)', [1, 0, 0]], ['ściana −z (fasada S)', [0, 0, -1]], ['ściana −x (fasada E)', [-1, 0, 0]], ['ku słońcu (sunDir)', sun], ['od słońca (−sunDir)', sun.map(v => -v)], ['dół (0,−1,0)', [0, -1, 0]]]) console.log(name.padEnd(48), f(irradiance(nrm)));
}
