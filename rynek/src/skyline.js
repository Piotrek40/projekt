// Panorama za pierzejami (tor „wieża i panorama", motywy #4 + #14): druga linia dachów, mgła, bramy zamykające osie ulic, wieże w oddali,
// ptaki nad placem. Flagi: ?noskyline=1 (cały moduł = stan sprzed cechy, także groundExtent w layout.js), ?nofog=1, ?nobirds=1.
// Układ lokalny: początek na środku podstawy, +x wzdłuż pierzei, +y w górę, +z = FRONT (do placu). Metry. Do świata tylko przez L().
// Wszystkie liczby w CONFIG.skyline; własny generator rng(seed + seedOffset), żeby kolejność losowań innych modułów nie zmieniała panoramy.
import * as THREE from 'three';
import { box, gable, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall, checkCollisionCovers, checkAboveGround, facadeNormal, bboxOf } from '../../engine/src/check.js';
import { oklch } from './color.js';

// Plan panoramy — FUNKCJA CZYSTA (bez DOM, loaderów i W.B): test geometrii (audyt/testy/test_geometria.mjs, asercje S) importuje ją
// i sprawdza liczby na tych samych danych, z których buildSkyline stawia bryły.
export function skylinePlan(W) {
  const { CONFIG, H, half, sw, sideTransform } = W;
  const S = CONFIG.skyline, R = rng(CONFIG.seed + S.seedOffset);
  // ---- domy tła: dwa odcinki wzdłuż każdej pierzei (z przerwą na dom zamykający ulicę: krawędź sw/2 + depth = 11 m + streetClear) ----
  const houses = [], placed = [];
  const SL = S.secondLine, inner = sw / 2 + H.depth + SL.streetClear, outer = half + H.depth + SL.alongMax;
  // kolejność: odcinek A (od narożnika do ulicy) wszystkich stron, potem odcinek B — każda strona wygrywa dokładnie jeden narożnik
  // (NW: s0-A przed s3-B, NE: s1-A przed s0-B, SE: s2-A przed s1-B, SW: s3-A przed s2-B), więc liczby domów na stronach są zbliżone
  for (const [a, b] of [[-outer, -inner], [inner, outer]]) {
    for (let side = 0; side < 4; side++) {
      let pos = a;
      while (b - pos > SL.widthMin) {
        let w = Math.min(R.range(SL.widthMin, SL.widthMax), b - pos);
        if (b - pos - w < SL.widthMin) w = b - pos; // ostatni dom domyka odcinek
        const d = R.range(SL.depthMin, SL.depthMax), setback = R.range(SL.distMin, SL.distMax), ridgeY = R.range(SL.ridgeMin, SL.ridgeMax);
        const gableFront = R() < SL.gableShare;
        const rise = ((gableFront ? w : d) / 2) * Math.tan(H.roofPitch), eaveY = ridgeY - rise;
        const h = { side, along: pos + w / 2, setback, w, d, eaveY, ridgeY, rise, gableFront, plaster: R.int(0, W.P.plaster.length - 1), roof: R.int(0, W.P.roof.length - 1),
                    chimney: (R() - 0.5) * ((gableFront ? d : w) - 2), lit: R(), off: [R(), R()] }; // komin ≥ 1 m od krawędzi kalenicy
        const tr = sideTransform(side, h.along, setback);
        // obrys w świecie (domy stoją wzdłuż osi, więc AABB = obrót o wielokrotność 90°)
        const hw = side % 2 === 0 ? w / 2 : d / 2, hd = side % 2 === 0 ? d / 2 : w / 2;
        h.box = new THREE.Box2(new THREE.Vector2(tr.x - hw, tr.z - hd), new THREE.Vector2(tr.x + hw, tr.z + hd));
        pos += w + R.range(SL.gapMin, SL.gapMax);
        if (placed.some(p => p.intersectsBox(h.box))) continue; // narożnik: dom sąsiedniej pierzei już tu stoi
        placed.push(h.box); houses.push(h);
      }
    }
  }
  // ---- bramy: na osi każdej ulicy, setback za osią pierzei (26 + 8 = 34 m; tył pierzei 30 m, fasada domu zamykającego half + sl = 38 m) ----
  const gates = [0, 1, 2, 3].map(side => ({ side, tr: sideTransform(side, 0, S.gate.setback), dist: half + H.depth / 2 + S.gate.setback }));
  // ---- wieże w oddali: pierścień wokół placu ----
  const towers = S.farTowers.map((t, i) => ({ ...t, i, x: Math.sin(t.a) * t.dist, z: Math.cos(t.a) * t.dist })); // ring: (sin a·R, cos a·R), §3.1.4
  // ---- ptaki: okręgi nad placem ----
  const Bd = S.birds, birds = [];
  for (let i = 0; i < Bd.count; i++) birds.push({ cx: R.range(-half / 3, half / 3), cz: R.range(-half / 3, half / 3), y: R.range(Bd.yMin, Bd.yMax), r: R.range(Bd.rMin, Bd.rMax), w: R.range(Bd.speedMin, Bd.speedMax) * (R() < 0.5 ? 1 : -1), phi: R() * Math.PI * 2 }); // połowa ptaków krąży w drugą stronę; środki w środkowej ⅓ placu
  return { houses, gates, towers, birds };
}

export function buildSkyline(W) {
  const { ctx, scene, CONFIG } = W;
  if (ctx.flags.noskyline) return;
  const S = CONFIG.skyline;
  if (!ctx.flags.nofog) {
    // kolor ekranowy z sondy (komentarz w config.js) — Fog miesza po AgX (meshphysical.glsl.js:219)
    scene.fog = new THREE.Fog(S.fog.color, S.fog.near, S.fog.far);
    check(S.fog.near < S.fog.far && S.fog.far <= (ctx.camera?.far ?? 300), 'mgła: near ≥ far albo far poza kamerą', S.fog);
  }
  W.mat.far = new THREE.MeshStandardMaterial({ color: oklch(...S.farColor), roughness: 1, metalness: 0 }); // przed W.B.build; bez tekstury (100 m, mip = średnia)
  const plan = skylinePlan(W);
  buildSecondLine(W, plan.houses);
  buildGates(W, plan.gates);
  buildFarTowers(W, plan.towers);
  if (!ctx.flags.nobirds) buildBirds(W, plan.birds);
  W.skylinePlan = plan;
}

// Druga linia dachów: box tynku + 2 połacie + szczyty + komin + okna górnych pięter (istniejące klucze plaster/roof/stone/glass = 0 nowych draw).
function buildSecondLine(W, houses) {
  const { CONFIG, T, H, B, half } = W;
  const SL = CONFIG.skyline.secondLine, ov = H.overhang;
  for (const h of houses) {
    const tr = W.sideTransform(h.side, h.along, h.setback);
    const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(tr.x, 0, tr.z, tr.ry)); // lokalny → świat
    const LP = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry));
    const id = `tło s${h.side} along${h.along.toFixed(1)}`, nrm = facadeNormal(tr.ry);
    const { w, d, eaveY, ridgeY, rise } = h, plasterKey = 'plaster' + h.plaster, roofKey = 'roof' + h.roof;
    // za pierzeją: najbliższa ściana ≥ tył pierzei (half + depth) + 0.3
    const nearDist = half + H.depth / 2 + h.setback - d / 2;
    check(nearDist >= half + H.depth + 0.3, `${id}: wchodzi w pierzeję`, { nearDist }); // ≥ 0.3 m luzu od tyłu pierzei
    check(eaveY >= 3 && ridgeY >= SL.ridgeMin - 0.01 && ridgeY <= SL.ridgeMax + 0.01, `${id}: kalenica poza zakresem`, { eaveY, ridgeY }); // okap ≥ 3 m (parter), tolerancja 1 cm
    B.add(plasterKey, box(w, eaveY, d, T.plaster.mpt, h.off), L(0, eaveY / 2, 0));
    // połacie: kalenica z TEJ SAMEJ macierzy co połać musi być wyżej niż okap (K1)
    const ridgeCheck = (m, slope, axis) => {
      const e = axis === 'x' ? [new THREE.Vector3(-slope / 2, 0, 0), new THREE.Vector3(slope / 2, 0, 0)] : [new THREE.Vector3(0, 0, -slope / 2), new THREE.Vector3(0, 0, slope / 2)];
      const [p, q] = e.map(v => v.applyMatrix4(m)), c = LP(0, 0, 0);
      const dp = Math.hypot(p.x - c.x, p.z - c.z), dq = Math.hypot(q.x - c.x, q.z - c.z);
      const [ridge, eave] = dp < dq ? [p, q] : [q, p]; // koniec bliżej osi domu = kalenica
      check(ridge.y > eave.y + 0.5 && Math.abs(ridge.y - ridgeY) < 0.02 && Math.abs(eave.y - eaveY) < 0.02, `${id}: połać odwrócona`, { ridge: ridge.toArray(), eave: eave.toArray(), ridgeY, eaveY }); // K1: kalenica ≥ 0.5 m nad okapem, końce na ridgeY/eaveY ± 2 cm
    };
    if (h.gableFront) {
      // kalenica ∥ z (szczyt do placu): spadek wzdłuż x
      const slope = Math.hypot(w / 2 + ov, rise), a = Math.atan2(rise, w / 2 + ov);
      for (const sx of [-1, 1]) { const m = L(sx * (w / 4 + ov / 2), eaveY + rise / 2, 0, 0, 0, -sx * a); B.add(roofKey, box(slope, 0.14, d + 2 * ov, T.roof.mpt, h.off), m); ridgeCheck(m, slope, 'x'); } // rot: rz=−a dla sx=+1 → koniec +x w dół (okap na w/2+ov), koniec −x na kalenicy (0, ridgeY, 0); dla sx=−1 lustrzanie (rz>0 podnosi koniec +x, §3.1)
      B.add(plasterKey, gable(w, rise, d, T.plaster.mpt), L(0, eaveY, 0));
    } else {
      // kalenica ∥ x (okap do placu): spadek wzdłuż z
      const slope = Math.hypot(d / 2 + ov, rise), a = Math.atan2(rise, d / 2 + ov);
      for (const sz of [-1, 1]) { const m = L(0, eaveY + rise / 2, sz * (d / 4 + ov / 2), 0, sz * a); B.add(roofKey, box(w + 2 * ov, 0.14, slope, T.roof.mpt, h.off), m); ridgeCheck(m, slope, 'z'); } // rot: rx=+a dla sz=+1 → koniec +z w dół: okap (0, eaveY, d/2+ov), kalenica (0, ridgeY, 0); policzone d=8, eaveY=8: (0, 8, 4.55) / (0, 12.553, 0)
      for (const sx of [-1, 1]) B.add(plasterKey, gable(d, rise, 0.3, T.plaster.mpt), L(sx * (w / 2 - 0.15), eaveY, 0, Math.PI / 2)); // szczyty boczne
    }
    // komin na kalenicy: spód 0.5 m pod okapem (w bryle tynku — podparty), wierzch 0.7 m nad kalenicą
    const chH = ridgeY + 0.7 - (eaveY - 0.5); // 0.7 m nad kalenicą, 0.5 m pod okapem (w bryle)
    B.add('stone', box(0.8, chH, 0.8, T.stone.mpt, h.off), h.gableFront ? L(0, eaveY - 0.5 + chH / 2, h.chimney) : L(h.chimney, eaveY - 0.5 + chH / 2, 0)); // komin 0.8 × 0.8 (słownik: 0.9; mniejszy, bo w tle)
    // okna: fasada (do placu) zawsze; ściana boczna od ulicy tylko w domu przy ulicy (widok z końca ulicy). Rzędy co kondygnację od góry,
    // ≥ 0.3 m pod okapem. Lokalne −x domu wskazuje ulicę dla along > 0 (§3.1.2), więc ściana od ulicy = −sign(along)·w/2.
    const faceZ = d / 2, wh = 1.3, ww = 1.0; // okno piętra 1.0 × 1.3 (słownik §3.7)
    const faces = [{ tag: 'f', len: w, m: (cx, wy) => L(cx, wy, faceZ + 0.01), ctr: (cx, wy) => LP(cx, wy, faceZ + 0.01), wall: (cx, wy) => LP(cx, wy, faceZ), nrm }]; // fasada: środek okna 1 cm przed licem
    if (Math.abs(h.along) - w / 2 < SL.streetSideMax) { // dom przy ulicy: okna też na ścianie od ulicy
      const sg = -Math.sign(h.along), faceX = sg * w / 2, ry = sg * Math.PI / 2; // ry=−π/2: lokalne +z okna → −x (§3.1 tabela; policzone: sg=−1 → (−1,0,0)), ry=+π/2 → +x
      const sideN = new THREE.Vector3(sg, 0, 0).transformDirection(M4(0, 0, 0, tr.ry));
      faces.push({ tag: 'b', len: d, m: (cz, wy) => L(faceX + sg * 0.01, wy, cz, ry), ctr: (cz, wy) => LP(faceX + sg * 0.01, wy, cz), wall: (cz, wy) => LP(faceX, wy, cz), nrm: sideN }); // środek 1 cm przed ścianą boczną
    }
    for (const fc of faces) {
      const n = Math.max(1, Math.round(fc.len / SL.windowSpacing));
      for (let f = 0; f < SL.windowRows; f++) {
        const wy = eaveY - 0.3 - wh / 2 - f * H.floorHeight; if (wy - wh / 2 < 1.0) break; // 0.3 m pod okapem; nie niżej niż 1 m nad ziemią
        for (let i = 0; i < n; i++) {
          const c = -fc.len / 2 + (i + 0.5) * fc.len / n, lit = (h.lit * 7919 + i * 31 + f * 17) % 1 < 0.25; // deterministycznie z liczby losowej domu
          B.add(lit ? 'glassLit' : 'glass', box(ww, wh, 0.04), fc.m(c, wy)); // tył 1 cm w ścianie, lico 3 cm przed nią (K4)
          checkInFrontOfWall(`${id} okno ${fc.tag}${f}`, fc.ctr(c, wy), fc.wall(c, wy), fc.nrm); // środek 1 cm przed licem (≥ 0.005)
        }
      }
    }
  }
}

// Mur bramy z otworem łukowym: prostokąt (−span/2..span/2 × spring..height) minus półkole o promieniu span/2 — spód elementu = spring (≥ 2 m → B6 zwolnione).
function archGeometry(span, spring, height, t, mpt) {
  const s = new THREE.Shape();
  s.moveTo(-span / 2, height); s.lineTo(span / 2, height); s.lineTo(span / 2, spring);
  s.absarc(0, spring, span / 2, 0, Math.PI, false); // od (span/2, spring) przez szczyt łuku (0, spring + span/2) do (−span/2, spring)
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mpt, uv.getY(i) / mpt);
  return g;
}

// Bramy: 2 filary + łuk + blanki + 2 baszty ze stożkiem; kolizja prostokątami filarów i kołami baszt (przejście |x| < span/2 wolne).
function buildGates(W, gates) {
  const { ctx, CONFIG, T, B, half, sl, H } = W;
  const G = CONFIG.skyline.gate;
  for (const g of gates) {
    const tr = g.tr;
    const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(tr.x, 0, tr.z, tr.ry));
    const LP = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry));
    const id = `brama s${g.side}`, across = g.side % 2 === 0; // side 0/2: lokalne x = świat x
    check(g.dist - G.thickness / 2 >= half + H.depth + 0.5 && g.dist + G.thickness / 2 <= half + sl - 1, `${id}: nie między pierzeją a domem zamykającym`, { dist: g.dist }); // 0.5 m za tyłem pierzei, 1 m przed fasadą domu zamykającego
    for (const s of [-1, 1]) {
      const px = s * (G.span / 2 + G.pierWidth / 2);
      const pier = box(G.pierWidth, G.height, G.thickness, T.blocks.mpt), mp = L(px, G.height / 2, 0);
      B.add('blocks', pier, mp);
      const c = LP(px, 0, 0), hw = across ? G.pierWidth / 2 : G.thickness / 2, hd = across ? G.thickness / 2 : G.pierWidth / 2;
      ctx.addRect(c.x, c.z, hw, hd); W.dbgRect?.(c.x, c.z, hw, hd);
      checkCollisionCovers(`${id} filar`, bboxOf(pier, mp), { x: c.x, z: c.z, hw, hd });
      for (let k = 0; k < G.merlons; k++) B.add('blocks', box(0.5, 0.6, G.thickness, T.blocks.mpt), L(px + (k - (G.merlons - 1) / 2) * 0.7, G.height + 0.3, 0)); // blanki: spód na wierzchu filaru
      const bast = cylinder(G.bastionR, G.bastionR * 1.06, G.bastionH, 8, T.blocks.mpt), mb = L(s * G.bastionX, G.bastionH / 2, 0); // lekkie zwężenie ku górze (1.06 u podstawy)
      B.add('blocks', bast, mb);
      const bc = LP(s * G.bastionX, 0, 0);
      ctx.addCircle(bc.x, bc.z, G.bastionR * 1.06); W.dbgCircle?.(bc.x, bc.z, G.bastionR * 1.06); // koło = promień podstawy
      checkCollisionCovers(`${id} baszta`, bboxOf(bast, mb), { x: bc.x, z: bc.z, r: G.bastionR * 1.06 }); // ta sama macierz co bryła
      const cap = new THREE.ConeGeometry(G.bastionR * 1.25, G.capH, 8); // stożek z okapem 25 %
      { const uv = cap.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * G.bastionR * 8 / T.roof.mpt, uv.getY(i) * G.capH / T.roof.mpt); }
      B.add('roof2', cap, L(s * G.bastionX, G.bastionH + G.capH / 2, 0));
    }
    const arch = archGeometry(G.span, G.archSpring, G.height, G.thickness, T.blocks.mpt), ma = L(0, 0, 0);
    B.add('blocks', arch, ma);
    const ab = bboxOf(arch, ma);
    check(ab.min.y >= 2.0, `${id}: łuk niżej niż 2 m nad ulicą (B6)`, { minY: ab.min.y }); // element nad przejściem bez kolizji
    check(ab.max.y <= G.height + 0.01 && ab.min.y >= G.archSpring - 0.01, `${id}: łuk poza murem`, { min: ab.min.toArray(), max: ab.max.toArray() }); // tolerancja 1 cm
    W.dbgAxes?.(tr.x, 0.05, tr.z, tr.ry, 2); // ?boxes=1: osie bramy (niebieska +z = do placu)
  }
}

// Wieże w oddali: trzon + stożek + przybudówka, klucz far (jaśniejszy tint = perspektywa powietrzna, do tego mgła).
function buildFarTowers(W, towers) {
  const { CONFIG, B, T } = W;
  const S = CONFIG.skyline, F = S.farBlock;
  for (const t of towers) {
    check(t.dist >= 60 && t.dist <= 110, `wieża w oddali ${t.i}: poza 60–110 m`, { dist: t.dist });
    const trunk = cylinder(t.r, t.r * 1.1, t.h, 8, T.blocks.mpt), mt = M4(t.x, t.h / 2, t.z, t.a); // podstawa 10 % szersza
    B.add('far', trunk, mt);
    B.place('far', new THREE.ConeGeometry(t.r * 1.3, t.h * 0.3, 8), t.x, t.h + t.h * 0.15, t.z, t.a); // hełm 30 % wysokości trzonu, okap 30 %
    // przybudówka po stronie stycznej pierścienia: lokalne +x wieży obróconej o a (ry=a: +x → (cos a, 0, −sin a) = styczna, §3.1)
    const annex = box(F.w, F.h, F.d), ma = M4(t.r + 1 + F.w / 2, F.h / 2, 0).premultiply(M4(t.x, 0, t.z, t.a));
    B.add('far', annex, ma);
    // na gruncie: bruk to kwadrat ±groundExtent, więc liczy się max(|x|, |z|) narożników AABB, nie odległość od środka
    const wb = bboxOf(trunk, mt).union(bboxOf(annex, ma)), reach = Math.max(Math.abs(wb.min.x), Math.abs(wb.max.x), Math.abs(wb.min.z), Math.abs(wb.max.z));
    check(reach <= S.groundExtent - 2, `wieża w oddali ${t.i}: poza gruntem`, { reach, groundExtent: S.groundExtent });
    checkAboveGround(`wieża w oddali ${t.i}`, wb);
  }
}

// Tekstura ptaka (V skrzydeł) liczona w tablicy — bez canvasu, więc działa też w teście Node.
function birdTexture() {
  const N = 32, data = new Uint8Array(N * N * 4);
  const segDist = (px, py, ax, ay, bx, by) => { const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dd = Math.min(segDist(x + 0.5, y + 0.5, 16, 21, 3, 11), segDist(x + 0.5, y + 0.5, 16, 21, 29, 11)); // V: wierzchołek (16,21), końce skrzydeł (3,11)/(29,11)
    const a = Math.max(0, Math.min(1, 2.2 - dd)); // szerokość kreski ~2 px z miękką krawędzią
    const o = (y * N + x) * 4; data[o] = data[o + 1] = data[o + 2] = 255; data[o + 3] = Math.round(a * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Ptaki: jeden Points (1 draw), pozycje z pierścieni w updaterze.
function buildBirds(W, birds) {
  const { ctx, scene, CONFIG } = W;
  const Bd = CONFIG.skyline.birds, N = birds.length, pos = new Float32Array(N * 3);
  // nad dachami: najwyższa kalenica pierzei = parter + (floorsMax−1) pięter + rise (topD/2 + jetty·(floorsMax−1)/2)·tan(pitch) = 13.95 m dla HEAD; sufit 40 m (kadr)
  const { H } = W, ridgeTop = H.groundFloor + (H.floorsMax - 1) * H.floorHeight + ((H.depth + (H.floorsMax - 1) * H.jetty) / 2) * Math.tan(H.roofPitch);
  for (const b of birds) check(b.y >= ridgeTop && b.y <= 40 && b.y >= Bd.yMin && b.y <= Bd.yMax, 'ptak pod kalenicami albo poza kadrem', { y: b.y, ridgeTop }); // cykl 1: próg 20 m z ręki — ptaki 22–34 m poza kadrem
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ map: birdTexture(), size: Bd.size, transparent: true, alphaTest: 0.3, depthWrite: false, color: oklch(...Bd.color), sizeAttenuation: true }); // alphaTest 0.3 = twarda krawędź V
  const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; pts.name = 'birds'; scene.add(pts);
  const tick = t => {
    for (let i = 0; i < N; i++) {
      const b = birds[i], a = b.phi + b.w * t;
      pos[i * 3] = b.cx + Math.sin(a) * b.r; pos[i * 3 + 1] = b.y + Math.sin(t * 0.7 + i) * 0.6; pos[i * 3 + 2] = b.cz + Math.cos(a) * b.r; // ring: (sin a·R, cos a·R) wokół (cx, cz)
    }
    geo.attributes.position.needsUpdate = true;
  };
  tick(0);
  ctx.updaters.push((dt, t) => tick(t));
}
