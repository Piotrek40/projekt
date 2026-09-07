// Wieża ratusza — landmark placu (motyw #2, ?notower2=1 przywraca starą kwadratową z buildSquareTower). Okrągły trzon-walec zbieżny 24 m
// w slates, 3 pasy i 6 przypór blocks, okna łukowe w 4 rzędach, tarcza zegara (klucz clock), gzyms, stożek 9 m (klucz roofTower = miedź
// z patyną na stone_tiles_02, materials.js), iglica 3 m z kulą i chorągwią → 36 m. Stoi na osi start→fontanna, na zachód od ulicy N, podstawą 2,3 m w placu.
// Układ lokalny: początek na środku podstawy (tx, 0, tz), +y w górę, +z = FRONT (do placu, na południe). Element „na promieniu" stawia
// LR(a, r, y, …) = M4(0, y, r, …).premultiply(M4(tx, 0, tz, a)): lokalne +z po obrocie a to (sin a, 0, cos a) — policzone: a = π/6 →
// (0.5, 0, 0.866), a = π/2 → (1, 0, 0) — więc front każdego elementu patrzy radialnie na zewnątrz. Metry. Do świata tylko przez LR()/M4.
import * as THREE from 'three';
import { box, plane, cylinder, M4 } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall, checkCollisionCovers, bboxOf } from '../../engine/src/check.js';
import { oklchToHex } from './color.js';

// Stara kwadratowa wieża 7 × 7 × 15 m + dach ostrosłupowy 6 m za pierzeją N-E — tylko ?notower2=1 (stan sprzed motywu #2); kod bez zmian.
function buildSquareTower(W) {
  const { ctx, CONFIG, T, B, half, sw } = W;
  {
    const tw = CONFIG.tower.size, th = CONFIG.tower.height, rh = CONFIG.tower.roofHeight;
    const tx = sw / 2 + tw / 2 + 0.5, tz = -half - tw / 2 - 0.2;
    B.place('slates', box(tw, th, tw, T.slates.mpt), tx, th / 2, tz);
    ctx.addRect(tx, tz, tw / 2, tw / 2);
    W.dbgRect?.(tx, tz, tw / 2, tw / 2); // ?boxes=1: obrys kolizji wieży
    // gzyms, okna strzelnicze, zegar-tarcza, dach ostrosłupowy
    B.place('blocks', box(tw + 0.6, 0.5, tw + 0.6, T.blocks.mpt), tx, th - 0.25, tz);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, ox = Math.sin(a) * (tw / 2 + 0.01), oz = Math.cos(a) * (tw / 2 + 0.01); // ring: okna na 4 ścianach (sin a·R, cos a·R)
      B.place('glassLit', box(0.7, 1.6, 0.08), tx + ox, th - 3.2, tz + oz, a);
      B.place('glass', box(0.5, 1.2, 0.08), tx + ox, th - 8, tz + oz, a);
      B.place('timber', box(0.9, 0.1, 0.16, T.timber.mpt), tx + ox, th - 2.35, tz + oz, a);
    }
    const roofG = new THREE.ConeGeometry(tw / 2 * 1.45, rh, 4, 1);
    roofG.rotateY(Math.PI / 4);
    { const uv = roofG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tw * 2 / T.roof.mpt, uv.getY(i) * rh / T.roof.mpt); }
    B.place('roofTower', roofG, tx, th + rh / 2, tz);
    B.place('iron', cylinder(0.05, 0.05, 2.2, 6, 1), tx, th + rh + 1.0, tz);
    B.place('banner2', plane(1.4, 0.9, 1), tx + 0.7, th + rh + 1.6, tz);
    // zadaszone wejście
    B.place('blocks', box(2.2, 0.4, 1.4, T.blocks.mpt), tx, 3.0, tz + tw / 2 + 0.6);
    B.place('door', box(1.6, 2.8, 0.1, 1.6), tx, 1.4, tz + tw / 2 + 0.03);
  }
}

// Pozycja i promienie z CONFIG (funkcja czysta: layout.js liczy z niej limit krawędzi pierzei N-W, test geometrii asercję „dom w wieży").
export function towerPlacement(CONFIG) {
  const t = CONFIG.tower, half = CONFIG.plaza.size / 2, sw = CONFIG.plaza.streetWidth;
  const tx = -(sw / 2 + t.rTop + t.streetGap);   // = −6.7 (policzone): na zachód od ulicy N, 0,5 m od jej krawędzi
  const tz = -half - t.rTop + t.plazaIn;         // = −23.2: trzon wchodzi 2,0 m w plac (tz + rTop = −20,0 vs krawędź −22), podstawa rBot 2,3 m
  return { tx, tz, rTop: t.rTop, rBot: t.rBot, houseEdgeMax: tx - t.rBot - t.houseGap }; // houseEdgeMax = −10,5
}

// Kształt łuku pełnego: prostokąt w × (h − w/2) + półkole r = w/2; początek (0, yBase) = środek podstawy. Do ExtrudeGeometry (oprawa) i ShapeGeometry (szkło).
function archShape(w, h, yBase = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, yBase); s.lineTo(w / 2, yBase); s.lineTo(w / 2, yBase + h - w / 2); s.absarc(0, yBase + h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, yBase);
  return s;
}
// Oprawa łukowa: pierścień (łuk zewnętrzny szerszy o fw z otworem w × h, łuki współśrodkowe) wyciągnięty na głębokość d wzdłuż +z (od z = 0 do d).
function archFrame(w, h, fw, d, mpt) {
  const s = archShape(w + 2 * fw, h + 2 * fw, -fw); s.holes.push(archShape(w, h));
  const g = new THREE.ExtrudeGeometry(s, { depth: d, curveSegments: 6, bevelEnabled: false });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mpt, uv.getY(i) / mpt);
  return g;
}
// Tarcza zegara na canvasie (bez bitmap): pierścień, pole, 12 kresek, wskazówki na pełną godzinę c.hour. Obroty przez ctx.rotate (bez sin/cos).
function clockTexture(c) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const hex = t => oklchToHex(...t).hexStr;
  g.fillStyle = hex(c.ring); g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(c.face); g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(c.hands);
  const tick = (i, w, len) => { g.save(); g.translate(128, 128); g.rotate(i * Math.PI / 6); g.fillRect(-w / 2, -108, w, len); g.restore(); };
  for (let i = 0; i < 12; i++) tick(i, i % 3 ? 4 : 8, i % 3 ? 12 : 20);
  const hand = (turns, w, len) => { g.save(); g.translate(128, 128); g.rotate(turns * Math.PI * 2); g.fillRect(-w / 2, -len, w, len + 12); g.restore(); };
  hand(c.hour / 12, 10, 60); hand(0, 6, 88);   // wskazówka godzinowa i minutowa (pełna godzina → minutowa pionowo)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

export function buildTower(W) {
  if (W.ctx.flags.notower2) return buildSquareTower(W);   // ?notower2=1: stan sprzed motywu #2
  const { ctx, CONFIG, T, B, half, sw } = W;
  const t = CONFIG.tower, { tx, tz, rTop, rBot } = towerPlacement(CONFIG);
  const rAt = y => rBot + (rTop - rBot) * y / t.trunkH;   // promień trzonu na wysokości y (walec zbieżny): y 8/15/21 → 3.40/3.31/3.24 (policzone)
  const LR = (a, r, y, ry = 0, rx = 0, rz = 0) => M4(0, y, r, ry, rx, rz).premultiply(M4(tx, 0, tz, a)); // na promieniu r pod kątem a, front (+z) radialnie na zewnątrz
  const P = m => new THREE.Vector3().setFromMatrixPosition(m);
  const radialN = a => new THREE.Vector3(0, 0, 1).transformDirection(M4(0, 0, 0, a));   // normalna radialna = lokalne +z po obrocie a
  if (W.sets) {   // materiały tylko w przeglądarce (test geometrii buduje bryły bez tekstur i DOM); PRZED W.B.build; roofTower z materials.js (paletteOKLCH.tint.roofTower na stone_tiles_02 — motyw #9)
    W.mat.clock = new THREE.MeshStandardMaterial({ map: clockTexture(t.clock), roughness: 0.7 }); // roughness 0.7: malowana blacha tarczy, bez metaliczności
  }
  // trzon + kolizja
  B.place('slates', cylinder(rTop, rBot, t.trunkH, t.seg, T.slates.mpt), tx, t.trunkH / 2, tz);
  ctx.addCircle(tx, tz, rBot); W.dbgCircle?.(tx, tz, rBot);
  checkCollisionCovers('wieża trzon', new THREE.Box3(new THREE.Vector3(tx - rBot, 0, tz - rBot), new THREE.Vector3(tx + rBot, t.trunkH, tz + rBot)), { x: tx, z: tz, r: rBot });
  check(tz + rBot + half >= 1.5 && tz + rBot + half <= 2.5, 'wieża wchodzi w plac poza 1,5–2,5 m', { plazaIn: tz + rBot + half });   // 2,3 m (policzone)
  check(tx + rBot <= -sw / 2, 'podstawa wieży w ulicy N', { edge: tx + rBot, street: -sw / 2 });                                     // −3,2 ≤ −3
  // pasy
  for (const y of t.bands) B.place('blocks', cylinder(rAt(y) + t.bandOut, rAt(y) + t.bandOut, t.bandH, t.seg, T.blocks.mpt), tx, y, tz);
  // przypory: co 60° od 30° (a = π/6 + k·π/3 — drzwi na a = 0 leżą między 330° a 30°); stopnie [h, d] od ziemi, tył wsunięty w trzon o buttressIn
  const buttressTop = Math.max(...t.buttressSteps.map(s => s[0]));
  for (let k = 0; k < t.buttresses; k++) {
    const a = Math.PI / t.buttresses + k * 2 * Math.PI / t.buttresses;
    let outer = 0;
    for (const [h, d] of t.buttressSteps) { const m = LR(a, rBot - t.buttressIn + d / 2, h / 2); B.add('blocks', box(t.buttressW, h, d, T.blocks.mpt), m); outer = Math.max(outer, d); }
    const cm = LR(a, rBot - t.buttressIn + outer / 2, 0), c = P(cm), cr = 0.75;   // koło kolizji przypory: środek = środek stopnia dolnego, r 0,75 ≥ półprzekątna 0,9 × 1,2 (0,75)
    ctx.addCircle(c.x, c.z, cr); W.dbgCircle?.(c.x, c.z, cr);
    checkCollisionCovers(`wieża przypora ${k}`, bboxOf(box(t.buttressW, buttressTop, outer), LR(a, rBot - t.buttressIn + outer / 2, buttressTop / 2)), { x: c.x, z: c.z, r: cr });
  }
  check(t.windowRows[0] > buttressTop + 0.3, 'okna rzędu 1 wchodzą w przypory', { row0: t.windowRows[0], buttressTop });   // 5,9 > 5,7
  // okna łukowe: 4 rzędy × 4 kierunki (S, E, N, W); pole S rzędu z tarczą zegara puste; rząd najwyższy (dzwonnica) świeci
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];   // front +z po obrocie: (0,0,1), (1,0,0), (0,0,−1), (−1,0,0) — policzone
  const clockRow = t.windowRows.findIndex(y0 => y0 < t.clock.y + t.clock.r && y0 + t.windowH > t.clock.y - t.clock.r);
  let nWin = 0;
  t.windowRows.forEach((y0, row) => {
    const glassKey = row === t.windowRows.length - 1 ? 'glassLit' : 'glass', r0 = rAt(y0);
    for (const a of dirs) {
      if (row === clockRow && a === 0) continue;
      B.add('blocks', archFrame(t.windowW, t.windowH, t.frameW, t.frameIn + t.frameOut, T.blocks.mpt), LR(a, r0 - t.frameIn, y0));
      B.add(glassKey, new THREE.ShapeGeometry(archShape(t.windowW, t.windowH), 8), LR(a, r0 + t.glassOut, y0));
      checkInFrontOfWall(`wieża okno rząd ${row} a=${a.toFixed(2)}`, P(LR(a, r0 + t.glassOut, y0)), P(LR(a, r0, y0)), radialN(a), 0.01);   // szkło 2 cm przed licem ≥ 1 cm (K5)
      nWin++;
    }
  });
  check(nWin === t.windowRows.length * dirs.length - 1 && clockRow >= 0, 'liczba okien wieży ≠ 4×4 − 1 (pole zegara)', { nWin, clockRow });
  // tarcza zegara na S: podkład blocks (walec osią wzdłuż promienia, przód 2 cm przed licem) + tarcza 1,5 cm przed podkładem
  {
    const y = t.clock.y, r0 = rAt(y), backCenter = r0 + 0.02 - t.clock.backT / 2;   // przód podkładu 2 cm przed licem (tył 38 cm w murze)
    B.add('blocks', cylinder(t.clock.backR, t.clock.backR, t.clock.backT, 24, T.blocks.mpt), LR(0, backCenter, y, 0, Math.PI / 2)); // rot: rx=+π/2 → oś walca (0,1,0) → (0,0,1) = wzdłuż promienia; przód na z = tz + r0 + 0.02 (policzone −19.912)
    B.add('clock', new THREE.CircleGeometry(t.clock.r, 24), LR(0, r0 + t.clock.out, y));
    checkInFrontOfWall('wieża tarcza zegara', P(LR(0, r0 + t.clock.out, y)), P(LR(0, r0 + 0.02, y)), radialN(0), 0.01);   // 1,5 cm przed podkładem
    check(y + t.clock.r < t.bands[t.bands.length - 1] - t.bandH / 2, 'tarcza zegara wchodzi w pas', { top: y + t.clock.r });   // 20,0 < 20,8
  }
  // gzyms i dach: stożek od y = trunkH do trunkH + roofH; okap 0,5 m za gzyms
  B.place('blocks', cylinder(rTop + t.corniceOut, rTop + t.corniceIn, t.corniceH, t.seg, T.blocks.mpt), tx, t.trunkH - t.corniceH / 2, tz);
  const roofG = new THREE.ConeGeometry(t.roofR, t.roofH, t.seg);
  { const uv = roofG.attributes.uv, circ = 2 * Math.PI * t.roofR, slant = Math.hypot(t.roofR, t.roofH); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / T.slates.mpt, uv.getY(i) * slant / T.slates.mpt); }
  const roofBaseY = t.trunkH, apexY = t.trunkH + t.roofH;
  B.place('roofTower', roofG, tx, roofBaseY + t.roofH / 2, tz);
  check(t.roofR >= rTop + t.corniceOut + 0.3, 'okap stożka nie wystaje za gzyms', { roofR: t.roofR, cornice: rTop + t.corniceOut });   // 4,1 ≥ 3,9
  // iglica z kulą i chorągwią
  const spireTopY = apexY + t.spireH;
  B.place('iron', cylinder(0.04, 0.08, t.spireH, 6, 1), tx, apexY + t.spireH / 2, tz);   // pręt 8 → 4 cm
  B.place('iron', new THREE.SphereGeometry(t.ballR, 8, 6), tx, apexY + t.ballR, tz);
  B.place('banner2', plane(t.flag.w, t.flag.h, 1), tx + t.flag.w / 2 + 0.05, spireTopY - t.flag.h / 2 - 0.1, tz);   // płótno od pręta w +x, 0,1 m pod szczytem
  check(Math.abs(spireTopY - 36) < 0.01, 'szczyt iglicy nie na 36 m', { spireTopY });   // 24 + 9 + 3 (słownik skali §3.7)
  // portal S: oprawa łukowa (łuk nad drzwiami odsłania mur), drzwi 1,6 × 2,8 przodem 7 cm przed licem
  {
    const d = t.door, r0 = rAt(d.h / 2);
    B.add('blocks', archFrame(d.w, d.archH, d.frameW, t.frameIn + d.frameOut, T.blocks.mpt), LR(0, r0 - t.frameIn, 0));
    B.add('door', box(d.w, d.h, 0.1, 1.6), LR(0, r0 + 0.02, d.h / 2));   // środek 2 cm przed licem jak drzwi kamienic (przód +0,07, tył −0,03 w murze)
    checkInFrontOfWall('wieża drzwi', P(LR(0, r0 + 0.02, d.h / 2)), P(LR(0, r0, d.h / 2)), radialN(0), 0.01);   // środek drzwi 2 cm przed licem ≥ 1 cm
  }
  // mur dziedzińca za wieżą: od krawędzi ostatniego domu pierzei N-W (houseEdgeMax) do 0,2 m przed ulicą (tx + rBot = −3,2), za obrysem podstawy
  {
    const yw = t.yardWall, x0 = towerPlacement(CONFIG).houseEdgeMax, x1 = tx + rBot, zw = tz + yw.zOff;
    B.place('blocks', box(x1 - x0, yw.h, yw.t, T.blocks.mpt), (x0 + x1) / 2, yw.h / 2, zw);
    ctx.addRect((x0 + x1) / 2, zw, (x1 - x0) / 2, yw.t / 2); W.dbgRect?.((x0 + x1) / 2, zw, (x1 - x0) / 2, yw.t / 2);
    check(x1 <= -sw / 2 && zw - yw.t / 2 > -half - CONFIG.house.depth && zw + yw.t / 2 < tz - rBot, 'mur dziedzińca w ulicy albo w placu/obrysie wieży', { x1, zw });
  }
}
