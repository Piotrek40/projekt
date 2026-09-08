// Materiały rynku: zestawy PBR z Poly Haven + materiały proceduralne (szkło, woda, chorągwie, szyld, dym).
// Kolory: motyw #9 — każdy tint z CONFIG.paletteOKLCH.tint[klucz] = [L, C, H, zestaw] przez oklch() (hex tylko w config.js); ?nopalette=1 = stare heksy
// z CONFIG.palette. Kolejność kluczy W.mat = lineup.js MAT_KEYS (lineup, lineup_rects). Nowe klucze: paint0..2 (okiennice) na sets.timber (old_planks_02),
// roof2 i roofTower na sets.tiles (stone_tiles_02). W.hex(klucz) daje hex bieżącej palety (props.js: światło latarni, dym; tower.js: nic — roofTower stąd).
import * as THREE from 'three';
import { rng } from '../../engine/src/geometry.js';
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
  mat.glass = new THREE.MeshPhysicalMaterial({ color: hexOf('glass'), roughness: 0.08, metalness: 0.0 }); // parametry jak HEAD; bez envMapIntensity: martwy przy scene.environment bez własnego envMap (§4.1.9, §8 #16 — tor B)
  const em = PK ? { color: oklch(...PK.emit.glassLit.color), emissive: oklch(...PK.emit.glassLit.emissive), k: PK.emit.glassLit.intensity } : { color: P.glassLit, emissive: P.glassLitEmissive, k: 1.6 }; // 1.6: HEAD emissiveIntensity
  mat.glassLit = new THREE.MeshStandardMaterial({ color: em.color, emissive: em.emissive, emissiveIntensity: em.k, roughness: 0.3 }); // roughness jak HEAD
  mat.iron = new THREE.MeshStandardMaterial({ color: hexOf('iron'), roughness: 0.55, metalness: 0.9 }); // parametry jak HEAD
  // --- fontanna (fountain.js, motyw #8) ---
  // Woda z WŁASNYM envMap: scene.environment to equirect HDR, renderer robi z niego PMREM (environments.get(material.envMap || environment), WebGLRenderer.js:2177);
  // bez własnego envMap envMapIntensity jest nadpisywany przez scene.environmentIntensity 0.6 (:2694, §4.1.9). Obrót: przy własnym envMap liczy się material.envMapRotation (:2178).
  const Fo = W.CONFIG.fountain, env = ctx.scene.environment || null;
  mat.water = new THREE.MeshPhysicalMaterial({ color: hexOf('water'), roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.85, envMap: env, envMapIntensity: Fo.water.envMapIntensity, normalMap: sets.cobble.normalMap.clone(), normalScale: new THREE.Vector2(Fo.water.normalScale, Fo.water.normalScale) }); // normalScale z CONFIG (poprawka r2: 0,25 przy repeat 3 = mozaika kafelkowa)
  if (env) mat.water.envMapRotation.copy(ctx.scene.environmentRotation);
  mat.water.normalMap.repeat.set(Fo.water.normalRepeat, Fo.water.normalRepeat); mat.water.normalMap.needsUpdate = true;   // poprawka r2: repeat 3 dawal regularna mozaike ~10 cm
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
  mat.flame = new THREE.MeshBasicMaterial({ color: PK ? new THREE.Color(oklch(...PK.emit.flame.color)).multiplyScalar(PK.emit.flame.intensity) : new THREE.Color(P.flame) });
  // girlandy (bunting.js): chorągiewki z kolorem wierzchołków (barwy w CONFIG.bunting.pennant.colors), lampiony papierowe emisyjne
  { const Lb = W.CONFIG.bunting.lantern;
    mat.bunting = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }); // tkanina matowa jak cloth (roughness 1)
    mat.paperLit = new THREE.MeshStandardMaterial({ color: oklch(...Lb.color), emissive: oklch(...Lb.emissive), emissiveIntensity: Lb.intensity, roughness: 0.8 }); } // papier: matowy (0.8), bez metalu
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
  W.hex = { lanternLight: PK ? oklch(...PK.lanternLight) : P.lanternLight, smoke: PK ? oklch(...PK.smoke) : P.smoke, gold, signBg: PK ? oklch(...PK.canvas.signBg) : P.signBg, signBoard: PK ? oklch(...PK.canvas.signBoard) : P.signBoard,
    silver: PK ? oklch(...PK.canvas.silver) : P.silver, fields: clothHex }; // silver: liść herbu miasta; fields: pola tarcz herbowych atlasu szyldów = kolory tkanin cloth0..3 (§4.2: te same kolory heraldyczne)
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
// Atlas szyldów cechowych (motyw #10b): A.cols × A.rows kafelków po A.tile px (4 × 3 × 256 = 1024 × 768 od motywu #11: 8 godeł domów + jabłko kramu owocarza); w kafelku okno szyldu A.tile × A.win px (256 × 158 ≈ 1,3 × 0,8 m,
// wyśrodkowane w pionie): deska signBoard, złota ramka, tarcza herbowa (pole = kolejny kolor z col.fields = cloth0..3, godło gold albo signBg na jasnym polu) z godłem
// rysowanym ścieżkami canvas w układzie 100 × 100 (EMBLEMS, kolejność = CONFIG.houseDetail.sign.tiles + extraTiles); kafelek 0 (gryf) z napisem karczmy pod mniejszą tarczą.
// UV kafelka (okno szyldu albo kwadrat A.win × A.win na plakietę): props.js signTileUV(). Kolory z W.hex (sRGB canvas — §4.1.7).
export function signTexture(col, A, text) {
  const c = document.createElement('canvas'); c.width = A.cols * A.tile; c.height = A.rows * A.tile; const g = c.getContext('2d');
  g.fillStyle = hexStr(col.signBg); g.fillRect(0, 0, c.width, c.height);
  EMBLEMS.forEach((draw, i) => {
    const x0 = (i % A.cols) * A.tile, y0 = Math.floor(i / A.cols) * A.tile + (A.tile - A.win) / 2;
    g.save(); g.translate(x0, y0);
    g.fillStyle = hexStr(col.signBoard); g.fillRect(0, 0, A.tile, A.win);
    g.strokeStyle = hexStr(col.gold); g.lineWidth = 5; g.strokeRect(6, 6, A.tile - 12, A.win - 12);
    const withText = i === 0 && !!text, field = col.fields[i % col.fields.length];
    const light = ((field >> 16) + ((field >> 8) & 255) + (field & 255)) / 3 > 0x90; // jasne pole (szafran): godło ciemne, nie złote
    const sw = withText ? 78 : 108, sh = withText ? 88 : 132, cx = A.tile / 2, cy = withText ? A.cyText : A.win / 2; // tarcza: szerokość, wysokość, środek (mniejsza nad napisem; plakieta = kwadrat A.plq wokół (cx, cy))
    // tarcza „heater": prosta góra, boki i ostry dół
    g.beginPath(); g.moveTo(cx - sw / 2, cy - sh / 2); g.lineTo(cx + sw / 2, cy - sh / 2); g.lineTo(cx + sw / 2, cy - sh / 8); g.quadraticCurveTo(cx + sw / 2, cy + sh / 2, cx, cy + sh / 2); g.quadraticCurveTo(cx - sw / 2, cy + sh / 2, cx - sw / 2, cy - sh / 8); g.closePath();
    g.fillStyle = hexStr(field); g.fill(); g.strokeStyle = hexStr(col.gold); g.lineWidth = 4; g.stroke();
    g.save(); g.translate(cx, cy - sh * 0.04); g.scale(sw / 110, sh / 130); // godło w układzie ±50, lekko nad środkiem tarczy
    g.fillStyle = g.strokeStyle = hexStr(i === 6 ? col.silver : light ? col.signBg : col.gold); g.lineWidth = 6; g.lineCap = 'round';
    draw(g, hexStr(field)); g.restore();
    if (withText) { g.fillStyle = hexStr(col.gold); g.font = 'bold 23px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cx, 128); }
    g.restore();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; // 4: napis czytelny pod kątem (szyld prostopadły do fasady)
}
// godła w układzie 100 × 100 (x, y ∈ ±50, y w dół), styl ustawiony przez signTexture; drugi argument = kolor pola (kontrastowe linie na godle)
const EMBLEMS = [
  (g, fld) => { // gryf: tułów, skrzydło, głowa z dziobem, łapy, ogon
    g.beginPath(); g.ellipse(6, 12, 22, 14, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-6, 2); g.lineTo(16, -42); g.lineTo(28, -38); g.lineTo(34, -18); g.lineTo(22, -2); g.closePath(); g.fill();
    g.beginPath(); g.arc(-20, -14, 10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-28, -16); g.lineTo(-42, -10); g.lineTo(-27, -8); g.closePath(); g.fill();
    g.fillRect(-8, 20, 6, 20); g.fillRect(10, 20, 6, 20);
    g.beginPath(); g.moveTo(26, 14); g.quadraticCurveTo(44, 8, 40, -8); g.stroke();
    g.fillStyle = fld; g.beginPath(); g.arc(-22, -16, 2.5, 0, Math.PI * 2); g.fill(); // oko
  },
  g => { g.beginPath(); g.ellipse(0, -22, 24, 14, 0, 0, Math.PI); g.fill(); g.fillRect(-24, -30, 48, 8); g.fillRect(-4, -8, 8, 30); g.fillRect(-18, 22, 36, 8); }, // kielich
  (g, fld) => { g.beginPath(); g.ellipse(0, 4, 34, 20, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = fld; g.lineWidth = 4; for (const x of [-16, 0, 16]) { g.beginPath(); g.moveTo(x - 6, -6); g.lineTo(x + 6, 14); g.stroke(); } }, // bochen z nacięciami
  g => { g.beginPath(); g.ellipse(-4, 8, 22, 24, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-14, -36, 20, 14); g.fillRect(-18, -42, 28, 7); g.beginPath(); g.arc(22, 2, 13, -Math.PI / 2, Math.PI / 2); g.stroke(); }, // dzban z uchem
  g => { for (const sx of [-1, 1]) { g.save(); g.rotate(sx * 0.42); g.beginPath(); g.ellipse(0, -14, 6, 30, 0, 0, Math.PI * 2); g.fill(); g.restore(); g.beginPath(); g.arc(sx * 13, 30, 9, 0, Math.PI * 2); g.stroke(); } }, // nożyce
  g => { g.fillRect(-30, -34, 60, 22); g.fillRect(-5, -12, 10, 54); }, // młot
  (g, fld) => { g.beginPath(); g.moveTo(0, -44); g.quadraticCurveTo(40, -12, 0, 44); g.quadraticCurveTo(-40, -12, 0, -44); g.fill(); g.strokeStyle = fld; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -36); g.lineTo(0, 38); g.stroke(); }, // srebrny liść
  g => { g.lineWidth = 9; g.beginPath(); g.arc(0, -26, 15, 0, Math.PI * 2); g.stroke(); g.fillRect(-5, -12, 10, 54); g.fillRect(5, 22, 20, 8); g.fillRect(5, 34, 14, 8); }, // klucz: grube ucho, trzon, dwa zęby
  // kafelki 8+ = CONFIG.houseDetail.sign.extraTiles (szyldy kramów, motyw #11; poza pulą szyldów domów)
  (g, fld) => { g.beginPath(); g.arc(0, 8, 32, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.beginPath(); g.moveTo(2, -22); g.quadraticCurveTo(4, -36, 10, -44); g.stroke(); g.beginPath(); g.moveTo(4, -30); g.quadraticCurveTo(26, -44, 30, -24); g.quadraticCurveTo(12, -18, 4, -30); g.fill(); g.strokeStyle = fld; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(-18, 8, -12, 24); g.stroke(); }, // jabłko: owoc, ogonek, listek, blik w kolorze pola
];
// Szyld z HEAD (tylko ?nosign=1): tło, deska, złota ramka i napis; kolory z W.hex (signBg, signBoard, gold)
export function signTextTexture(text, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = hexStr(col.signBg); g.fillRect(0, 0, 512, 320);
  g.fillStyle = hexStr(col.signBoard); g.fillRect(12, 12, 488, 296);
  g.strokeStyle = hexStr(col.gold); g.lineWidth = 6; g.strokeRect(24, 24, 464, 272);
  g.fillStyle = hexStr(col.gold); g.font = 'bold 62px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = text.split(' ');
  g.fillText(words.slice(0, 2).join(' '), 256, 120); g.fillText(words.slice(2).join(' '), 256, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
