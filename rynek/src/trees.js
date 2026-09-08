// Lipy proceduralne przy fontannie (motyw #7, ?notrees=1): pień, odziomek, konary, korona z brył (ikosaedry z teksturą liści alphaTest) i kart liści, falowanie.
// Układ lokalny drzewa: początek u podstawy pnia (na ziemi), +y w górę, +x/+z poziomo (bez frontu — korona obrotowo losowa). Metry. Do świata tylko przez L().
// treePlacements(W) = funkcja czysta (geo/entry.mjs, asercja H: koło kolizji w osi pnia); buildTrees tylko dodaje z niej geometrię do W.B i koła kolizji.
// Materiały (leaf0/leaf1/leafCard) powstają tylko w przeglądarce (W.sets, CanvasTexture) — test offline ma sam W.B. Liczby: CONFIG.trees.
import * as THREE from 'three';
import { cylinder, plane, M4, rng } from '../../engine/src/geometry.js';
import { check, checkCollisionCovers, bboxOf } from '../../engine/src/check.js';
import { oklch } from './color.js';

// Pozycje lip: count sztuk na okręgu dist wokół fontanny od kąta phase (π/2 → (±6, 0)); r = koło kolizji w osi pnia.
export function treePlacements(W) {
  const C = W.CONFIG.trees, out = [];
  for (let i = 0; i < C.count; i++) {
    const a = C.phase + (i / C.count) * Math.PI * 2;
    out.push({ x: Math.sin(a) * C.dist, z: Math.cos(a) * C.dist, r: C.collideR, ry: a, seed: C.seed + i });   // ring: pozycja na okręgu wokół fontanny
  }
  return out;
}

export function buildTrees(W) {
  const { ctx, CONFIG, B } = W;
  if (ctx.flags.notrees) return;
  const C = CONFIG.trees, F = CONFIG.fountain;
  if (W.sets) makeLeafMaterials(W);
  const places = treePlacements(W);
  check(places.every(p => Math.hypot(p.x, p.z) - C.trunk.rBot >= F.radius + 1.2 + 0.5), 'lipa za blisko schodka fontanny', { dist: C.dist }); // schodek r + 1,2 (fountain.js) + 0,5 luzu: 6 − 0,32 = 5,68 ≥ 4,9
  for (const p of places) {
    buildTree(W, p);
    ctx.addCircle(p.x, p.z, p.r); W.dbgCircle?.(p.x, p.z, p.r);
  }
  W.trees = places;
}

// Jedno drzewo w układzie lokalnym → świat przez L (ry drzewa = kąt na okręgu: konary/karty losowe, więc obrót tylko różnicuje egzemplarze).
function buildTree(W, p) {
  const { CONFIG, T, B } = W, C = CONFIG.trees, R = rng(p.seed);
  const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(p.x, 0, p.z, p.ry));
  const id = `lipa (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
  // pień + odziomek (timber: belki dębowe — ten sam klucz, 0 nowych draw)
  const tr = C.trunk;
  const trunkG = cylinder(tr.rTop, tr.rBot, tr.h, tr.seg, T.timber.mpt), trunkM = L(0, tr.h / 2, 0);
  B.add('timber', trunkG, trunkM);
  B.add('timber', cylinder(tr.rBot, tr.root.r, tr.root.h, tr.seg, T.timber.mpt), L(0, tr.root.h / 2, 0));
  checkCollisionCovers(id + ' pień', bboxOf(trunkG, trunkM), { x: p.x, z: p.z, r: p.r });   // koło kolizji z tej samej macierzy co pień (r 0,45 ≥ 0,8·0,32)
  // konary: od szczytu pnia (y h − in), pochylone tilt od pionu: rz = −tilt (rot: rz=−0.7 → (0,1,0)→(0.644, 0.765, 0): czubek wychyla się ku lokalnemu +x, potem ry rozkłada po obwodzie)
  const br = C.branches, crown = C.crown, crownBottom = crown.y - crown.r;
  for (let k = 0; k < br.n; k++) {
    const ry = (k / br.n) * Math.PI * 2 + R.range(-0.3, 0.3), tilt = br.tilt + R.range(-br.tiltJitter, br.tiltJitter);   // ±0,3 rad: nierówny rozstaw konarów po obwodzie
    const m = M4(0, br.len / 2, 0).premultiply(L(0, tr.h - br.in, 0, ry, 0, -tilt));   // rot: rz=−tilt → koniec +y w bok (0.644, 0.765, 0) przy 0,7; środek konaru = (0, len/2, 0) tą samą macierzą
    B.add('timber', cylinder(br.rTop, br.rBot, br.len, 6, T.timber.mpt), m);
    const tip = new THREE.Vector3(0, br.len / 2, 0).applyMatrix4(m);   // czubek konaru z TEJ SAMEJ macierzy (policzone dla tilt 0,7: y 4,13, promień 1,29)
    check(tip.y >= crownBottom + 0.5 && Math.hypot(tip.x - p.x, tip.z - p.z) <= crown.r - 0.5, id + ' konar poza koroną', { tip: tip.toArray(), crownBottom });   // 0,5 m: czubek w głębi korony, nie na jej skórze
  }
  // korona z brył: ikosaedry (80 tri) w pierścieniach blobs; środek leaf0 (ciemniej), pierścienie leaf1; spód każdej bryły ≥ headroom
  const ico = new Map();   // geometria per promień (zaokrąglony do 0,05) — mniej alokacji
  const blob = rB => { const key = Math.round(rB * 20); if (!ico.has(key)) ico.set(key, new THREE.IcosahedronGeometry(key / 20, 1)); return ico.get(key); };
  crown.blobs.forEach((ring, ri) => {
    for (let k = 0; k < ring.n; k++) {
      const rB = Array.isArray(ring.rB) ? R.range(...ring.rB) : ring.rB, a = (k / ring.n) * Math.PI * 2 + R.range(-0.2, 0.2);   // ±0,2 rad / ±0,15 m: nierówna korona
      const c = new THREE.Vector3(0, ring.y + R.range(-0.15, 0.15), 0).add(new THREE.Vector3().setFromSphericalCoords(ring.ring, Math.PI / 2, a));   // bez sin/cos: punkt na okręgu przez sferyczne (φ = π/2 → poziom)
      check(c.y - rB >= C.headroom, id + ' bryła korony za nisko', { y: c.y, rB, headroom: C.headroom });
      B.add(ri === 0 ? 'leaf0' : 'leaf1', blob(rB), L(c.x, c.y, c.z, R.range(0, Math.PI * 2), 0, 0));   // środkowa bryła (wnętrze) ciemniejsza
    }
  });
  // karty liści na sferze korony: kierunek d (elewacja ≥ elevMin), karta licem na zewnątrz: ry = atan2(d.x, d.z), rx = −asin(d.y) (rot: dla d (0.669, 0.362, 0.649): ry 0,800, rx −0,371 → normalna = d — policzone), rz = losowy przechył
  const card = plane(crown.cardSize, crown.cardSize, crown.cardSize);   // UV 0..1 na całej karcie (mpt = bok)
  for (let k = 0; k < crown.cards; k++) {
    const elev = R.range(crown.elevMin, Math.PI / 2 - 0.2), az = R.range(0, Math.PI * 2), rad = crown.r * R.range(...crown.cardIn);   // −0,2: bez kart pionowo na szczycie (płaskie z góry)
    const d = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - elev, az), c = d.clone().multiplyScalar(rad).add(new THREE.Vector3(0, crown.y, 0));
    check(c.y - crown.cardSize / 2 >= C.headroom, id + ' karta liści za nisko', { y: c.y });
    B.add('leafCard', card, L(c.x, c.y, c.z, Math.atan2(d.x, d.z), -Math.asin(d.y), R.range(-0.5, 0.5)));   // rot: rx=−asin(d.y) → normalna karty = d (na zewnątrz korony); rz = przechył karty
  }
}

// Materiały liści (klucze W.mat PRZED W.B.build): tekstura liści z canvasu (sRGB, alpha → alphaTest 0,5, cień z wycinanką), DoubleSide; tinty z CONFIG.trees.tint przez oklch();
// falowanie W.sway (tor B) albo lokalna kopia sway z materials.js (?nosway=1 wyłącza).
function makeLeafMaterials(W) {
  const { ctx, CONFIG, mat, windUniform } = W, C = CONFIG.trees;
  const col = Object.fromEntries(Object.entries(C.canvas).map(([k, v]) => [k, '#' + oklch(...v).toString(16).padStart(6, '0')]));
  const tex = leafTexture(col, false), texCard = leafTexture(col, true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(C.texRepeat, C.texRepeat); tex.anisotropy = ctx.aniso?.() ?? 4; texCard.anisotropy = tex.anisotropy;
  const mk = (key, map) => new THREE.MeshStandardMaterial({ color: oklch(...C.tint[key]), map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });   // alphaTest 0,5: wycinanka bez sortowania; roughness 0,9: liście matowe
  mat.leaf0 = mk('leaf0', tex); mat.leaf1 = mk('leaf1', tex); mat.leafCard = mk('leafCard', texCard);
  const sway = W.sway ?? localSway(windUniform);
  if (!ctx.flags.nosway) for (const k of ['leaf0', 'leaf1', 'leafCard']) sway(mat[k], C.sway, false);
}
// Kopia sway z materials.js (do czasu W.sway z toru B): przesunięcie wierzchołków w x/z falą po czasie uWind i pozycji
function localSway(windUniform) {
  return (m, amp, byUv) => { m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n float swayK = ${byUv ? '(1.0 - clamp(uv.y, 0.0, 1.0))' : '1.0'};\n transformed.x += sin(uWind * 2.1 + position.y * 2.0 + position.z * 0.7) * ${amp} * swayK;\n transformed.z += cos(uWind * 1.7 + position.x * 1.3) * ${amp * 0.5} * swayK;`);   // jak materials.js sway (amp w x, amp/2 w z)
  }; };
}
// Tekstura liści lipy (sercowate, ząbkowane w przybliżeniu elipsą + szpic, nerw główny): gęsta (bryły korony, ~25 % prześwitu, kafelkowana) albo luźny pęk (karta, przezroczysty tył).
function leafTexture(col, sparse) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = rng(sparse ? 11 : 12);   // stałe ziarna: ta sama tekstura w każdym uruchomieniu
  const n = sparse ? 26 : 90, shades = [col.dark, col.mid, col.mid, col.silver];
  for (let i = 0; i < n; i++) {
    const x = sparse ? S / 2 + R.range(-0.36, 0.36) * S : R.range(0, S), y = sparse ? S / 2 + R.range(-0.36, 0.36) * S : R.range(0, S);   // pęk w środkowych 72 % karty (krawędź karty przezroczysta)
    const len = S * (sparse ? R.range(0.13, 0.2) : R.range(0.1, 0.15)), rot = R.range(0, Math.PI * 2), fill = R.pick(shades);   // liść 13–20 % (pęk) / 10–15 % (bryła) boku tekstury
    for (const [ox, oy] of sparse ? [[0, 0]] : [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]]) {   // kafelkowanie: liść przy krawędzi dorysowany po drugiej stronie
      g.save(); g.translate(x + ox, y + oy); g.rotate(rot);
      g.fillStyle = fill; g.beginPath(); g.moveTo(0, -len * 0.5); g.bezierCurveTo(len * 0.55, -len * 0.55, len * 0.5, len * 0.1, 0, len * 0.5); g.bezierCurveTo(-len * 0.5, len * 0.1, -len * 0.55, -len * 0.55, 0, -len * 0.5); g.fill();   // liść sercowaty: 2 krzywe Béziera od szpica do szpica
      g.strokeStyle = col.vein; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -len * 0.4); g.lineTo(0, len * 0.45); g.stroke();   // nerw główny 1,2 px
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
