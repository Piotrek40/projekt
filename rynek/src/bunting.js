// Girlandy chorągiewek i lampiony nad placem (tor „kramy i rekwizyty", motyw #5). Flaga: ?nobunting=1 (stan sprzed cechy).
// Układ lokalny kotwicy = układ domu (layout.js): początek na środku podstawy domu, +x wzdłuż pierzei, +y w górę, +z = FRONT (do placu).
// Metry. Do świata tylko przez M4(tr).premultiply. Liny: QuadraticBezierCurve3 z punktem kontrolnym opuszczonym o 2·zwis, bo zwis krzywej
// = połowa opuszczenia punktu kontrolnego (B(0.5) = ¼A + ½P + ¼B; policzone w Node: A,B y 6.5, P y 1.5 → min y 4.0). Liczby: CONFIG.bunting.
// Poprawka r1: lina nie może zasłaniać tarczy zegara w kadrze startowym (clockClearance; ?noclockclear=1 = losowy zwis bez reguły).
import * as THREE from 'three';
import { box, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall, facadeNormal } from '../../engine/src/check.js';
import { oklch } from './color.js';

// Wysokość kotwicy na fasadzie domu h: CONFIG.bunting.y (6.5 m — nad górną ramą okna p1 = 5.49 m, chorągwie 5.0 m) albo belowEave pod
// okapem, gdy dom jest niższy (2 piętra: wierzch ściany 3.2 + 2.9 = 6.1 → 5.8 m; okno p1 kończy się 5.49, oczep 5.94–6.10 — między nimi).
function anchorY(C, H, h) { return Math.min(C.y, H.groundFloor + (h.floors - 1) * H.floorHeight - C.belowEave); }

// Kotwica liny na fasadzie: dom pod `along` na stronie `side`, lico piętra, w którym leży y (jetty: lico piętra f = depth/2 + f·jetty,
// jak `front = jet/2 + fd/2` w buildings.js). Omija chorągwie (W.banners z buildBanners): przesunięcie o bannerShift, gdy bliżej niż bannerClear.
function anchorAt(W, side, along, y) {
  const { CONFIG, H, houses, sideTransform } = W, C = CONFIG.bunting;
  const banners = (W.banners || []).filter(b => b.side === side);
  for (let k = 0; k < 3 && banners.some(b => Math.abs(b.along - along) < C.bannerClear); k++) along += C.bannerShift;
  const h = houses.find(h => h.side === side && !h.setback && Math.abs(along - h.along) <= h.w / 2);
  if (!check(!!h, 'girlanda: brak domu pod kotwicą', { side, along })) return null;
  const f = Math.min(h.floors - 1, Math.max(1, Math.floor((y - H.groundFloor) / H.floorHeight) + 1)); // piętro (1..floors−1) z kotwicą
  const jet = h.jetty ? f * H.jetty : 0, faceZ = H.depth / 2 + jet;                                  // lico piętra f w układzie domu
  const tr = sideTransform(side, h.along, 0), M = M4(tr.x, 0, tr.z, tr.ry), lx = along - h.along;  // lokalne x = along − środek domu (policzone dla 4 stron)
  const P = new THREE.Vector3(lx, y, faceZ + C.hook.out).applyMatrix4(M);   // koniec liny: hook.out przed licem (poza słupkiem 0.09 m)
  const face = new THREE.Vector3(lx, y, faceZ).applyMatrix4(M);
  checkInFrontOfWall(`girlanda kotwica s${side} along${along.toFixed(1)}`, P, face, facadeNormal(tr.ry), C.hook.out - 0.01);
  return { side, along, h, y, faceZ, lx, tr, M, P, face };
}

// FUNKCJA CZYSTA (bez DOM, loaderów i W.B): liny, kotwice, lampiony — test geometrii (asercje G) liczy na tych samych danych.
// Liny E–W na z = ew[i] (fasada zachodnia side 3, along = −z → wschodnia side 1, along = z), N–S na x = ns[i] (północna side 0, along = x
// → południowa side 2, along = −x); sideTransform: side 0 x = along, side 1 z = along, side 2 x = −along, side 3 z = −along (layout.js).
export function buntingCurves(W) {
  const { CONFIG, H } = W, C = CONFIG.bunting, R = rng(CONFIG.seed + C.seedOffset);
  check(C.ew.length + C.ns.length === C.lines, 'girlanda: liczba lin ≠ CONFIG.bunting.lines', { lines: C.lines });
  const spans = [...C.ew.map(z => [[3, -z], [1, z]]), ...C.ns.map(x => [[0, x], [2, -x]])];
  const lines = [];
  for (const [[sa, aa], [sb, ab]] of spans) {
    const zwis0 = R.range(C.sagMin, C.sagMax);
    const ha = anchorAt(W, sa, aa, C.y), hb = anchorAt(W, sb, ab, C.y);
    if (!ha || !hb) continue;
    const yLine = Math.min(anchorY(C, H, ha.h), anchorY(C, H, hb.h));     // oba końce na tej samej wysokości → najniższy punkt = środek
    const A = anchorAt(W, sa, aa, yLine), B = anchorAt(W, sb, ab, yLine);
    const zwisMax = yLine - C.minY;                                        // granica zwisu: środek liny ≥ minY (4.0 m)
    let zwis = Math.min(zwis0, zwisMax);
    const mid = A.P.clone().add(B.P).multiplyScalar(0.5);
    const curveOf = zw => new THREE.QuadraticBezierCurve3(A.P, mid.clone().sub(new THREE.Vector3(0, 2 * zw, 0)), B.P); // punkt kontrolny 2·zwis niżej
    // zegar w kadrze startowym (poprawka r1): zwis rośnie co sagStep, aż pasmo liny zejdzie pod tarczę o margin (lina z = 12: 1,64 → 2,35, policzone w config)
    const clockRule = !!W.clock && !W.ctx.flags.noclockclear, K = C.clockClear;
    while (clockRule && zwis < zwisMax - 1e-9 && clockClearance(W, curveOf(zwis)).gap < K.margin) zwis = Math.min(zwisMax, zwis + K.sagStep);
    const curve = curveOf(zwis), m = curve.getPoint(0.5);   // 0.5 = środek liny (najniższy punkt przy końcach na tej samej wysokości)
    const clock = clockRule ? clockClearance(W, curve) : null;
    if (clock) check(clock.gap >= K.margin, 'girlanda na tarczy zegara w kadrze startowym', { gap: +clock.gap.toFixed(3), margin: K.margin, zwis, t: clock.t });
    check(Math.abs(m.y - (A.P.y - zwis)) < 0.01, 'zwis girlandy', { mid: m.y, oczekiwane: A.P.y - zwis });
    check(m.y >= C.minY, 'girlanda za nisko', { mid: m.y, minY: C.minY });
    const lanterns = Array.from({ length: C.lantern.count }, (_, i) => {
      const p = curve.getPointAt((i + 1) / (C.lantern.count + 1)); p.y -= C.lantern.drop; return p;   // środek kuli lampionu
    });
    for (const p of lanterns) check(p.y - C.lantern.r >= C.lantern.minY, 'lampion za nisko', { y: p.y - C.lantern.r, minY: C.lantern.minY });
    lines.push({ curve, A: A.P, B: B.P, zwis, zwis0, anchors: [A, B], lanterns, clock });
  }
  return lines;
}

// FUNKCJA CZYSTA: odstęp liny od tarczy zegara w kadrze startowym (CONFIG.composition.start; W.clock z tower.js — landmark „zaraz wybije czwarta").
// Rzut kamerą startową (fov/oko z CONFIG.bunting.clockClear = app.js:44/18, aspect 1 → NDC x i y w tej samej skali); dla próbek liny w pionie tarczy
// (|Δx| ≤ r_NDC + margin) liczy odstęp pasma lina → spód lampionu (drop + r = 0,5 m; proporczyk 0,335 m sięga płycej) od krawędzi tarczy w y.
// Zwraca { gap, t, p } z najmniejszym odstępem (ujemny = pasmo na tarczy; Infinity = lina poza pionem tarczy) albo null, gdy nie ma zegara (?notower2=1).
export function clockClearance(W, curve) {
  const { CONFIG } = W, C = CONFIG.bunting, K = C.clockClear, st = CONFIG.composition.start, clock = W.clock;
  if (!clock) return null;
  const cam = new THREE.PerspectiveCamera(K.fov, 1, 0.05, 300);   // near/far jak app.js:44 (nieistotne dla NDC x/y)
  cam.position.set(st.x, K.eye, st.z); cam.rotation.set(0, 0, 0, 'YXZ'); cam.rotation.y = st.yaw; cam.rotation.x = st.pitch;   // jak app.js:154
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const pr = p => p.clone().project(cam);
  const cc = pr(new THREE.Vector3(clock.x, clock.y, clock.z)), rN = pr(new THREE.Vector3(clock.x, clock.y + clock.r, clock.z)).y - cc.y;
  const below = C.lantern.drop + C.lantern.r;
  let best = null;
  for (let k = 0; k <= K.samples; k++) {
    const p = curve.getPoint(k / K.samples), top = pr(p), bot = pr(p.clone().setY(p.y - below));
    if (Math.abs(top.x - cc.x) > rN + K.margin) continue;
    const gap = (top.y > cc.y ? bot.y - cc.y : cc.y - top.y) - rN;   // odstęp pasma od krawędzi tarczy: pasmo nad tarczą → jego spód, pod → lina
    if (!best || gap < best.gap) best = { gap, t: k / K.samples, p };
  }
  return best ?? { gap: Infinity, t: -1, p: null };
}

// Trójkątne chorągiewki jednej liny w JEDNEJ geometrii (klucz bunting, vertexColors): co `spacing` m łuku, wierzchołkiem w dół,
// uv.y 1 na linie / 0 na wierzchołku → W.sway(byUv) rusza tylko dolny wierzchołek.
function pennantGeometry(curve, C, colors) {
  const n = Math.floor(curve.getLength() / C.pennant.spacing), pos = [], col = [], uv = [];
  for (let i = 1; i < n; i++) {
    const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u).setY(0).normalize().multiplyScalar(C.pennant.w / 2);
    const top = p.y - C.rope.r, c = colors[i % colors.length];
    pos.push(p.x - t.x, top, p.z - t.z, p.x + t.x, top, p.z + t.z, p.x, top - C.pennant.h, p.z);
    uv.push(0, 1, 1, 1, 0.5, 0); col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function buildBunting(W) {
  if (W.ctx.flags.nobunting) return;
  const { ctx, CONFIG, B, mat } = W, C = CONFIG.bunting;
  const colors = C.pennant.colors.map(([L, c, h]) => new THREE.Color(oklch(L, c, h)));
  const sphere = new THREE.SphereGeometry(C.lantern.r, 8, 6), string = cylinder(C.lantern.stringR, C.lantern.stringR, C.lantern.string, 4, 1);
  let pennants = 0;
  for (const ln of buntingCurves(W)) {
    B.add('iron', new THREE.TubeGeometry(ln.curve, C.rope.seg, C.rope.r, C.rope.radial, false));
    const pg = pennantGeometry(ln.curve, C, colors); pennants += pg.attributes.position.count / 3;
    B.add('bunting', pg);
    for (const a of ln.anchors) B.add('iron', box(C.hook.size, C.hook.size, C.hook.len), M4(a.lx, a.y, a.faceZ + C.hook.len / 2 - C.hook.inWall).premultiply(a.M)); // hak: inWall w ścianie, reszta przed licem
    for (const p of ln.lanterns) {
      B.add('paperLit', sphere, M4(p.x, p.y, p.z));
      B.add('iron', string, M4(p.x, p.y + C.lantern.drop - C.lantern.string / 2, p.z)); // sznurek od liny do kuli
    }
  }
  check(pennants > 0, 'girlanda bez chorągiewek');
  if (!ctx.flags.nosway && mat.bunting) W.sway(mat.bunting, C.pennant.swayAmp, true);
}
