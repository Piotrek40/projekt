// Test numeryczny geometrii rynku BEZ przeglądarki: uruchamia prawdziwe moduły sceny (layout, buildings, stalls, tower) ze stubem
// kontekstu i sprawdza asercje przestrzenne na faktycznych macierzach (klasy błędów z przestrzen.md §3: znak obrotu, lico vs środek,
// kolizja vs bryła, 4 strony pierzei). Uruchom: bash audyt/testy/geo_test.sh (= bundle geo/entry.mjs → geo/scene.bundle.mjs + ten test)
// albo komendą z rynek/PROMPT.md §3.4. Exit 1 przy FAIL. Nową cechę dopisujesz jako nową asercję (najpierw skalibrowaną na znanym-dobrym przypadku).
import { THREE, M4, rng, CONFIG, buildLayout, buildHouses, buildStalls, buildTower, buildSkyline, skylinePlan, checkFailures } from './geo/scene.bundle.mjs';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f2 = v => v.toArray().map(x => +x.toFixed(2));
function makeW() {
  const rec = [];
  const B = { add(key, g, m) { g.computeBoundingBox(); rec.push({ key, bb: g.boundingBox.clone(), m: m ? m.clone() : new THREE.Matrix4() }); },
              place(key, g, x, y, z, ry = 0, rx = 0, rz = 0) { this.add(key, g, M4(x, y, z, ry, rx, rz)); } };
  const col = { rects: [], circles: [] };
  const ctx = { addWalkable() {}, addRect: (x, z, hw, hd) => col.rects.push({ x, z, hw, hd }), addCircle: (x, z, r) => col.circles.push({ x, z, r }), flags: {}, updaters: [] };
  return { W: { ctx, R: rng(CONFIG.seed), CONFIG, P: CONFIG.palette, T: CONFIG.textures, H: CONFIG.house, S: CONFIG.plaza.size, half: CONFIG.plaza.size / 2, B, mat: {}, scene: { add() {} } }, rec, col };
}
const fails = [], notes = [];
const { W, rec, col } = makeW();
buildLayout(W);
const H = W.H;
// A) każda strona pierzei: lokalne +z patrzy na środek placu (test symetrii 4 stron)
for (const side of [0, 1, 2, 3]) {
  const t = W.sideTransform(side, 3);
  const n = V(0, 0, 1).transformDirection(M4(0, 0, 0, t.ry));
  if (n.dot(V(-t.x, 0, -t.z).normalize()) < 0.98) fails.push(`A: front strony ${side} nie patrzy na plac`);
}
// B) domy pojedynczo (izolacja: buildHouses na liście z jednym domem)
const allHouses = W.houses;
let nWin = 0, nRoof = 0;
for (const h of allHouses) {
  const n0 = rec.length; W.houses = [h]; buildHouses(W);
  const items = rec.slice(n0);
  const t = W.sideTransform(h.side, h.along, h.setback), inv = M4(t.x, 0, t.z, t.ry).invert();
  const loc = r => ({ ...r, ml: r.m.clone().premultiply(inv) }); // macierz w układzie domu
  const L = items.map(loc);
  const floors = L.filter(r => r.key.startsWith('plaster') && r.bb.max.y - r.bb.min.y > 2 && Math.abs(r.ml.elements[0] - 1) < 1e-6 && Math.abs(r.bb.min.z + r.bb.max.z) < 1e-6 && r.bb.max.x > 2.5)
    .map(r => { const c = V(0, 0, 0).applyMatrix4(r.ml); return { face: c.z + r.bb.max.z, y0: c.y + r.bb.min.y, y1: c.y + r.bb.max.y }; });
  // B1) okna i ramy: LICO PRZEDNIE elementu >= lico ściany kondygnacji + 0.005 (element wystaje, nie jest schowany)
  for (const r of L) {
    if (!(r.key.startsWith('glass') || r.key === 'timber')) continue;
    const c = V(0, 0, 0).applyMatrix4(r.ml), depth = r.bb.max.z - r.bb.min.z;
    if (Math.abs(r.ml.elements[0] - 1) > 1e-6 || Math.abs(r.ml.elements[5] - 1) > 1e-6) continue; // tylko elementy bez obrotu (okna, ramy, belki fasady)
    if (depth > 0.5) continue; // belki stropowe pod wykuszem — z założenia wchodzą w ścianę
    const fl = floors.find(fl => c.y > fl.y0 + 0.05 && c.y < fl.y1 - 0.05 && Math.abs(c.z - fl.face) < 0.3);
    if (!fl) continue; nWin++;
    if (c.z + depth / 2 < fl.face + 0.005) fails.push(`B1 dom side=${h.side} along=${h.along.toFixed(1)}: ${r.key} lico ${(c.z + depth / 2).toFixed(3)} < ściana ${fl.face.toFixed(3)}`);
  }
  // B2) połacie: krawędź połaci przy kalenicy ma być WYŻEJ niż krawędź przy okapie
  for (const r of L.filter(r => r.key.startsWith('roof') && r.bb.max.y - r.bb.min.y < 0.2)) {
    const isGable = h.gableFront && r.bb.max.z > 3; // szczyt od placu: spadek wzdłuż x
    const isDormer = r.bb.max.x < 1;                 // daszek lukarny: spadek wzdłuż z, okap z przodu
    const axis = isGable ? 'x' : 'z';
    const half = r.bb.max[axis];
    const a = V(0, 0, 0).setComponent(axis === 'x' ? 0 : 2, -half).applyMatrix4(r.ml), b = V(0, 0, 0).setComponent(axis === 'x' ? 0 : 2, half).applyMatrix4(r.ml);
    const c = V(0, 0, 0).applyMatrix4(r.ml);
    nRoof++;
    let ridgeEnd, eaveEnd;
    if (isDormer) { [eaveEnd, ridgeEnd] = a.z > b.z ? [a, b] : [b, a]; } // okap lukarny = koniec bliżej frontu
    else { const ridge = isGable ? 0 : (h.jetty ? (h.floors - 1) * H.jetty / 2 : 0); const da = Math.abs(a[axis] - ridge), db = Math.abs(b[axis] - ridge); [ridgeEnd, eaveEnd] = da < db ? [a, b] : [b, a]; }
    if (ridgeEnd.y <= eaveEnd.y) fails.push(`B2 dom side=${h.side} along=${h.along.toFixed(1)} ${isDormer ? 'LUKARNA' : isGable ? 'szczyt' : 'połać'}: kalenica y=${ridgeEnd.y.toFixed(2)} <= okap y=${eaveEnd.y.toFixed(2)} (środek ${f2(c)}) — ODWRÓCONY ZNAK OBROTU`);
  }
  // B3) kolizja: obrys parteru w świecie zawarty w prostokącie kolizji
  const stone = items.find(r => r.key === 'stone' && r.bb.max.y - r.bb.min.y > 3); const wb = stone.bb.clone().applyMatrix4(stone.m);
  if (!col.rects.some(rc => wb.min.x >= rc.x - rc.hw - 0.05 && wb.max.x <= rc.x + rc.hw + 0.05 && wb.min.z >= rc.z - rc.hd - 0.05 && wb.max.z <= rc.z + rc.hd + 0.05)) fails.push(`B3 parter bez kolizji: ${f2(wb.min)}..${f2(wb.max)}`);
  // B4) nic nie wisi: każdy element ma dolną krawędź <= 0.05 nad ziemią ALBO styka się (w pionie) z innym elementem domu — uproszczenie: najniższy element domu stoi na ziemi
}
W.houses = allHouses;
const lowest = Math.min(...rec.filter(r => r.key === 'stone').map(r => r.bb.clone().applyMatrix4(r.m).min.y));
if (Math.abs(lowest) > 0.01) fails.push(`B4 najniższy parter nie stoi na ziemi: y=${lowest}`);
// C) kramy: rogi słupów vs koło kolizji (uwzględniając promień gracza 0.35)
buildStalls(W);
for (const s of W.stalls) {
  const c = col.circles.find(c => Math.hypot(c.x - s.x, c.z - s.z) < 1e-6);
  const maxD = Math.max(...[[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].map(([lx, lz]) => { const p = V(lx, 0, lz).applyMatrix4(M4(s.x, 0, s.z, s.ry)); return Math.hypot(p.x - s.x, p.z - s.z); }));
  if (maxD > c.r + 0.35) fails.push(`C kram (${s.x.toFixed(1)},${s.z.toFixed(1)}): słup ${maxD.toFixed(2)} m od środka, koło ${c.r}+0.35`);
  else if (maxD > c.r) notes.push(`C kram (${s.x.toFixed(1)},${s.z.toFixed(1)}): róg słupa ${maxD.toFixed(2)} m > koło ${c.r} m (gracz wchodzi 0.10 m w słup — tolerowane)`);
}
// D) wieża: okna na zewnątrz bryły
const n1 = rec.length; buildTower(W);
const twr = rec.slice(n1).find(r => r.key === 'slates'), tb = twr.bb.clone().applyMatrix4(twr.m);
for (const r of rec.slice(n1).filter(r => r.key.startsWith('glass'))) {
  const c = V(0, 0, 0).applyMatrix4(r.m), n = V(0, 0, 1).transformDirection(r.m), outwardOfBox = V(Math.sign(c.x - (tb.min.x + tb.max.x) / 2), 0, Math.sign(c.z - (tb.min.z + tb.max.z) / 2));
  const onFace = Math.abs(Math.abs(c.x - (tb.min.x + tb.max.x) / 2) - (tb.max.x - tb.min.x) / 2) < 0.05 || Math.abs(Math.abs(c.z - (tb.min.z + tb.max.z) / 2) - (tb.max.z - tb.min.z) / 2) < 0.05;
  if (!onFace) fails.push(`D okno wieży nie na licu: ${f2(c)}`);
  if (n.dot(outwardOfBox) <= 0) fails.push(`D okno wieży odwrócone do środka: ${f2(c)} n=${f2(n)}`);
}
// S) panorama (skyline.js): plan z funkcji czystej skylinePlan + bryły z buildSkyline (ten sam rejestrator B)
{
  const half = W.half, houseRects = col.rects.slice(); // prostokąty kolizji domów pierzei (z buildHouses, w tym domy zamykające ulice)
  const n3 = rec.length; buildSkyline(W);
  const sky = rec.slice(n3), plan = W.skylinePlan, SK = CONFIG.skyline;
  const boxXZ = (r) => { const b = r.bb.clone().applyMatrix4(r.m); return new THREE.Box2(new THREE.Vector2(b.min.x, b.min.z), new THREE.Vector2(b.max.x, b.max.z)); };
  // S1) domy tła: 6–8 na pierzeję, za tyłem pierzei (half + depth + 0.3), poza domem zamykającym (krawędź sw/2 + depth + streetClear), bez wzajemnych przecięć
  for (let side = 0; side < 4; side++) { const n = plan.houses.filter(h => h.side === side).length; if (n < 6 || n > 8) fails.push(`S1 strona ${side}: ${n} domów tła (ma być 6–8)`); }
  const inner = W.sw / 2 + H.depth + SK.secondLine.streetClear;
  for (const h of plan.houses) {
    const near = half + H.depth / 2 + h.setback - h.d / 2;
    if (near < half + H.depth + 0.3) fails.push(`S1 dom tła s${h.side} along=${h.along.toFixed(1)}: ściana ${near.toFixed(2)} m < tył pierzei ${(half + H.depth + 0.3).toFixed(1)}`);
    if (Math.abs(h.along) - h.w / 2 < inner - 0.01) fails.push(`S1 dom tła s${h.side} along=${h.along.toFixed(1)}: krawędź ${(Math.abs(h.along) - h.w / 2).toFixed(2)} < ${inner} (dom zamykający ulicę)`);
    if (h.ridgeY < SK.secondLine.ridgeMin - 0.01 || h.ridgeY > SK.secondLine.ridgeMax + 0.01) fails.push(`S1 dom tła: kalenica ${h.ridgeY.toFixed(2)} poza ${SK.secondLine.ridgeMin}–${SK.secondLine.ridgeMax}`);
    for (const rc of houseRects) if (h.box.intersectsBox(new THREE.Box2(new THREE.Vector2(rc.x - rc.hw + 0.01, rc.z - rc.hd + 0.01), new THREE.Vector2(rc.x + rc.hw - 0.01, rc.z + rc.hd - 0.01)))) fails.push(`S1 dom tła s${h.side} along=${h.along.toFixed(1)} przecina dom pierzei (${rc.x}, ${rc.z})`);
  }
  for (let i = 0; i < plan.houses.length; i++) for (let j = i + 1; j < plan.houses.length; j++) if (plan.houses[i].box.intersectsBox(plan.houses[j].box)) fails.push(`S1 domy tła #${i}/#${j} przecinają się`);
  // S2) połacie domów tła: koniec bliżej środka domu (kalenica) wyżej niż koniec dalszy (okap) — oś spadku z macierzy (e[1] ≠ 0 → rz, spadek wzdłuż x)
  let nSlab = 0;
  for (const r of sky.filter(r => r.key.startsWith('roof') && r.bb.max.y - r.bb.min.y < 0.2)) {
    const e = r.m.elements, axis = Math.abs(e[1]) > 1e-6 ? 'x' : 'z', hl = r.bb.max[axis];
    const a = V(0, 0, 0).setComponent(axis === 'x' ? 0 : 2, -hl).applyMatrix4(r.m), b = V(0, 0, 0).setComponent(axis === 'x' ? 0 : 2, hl).applyMatrix4(r.m);
    const c = V(0, 0, 0).applyMatrix4(r.m);
    const h = plan.houses.reduce((best, h) => { const t = W.sideTransform(h.side, h.along, h.setback), d = Math.hypot(t.x - c.x, t.z - c.z); return d < best.d ? { d, t } : best; }, { d: 1e9 }).t;
    const [ridge, eave] = Math.hypot(a.x - h.x, a.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? [a, b] : [b, a];
    nSlab++;
    if (ridge.y <= eave.y + 0.5) fails.push(`S2 połać domu tła: kalenica y=${ridge.y.toFixed(2)} <= okap y=${eave.y.toFixed(2)} (środek ${f2(c)}) — ODWRÓCONY ZNAK OBROTU`);
  }
  // S3) bramy: każdy element blocks z bb.min.y < 2 (filary, baszty) ma środek w prostokącie/kole kolizji; łuk (bez kolizji) ≥ 2 m nad ulicą; brama między tyłem pierzei a domem zamykającym
  for (const r of sky.filter(r => r.key === 'blocks')) {
    const wb = r.bb.clone().applyMatrix4(r.m), cx = (wb.min.x + wb.max.x) / 2, cz = (wb.min.z + wb.max.z) / 2;
    const dist = Math.max(Math.abs(cx), Math.abs(cz));
    if (dist < half + H.depth + 0.5 || dist > half + W.sl - 1) fails.push(`S3 element bramy ${f2(wb.min)}..${f2(wb.max)}: odległość ${dist.toFixed(1)} poza (${half + H.depth + 0.5}, ${half + W.sl - 1})`);
    if (wb.min.y >= 2) continue;
    const covered = col.rects.some(rc => Math.abs(cx - rc.x) <= rc.hw + 0.05 && Math.abs(cz - rc.z) <= rc.hd + 0.05) || col.circles.some(c => Math.hypot(cx - c.x, cz - c.z) <= c.r + 0.05);
    if (!covered) fails.push(`S3 element bramy bez kolizji (B6): środek (${cx.toFixed(2)}, ${cz.toFixed(2)}), min.y ${wb.min.y.toFixed(2)}`);
  }
  // S4) wieże w oddali: 60–110 m od środka, na gruncie (groundExtent − 5); ptaki 20–40 m nad placem
  for (const t of plan.towers) if (t.dist < 60 || t.dist > 110) fails.push(`S4 wieża ${t.i}: ${t.dist} m poza 60–110`);
  const reach = Math.max(...sky.filter(r => r.key === 'far').map(r => { const b = r.bb.clone().applyMatrix4(r.m); return Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)); }));
  if (reach > SK.groundExtent - 2) fails.push(`S4 wieże w oddali sięgają ${reach.toFixed(1)} m > bruk ${SK.groundExtent} − 2 (kwadrat, max-norma)`);
  const ridgeTop = H.groundFloor + (H.floorsMax - 1) * H.floorHeight + ((H.depth + (H.floorsMax - 1) * H.jetty) / 2) * Math.tan(H.roofPitch); // najwyższa kalenica pierzei (13.95 m na HEAD)
  for (const b of plan.birds) if (b.y < ridgeTop || b.y > 40) fails.push(`S4 ptak y=${b.y.toFixed(1)} poza ${ridgeTop.toFixed(2)}–40 (pod kalenicami / poza kadrem)`);
  const lowestSky = Math.min(...sky.map(r => r.bb.clone().applyMatrix4(r.m).min.y));
  if (lowestSky < -0.01) fails.push(`S4 element panoramy pod ziemią: y=${lowestSky.toFixed(3)}`);
  console.log(`panorama: domów tła ${plan.houses.length}, połaci ${nSlab}, elementów bram ${sky.filter(r => r.key === 'blocks').length}, wież w oddali ${plan.towers.length}, ptaków ${plan.birds.length}`);
}
// E) asercje CHECK z modułów sceny (engine/src/check.js): w przeglądarce idą do results.errors renderu, tu liczą się jako FAIL
if (checkFailures() > 0) fails.push(`E: ${checkFailures()} nieudanych asercji CHECK w modułach sceny (linie "CHECK:" wyżej)`);
console.log(`sprawdzono: okien/ram ${nWin}, połaci ${nRoof}, domów ${allHouses.length}, kramów ${W.stalls.length}, asercji CHECK nieudanych ${checkFailures()}`);
notes.forEach(n => console.log('uwaga:', n));
console.log(fails.length ? `FAIL (${fails.length}):\n` + fails.join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
