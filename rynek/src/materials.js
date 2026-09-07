// Materiały rynku: zestawy PBR z Poly Haven + materiały proceduralne (szkło, woda, chorągwie, szyld, dym).
// Kolory: motyw #9 — każdy tint z CONFIG.paletteOKLCH.tint[klucz] = [L, C, H, zestaw] przez oklch() (hex tylko w config.js); ?nopalette=1 = stare heksy
// z CONFIG.palette. Kolejność kluczy W.mat = lineup.js MAT_KEYS (lineup, lineup_rects). Nowe klucze: paint0..2 (okiennice) na sets.timber (old_planks_02),
// roof2 i roofTower na sets.tiles (stone_tiles_02). W.hex(klucz) daje hex bieżącej palety (props.js: światło latarni, dym; tower.js: nic — roofTower stąd).
import * as THREE from 'three';
import { oklch } from './color.js';

export async function buildMaterials(W) {
  const { ctx, loaders, P, T, CONFIG } = W;
  const PK = ctx.flags.nopalette ? null : CONFIG.paletteOKLCH;
  const sets = {};
  await Promise.all(Object.entries(T).map(async ([k, v]) => { sets[k] = await ctx.loadPbrSet(v.name, { metersPerTile: v.mpt }); }));
  const mat = {};
  // hex tintu klucza: paleta OKLCH albo (?nopalette=1) stary hex z CONFIG.palette (tablice plaster/roof/cloth po indeksie)
  const hexOf = k => { if (PK) return oklch(...PK.tint[k]); const m = k.match(/^(plaster|roof|cloth)(\d)$/); return m ? P[m[1]][+m[2]] : P[k]; };
  const setOf = k => PK ? PK.tint[k][3] : ({ cobble: 'cobble', stone: 'stone', blocks: 'blocks', slates: 'slates', timber: 'timber', planks: 'planks', door: 'planks', roof2: 'roof', roofTower: 'slates' }[k] ?? k.replace(/\d$/, ''));
  const pbr = (k, params) => sets[setOf(k)].material({ color: hexOf(k), params });
  for (const k of ['cobble', 'stone', 'blocks', 'slates', 'timber', 'planks', 'door']) mat[k] = pbr(k);
  P.plaster.forEach((c, i) => { mat['plaster' + i] = pbr('plaster' + i); });
  P.roof.forEach((c, i) => { mat['roof' + i] = pbr('roof' + i); });
  mat.roofTower = PK ? pbr('roofTower', PK.params.roofTower) : sets.slates.material({ color: oklch(...P.roofTowerOKLCH), params: CONFIG.paletteOKLCH.params.roofTower }); // ?nopalette=1: stan po motywie #2 (tower.js)
  if (PK) for (let i = 0; i < 3; i++) mat['paint' + i] = pbr('paint' + i);   // drewno malowane (okiennice) — tylko z paletą (bez niej okiennic nie ma: ?nopalette wyłącza też ?noshutters-owy klucz)
  const fabricNor = await loaders.loadTexture('fabric_pattern_07', 'nor'), fabricArm = await loaders.loadTexture('fabric_pattern_07', 'arm');
  for (const t of [fabricNor, fabricArm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = ctx.aniso(); }
  const clothHex = P.cloth.map((c, i) => hexOf('cloth' + i));
  clothHex.forEach((c, i) => { mat['cloth' + i] = new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, normalMap: fabricNor, roughnessMap: fabricArm, side: THREE.DoubleSide }); });
  mat.glass = new THREE.MeshPhysicalMaterial({ color: hexOf('glass'), roughness: 0.08, metalness: 0.0, envMapIntensity: 1.5 }); // parametry jak HEAD (envMapIntensity martwy — §4.1.9, dług #8)
  const em = PK ? { color: oklch(...PK.emit.glassLit.color), emissive: oklch(...PK.emit.glassLit.emissive), k: PK.emit.glassLit.intensity } : { color: P.glassLit, emissive: P.glassLitEmissive, k: 1.6 }; // 1.6: HEAD emissiveIntensity
  mat.glassLit = new THREE.MeshStandardMaterial({ color: em.color, emissive: em.emissive, emissiveIntensity: em.k, roughness: 0.3 }); // roughness jak HEAD
  mat.iron = new THREE.MeshStandardMaterial({ color: hexOf('iron'), roughness: 0.55, metalness: 0.9 }); // parametry jak HEAD
  mat.water = new THREE.MeshPhysicalMaterial({ color: hexOf('water'), roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.85, envMapIntensity: 1.8, normalMap: sets.cobble.normalMap.clone(), normalScale: new THREE.Vector2(0.25, 0.25) }); // parametry jak HEAD (envMapIntensity martwy — §4.1.9)
  mat.water.normalMap.repeat.set(3, 3); mat.water.normalMap.needsUpdate = true;
  // płomień: MeshBasic bez świateł — kolor × intensywność idzie wprost do AgX (§4.1.6); PK: [0.72, 0.185, 49] × 1,6 → ekran ≈ #e9a878; stara paleta: #ffc070 × 1
  mat.flame = new THREE.MeshBasicMaterial({ color: PK ? new THREE.Color(oklch(...PK.emit.flame.color)).multiplyScalar(PK.emit.flame.intensity) : new THREE.Color(P.flame) });
  const gold = PK ? oklch(...PK.canvas.gold) : P.gold;
  const bannerMats = clothHex.map((c, i) => new THREE.MeshStandardMaterial({ map: heraldry(c, clothHex[(i + 2) % clothHex.length], i, gold), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 })); // jak HEAD
  bannerMats.forEach((m, i) => { mat['banner' + i] = m; });
  const windUniform = { value: 0 };
  const sway = (m, amp, byUv) => { m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n float swayK = ${byUv ? '(1.0 - clamp(uv.y, 0.0, 1.0))' : '1.0'};\n transformed.x += sin(uWind * 2.1 + position.y * 2.0 + position.z * 0.7) * ${amp} * swayK;\n transformed.z += cos(uWind * 1.7 + position.x * 1.3) * ${amp * 0.5} * swayK;`);
  }; };
  if (!ctx.flags.nosway) bannerMats.forEach(m => sway(m, 0.08, true));
  ctx.updaters.push((dt, t) => { windUniform.value = t; });
  W.sets = sets; W.mat = mat; W.bannerMats = bannerMats; W.windUniform = windUniform;
  // heksy poza W.mat dla innych modułów (props.js: PointLight latarni, dym; buildBanners: szyld) — z bieżącej palety
  W.hex = { lanternLight: PK ? oklch(...PK.lanternLight) : P.lanternLight, smoke: PK ? oklch(...PK.smoke) : P.smoke, gold, signBg: PK ? oklch(...PK.canvas.signBg) : P.signBg, signBoard: PK ? oklch(...PK.canvas.signBoard) : P.signBoard };
}

export function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const hexStr = v => '#' + v.toString(16).padStart(6, '0');   // liczba 0xrrggbb → '#rrggbb' (canvas)
// Chorągiew heraldyczna: pole w kolorze, pas i prosty emblemat (gold); generowana na canvasie, żeby nie wozić bitmap.
export function heraldry(field, charge, variant, gold) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  const hex = hexStr;
  g.fillStyle = hex(field); g.fillRect(0, 0, 256, 512);
  g.fillStyle = hex(gold);
  if (variant % 3 === 0) { g.fillRect(0, 220, 256, 70); }
  else if (variant % 3 === 1) { g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 512); g.lineTo(256, 440); g.lineTo(60, 0); g.fill(); }
  else { g.beginPath(); g.arc(128, 256, 80, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(charge); g.beginPath(); g.arc(128, 256, 55, 0, Math.PI * 2); g.fill(); }
  // zębaty dół
  g.fillStyle = 'rgba(0,0,0,0)'; g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 512); g.lineTo(x + 32, 470); g.lineTo(x + 64, 512); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Szyld: tło, deska, złota ramka i napis; kolory z W.hex (signBg, signBoard, gold)
export function signTexture(text, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = hexStr(col.signBg); g.fillRect(0, 0, 512, 320);
  g.fillStyle = hexStr(col.signBoard); g.fillRect(12, 12, 488, 296);
  g.strokeStyle = hexStr(col.gold); g.lineWidth = 6; g.strokeRect(24, 24, 464, 272);
  g.fillStyle = hexStr(col.gold); g.font = 'bold 62px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = text.split(' ');
  g.fillText(words.slice(0, 2).join(' '), 256, 120); g.fillText(words.slice(2).join(' '), 256, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
