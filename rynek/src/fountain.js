// Fontanna 3-poziomowa (motyw #8): basen i dwie misy z LatheGeometry, kolumny, 3 lustra wody z własnym envMap, strumienie (klucz jet),
// rozbryzg (Points), kręgi na wodzie (ripple), mokry bruk (wet), schodek i kolizja. Flagi: ?nofountain=1 (stara cembrowina ośmiokątna),
// ?nojets=1 (bez strumieni, rozbryzgu i kręgów), ?nowet=1 (bez mokrego bruku), ?nowater=1 (woda, strumienie i kręgi STATYCZNE — do img_diff).
// Układ lokalny = świat: początek na środku basenu na bruku (0,0,0), +y w górę; bryły obrotowe wokół osi y, więc bez L(). Metry.
// Dyski (lustra, kręgi, wet) leżą w XY i idą na XZ przez M4(x,y,z,0,-π/2) — rot: rx=−π/2 → normalna (0,0,1)→(0,1,0), lokalne +y→−z (policzone §3.1).
// Liczby: CONFIG.fountain. Profile, wysokości i krzywe strumieni liczy FUNKCJA CZYSTA fountainPlan — test geometrii (asercje F) czyta te same dane.
import * as THREE from 'three';
import { cylinder, M4, rng } from '../../engine/src/geometry.js';
import { check, checkCollisionCovers } from '../../engine/src/check.js';

const V2 = (r, y) => new THREE.Vector2(r, y);
const ringDir = a => new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); // ring: kierunek na pierścieniu (sin a, cos a), §3.1 p.4

// Plan fontanny (bez DOM, loaderów i W.B): profile Lathe (r, y), lustra, kolumny, płyta posągu, strumienie, schodek, kolizja, mokry bruk.
// Profil basenu i mis biegnie od dołu po zewnętrznej stronie, przez krawędź, po wewnętrznej do dna — tak LatheGeometry daje normalne
// na zewnątrz na ścianie zewnętrznej i do wnętrza na wewnętrznej (policzone w Node: zewn. (0.99,−0.13,0), wewn. (−0.14,0.99,0)).
export function fountainPlan(CONFIG) {
  const F = CONFIG.fountain, R = F.radius, rim = F.rim, Bn = F.basin, w = F.bowlWall;
  const statueY = rim + F.columnHeight + F.plinth.h; // spód posągu = props.js placeStatue (rim + columnHeight + 0.35)
  const basinProfile = [V2(R, 0), V2(R, rim - Bn.lipH), V2(R + Bn.lip, rim - Bn.lipH), V2(R + Bn.lip, rim), V2(R - Bn.wall, rim), V2(R - Bn.wall, Bn.floor), V2(0, Bn.floor)];
  const waters = [{ r: R - Bn.wall - F.waterInset, y: rim - Bn.waterBelowRim, floor: Bn.floor, rimY: rim, rIn: R - Bn.wall }];
  const bowls = F.bowls.map((b, i) => {
    const top = rim + b.top, floor = top - b.depth + w, hole = F.columns[i] - F.holeInset, [[f1r, f1d], [f2r, f2d]] = F.bowlShape;
    const profile = [V2(hole, -b.depth), V2(f1r * b.r, -f1d * b.depth), V2(f2r * b.r, -f2d * b.depth), V2(b.r, -w), V2(b.r, 0),
      V2(b.r - w, 0), V2(f2r * b.r - w, -f2d * b.depth + w), V2(f1r * b.r - w, -f1d * b.depth + w), V2(hole, -b.depth + w)];
    waters.push({ r: b.r - w - F.waterInset, y: top - F.bowlWaterBelowRim, floor, rimY: top, rIn: b.r - w });
    return { r: b.r, top, floor, depth: b.depth, profile };
  });
  check(Math.abs(bowls.at(-1).top - (rim + F.columnHeight)) < 1e-6, 'fontanna: krawędź górnej misy ≠ rim + columnHeight (posąg w props.js stanąłby w powietrzu)', { top: bowls.at(-1).top, columnHeight: F.columnHeight });
  for (const wt of waters) check(wt.y >= wt.floor + 0.05 && wt.y <= wt.rimY - 0.02, 'fontanna: lustro poza misą (≥ dno + 0.05, ≤ krawędź − 0.02)', wt); // 5 cm wody min., 2 cm pod krawędzią
  // kolumny: zatopione `sink` w dnie niżej i w spodzie misy wyżej (spód misy ma grubość bowlWall > sink → nic nie wystaje)
  const columns = [
    { r: F.columns[0], y0: Bn.floor - F.sink, y1: bowls[0].top - bowls[0].depth + F.sink },
    { r: F.columns[1], y0: bowls[0].floor - F.sink, y1: bowls[1].top - bowls[1].depth + F.sink },
    { r: F.columns[2], y0: bowls[1].floor - F.sink, y1: statueY - F.plinth.capH },
  ];
  const cap = { r: F.plinth.capR, y0: statueY - F.plinth.capH, y1: statueY };
  for (const c of columns) check(c.y1 - c.y0 >= 0.3, 'fontanna: kolumna krótsza niż 0.3 m', c); // każda kolumna to widoczny odcinek, nie krążek
  check(columns[0].y1 < bowls[0].floor && columns[0].y1 > bowls[0].top - bowls[0].depth, 'fontanna: kolumna 1 wystaje z dna misy 1', { y1: columns[0].y1, floor: bowls[0].floor });
  check(columns[1].y1 < bowls[1].floor && columns[1].y0 > bowls[0].top - bowls[0].depth, 'fontanna: kolumna 2 wystaje z misy', { c: columns[1], b0: bowls[0].top - bowls[0].depth, floor1: bowls[1].floor });
  check(columns[2].y0 > bowls[1].top - bowls[1].depth, 'fontanna: trzpień wystaje pod misą 2', { c: columns[2] });
  check(Math.abs(cap.y1 - statueY) < 1e-6 && Math.abs(F.plinth.h - (cap.y1 - bowls[1].top)) < 1e-6, 'fontanna: płyta nie kończy się na spodzie posągu', { cap, statueY });
  // strumienie: z krawędzi misy i (start), łuk za krawędź (ctrl) i lądowanie na lustrze poziom niżej (waters[i] = basen dla misy 0, misa 0 dla misy 1)
  const J = F.jets, jets = [];
  bowls.forEach((b, i) => {
    const below = waters[i], colBelow = columns[i];
    for (let k = 0; k < J.count[i]; k++) {
      const a = (k + 0.5) / J.count[i] * Math.PI * 2, d = ringDir(a); // ring: strumienie między osiami x/z (pół kroku)
      const start = d.clone().multiplyScalar(b.r - J.startIn).setY(b.top + J.startUp);
      const ctrl = d.clone().multiplyScalar(b.r + J.ctrlOut[i]).setY(b.top + J.ctrlUp[i]);
      const end = d.clone().multiplyScalar(b.r + J.landOut[i]).setY(below.y);
      const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
      let apex = -1; for (let s = 0; s <= 20; s++) apex = Math.max(apex, curve.getPoint(s / 20).y);
      const rLand = Math.hypot(end.x, end.z);
      check(start.y >= b.top, 'strumień startuje pod krawędzią misy', { i, k, start: start.y, top: b.top });
      check(Math.abs(end.y - below.y) < 1e-6, 'strumień nie kończy się na lustrze niżej', { i, k, end: end.y, water: below.y });
      check(apex >= start.y + 0.05, 'strumień bez łuku (apex < start + 0.05)', { i, k, apex, start: start.y }); // łuk widoczny: ≥ 5 cm nad startem
      check(rLand <= below.rIn - 0.15 && rLand >= colBelow.r + 0.15, 'strumień ląduje na ścianie/kolumnie zamiast na wodzie', { i, k, rLand, rIn: below.rIn, col: colBelow.r }); // 15 cm od ściany i od kolumny
      jets.push({ tier: i, a, start, ctrl, end, curve, apex, land: end.clone(), below });
    }
  });
  const step = { rIn: R + F.step.inner, rOut: R + F.step.outer, h: F.step.h }, collideR = R + F.collide;
  const wet = { r: F.wet.r, y: F.wet.y };
  check(wet.r >= step.rOut + 0.5, 'mokry bruk nie wystaje spod schodka (≥ 0.5 m pasa)', { wet: wet.r, step: step.rOut }); // pas mokrego bruku ≥ 0.5 m
  check(wet.y > 0 && wet.y <= 0.01, 'mokry bruk: y poza (0, 0.01]', wet); // nad podłogą, ale ≤ 1 cm (dysk ma nie „lewitować")
  check(collideR >= R + Bn.lip, 'koło kolizji mniejsze niż obrzeże basenu', { collideR, lip: R + Bn.lip });
  return { statueY, basinProfile, waters, bowls, columns, cap, jets, step, collideR, wet };
}

// UV LatheGeometry w metrach: u = obwód na promieniu wierzchołka / mpt, v = długość profilu do wierzchołka / mpt (kolejność wierzchołków
// LatheGeometry.js: i po segmentach, j po punktach profilu → indeks i·N + j).
function latheUv(g, pts, seg, mpt) {
  const N = pts.length, s = [0]; for (let j = 1; j < N; j++) s.push(s[j - 1] + pts[j].distanceTo(pts[j - 1]));
  const uv = g.attributes.uv;
  for (let i = 0; i <= seg; i++) for (let j = 0; j < N; j++) uv.setXY(i * N + j, (i / seg) * 2 * Math.PI * pts[j].x / mpt, s[j] / mpt);
  return g;
}

export function buildFountain(W) {
  const { ctx, CONFIG, B, mat } = W, F = CONFIG.fountain;
  if (ctx.flags.nofountain) return buildFountainLegacy(W);
  const plan = fountainPlan(CONFIG), seg = F.seg, bm = F.blockScale;
  const lathe = pts => latheUv(new THREE.LatheGeometry(pts, seg), pts, seg, bm);
  const basin = lathe(plan.basinProfile); B.add('blocks', basin);
  for (const b of plan.bowls) B.add('blocks', lathe(b.profile), M4(0, b.top, 0));
  for (const c of [...plan.columns, plan.cap]) B.place('blocks', cylinder(c.r, c.r, c.y1 - c.y0, seg, bm), 0, (c.y0 + c.y1) / 2, 0);
  const stepGeo = cylinder(plan.step.rIn, plan.step.rOut, plan.step.h, seg, bm); B.place('blocks', stepGeo, 0, plan.step.h / 2, 0);
  // kolizja z TEJ SAMEJ geometrii: AABB basenu i schodka vs koło (0,0) r = radius + collide
  basin.computeBoundingBox(); stepGeo.computeBoundingBox();
  const stepBox = stepGeo.boundingBox.clone().applyMatrix4(M4(0, plan.step.h / 2, 0));
  checkCollisionCovers('fontanna basen', basin.boundingBox, { x: 0, z: 0, r: plan.collideR });
  checkCollisionCovers('fontanna schodek', stepBox, { x: 0, z: 0, r: plan.collideR });
  ctx.addCircle(0, 0, plan.collideR); W.dbgCircle?.(0, 0, plan.collideR);
  // lustra wody: 3 dyski (basen, misa 1, misa 2) jednym kluczem water = 1 draw
  for (const wt of plan.waters) B.add('water', new THREE.CircleGeometry(wt.r, seg), M4(0, wt.y, 0, 0, -Math.PI / 2)); // rot: rx=−π/2 → normalna (0,0,1)→(0,1,0) w górę
  if (!ctx.flags.nojets) buildJets(W, plan);
  if (!ctx.flags.nowet) buildWet(W, plan);
  if (!ctx.flags.nowater) ctx.updaters.push((dt, t) => {
    if (mat.water?.normalMap) mat.water.normalMap.offset.set((t * F.water.drift[0]) % 1, (t * F.water.drift[1]) % 1);
    if (mat.jet?.map) mat.jet.map.offset.x -= dt * F.jets.speed; // uv.x biegnie wzdłuż rury (TubeGeometry.js:196) — offset.x, nie .y; malejący offset = płynięcie od startu do lądowania
    if (W.waterTime) W.waterTime.value = t;
  });
  W.fountainPlan = plan;
}

// Strumienie (TubeGeometry po krzywej planu, klucz jet), kręgi na lustrze (RingGeometry z atrybutami aCenter/aPhase dla shadera mat.ripple)
// i rozbryzg (Points z atrybutami aVel/aSeed dla shadera mat.splash; nie jest Meshem → poza W.B, jak dym w props.js).
function buildJets(W, plan) {
  const { scene, CONFIG, B, mat } = W, F = CONFIG.fountain, J = F.jets, Rp = F.ripple, Sp = F.splash;
  for (const j of plan.jets) B.add('jet', new THREE.TubeGeometry(j.curve, J.seg, J.r, J.radial, false));
  plan.jets.forEach((j, k) => { for (let q = 0; q < Rp.perJet; q++) {
    const g = new THREE.RingGeometry(Rp.rIn, Rp.rOut, Rp.seg), n = g.attributes.position.count, y = j.below.y + Rp.above;
    check(y >= j.below.y + 0.01, 'krąg na lustrze bez offsetu (K5)', { y, water: j.below.y }); // ≥ 1 cm nad lustrem
    g.setAttribute('aCenter', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [j.land.x, y, j.land.z]).flat(), 3)); // środek w świecie (geometria po Batch jest w świecie)
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Array(n).fill((k / plan.jets.length + q / Rp.perJet) % 1), 1)); // faza: rozrzut po strumieniach + co 1/perJet w jednym lądowaniu
    B.add('ripple', g, M4(j.land.x, y, j.land.z, 0, -Math.PI / 2)); // rot: rx=−π/2 → normalna (0,0,1)→(0,1,0) w górę
  } });
  const R = rng(CONFIG.seed + F.seedOffset), pos = [], vel = [], seed = [];
  for (const j of plan.jets) for (let i = 0; i < Sp.perJet; i++) {
    const d = ringDir(R.range(0, Math.PI * 2)).multiplyScalar(R.range(0.3, 1) * Sp.out); // ring: kierunek kropli w poziomie, 30–100 % prędkości bocznej
    pos.push(j.land.x, j.land.y, j.land.z); vel.push(d.x, R.range(0.5, 1) * Sp.up, d.z); seed.push(R()); // 50–100 % prędkości w górę
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  if (mat.splash) { const pts = new THREE.Points(geo, mat.splash); pts.name = 'splash'; pts.frustumCulled = false; pts.renderOrder = Sp.renderOrder; scene.add(pts); } // po wodzie i kręgach (CONFIG.renderOrderKeys)
  W.splashCount = pos.length / 3;
}

// Mokry bruk: dysk klucza wet tuż nad podłogą; UV jak podłoga (layout.js: plane 2·extent z uvOffset → UV bruku = (x + extent0)/mpt, lokalne +y → −z)
function buildWet(W, plan) {
  const { CONFIG, B, H, half } = W, F = CONFIG.fountain, mpt = CONFIG.textures.cobble.mpt;
  const extent0 = half + CONFIG.plaza.streetLength + H.depth + 6; // = extent0 w layout.js (zasięg bruku bez panoramy, 52 m) — kotwica wzoru bruku
  // dwie części: pełny dysk do rFull (alfa 1) + pierścień rFull→r z alfą 1→0. CircleGeometry ma wierzchołki TYLKO w środku i na obwodzie, więc alfa
  // jednego dysku interpolowałaby się liniowo od środka (cykl 3: w paśmie 4.4–5.2 alfa 0.15→0 = pas znikał); pierścień daje wierzchołki na rFull.
  check(F.wet.rFull > plan.step.rOut && F.wet.rFull < F.wet.r, 'mokry bruk: rFull poza (schodek, r)', { rFull: F.wet.rFull, step: plan.step.rOut, r: F.wet.r });
  for (const g of [new THREE.CircleGeometry(F.wet.rFull, F.wet.seg), new THREE.RingGeometry(F.wet.rFull, F.wet.r, F.wet.seg, 1)]) {
    const uv = g.attributes.uv, p = g.attributes.position, rgba = [];
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (p.getX(i) + extent0) / mpt, (p.getY(i) + extent0) / mpt);
      const r = Math.hypot(p.getX(i), p.getY(i)), a = THREE.MathUtils.clamp((F.wet.r - r) / (F.wet.r - F.wet.rFull), 0, 1); // alfa 1 do rFull, 0 na r (mat.wet: transparent + vertexColors RGBA)
      rgba.push(1, 1, 1, a);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
    B.add('wet', g, M4(0, plan.wet.y, 0, 0, -Math.PI / 2)); // rot: rx=−π/2 → dysk w XZ, normalna w górę, lokalne +y → −z jak podłoga
  }
}

// Stara fontanna (HEAD db39bc2, ?nofountain=1): ośmiokątna cembrowina, gruba kolumna, jedno lustro. Zostaje do bisekcji na telefonie.
function buildFountainLegacy(W) {
  const { ctx, scene, CONFIG, B, mat } = W;
  const F = CONFIG.fountain, r = F.radius, bm = F.blockScale, colH = 1.6; // dawny columnHeight 1.6 (posąg z props.js stanie 0.8 m nad kapitelem — tryb diagnostyczny)
  B.place('blocks', cylinder(r, r + 0.1, F.rim, 8, bm), 0, F.rim / 2, 0); // jak HEAD
  B.place('blocks', cylinder(r + 0.25, r + 0.25, 0.14, 8, bm), 0, F.rim + 0.07, 0); // jak HEAD
  B.place('blocks', cylinder(0.7, 0.85, colH, 8, bm), 0, F.rim + colH / 2, 0); // jak HEAD
  B.place('blocks', cylinder(1.2, 1.0, 0.3, 8, bm), 0, F.rim + colH + 0.15, 0); // jak HEAD
  B.place('blocks', cylinder(r + 1.1, r + 1.2, 0.18, 8, bm), 0, 0.09, 0); // schodek jak HEAD
  ctx.addCircle(0, 0, r + 1.0); // jak HEAD
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.05, 32), mat.water); // jak HEAD
  water.rotation.x = -Math.PI / 2; water.position.y = F.rim - 0.1; water.receiveShadow = true; // jak HEAD; rot: rx=−π/2 → normalna w górę
  scene.add(water);
  if (!ctx.flags.nowater) ctx.updaters.push((dt, t) => { mat.water.normalMap.offset.set((t * F.water.drift[0]) % 1, (t * F.water.drift[1]) % 1); });
}
