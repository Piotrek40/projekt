// Materiały rynku: zestawy PBR z Poly Haven + materiały proceduralne (szkło, woda, chorągwie, szyld, dym).
import * as THREE from 'three';

export async function buildMaterials(W) {
  const { ctx, loaders, P, T } = W;
  const sets = {};
  await Promise.all(Object.entries(T).map(async ([k, v]) => { sets[k] = await ctx.loadPbrSet(v.name, { metersPerTile: v.mpt }); }));
  const mat = {};
  mat.cobble = sets.cobble.material({ color: 0xb9b3aa });
  mat.stone = sets.stone.material({ color: P.stone });
  mat.blocks = sets.blocks.material();
  mat.slates = sets.slates.material({ color: 0xb8b4ae });
  mat.timber = sets.timber.material({ color: P.timber });
  mat.planks = sets.planks.material();
  mat.door = sets.planks.material({ color: 0x6b4a33 });
  P.plaster.forEach((c, i) => { mat['plaster' + i] = sets.plaster.material({ color: c }); });
  P.roof.forEach((c, i) => { mat['roof' + i] = sets.roof.material({ color: c }); });
  mat.roofTower = sets.roof.material({ color: 0x4a4d56 });
  const fabricNor = await loaders.loadTexture('fabric_pattern_07', 'nor'), fabricArm = await loaders.loadTexture('fabric_pattern_07', 'arm');
  for (const t of [fabricNor, fabricArm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = ctx.aniso(); }
  P.cloth.forEach((c, i) => { mat['cloth' + i] = new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, normalMap: fabricNor, roughnessMap: fabricArm, side: THREE.DoubleSide }); });
  mat.glass = new THREE.MeshPhysicalMaterial({ color: 0x1a222c, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.5 });
  mat.glassLit = new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffb257, emissiveIntensity: 1.6, roughness: 0.3 });
  mat.iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.55, metalness: 0.9 });
  mat.water = new THREE.MeshPhysicalMaterial({ color: P.water, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.85, envMapIntensity: 1.8, normalMap: sets.cobble.normalMap.clone(), normalScale: new THREE.Vector2(0.25, 0.25) });
  mat.water.normalMap.repeat.set(3, 3); mat.water.normalMap.needsUpdate = true;
  mat.flame = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const bannerMats = P.cloth.map((c, i) => new THREE.MeshStandardMaterial({ map: heraldry(c, P.cloth[(i + 2) % P.cloth.length], i), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 }));
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
  W.sway = sway; // (§8 #8) kołysanie na wietrze dla innych modułów (girlandy): W.sway(material, amplituda, byUv); wywołujący sprawdza ctx.flags.nosway
}

export function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Chorągiew heraldyczna: pole w kolorze, pas i prosty emblemat; generowana na canvasie, żeby nie wozić bitmap.
export function heraldry(field, charge, variant) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  const hex = v => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hex(field); g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#d9b34a';
  if (variant % 3 === 0) { g.fillRect(0, 220, 256, 70); }
  else if (variant % 3 === 1) { g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 512); g.lineTo(256, 440); g.lineTo(60, 0); g.fill(); }
  else { g.beginPath(); g.arc(128, 256, 80, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(charge); g.beginPath(); g.arc(128, 256, 55, 0, Math.PI * 2); g.fill(); }
  // zębaty dół
  g.fillStyle = 'rgba(0,0,0,0)'; g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 512); g.lineTo(x + 32, 470); g.lineTo(x + 64, 512); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#3a2718'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#5a4030'; g.fillRect(12, 12, 488, 296);
  g.strokeStyle = '#d9b34a'; g.lineWidth = 6; g.strokeRect(24, 24, 464, 272);
  g.fillStyle = '#d9b34a'; g.font = 'bold 62px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = text.split(' ');
  g.fillText(words.slice(0, 2).join(' '), 256, 120); g.fillText(words.slice(2).join(' '), 256, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
