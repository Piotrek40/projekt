// Predyktor koloru w potoku three 0.185 (MeshStandardMaterial, AgXToneMapping, outputColorSpace sRGB).
// Replika shadera: tonemapping_pars_fragment.glsl.js (AgX), common.glsl.js (BRDF_Lambert = albedo/π),
// lights_physical_pars_fragment (irradiance = dotNL * kolor*intensywność), envmap_physical_pars_fragment (π * env * envMapIntensity).
import { srgbToLin, linToSrgb, linToOklch, hexToOklch } from './oklch.mjs';
const mulM = (M, v) => [0, 1, 2].map(i => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]); // GLSL mat3 = kolumny
const SRGB_TO_2020 = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]];
const R2020_TO_SRGB = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
const INSET = [[0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]];
const OUTSET = [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]];
const sig = x => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
export function agx(rgb, exposure = 1.15) {
  let c = rgb.map(v => v * exposure);
  c = mulM(INSET, mulM(SRGB_TO_2020, c));
  c = c.map(v => Math.max(v, 1e-10)).map(v => (Math.log2(v) + 12.47393) / (4.026069 + 12.47393)).map(v => Math.min(1, Math.max(0, v)));
  c = c.map(sig);
  c = mulM(OUTSET, c).map(v => Math.max(0, v) ** 2.2);
  return mulM(R2020_TO_SRGB, c).map(v => Math.min(1, Math.max(0, v)));
}
// Oświetlenie sceny rynek: słońce 5.0 × 0xffd6a6, env 0.6 × średnia HDRI (policzona z sky_1k.hdr przez hdr_stats.mjs).
let SUN = [0xff, 0xd6, 0xa6].map(v => srgbToLin(v / 255) * 5.0), ENV_K = 1;
// nadpisanie na czas skryptu (jak ?sun=&env= w world.js): kolor słońca (hex '#rrggbb', intensywność 5,0) i mnożnik environmentIntensity względem 0,6
export function setSun(hex, intensity = 5.0) { SUN = [1, 3, 5].map(i => srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255) * intensity); }
export function setEnv(envIntensity) { ENV_K = envIntensity / 0.6; }
export const ENV_SPHERE = [0.631, 0.726, 0.884].map(v => v * 0.6);   // ściany (przybliżenie: PMREM przy roughness 1 ≈ średnia otoczenia)
export const ENV_UP = [0.814, 0.952, 1.178].map(v => v * 0.6);       // podłoga (normalna w górę)
// Mnożniki tekstur diff (średnia liniowa 2k, tex_stats.mjs 2026-09-07) i średnie AO z kanału R mapy arm (tex_ao_weighted.mjs) — klucze = CONFIG.textures.
// AO ciemni TYLKO światło otoczenia (aomap_fragment), nie słońce. Zmierzone: planks 0,85, stone 0,85, blocks 0,67 (§4.4 zakładał 0,9 — liczba wygrywa).
export const TEX = { plaster: [0.436, 0.392, 0.335], roof: [0.254, 0.185, 0.129], stone: [0.251, 0.180, 0.111], cobble: [0.279, 0.228, 0.149], timber: [0.123, 0.091, 0.064], planks: [0.081, 0.058, 0.044], blocks: [0.375, 0.242, 0.135], slates: [0.275, 0.227, 0.150], tiles: [0.198, 0.196, 0.171], none: [1, 1, 1] };
export const AO = { plaster: 0.96, roof: 0.50, stone: 0.85, cobble: 0.70, timber: 0.85, planks: 0.85, blocks: 0.67, slates: 0.45, tiles: 0.93, none: 1 };
// radiancja wyjściowa Lamberta: albedo/π * (dotNL*sun) + albedo/π * (π*env*ao) = albedo * (sun*dotNL/π + env*ao); env: 'wall' (sfera/ściana) | 'up' (podłoga) | [r,g,b]
export const radiance = (albedo, { sun = 1, env = ENV_SPHERE, ao = 1 } = {}) => { const e = env === 'up' ? ENV_UP : env === 'wall' ? ENV_SPHERE : env; return albedo.map((a, i) => a * (SUN[i] * sun / Math.PI + e[i] * ENV_K * ao)); };
const toHex = lin => '#' + lin.map(v => Math.round(linToSrgb(v) * 255).toString(16).padStart(2, '0')).join('');
export function predict(hexTint, texLinear = [1, 1, 1], opts = {}) {
  const tint = [parseInt(hexTint.slice(1, 3), 16), parseInt(hexTint.slice(3, 5), 16), parseInt(hexTint.slice(5, 7), 16)].map(v => srgbToLin(v / 255));
  const albedo = tint.map((v, i) => v * texLinear[i]);
  const out = agx(radiance(albedo, opts));
  return { albedoHex: toHex(albedo), albedoOKLCH: linToOklch(...albedo), albedoLin: albedo, out: toHex(out), outLin: out, outOKLCH: linToOklch(...out) };
}
if (process.argv[1]?.endsWith('agx_predict.mjs')) {
  const row = (label, hex, tex, o) => { const p = predict(hex, tex, o); console.log(label.padEnd(30), 'tint', hex, 'albedo', p.albedoHex, JSON.stringify(p.albedoOKLCH), '→ ekran', p.out, JSON.stringify(p.outOKLCH)); };
  console.log('== słońce (dotNL=1) + niebo, exposure 1.15 ==');
  row('plaster0 e3d3b2 × plastered_wall', '#e3d3b2', TEX.plaster);
  row('plaster0 w cieniu', '#e3d3b2', TEX.plaster, { sun: 0 });
  row('roof0 b8734f × roof_09', '#b8734f', TEX.roof);
  row('roof0 w cieniu', '#b8734f', TEX.roof, { sun: 0 });
  row('roofTower 4a4d56 × roof_09', '#4a4d56', TEX.roof);
  row('stone cfc6b8 × rustic_stone', '#cfc6b8', TEX.stone);
  row('cobble b9b3aa × cobble (góra)', '#b9b3aa', TEX.cobble, { env: ENV_UP });
  row('cobble w cieniu (góra)', '#b9b3aa', TEX.cobble, { env: ENV_UP, sun: 0 });
  row('timber 5a4030 × old_planks', '#5a4030', TEX.timber);
  row('cloth0 8c1f28 (bez map)', '#8c1f28', TEX.none);
  row('cloth0 w cieniu', '#8c1f28', TEX.none, { sun: 0 });
  row('cloth1 1f4d3a', '#1f4d3a', TEX.none);
  row('cloth3 2b3a6b', '#2b3a6b', TEX.none);
  console.log('== test desaturacji AgX: czyste nasycone albedo w słońcu ==');
  row('czysta czerwień ff0000', '#ff0000', TEX.none);
  row('czysta zieleń 00ff00', '#00ff00', TEX.none);
  row('purpura 82326c', '#82326c', TEX.none);
  row('turkus 2a8a86', '#2a8a86', TEX.none);
  row('biel 0.9 (e6e6e6)', '#e6e6e6', TEX.none);
  console.log('== krzywa L: albedo szare → L na ekranie (słońce / cień) ==');
  for (const a of [0.04, 0.1, 0.18, 0.3, 0.5, 0.7, 0.9]) { const s = agx(radiance([a, a, a])), c = agx(radiance([a, a, a], { sun: 0 })); console.log(`albedo lin ${a}`.padEnd(18), 'słońce L', linToOklch(...s).L.toFixed(3), 'C', linToOklch(...s).C.toFixed(3), '| cień L', linToOklch(...c).L.toFixed(3), 'C', linToOklch(...c).C.toFixed(3)); }
}
