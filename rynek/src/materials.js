// Materiały rynku: zestawy PBR z Poly Haven + materiały proceduralne (szkło, woda, chorągwie, szyld, dym).
import * as THREE from 'three';
import { rng } from '../../engine/src/geometry.js';
import { oklch } from './color.js';

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
  mat.glass = new THREE.MeshPhysicalMaterial({ color: 0x1a222c, roughness: 0.08, metalness: 0.0 }); // bez envMapIntensity: martwy przy scene.environment bez własnego envMap (§4.1.9, §8 #16)
  mat.glassLit = new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffb257, emissiveIntensity: 1.6, roughness: 0.3 });
  mat.iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.55, metalness: 0.9 });
  // --- fontanna (fountain.js, motyw #8) ---
  // Woda z WŁASNYM envMap: scene.environment to equirect HDR, renderer robi z niego PMREM (environments.get(material.envMap || environment), WebGLRenderer.js:2177);
  // bez własnego envMap envMapIntensity jest nadpisywany przez scene.environmentIntensity 0.6 (:2694, §4.1.9). Obrót: przy własnym envMap liczy się material.envMapRotation (:2178).
  const Fo = W.CONFIG.fountain, env = ctx.scene.environment || null;
  mat.water = new THREE.MeshPhysicalMaterial({ color: P.water, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.85, envMap: env, envMapIntensity: Fo.water.envMapIntensity, normalMap: sets.cobble.normalMap.clone(), normalScale: new THREE.Vector2(0.25, 0.25) }); // roughness/opacity/normalScale jak w HEAD
  if (env) mat.water.envMapRotation.copy(ctx.scene.environmentRotation);
  mat.water.normalMap.repeat.set(3, 3); mat.water.normalMap.needsUpdate = true;
  W.waterTime = { value: 0 }; // uniform czasu dla kręgów i rozbryzgu (fountain.js aktualizuje, gdy nie ma ?nowater)
  { const J = Fo.jets, tex = jetTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(J.texRepeat, 1);
    mat.jet = new THREE.MeshStandardMaterial({ color: oklch(...J.color), map: tex, transparent: true, opacity: J.opacity, depthWrite: false, roughness: J.roughness, metalness: 0, envMap: env, envMapIntensity: J.envMapIntensity, side: THREE.DoubleSide });
    if (env) mat.jet.envMapRotation.copy(ctx.scene.environmentRotation); }
  { const Rp = Fo.ripple, f = v => v.toFixed(3); // literały GLSL zawsze z kropką (int·float nie kompiluje się w GLSL ES 3.0)
    mat.ripple = new THREE.MeshBasicMaterial({ color: oklch(...Rp.color), transparent: true, opacity: Rp.opacity, depthWrite: false });
    // krąg rośnie od minScale do 1 wokół aCenter (środek w świecie — geometria po Batch jest już w świecie) i gaśnie; faza per krąg w aPhase
    mat.ripple.onBeforeCompile = sh => {
      sh.uniforms.uWater = W.waterTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWater; attribute vec3 aCenter; attribute float aPhase; varying float vRip;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n float rp = fract(uWater * ${f(Rp.speed)} + aPhase);\n transformed = aCenter + (position - aCenter) * (${f(Rp.minScale)} + ${f(1 - Rp.minScale)} * rp);\n vRip = 1.0 - rp;`); // GLSL: faza 0→1, skala minScale→1, alfa 1→0
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRip;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vRip;');
    }; }
  { const Sp = Fo.splash, f = v => v.toFixed(3);
    mat.splash = new THREE.PointsMaterial({ map: splashTexture(), color: oklch(...Sp.color), size: Sp.size, transparent: true, opacity: Sp.opacity, depthWrite: false, sizeAttenuation: true });
    // kropla: z punktu lądowania (position) z prędkością aVel, spada z g = 9.81 (4.905·τ²); cykl `life` s z fazą aSeed; alfa gaśnie do końca cyklu
    mat.splash.onBeforeCompile = sh => {
      sh.uniforms.uWater = W.waterTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWater; attribute vec3 aVel; attribute float aSeed; varying float vSpl;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n float tau = fract(uWater * ${f(Sp.rate)} + aSeed) * ${f(Sp.life)};\n transformed = position + aVel * tau - vec3(0.0, 4.905 * tau * tau, 0.0);\n vSpl = (1.0 - tau / ${f(Sp.life)}) * step(-0.01, transformed.y - position.y);`); // GLSL: rzut ukośny, 4.905 = g/2; kropla pod lustrem (y < start − 1 cm) niewidoczna
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSpl;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vSpl;');
    }; }
  mat.wet = sets.cobble.material({ color: oklch(...Fo.wet.color), params: { roughness: Fo.wet.roughness, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, transparent: true, vertexColors: true } }); // mokry bruk: ciemniejszy tint, gładszy; polygonOffset przeciw z-fightingowi z podłogą; alfa z atrybutu color RGBA (zanik na brzegu)
  mat.flame = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  // girlandy (bunting.js): chorągiewki z kolorem wierzchołków (barwy w CONFIG.bunting.pennant.colors), lampiony papierowe emisyjne
  { const Lb = W.CONFIG.bunting.lantern;
    mat.bunting = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }); // tkanina matowa jak cloth (roughness 1)
    mat.paperLit = new THREE.MeshStandardMaterial({ color: oklch(...Lb.color), emissive: oklch(...Lb.emissive), emissiveIntensity: Lb.intensity, roughness: 0.8 }); } // papier: matowy (0.8), bez metalu
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

// Strumień fontanny: alfa wzdłuż u (u biegnie WZDŁUŻ rury — TubeGeometry.js:196 `uv.x = i / tubularSegments`): jasne smugi na półprzezroczystym tle;
// RepeatWrapping i animowany offset.x (fountain.js) dają płynięcie od krawędzi misy do lustra.
export function jetTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, 256, 32); // tło strumienia: 45 % krycia (razem z opacity materiału 0.6 → ~0.27)
  const r = rng(11); // stały wzór smug (ziarno bez znaczenia dla sceny)
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${(0.6 + r() * 0.4).toFixed(2)})`; g.fillRect(r() * 256, r() * 32, 6 + r() * 20, 2 + r() * 3); } // 40 smug 6–26 px × 2–5 px, krycie 0.6–1.0
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Kropla rozbryzgu: miękkie kółko (jak dym), 32 px.
export function splashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); // rdzeń pełny, 60 % promienia półkrycie, brzeg 0
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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
