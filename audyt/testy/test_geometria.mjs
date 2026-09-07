// Test numeryczny geometrii rynku BEZ przeglądarki: uruchamia prawdziwe moduły sceny (layout, buildings, stalls, tower) ze stubem
// kontekstu i sprawdza asercje przestrzenne na faktycznych macierzach (klasy błędów z przestrzen.md §3: znak obrotu, lico vs środek,
// kolizja vs bryła, 4 strony pierzei). Uruchom: bash audyt/testy/geo_test.sh (= bundle geo/entry.mjs → geo/scene.bundle.mjs + ten test)
// albo komendą z rynek/PROMPT.md §3.4. Exit 1 przy FAIL. Nową cechę dopisujesz jako nową asercję (najpierw skalibrowaną na znanym-dobrym przypadku).
import { THREE, M4, rng, CONFIG, buildLayout, buildHouses, buildStalls, buildTower, buildSkyline, skylinePlan, buntingCurves, buildBunting, fountainPlan, buildFountain, checkFailures } from './geo/scene.bundle.mjs';
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
// G) girlandy (bunting.js): funkcja czysta buntingCurves + bryły z buildBunting (ten sam rejestrator B)
{
  const C = CONFIG.bunting, lines = buntingCurves(W);
  if (lines.length !== C.lines) fails.push(`G: ${lines.length} lin zamiast ${C.lines}`);
  for (const ln of lines) {
    const m = ln.curve.getPoint(0.5), id = `G lina (${f2(ln.A)})→(${f2(ln.B)})`;
    if (Math.abs(m.y - (ln.A.y - ln.zwis)) >= 0.01) fails.push(`${id}: środek y=${m.y.toFixed(3)} ≠ A.y − zwis = ${(ln.A.y - ln.zwis).toFixed(3)}`);
    if (m.y < C.minY) fails.push(`${id}: środek y=${m.y.toFixed(2)} < ${C.minY} (za nisko)`);
    if (Math.abs(ln.A.y - ln.B.y) > 1e-6) fails.push(`${id}: końce na różnych wysokościach ${ln.A.y} / ${ln.B.y}`);
    if (ln.zwis < C.sagMin - 1e-6 && ln.zwis < ln.A.y - C.minY - 1e-6) fails.push(`${id}: zwis ${ln.zwis.toFixed(2)} poza zakresem`);
    if (ln.zwis > C.sagMax + 1e-6) fails.push(`${id}: zwis ${ln.zwis.toFixed(2)} > sagMax`);
    let minY = 1e9; for (let i = 0; i <= 64; i++) minY = Math.min(minY, ln.curve.getPoint(i / 64).y);
    if (minY < C.minY - 1e-6) fails.push(`${id}: najniższy punkt liny ${minY.toFixed(3)} < ${C.minY}`);
    // kotwice: koniec liny przed licem piętra (K4) i we właściwej ćwiartce (lina rozpięta między przeciwległymi pierzejami)
    for (const a of ln.anchors) {
      const n = V(0, 0, 1).transformDirection(M4(0, 0, 0, a.tr.ry)), d = a.P.clone().sub(a.face).dot(n);
      if (Math.abs(d - C.hook.out) > 0.01) fails.push(`${id}: kotwica s${a.side} ${d.toFixed(3)} m przed licem (ma być ${C.hook.out})`);
      const distC = Math.max(Math.abs(a.P.x), Math.abs(a.P.z));
      if (distC < W.half - 1 || distC > W.half + H.depth) fails.push(`${id}: kotwica s${a.side} ${distC.toFixed(2)} m od środka — nie na fasadzie (${W.half - 1}–${W.half + H.depth})`);
      if (a.y > C.y + 1e-6 || a.y < C.y - 1) fails.push(`${id}: kotwica y=${a.y.toFixed(2)} poza [${C.y - 1}, ${C.y}]`);
    }
    if (ln.anchors[0].side % 2 !== ln.anchors[1].side % 2 || ln.anchors[0].side === ln.anchors[1].side) fails.push(`${id}: strony ${ln.anchors[0].side}/${ln.anchors[1].side} nie są przeciwległe`);
    for (const p of ln.lanterns) if (p.y - C.lantern.r < C.lantern.minY) fails.push(`${id}: lampion spód ${(p.y - C.lantern.r).toFixed(2)} < ${C.lantern.minY}`);
    // środek placu wolny (posąg 5.3 m): żaden punkt liny w promieniu 2.5 m od (0,0)
    for (let i = 0; i <= 64; i++) { const p = ln.curve.getPoint(i / 64); if (Math.hypot(p.x, p.z) < 2.5) { fails.push(`${id}: lina nad posągiem (${f2(p)})`); break; } }
  }
  const n4 = rec.length; buildBunting(W); const bun = rec.slice(n4);
  const keys = {}; for (const r of bun) keys[r.key] = (keys[r.key] || 0) + 1;
  if ((keys.bunting || 0) !== lines.length) fails.push(`G: geometrii bunting ${keys.bunting} ≠ lin ${lines.length}`);
  if ((keys.paperLit || 0) !== lines.length * C.lantern.count) fails.push(`G: lampionów ${keys.paperLit} ≠ ${lines.length * C.lantern.count}`);
  const lowest = Math.min(...bun.map(r => r.bb.clone().applyMatrix4(r.m).min.y));
  if (lowest < C.lantern.minY - 0.01) fails.push(`G: element girlandy poniżej ${C.lantern.minY}: y=${lowest.toFixed(2)}`);
  console.log(`girlandy: lin ${lines.length}, zwisy ${lines.map(l => l.zwis.toFixed(2)).join('/')}, y lin ${lines.map(l => l.A.y.toFixed(1)).join('/')}, lampionów ${keys.paperLit || 0}, elementów iron ${keys.iron || 0}, najniższy element ${lowest.toFixed(2)} m`);
}
// F) fontanna 3-poziomowa (fountain.js): plan z funkcji czystej fountainPlan + bryły z buildFountain (ten sam rejestrator B; stub W.mat = {} → bez Points)
{
  const F = CONFIG.fountain, plan = fountainPlan(CONFIG), n5 = rec.length; buildFountain(W); const fo = rec.slice(n5);
  const wb = r => r.bb.clone().applyMatrix4(r.m);
  // F1) posąg: krawędź górnej misy = rim + columnHeight (props.js stawia posąg na rim + columnHeight + 0.35); płyta kończy się dokładnie na spodzie posągu
  if (Math.abs(plan.bowls.at(-1).top - (F.rim + F.columnHeight)) > 1e-6) fails.push(`F1 górna misa ${plan.bowls.at(-1).top} ≠ rim + columnHeight ${F.rim + F.columnHeight}`);
  if (Math.abs(plan.cap.y1 - (F.rim + F.columnHeight + 0.35)) > 1e-6) fails.push(`F1 płyta kończy się na ${plan.cap.y1}, posąg (props.js) na ${F.rim + F.columnHeight + 0.35}`);
  const capTop = Math.max(...fo.filter(r => r.key === 'blocks').map(r => wb(r).max.y));
  if (Math.abs(capTop - plan.statueY) > 1e-6) fails.push(`F1 najwyższy element blocks ${capTop.toFixed(3)} ≠ spód posągu ${plan.statueY}`);
  // F2) lustra: 3 dyski klucza water, normalna w górę, y między dnem + 0.05 a krawędzią − 0.02, promień < r wewnętrzny
  const waters = fo.filter(r => r.key === 'water');
  if (waters.length !== plan.waters.length || waters.length !== 1 + F.bowls.length) fails.push(`F2 luster ${waters.length} ≠ ${1 + F.bowls.length}`);
  for (const r of waters) { const n = V(0, 0, 1).transformDirection(r.m); if (n.y < 0.99) fails.push(`F2 lustro z normalną ${f2(n)} (nie w górę)`); }
  for (const wt of plan.waters) if (wt.y < wt.floor + 0.05 || wt.y > wt.rimY - 0.02 || wt.r >= wt.rIn) fails.push(`F2 lustro y=${wt.y} r=${wt.r} poza misą (dno ${wt.floor}, krawędź ${wt.rimY}, r wewn. ${wt.rIn})`);
  // F3) strumienie: 8 + 4, start na krawędzi misy, koniec na lustrze niżej, łuk (apex ≥ start + 0.05), lądowanie 0.15 od ściany i od kolumny; geometrii jet = strumieni
  if (plan.jets.length !== F.jets.count[0] + F.jets.count[1]) fails.push(`F3 strumieni ${plan.jets.length}`);
  for (const j of plan.jets) {
    const b = plan.bowls[j.tier], rl = Math.hypot(j.end.x, j.end.z);
    if (j.start.y < b.top || Math.abs(j.end.y - j.below.y) > 1e-6 || j.apex < j.start.y + 0.05) fails.push(`F3 strumień ${j.tier}/${j.a.toFixed(2)}: start ${j.start.y.toFixed(2)} (krawędź ${b.top}), koniec ${j.end.y.toFixed(2)} (lustro ${j.below.y}), apex ${j.apex.toFixed(2)}`);
    if (rl > j.below.rIn - 0.15 || rl < plan.columns[j.tier].r + 0.15) fails.push(`F3 strumień ${j.tier}: ląduje r=${rl.toFixed(2)} (woda ${plan.columns[j.tier].r}+0.15 … ${j.below.rIn}−0.15)`);
  }
  const keys = {}; for (const r of fo) keys[r.key] = (keys[r.key] || 0) + 1;
  if ((keys.jet || 0) !== plan.jets.length) fails.push(`F3 geometrii jet ${keys.jet} ≠ strumieni ${plan.jets.length}`);
  if ((keys.ripple || 0) !== plan.jets.length * F.ripple.perJet) fails.push(`F3 kręgów ${keys.ripple} ≠ strumieni × perJet ${plan.jets.length * F.ripple.perJet}`);
  for (const r of fo.filter(r => r.key === 'ripple')) { const b = wb(r), w = plan.waters.find(w => Math.abs(b.min.y - (w.y + F.ripple.above)) < 1e-3); if (!w) fails.push(`F3 krąg na y=${b.min.y.toFixed(3)} — nie 0.01 nad żadnym lustrem`); }
  // F4) kolizja (B6): koło w (0,0) r ≥ radius + collide; każdy element poza cobble|wet z min.y < 2 ma środek w tym kole; najniższy element ≥ 0 (schodek na bruku)
  const c0 = col.circles.find(c => Math.abs(c.x) < 1e-6 && Math.abs(c.z) < 1e-6);
  if (!c0 || c0.r < F.radius + F.collide - 1e-6) fails.push(`F4 brak koła kolizji fontanny r ≥ ${F.radius + F.collide}`);
  for (const r of fo.filter(r => r.key !== 'wet')) { const b = wb(r); if (b.min.y < 2 && c0 && Math.hypot((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2) > c0.r) fails.push(`F4 element ${r.key} poza kolizją`); }
  const lowest = Math.min(...fo.map(r => wb(r).min.y));
  if (lowest < -0.01) fails.push(`F4 element fontanny pod ziemią: y=${lowest.toFixed(3)}`);
  const stepR = Math.max(...fo.filter(r => r.key === 'blocks').map(r => wb(r).max.x));
  if (stepR > c0.r + F.step.outer - F.collide + 1e-6) fails.push(`F4 schodek r=${stepR.toFixed(2)} dalej niż kolizja + 0.2`);
  // F5) mokry bruk: 2 części wet (dysk do rFull + pierścień rFull→r), zasięg r > schodek + 0.5, 0 < y ≤ 0.01, normalna w górę
  const wet = fo.filter(r => r.key === 'wet');
  if (wet.length !== 2) fails.push(`F5 części wet ${wet.length} (ma być dysk + pierścień)`);
  const wetR = Math.max(...wet.map(r => wb(r).max.x));
  if (wetR <= stepR + 0.5 || Math.abs(wetR - F.wet.r) > 1e-3) fails.push(`F5 wet zasięg r=${wetR.toFixed(2)} (schodek ${stepR.toFixed(2)}, CONFIG ${F.wet.r})`);
  for (const r of wet) { const b = wb(r), n = V(0, 0, 1).transformDirection(r.m); if (b.min.y <= 0 || b.min.y > 0.01 || n.y < 0.99) fails.push(`F5 wet y=${b.min.y.toFixed(3)} n=${f2(n)}`); }
  console.log(`fontanna: spód posągu ${plan.statueY.toFixed(2)} m, misy krawędź ${plan.bowls.map(b => b.top.toFixed(2)).join('/')}, lustra y ${plan.waters.map(w => w.y.toFixed(2)).join('/')} r ${plan.waters.map(w => w.r.toFixed(2)).join('/')}, strumieni ${plan.jets.length} (apex ${plan.jets.map(j => j.apex.toFixed(2)).filter((v, i, a) => a.indexOf(v) === i).join('/')}), elementów blocks ${keys.blocks}, water ${keys.water}, jet ${keys.jet}, ripple ${keys.ripple}, wet ${keys.wet}, najniższy ${lowest.toFixed(2)} m`);
}
// E) asercje CHECK z modułów sceny (engine/src/check.js): w przeglądarce idą do results.errors renderu, tu liczą się jako FAIL
if (checkFailures() > 0) fails.push(`E: ${checkFailures()} nieudanych asercji CHECK w modułach sceny (linie "CHECK:" wyżej)`);
console.log(`sprawdzono: okien/ram ${nWin}, połaci ${nRoof}, domów ${allHouses.length}, kramów ${W.stalls.length}, asercji CHECK nieudanych ${checkFailures()}`);
notes.forEach(n => console.log('uwaga:', n));
console.log(fails.length ? `FAIL (${fails.length}):\n` + fails.join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
