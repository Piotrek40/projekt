// Test numeryczny geometrii rynku BEZ przeglądarki: uruchamia prawdziwe moduły sceny (layout, buildings, stalls, tower) ze stubem
// kontekstu i sprawdza asercje przestrzenne na faktycznych macierzach (klasy błędów z przestrzen.md §3: znak obrotu, lico vs środek,
// kolizja vs bryła, 4 strony pierzei). Uruchom: bash audyt/testy/geo_test.sh (= bundle geo/entry.mjs → geo/scene.bundle.mjs + ten test)
// albo komendą z rynek/PROMPT.md §3.4. Exit 1 przy FAIL. Nową cechę dopisujesz jako nową asercję (najpierw skalibrowaną na znanym-dobrym przypadku).
import { THREE, M4, rng, CONFIG, buildLayout, buildHouses, buildStalls, buildTower, buildCart, signMatrix, signPlacements, smokerChimneys, treePlacements, buildTrees, stallPlacements, yawFrom, stallGoodsPlan, buildStallGoods, buildSkyline, skylinePlan, buntingCurves, buildBunting, clockClearance, fountainPlan, buildFountain, poiPlan, poiInView, greeneryPlan, buildGreenery, checkFailures } from './geo/scene.bundle.mjs';
// Znane wady HEAD (B6): element w obszarze chodzenia bez kolizji — lista ma się KURCZYĆ (kto dotyka modułu, naprawia i usuwa wpis). Dopasowanie: klucz + środek AABB ± 0,1 m.
const KNOWN_B6 = []; // dyszel wozu (2 wpisy z 2026-09-07) usunięty 2026-09-08: buildCart dodaje koło L(−2,2, 0, 0) r 0,6 pod dyszlem (poprawka r1 reżyserii, wóz na (4,9, 11,3))
// Znane wady HEAD (B5b ii): okna lukarn zakopane w połaci (buildings.js blok „lukarna" na HEAD: spód okna 0,44 m POD wierzchem płyty) — usuwa motyw #12 (lukarny NA połaci).
const KNOWN_B5B = []; // 10 lukarn HEAD usunięte 2026-09-07 przez motyw #12a (lukarny NA połaci: spód okna +0,10 nad wierzchem płyty)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Wierzch powierzchni dachu nad punktem (x, z) w układzie domu: najwyższe przecięcie pionu z trójkątami elementów roof* (pos z rejestratora, macierz ml) — null poza połacią (B7, B5c)
function roofSurfaceY(L, x, z) {
  const ray = new THREE.Ray(V(x, 1000, z), V(0, -1, 0)), a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), hit = V(0, 0, 0);
  let best = null;
  for (const r of L) {
    if (!r.pos) continue;
    for (let i = 0; i < r.pos.length; i += 9) {
      a.set(r.pos[i], r.pos[i + 1], r.pos[i + 2]).applyMatrix4(r.ml); b.set(r.pos[i + 3], r.pos[i + 4], r.pos[i + 5]).applyMatrix4(r.ml); c.set(r.pos[i + 6], r.pos[i + 7], r.pos[i + 8]).applyMatrix4(r.ml);
      if (ray.intersectTriangle(a, b, c, false, hit) && (best === null || hit.y > best)) best = hit.y;
    }
  }
  return best;
}
// Bryły modeli towaru kramów (motyw #11, asercja J): bboxMin/bboxMax z `gltf-transform inspect rynek/assets/models_jpg/<n>.glb` (2026-09-08) — stub 1×1×1 m dawałby
// fałszywe FAIL asercji „wystaje poza blat" / „poza kołem kolizji" (kosz 1,3 m na ladzie 1,0 m); pozostałe modele nadal ze stubem.
const WICKER1 = [[-0.192, -0.001, -0.147], [0.191, 0.116, 0.147]];   // wicker_basket_01: gltf-transform inspect rynek/assets/models_jpg (2026-09-08), płaski kosz 0,38 × 0,29 × 0,12 m
const GOODS_BOUNDS = {
  hamburger_buns: [[-0.199, 0, -0.049], [0.198, 0.063, 0.065]], food_pears_asian_01: [[-0.08, 0, -0.101], [0.046, 0.071, 0.066]], ceramic_pot: [[-0.328, -0.001, -0.251], [0.328, 0.371, 0.251]],
  brass_pot_01: [[-0.151, -0.001, -0.151], [0.151, 0.29, 0.151]], brass_vase_01: [[-0.114, 0.001, -0.114], [0.114, 0.694, 0.114]], wicker_basket_02: [[-0.108, 0, -0.145], [0.239, 0.2, 0.109]],
  wooden_bowl_01: [[-0.157, 0.001, -0.154], [0.156, 0.094, 0.155]], ceramic_vase_01: [[-0.102, 0.001, -0.101], [0.102, 0.401, 0.102]], ceramic_vase_02: [[-0.109, 0.001, -0.109], [0.109, 0.31, 0.109]],
  wine_bottles_01: [[-0.036, 0, -0.04], [0.64, 0.331, 0.04]], wine_barrel_01: [[-0.371, 0.002, -0.371], [0.371, 0.871, 0.381]], wooden_crate_01: [[-0.413, -0.008, -0.196], [0.413, 0.342, 0.213]], Barrel_01: [[-0.282, -0.007, -0.282], [0.282, 0.873, 0.282]],
  wicker_basket_01: WICKER1,   // kosz pierwszego planu (poprawka r1: CONFIG.props.cart.foreground) — bryła z gltf-transform inspect 2026-09-08
};
// Bryły modeli zieleni (motyw #greenery, asercja K2): gltf-transform inspect rynek/assets/models_jpg/<n>.glb (2026-09-08) — stub 1×1×1 dawałby fałszywe FAIL
// (krzew ×3 = 3 m, ławka 1 m głęboka w kole fontanny).
const GREENERY_BOUNDS = {
  planter_box_01: [[-0.457, 0, -0.207], [0.456, 0.425, 0.207]], shrub_04_c: [[-0.061, -0.006, -0.066], [0.061, 0.213, 0.066]], periwinkle_plant_03: [[-0.084, 0, -0.073], [0.084, 0.300, 0.073]],
  celandine_01_c: [[-0.129, -0.004, -0.093], [0.129, 0.172, 0.093]], flower_gazania_h: [[-0.169, -0.006, -0.163], [0.169, 0.159, 0.163]], painted_wooden_bench: [[-0.576, -0.001, -0.254], [0.589, 0.889, 0.243]],
};
const f2 = v => v.toArray().map(x => +x.toFixed(2));
function makeW() {
  const rec = [];
  const B = { add(key, g, m) { g.computeBoundingBox(); rec.push({ key, bb: g.boundingBox.clone(), m: m ? m.clone() : new THREE.Matrix4(), type: g.type, params: g.parameters, pos: /^roof/.test(key) ? (g.index ? g.toNonIndexed() : g).attributes.position.array.slice() : null }); }, // type/params: klasyfikacja trzonu wieży w D (box vs walec); pos: trójkąty połaci (B7: powierzchnia dachu pod kominem)
              place(key, g, x, y, z, ry = 0, rx = 0, rz = 0) { this.add(key, g, M4(x, y, z, ry, rx, rz)); } };
  const col = { rects: [], circles: [] };
  const ctx = { addWalkable() {}, addRect: (x, z, hw, hd) => col.rects.push({ x, z, hw, hd }), addCircle: (x, z, r) => col.circles.push({ x, z, r }), flags: {}, updaters: [] };
  // stub modeli (PROMPT §3.4): W.bounds = Map z Box3 (0,0,0)→(1,1,1) dla KAŻDEJ nazwy (modele z Poly Haven nie są ładowane offline), W.put rejestruje
  // {name, x, y, z, ry, scale} w `puts` (buildCart stawia nim skrzynię i kosz na wozie; motywy #5/#7/#10 mogą sprawdzać pozycje modeli z funkcji czystych)
  const bounds = new (class extends Map { get(n) { return super.get(n) ?? new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)); } })();
  for (const [n, [lo, hi]] of Object.entries({ ...GOODS_BOUNDS, ...GREENERY_BOUNDS })) bounds.set(n, new THREE.Box3(V(...lo), V(...hi)));   // towar kramów (J) i zieleń (K2): prawdziwe bryły
  const puts = [];
  const put = (name, x, y, z, ry = 0, scale = 1) => { puts.push({ name, x, y, z, ry, scale }); return true; };
  return { W: { ctx, R: rng(CONFIG.seed), CONFIG, P: CONFIG.palette, T: CONFIG.textures, H: CONFIG.house, S: CONFIG.plaza.size, half: CONFIG.plaza.size / 2, B, put, bounds, mat: {}, scene: { add() {} } }, rec, col, puts };
}
const fails = [], notes = [];
const { W, rec, col, puts } = makeW();
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
let nWin = 0, nWinO = 0, nRoof = 0, nSupp = 0, nDormer = 0, nWalk = 0, known = 0;
let nChim = 0, nBrace = 0, nGlass = 0, nBraceHit = 0, nStep = 0, nSideWin = 0; const allChimneys = []; // poprawki r1: B7 kominy, B8 zastrzał/okno, B5c schodki, B1c okna ścian bocznych, M dym
const allPortals = [], allSills = []; // W.portals / W.sills z każdego izolowanego buildHouses (do F2 / K1)
for (const h of allHouses) {
  const n0 = rec.length; W.houses = [h]; buildHouses(W); allPortals.push(...W.portals); allSills.push(...W.sills); allChimneys.push(...W.chimneys);
  const items = rec.slice(n0);
  const t = W.sideTransform(h.side, h.along, h.setback), inv = M4(t.x, 0, t.z, t.ry).invert();
  const loc = r => ({ ...r, ml: r.m.clone().premultiply(inv) }); // macierz w układzie domu
  const L = items.map(loc);
  const roofTops = []; // wierzchy szerokich połaci domu (do B5b), z B2
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
  // B1b) okna i ramy WYKUSZA (motyw #6; ściany obrócone o k·60°, więc B1 je pomija): lico przednie elementu wzdłuż WŁASNEJ normalnej ≥ apotema wielokąta + 0,005
  //      od osi wykusza (wykusz = plaster o typie CylinderGeometry; apotema = r·cos(π/seg) = 0,953 przy r 1,1, seg 6). Element wykusza = cienki (≤ 0,12) i niski (< 2 m)
  //      glass/timber ze środkiem w promieniu r + 0,3 od osi i w zakresie wysokości bryły — ramy 0,1, szkło 0,04; słupki (fh) i belki (0,16) nie.
  for (const o of L.filter(r => r.key.startsWith('plaster') && r.type === 'CylinderGeometry')) {
    const oc = V(0, 0, 0).applyMatrix4(o.ml), R = o.params.radiusTop, ap = R * Math.cos(Math.PI / o.params.radialSegments), y0 = oc.y + o.bb.min.y, y1 = oc.y + o.bb.max.y;
    for (const r of L) {
      if (!(r.key.startsWith('glass') || r.key === 'timber')) continue;
      const depth = r.bb.max.z - r.bb.min.z; if (depth > 0.12 || r.bb.max.y - r.bb.min.y > 2) continue;
      const c = V(0, 0, 0).applyMatrix4(r.ml); if (Math.hypot(c.x - oc.x, c.z - oc.z) > R + 0.3 || c.y < y0 || c.y > y1) continue;
      const n = V(0, 0, 1).transformDirection(r.ml), face = V(c.x - oc.x, 0, c.z - oc.z).dot(n) + depth / 2; nWinO++;
      if (face < ap + 0.005) fails.push(`B1b dom side=${h.side} along=${h.along.toFixed(1)}: ${r.key} wykusza lico ${face.toFixed(3)} < apotema ${ap.toFixed(3)} + 0.005 (n=${f2(n)})`);
    }
  }
  // B2) połacie: krawędź płyty przy kalenicy ma być WYŻEJ niż przy okapie. Oś spadku Z MACIERZY, nie z gableFront/szerokości (naczółek #12 to
  //     płyta obrócona o rz na domu ∥ x — z osi „z szerokości" dostałby końce wzdłuż z na tej samej wysokości = fałszywy „ODWRÓCONY ZNAK"):
  //     płyta cienka w lokalnym y (box): e[1] = składowa y lokalnego +x — ≠ 0 ⇒ obrót rz ⇒ spadek wzdłuż lokalnego x, inaczej rx ⇒ wzdłuż z;
  //     płyta cienka w lokalnym z (ExtrudeGeometry: trójkąt naczółka, pięciokąt połaci przy naczółku, w płaszczyźnie XY) ⇒ spadek wzdłuż lokalnego y.
  //     Kalenica: oś z większą rozpiętością poziomą końców — 'x' ⇒ koniec bliżej x = 0; 'z' ⇒ koniec bliżej z kalenicy (jet/2); lukarna ⇒ okap z przodu (większe z).
  for (const r of L.filter(r => r.key.startsWith('roof') && (r.bb.max.y - r.bb.min.y < 0.2 || r.bb.max.z - r.bb.min.z < 0.2))) {
    const e = r.ml.elements, thinZ = r.bb.max.z - r.bb.min.z < 0.2;
    const slopeAxis = thinZ ? 'y' : (Math.abs(e[1]) > 1e-6 ? 'x' : 'z');
    const ai = { x: 0, y: 1, z: 2 }[slopeAxis];
    const a = V(0, 0, 0).setComponent(ai, r.bb.min[slopeAxis]).applyMatrix4(r.ml), b = V(0, 0, 0).setComponent(ai, r.bb.max[slopeAxis]).applyMatrix4(r.ml);
    const ridgeAxis = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    const isDormer = ridgeAxis === 'z' && r.bb.max.x < 1; // daszek lukarny: spadek wzdłuż z, okap z przodu
    const c = V(0, 0, 0).applyMatrix4(r.ml);
    nRoof++;
    let ridgeEnd, eaveEnd;
    if (isDormer) { [eaveEnd, ridgeEnd] = a.z > b.z ? [a, b] : [b, a]; }
    else { const ridge = ridgeAxis === 'x' ? 0 : (h.jetty ? (h.floors - 1) * H.jetty / 2 : 0); const da = Math.abs(a[ridgeAxis] - ridge), db = Math.abs(b[ridgeAxis] - ridge); [ridgeEnd, eaveEnd] = da < db ? [a, b] : [b, a]; }
    const what = isDormer ? 'LUKARNA' : thinZ ? (r.bb.max.x < 3 ? 'naczółek' : 'połać przy naczółku') : ridgeAxis === 'x' ? 'szczyt' : 'połać';
    if (ridgeEnd.y <= eaveEnd.y) fails.push(`B2 dom side=${h.side} along=${h.along.toFixed(1)} ${what}: kalenica y=${ridgeEnd.y.toFixed(2)} <= okap y=${eaveEnd.y.toFixed(2)} (środek ${f2(c)}) — ODWRÓCONY ZNAK OBROTU`);
    if (ridgeAxis === 'z' && !isDormer && r.bb.max.x > 1) { // wierzch płyty (oś + 0,07 wzdłuż normalnej; dla płyty z Extrude normalna może patrzeć w dół → wyższy z ±0,07) — do B5b
      const ends = off => thinZ ? [V(0, r.bb.min.y, off).applyMatrix4(r.ml), V(0, r.bb.max.y, off).applyMatrix4(r.ml)] : [V(0, off, r.bb.min.z).applyMatrix4(r.ml), V(0, off, r.bb.max.z).applyMatrix4(r.ml)];
      const [pa, pb] = [ends(0.07), ends(-0.07)].sort((u, v) => v[0].y - u[0].y)[0]; roofTops.push({ a: pa, b: pb });
    }
  }
  // B5) podparcie: element z dolną krawędzią > 0,05 nad ziemią ma inny element TEGO SAMEGO domu, którego AABB rozszerzone o 0,05 przecina jego AABB
  //     (w układzie domu; AABB bryły obróconej = zachowawcze). NIE dotyczy elementów nad połacią (AABB pochylonej płyty obejmuje cały strych —
  //     przepuściłby wiszącą lukarnę): dla nich B5b niżej. Element nad połacią = środek nad wierzchem ostatniej kondygnacji i szerokość < 2 m.
  const eaveY = Math.max(...floors.map(fl => fl.y1));
  const aboveRoof = r => r.bb.max.x < 1 && V(0, 0, 0).applyMatrix4(r.ml).y > eaveY;
  const lb = L.map(r => ({ r, b: r.bb.clone().applyMatrix4(r.ml) }));
  for (const { r, b } of lb) {
    if (b.min.y <= 0.05 || aboveRoof(r)) continue;
    const e = b.clone().expandByScalar(0.05);
    nSupp++;
    if (!lb.some(o => o.r !== r && o.b.intersectsBox(e))) fails.push(`B5 dom side=${h.side} along=${h.along.toFixed(1)}: ${r.key} wisi (AABB ${f2(b.min)}..${f2(b.max)} bez styku z innym elementem domu)`);
  }
  // B5b) lukarna NA połaci (wzory roofY/roofTopY z PROMPT §5.2 #12; tu wierzch płyty z MACIERZY połaci — punkt (0, +0,07, t) płyty, interpolacja po z):
  //      (i) spód ściany czołowej ≤ roofTopY(zFront) − 0,05 (ściana wchodzi w połać, nie wisi); (ii) spód okna ≥ roofTopY(zOkna) + 0,05 (okno nad dachówką).
  const roofTopAt = z => { const t = roofTops.find(t => z >= Math.min(t.a.z, t.b.z) - 0.05 && z <= Math.max(t.a.z, t.b.z) + 0.05); if (!t) return null; const u = (z - t.a.z) / (t.b.z - t.a.z); return t.a.y + u * (t.b.y - t.a.y); };
  for (const { r, b } of lb) {
    if (!aboveRoof(r)) continue;
    const c = V(0, 0, 0).applyMatrix4(r.ml), idH = `dom side=${h.side} along=${h.along.toFixed(1)}`;
    if (r.key.startsWith('plaster') && r.bb.max.x >= 0.5) { // ściana czołowa lukarny (policzki mają bb.max.x 0,06)
      const zFront = c.z + r.bb.max.z, top = roofTopAt(zFront); nDormer++;
      if (top === null) fails.push(`B5b ${idH}: ściana lukarny poza połacią (zFront ${zFront.toFixed(2)})`);
      else if (b.min.y > top - 0.05) fails.push(`B5b(i) ${idH}: lukarna wisi nad połacią — spód ściany ${b.min.y.toFixed(2)} > wierzch połaci ${top.toFixed(2)} − 0,05 przy zFront ${zFront.toFixed(2)}`);
    }
    if (r.key.startsWith('glass') && Math.abs(r.ml.elements[0] - 1) < 1e-6) { // okno lukarny (bez obrotu); okna poddasza ścian bocznych (ry ±π/2, poprawka r1) → B1c
      const top = roofTopAt(c.z);
      if (top === null) fails.push(`B5b ${idH}: okno lukarny poza połacią (z ${c.z.toFixed(2)})`);
      else if (b.min.y < top + 0.05) { const msg = `B5b(ii) ${idH}: okno lukarny zakopane — spód ${b.min.y.toFixed(2)} < wierzch połaci ${top.toFixed(2)} + 0,05 przy z ${c.z.toFixed(2)}`; if (KNOWN_B5B.some(k => k.side === h.side && Math.abs(k.along - h.along) < 0.05)) { known++; notes.push('znane (KNOWN_B5B): ' + msg); } else fails.push(msg); }
    }
  }
  const idH = `dom side=${h.side} along=${h.along.toFixed(1)}`;
  // B7) komin nad połacią (poprawka r1 K8/K9; HEAD z ?nochimridge=1: FAIL 26/28 — kalibracja kominy_kalib.mjs): wierzch komina (stone box w×w, CONFIG.houseDetail.chimney)
  //     − wierzch powierzchni dachu pod jego środkiem (roofSurfaceY: trójkąty roof* domu) ≥ minAbove; dokładnie 1 komin na dom
  { const Chm = CONFIG.houseDetail.chimney;
    const chims = L.filter(r => r.key === 'stone' && Math.abs(r.bb.max.x - r.bb.min.x - Chm.w) < 1e-6 && Math.abs(r.bb.max.z - r.bb.min.z - Chm.w) < 1e-6);
    if (chims.length !== 1) fails.push(`B7 ${idH}: ${chims.length} kominów (oczekiwany 1)`);
    for (const r of chims) {
      const b = r.bb.clone().applyMatrix4(r.ml), c = V(0, 0, 0).applyMatrix4(r.ml), top = roofSurfaceY(L, c.x, c.z); nChim++;
      if (top === null) fails.push(`B7 ${idH}: komin (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) poza połacią (pion nie trafia w dach)`);
      else if (b.max.y - top < Chm.minAbove) fails.push(`B7 ${idH}: komin zakopany — wierzch ${b.max.y.toFixed(2)} − połać ${top.toFixed(2)} = ${(b.max.y - top).toFixed(2)} < ${Chm.minAbove} przy (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
    } }
  // B8) zastrzał nie przecina okna (poprawka r1; HEAD 148/316 okien pięter z belką przez szkło): AABB (układ domu) zastrzału (timber obrócony rz albo rx: e[1] ≠ 0 albo e[6] ≠ 0,
  //     wysokość > 1 m) ∩ AABB okna (glass*) tego domu = ∅ — AABB zastrzału obejmuje całe pole (0,7 przekątnej), sąsiednie pola są ≥ 0,45 m dalej (policzone: pole 1,6, okno 1,0)
  { const braces = L.filter(r => r.key === 'timber' && (Math.abs(r.ml.elements[1]) > 1e-6 || Math.abs(r.ml.elements[6]) > 1e-6) && r.bb.max.y - r.bb.min.y > 1).map(r => r.bb.clone().applyMatrix4(r.ml));
    const glasses = L.filter(r => r.key.startsWith('glass')).map(r => r.bb.clone().applyMatrix4(r.ml));
    nBrace += braces.length; nGlass += glasses.length;
    for (const b of braces) for (const g of glasses) if (b.intersectsBox(g)) { nBraceHit++; fails.push(`B8 ${idH}: zastrzał ${f2(b.min)}..${f2(b.max)} przecina okno ${f2(g.min)}..${f2(g.max)}`); } }
  // B5c) mur szczytu schodkowego (poprawka r1 K9; HEAD: mur w + 2·ov, narożnik 0,55 m poza ścianą boczną w powietrzu): schodki = blocks ze spodem ≥ wierzch ostatniej kondygnacji;
  //      najszerszy (najniższy) ma |x| ≤ w/2 + 0,05 (narożnik nad ścianą boczną); każdy schodek: spód ≤ wierzch dachu przy zewnętrznym narożniku + 0,02 (bez szpary), z 0,05 za licem tylnym muru
  { const wallTop = Math.max(...L.filter(r => r.key.startsWith('plaster') && r.type === 'BoxGeometry' && r.bb.max.x > 2.5 && r.bb.max.y - r.bb.min.y > 2).map(r => r.bb.clone().applyMatrix4(r.ml).max.y)); // wierzch ostatniej kondygnacji (box; `floors`/eaveY łapie też trójkąt poddasza gable() → kalenica)
    const St5 = CONFIG.houseDetail.step, above = r => r.bb.clone().applyMatrix4(r.ml).min.y >= wallTop - 0.01;
    // po poprawce (zrzuty z telefonu): trzon schodka jest w TYNKU domu (płytki w z: ≤ St.t + 0,15), kamienna nakrywa 'blocks' leży na jego wierzchu
    const steps = L.filter(r => r.type === 'BoxGeometry' && r.key.startsWith('plaster') && above(r)).map(r => r.bb.clone().applyMatrix4(r.ml))
      .filter(b => b.max.z - b.min.z <= St5.t + 0.15 && b.max.y - b.min.y < 3);
    const caps = L.filter(r => r.key === 'blocks' && above(r)).map(r => r.bb.clone().applyMatrix4(r.ml));
    if (steps.length) { nStep++;
      const low = [...steps].sort((a, b) => (b.max.x - b.min.x) - (a.max.x - a.min.x))[0];
      if (low.max.x > h.w / 2 + 0.05 || low.min.x < -h.w / 2 - 0.05) fails.push(`B5c ${idH}: mur schodków x ${low.min.x.toFixed(2)}..${low.max.x.toFixed(2)} poza ścianą boczną ±${(h.w / 2).toFixed(2)} + 0,05 (narożnik w powietrzu)`);
      for (const st of steps) { if (st.min.y <= wallTop + 0.01) continue; const top = roofSurfaceY(L, st.max.x - 0.02, st.min.z + 0.05); if (top === null || st.min.y > top + 0.02) fails.push(`B5c ${idH}: schodek ${f2(st.min)}..${f2(st.max)} wisi nad połacią (wierzch dachu przy narożniku ${top === null ? 'brak' : top.toFixed(2)})`); }
      // B5d) każda nakrywa leży na wierzchu trzonu schodka (spód nakrywy = wierzch trzonu ± 0,01) i nie wystaje bokiem więcej niż capOut + 0,01
      for (const cp of caps) { const base = steps.find(st => Math.abs(cp.min.y - st.max.y) <= 0.01 && cp.min.x >= st.min.x - St5.capOut - 0.01 && cp.max.x <= st.max.x + St5.capOut + 0.01);
        if (!base) fails.push(`B5d ${idH}: nakrywa ${f2(cp.min)}..${f2(cp.max)} nie leży na trzonie schodka`); } } }
  // B1c) okna ścian bocznych (poprawka r1; ry = ±π/2 → B1 je pomija): glass z |e[0]| < 1e-6 (lokalne +z okna wzdłuż ±x domu): lico przednie |c.x| + t/2 ≥ w/2 + 0,005, tył ≤ w/2 + 0,05 (przy ścianie)
  for (const r of L.filter(r => r.key.startsWith('glass') && Math.abs(r.ml.elements[0]) < 1e-6)) {
    const c = V(0, 0, 0).applyMatrix4(r.ml), t = (r.bb.max.z - r.bb.min.z) / 2; nSideWin++;
    if (Math.abs(c.x) + t < h.w / 2 + 0.005 || Math.abs(c.x) - t > h.w / 2 + 0.05) fails.push(`B1c ${idH}: okno ściany bocznej x ${c.x.toFixed(3)} ± ${t.toFixed(3)} vs ściana ±${(h.w / 2).toFixed(2)}`);
  }
  // B3) kolizja: obrys parteru w świecie zawarty w prostokącie kolizji
  const stone = items.find(r => r.key === 'stone' && r.bb.max.y - r.bb.min.y > 3); const wb = stone.bb.clone().applyMatrix4(stone.m);
  if (!col.rects.some(rc => wb.min.x >= rc.x - rc.hw - 0.05 && wb.max.x <= rc.x + rc.hw + 0.05 && wb.min.z >= rc.z - rc.hd - 0.05 && wb.max.z <= rc.z + rc.hd + 0.05)) fails.push(`B3 parter bez kolizji: ${f2(wb.min)}..${f2(wb.max)}`);
  // B4) nic nie wisi: każdy element ma dolną krawędź <= 0.05 nad ziemią ALBO styka się (w pionie) z innym elementem domu — uproszczenie: najniższy element domu stoi na ziemi
}
W.houses = allHouses; W.chimneys = allChimneys;
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
// I) kompozycja startu (motyw #7, stalls.js stallPlacements — funkcja czysta): żaden kram bliżej niż maxDist od startu nie ma koła kolizji (collideR) w sektorze
//    yaw [yawMin, yawMax]; kram 0 = repoussoir na |p| = ringRadius + ringOut (± 0,01), tuż za sektorem (0 ≤ luz ≤ 0,05). Kalibracja na znanym-złym: pierścień HEAD
//    (?nocompose=1: faza 0, bez repoussoira) ma kram 0 (0,18, 11,97) z kołem do yaw 0,336 < 0,40 — policzone 2026-09-08 — więc I musi go oblać (dokładnie 1 kram).
{
  const C = CONFIG.composition, S = CONFIG.stalls, st = C.start, sec = C.stallFreeSector;
  const inSector = p => { const d = Math.hypot(p.x - st.x, p.z - st.z); if (d >= sec.maxDist) return false; const yaw = yawFrom(st, p.x, p.z), half = Math.asin(S.collideR / d); return !(yaw + half <= sec.yawMin || yaw - half >= sec.yawMax); };
  for (const s of W.stalls) if (inSector(s)) fails.push(`I kram (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) w sektorze startu yaw ${sec.yawMin}–${sec.yawMax} (d ${Math.hypot(s.x - st.x, s.z - st.z).toFixed(2)} < ${sec.maxDist})`);
  const rep = W.stalls[0];
  if (!rep.repoussoir || Math.abs(Math.hypot(rep.x, rep.z) - (S.ringRadius + C.repoussoir.ringOut)) > 0.01) fails.push(`I kram 0 nie jest repoussoirem na skraju pierścienia: (${rep.x.toFixed(2)}, ${rep.z.toFixed(2)}) |p| ${Math.hypot(rep.x, rep.z).toFixed(2)}`);
  const dRep = Math.hypot(rep.x - st.x, rep.z - st.z), gap = yawFrom(st, rep.x, rep.z) - Math.asin(S.collideR / dRep) - sec.yawMax;
  if (gap < 0 || gap > 0.05) fails.push(`I repoussoir nie tuż za sektorem: luz ${gap.toFixed(3)} (d ${dRep.toFixed(2)})`);
  const Wh = { ...W, R: rng(CONFIG.seed), ctx: { ...W.ctx, flags: { nocompose: 1 } } }; buildLayout(Wh); buildHouses(Wh); buildTower(Wh);   // ten sam stan R co przed buildStalls (world.js: layout → houses → tower → fountain(0 losowań) → stalls)
  const headIn = stallPlacements(Wh).filter(inSector).length;
  if (headIn !== 1) fails.push(`I kalibracja: pierścień HEAD (?nocompose=1) daje ${headIn} kramów w sektorze (oczekiwany 1)`);
}
// H) lipy (trees.js treePlacements — funkcja czysta; buildTrees dodaje geometrię do W.B i koła kolizji): każda lipa ma addCircle o tym samym środku (± 0,01) i promieniu
//    collideR; count sztuk w odległości dist od fontanny (± 0,01); pień (timber ze spodem na y 0 w osi lipy) pokryty kołem → B6; korona (leaf*) ze spodem ≥ headroom.
let nTree = 0;
{
  const n0 = rec.length; buildTrees(W); const items = rec.slice(n0), C = CONFIG.trees;
  const places = treePlacements(W);
  if (places.length !== C.count) fails.push(`H lip ${places.length} ≠ CONFIG.trees.count ${C.count}`);
  for (const p of places) {
    nTree++;
    if (Math.abs(Math.hypot(p.x, p.z) - C.dist) > 0.01) fails.push(`H lipa (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) nie w odległości ${C.dist} od fontanny`);
    if (!col.circles.some(c => Math.abs(c.x - p.x) < 0.01 && Math.abs(c.z - p.z) < 0.01 && Math.abs(c.r - C.collideR) < 1e-6)) fails.push(`H lipa (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) bez koła kolizji r ${C.collideR} w osi pnia`);
    const near = items.filter(r => { const b = r.bb.clone().applyMatrix4(r.m); return Math.hypot((b.min.x + b.max.x) / 2 - p.x, (b.min.z + b.max.z) / 2 - p.z) < C.crown.r + 1; });
    const trunk = near.filter(r => r.key === 'timber' && r.bb.clone().applyMatrix4(r.m).min.y < 0.01);
    if (trunk.length < 1) fails.push(`H lipa (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): pień nie stoi na ziemi`);
    const leaves = near.filter(r => r.key.startsWith('leaf')), lowest = Math.min(...leaves.map(r => r.bb.clone().applyMatrix4(r.m).min.y));
    if (leaves.length < 10 || lowest < C.headroom) fails.push(`H lipa (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): korona ${leaves.length} elementów, spód ${lowest.toFixed(2)} < headroom ${C.headroom}`);
  }
}
// K1) kontrakt W.sills (buildings.js → greenery.js, motyw #greenery): punkt = środek górnej-PRZEDNIEJ krawędzi parapetu (timber box(w+0.16, 0.08, 0.1) na front+0.02 →
//     wierzch +0.04, lico +0.07) okien parteru (floor 0) i piętra 1 (floor 1). Sprawdzane: istnieje belka timber z wierzchem na s.y (± 0,005) zawierająca punkt 1 cm pod
//     wierzchem i 2 cm za licem; lico tej belki (max rzutu AABB na normalną (sin ry, 0, cos ry)) = punkt (± 0,005); parter bez setback: |współrzędna| = half − 0,07
//     (lico parteru d/2 przy dist = half + d/2) — 4 pierzeje. Kalibracja 2026-09-08: 0 FAIL na HEAD (parapety z tego samego L() co punkt).
let nSill = 0;
{
  W.sills = allSills; const sills = allSills;
  if (sills.length < 20) fails.push(`K1 W.sills: ${sills.length} parapetów (< 20 przy 24 domach)`);
  for (const s of sills) {
    nSill++;
    const nrm = V(Math.sin(s.ry), 0, Math.cos(s.ry)), probe = V(s.x, s.y - 0.01, s.z).sub(nrm.clone().multiplyScalar(0.02));
    const face = rec.filter(r => r.key === "timber").map(r => r.bb.clone().applyMatrix4(r.m)).filter(b => Math.abs(b.max.y - s.y) < 0.005 && b.containsPoint(probe));
    if (!face.length) { fails.push(`K1 parapet (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}) s${s.side} p${s.floor}: brak belki parapetu z wierzchem na y zawierającej punkt 2 cm za licem`); continue; }
    const b = face[0], lip = Math.max(...[b.min, b.max].map(v => V(v.x, 0, v.z).dot(nrm))) - V(s.x, 0, s.z).dot(nrm); // lico parapetu − punkt (wzdłuż normalnej; AABB osiowe, normalna osiowa)
    if (Math.abs(lip) > 0.005) fails.push(`K1 parapet s${s.side} p${s.floor} along ${s.along.toFixed(1)}: punkt ${(-lip).toFixed(3)} m od lica parapetu (oczekiwane 0)`);
    if (![0, 1].includes(s.floor) || !(s.w >= 0.7 && s.w <= 1.0)) fails.push(`K1 parapet s${s.side}: floor ${s.floor}, w ${s.w}`);
    if (s.floor === 0 && !s.setback) { const c = Math.abs(s.side % 2 === 0 ? s.z : s.x); if (Math.abs(c - (W.half - 0.07)) > 0.005) fails.push(`K1 parapet parteru s${s.side} along ${s.along.toFixed(1)}: |współrzędna| ${c.toFixed(3)} ≠ half − 0,07 = ${(W.half - 0.07).toFixed(3)}`); }
  }
}
// D) wieża: okna (i tarcza zegara) na licu trzonu, normalną na zewnątrz. Trzon = najwyższy element `slates` wieży; klasyfikacja po typie geometrii:
//    walec (motyw #2: cylinder(rTop, rBot, h, seg) — promień zależy od wysokości, rAt(y) = rBot + (rTop − rBot)·y/h; policzone dla (3.2, 3.5, 24):
//    y 8/15/21 → 3.40/3.31/3.24, więc stała półszerokość AABB ± 0.05 dawałaby 12–16 fałszywych FAIL) albo prostopadłościan (stara kwadratowa: lico = ściana AABB).
const n1 = rec.length; buildTower(W);
const tw = rec.slice(n1);
const twr = tw.filter(r => r.key === 'slates').sort((a, b) => (b.bb.max.y - b.bb.min.y) - (a.bb.max.y - a.bb.min.y))[0], tb = twr.bb.clone().applyMatrix4(twr.m);
const tc = V((tb.min.x + tb.max.x) / 2, 0, (tb.min.z + tb.max.z) / 2);   // oś trzonu (x, z)
const isRound = twr.type === 'CylinderGeometry';
const rAt = y => { const p = twr.params; return p.radiusBottom + (p.radiusTop - p.radiusBottom) * (y - tb.min.y) / p.height; }; // promień walca na wysokości y (świat)
let nTowerWin = 0;
for (const r of tw.filter(r => r.key.startsWith('glass') || r.key === 'clock')) {
  const c = V(0, 0, 0).applyMatrix4(r.m), n = V(0, 0, 1).transformDirection(r.m);
  const radial = V(c.x - tc.x, 0, c.z - tc.z), dist = radial.length();
  nTowerWin++;
  if (isRound) {
    // środek okna na licu walca: |odległość od osi − rAt(y)| ≤ 0.05 (szkło 2 cm przed licem); tarcza zegara 0.01–0.05 przed licem; normalna wzdłuż promienia
    const tol = r.key === 'clock' ? [0.005, 0.05] : [-0.05, 0.05], d = dist - rAt(c.y); // 0.005: tarcza stawiana ≥ 0.01 przed licem, margines na arytmetykę float (0.01 wychodziło 0.00999)
    if (d < tol[0] || d > tol[1]) fails.push(`D ${r.key} wieży nie na licu walca: odległość od osi ${dist.toFixed(3)} vs promień ${rAt(c.y).toFixed(3)} na y=${c.y.toFixed(2)} (Δ ${d.toFixed(3)}, dozwolone [${tol}])`);
    if (n.dot(radial.normalize()) < 0.9) fails.push(`D ${r.key} wieży nie patrzy na zewnątrz walca: ${f2(c)} n=${f2(n)}`);
  } else {
    const outwardOfBox = V(Math.sign(c.x - tc.x), 0, Math.sign(c.z - tc.z));
    const onFace = Math.abs(Math.abs(c.x - tc.x) - (tb.max.x - tb.min.x) / 2) < 0.05 || Math.abs(Math.abs(c.z - tc.z) - (tb.max.z - tb.min.z) / 2) < 0.05;
    if (!onFace) fails.push(`D okno wieży nie na licu: ${f2(c)}`);
    if (n.dot(outwardOfBox) <= 0) fails.push(`D okno wieży odwrócone do środka: ${f2(c)} n=${f2(n)}`);
  }
}
// F) szyld (props.js signMatrix — funkcja czysta; motyw #10): front płaszczyzny (lokalne +z) patrzy NA ULICĘ, tj. ku along = 0 wzdłuż pierzei:
//    n·dirToStreet ≥ 0,9 dla 4 pierzei × 2 znaki along (8 przypadków), środek szyldu faceZ + out = 4,8 m przed osią domu (± 0,01).
//    Kalibracja na znanym-złym przypadku: stary łańcuch z HEAD (M4(tr, ry)·T(0,0,0.8)·RotY(π/2), props.js buildBanners) nie zależy od along →
//    dokładnie 4/8 (along < 0 przechodzi przypadkiem; PROMPT §3.4 pisał „0/8" — policzone 2026-09-07: 4/8). Gdyby F przepuszczał stary łańcuch w 8/8, F nie rozróżnia.
let nSign = 0, nSignOld = 0;
for (const side of [0, 1, 2, 3]) for (const along of [-10, 10]) {
  const tr = W.sideTransform(side, along);
  const dirToStreet = V(-Math.sign(along), 0, 0).transformDirection(M4(0, 0, 0, tr.ry));
  const m = signMatrix(tr, along), n = V(0, 0, 1).transformDirection(m), c = new THREE.Vector3().setFromMatrixPosition(m);
  nSign++;
  if (n.dot(dirToStreet) < 0.9) fails.push(`F szyld side=${side} along=${along} tyłem do ulicy: n=${f2(n)} dirToStreet=${f2(dirToStreet)}`);
  const dOut = c.clone().sub(V(tr.x, 0, tr.z)).dot(V(0, 0, 1).transformDirection(M4(0, 0, 0, tr.ry)));
  if (Math.abs(dOut - 4.8) > 0.01 || Math.abs(c.y - 3.05) > 0.01) fails.push(`F szyld side=${side} along=${along}: środek ${f2(c)} nie 4,8 m przed osią domu / y 3,05 (d=${dOut.toFixed(3)})`);
  const old = M4(tr.x, 3.05, tr.z, tr.ry).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.8)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  if (V(0, 0, 1).transformDirection(old).dot(dirToStreet) >= 0.9) nSignOld++;
}
if (nSignOld !== 4) fails.push(`F kalibracja: stary łańcuch szyldu z HEAD daje ${nSignOld}/8 (oczekiwane 4/8)`);
// F2) faktyczne szyldy (props.js signPlacements — funkcja czysta na W.portals z buildHouses): każdy frontem do ulicy (n·dirToStreet ≥ 0,9), środek out przed licem
//     piętra 1 (faceZ1) na wysokości S.y, wspornik od bracket.back w ścianie, x szyldu ≥ oriel.r + orielGap od osi wykusza i w obrysie domu; karczma (s2, along > 0) ma kafelek 0.
W.portals = allPortals;
const signs = signPlacements(W), S = CONFIG.houseDetail.sign, O = CONFIG.houseDetail.oriel;
if (allPortals.length !== allHouses.length) fails.push(`F2 W.portals ${allPortals.length} ≠ domów ${allHouses.length}`);
if (signs.length < 3 || !signs.some(s => s.p.side === 2 && s.p.along > 0 && s.tile === S.tavernTile)) fails.push(`F2 szyldów ${signs.length} (< 3) albo karczma bez kafelka ${S.tavernTile}`);
for (const s of signs) {
  const idS = `F2 szyld side=${s.p.side} along=${s.p.along.toFixed(1)}`, n = V(0, 0, 1).transformDirection(s.m), c = new THREE.Vector3().setFromMatrixPosition(s.m);
  const fn = V(0, 0, 1).transformDirection(M4(0, 0, 0, s.tr.ry)), d = c.clone().sub(V(s.tr.x, 0, s.tr.z)).dot(fn) - s.p.faceZ1;
  if (n.dot(s.dirToStreet) < 0.9) fails.push(`${idS} tyłem do ulicy: n=${f2(n)}`);
  if (V(0, 0, 1).transformDirection(s.mBack).dot(n) > -0.99) fails.push(`${idS}: druga płaszczyzna nie odwrócona`);
  if (Math.abs(d - S.out) > 0.01 || Math.abs(c.y - S.y) > 0.01) fails.push(`${idS}: środek ${d.toFixed(3)} przed licem piętra 1 (ma być ${S.out}), y ${c.y.toFixed(2)}`);
  const bb = new THREE.Vector3(0, 0, -S.bracket.len / 2).applyMatrix4(s.bracket), db = bb.clone().sub(V(s.tr.x, 0, s.tr.z)).dot(fn) - s.p.faceZ1;
  if (db > -0.05) fails.push(`${idS}: tył wspornika ${db.toFixed(3)} nie w ścianie`);
  if (s.p.orielX !== null && Math.abs(s.x - s.p.orielX) < O.r + S.orielGap) fails.push(`${idS}: szyld ${Math.abs(s.x - s.p.orielX).toFixed(2)} od osi wykusza (< ${O.r + S.orielGap})`);
  if (Math.abs(s.x) > s.p.w / 2 - 0.3) fails.push(`${idS}: szyld poza obrysem domu (x ${s.x.toFixed(2)}, w ${s.p.w.toFixed(2)})`);
}
// J) role kramów (motyw #11, stalls.js stallGoodsPlan — funkcja czysta; buildStallGoods dodaje bele/szyldy do B i towar przez stub put): 7 różnych ról, kram 0 = sukiennik
//    (repoussoir §5.3); szyld każdego kramu frontem kramu (n·front ≥ 0,98 dla 7 obrotów pierścienia) i sign.out przed płótnem zwisu; bele: spód dolnego rzędu na blacie
//    ch + 0,04, górny rząd na dolnym (z TYCH SAMYCH macierzy), środek każdej beli w kole kolizji kramu (B6); towar z put: spód na blacie i środek w obrysie lady;
//    kosz na ziemi w kole kolizji; asercje check() z buildStallGoods liczą się w E (0 FAIL na prawdziwych bryłach GOODS_BOUNDS).
let nGoods = 0, nBales = 0;
{
  const n0 = rec.length, p0 = puts.length; buildStallGoods(W);
  const plan = W.stallGoods, G = CONFIG.stalls.goods, S = CONFIG.stalls;
  if (plan.length !== W.stalls.length) fails.push(`J: plan ról ${plan.length} ≠ kramów ${W.stalls.length}`);
  if (new Set(plan.map(p => p.kind)).size !== Math.min(S.count, S.kinds.length)) fails.push(`J: role się powtarzają: ${plan.map(p => p.kind).join(',')}`);
  if (W.stalls[0].kind !== 'sukiennik' || !W.stalls[0].repoussoir) fails.push(`J: kram 0 (repoussoir) ma rolę ${W.stalls[0].kind}, nie sukiennik`);
  for (const p of plan) {
    const s = p.s, id = `J kram ${p.kind} (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`, front = V(0, 0, 1).transformDirection(M4(0, 0, 0, s.ry)), inv = M4(s.x, 0, s.z, s.ry).invert(), top = s.ch + 0.04;
    const n = V(0, 0, 1).transformDirection(p.sign.m), d = p.sign.center.clone().sub(p.sign.valance).dot(front);
    if (n.dot(front) < 0.98) fails.push(`${id}: szyld n=${f2(n)} nie frontem kramu ${f2(front)}`);
    if (Math.abs(d - G.sign.out) > 0.005) fails.push(`${id}: szyld ${d.toFixed(3)} m przed zwisem (ma być ${G.sign.out})`);
    if (p.sign.y1 > s.ph - 0.1) fails.push(`${id}: wierzch szyldu ${p.sign.y1.toFixed(3)} w belce frontowej (spód ${(s.ph - 0.1).toFixed(2)})`);
    if (p.sign.tile < 0) fails.push(`${id}: brak kafelka szyldu`);
    for (const b of p.bales) {
      nBales++;
      const lo = V(0, -G.bale.w / 2, 0).applyMatrix4(b.m).y, c = V(0, 0, 0).applyMatrix4(b.m);
      if (Math.abs(lo - (top + b.row * G.bale.w)) > 0.005) fails.push(`${id}: bela rzędu ${b.row} spód ${lo.toFixed(3)} ≠ ${(top + b.row * G.bale.w).toFixed(3)}`);
      if (Math.hypot(c.x - s.x, c.z - s.z) > S.collideR) fails.push(`${id}: bela poza kołem kolizji kramu`);
    }
    if (p.kind === 'sukiennik' && p.bales.length !== G.bale.rows[0] + G.bale.rows[1]) fails.push(`${id}: ${p.bales.length} bel zamiast ${G.bale.rows[0] + G.bale.rows[1]}`);
    for (const g of p.goods) {
      nGoods++;
      const l = V(g.x, g.y, g.z).applyMatrix4(inv);
      if (Math.abs(l.y - top) > 1e-6) fails.push(`${id}: ${g.name} spód ${g.y.toFixed(3)} ≠ blat ${top.toFixed(3)}`);
      if (Math.abs(l.x) > s.cw / 2 || Math.abs(l.z) > s.cd / 2) fails.push(`${id}: ${g.name} środek (${l.x.toFixed(2)}, ${l.z.toFixed(2)}) poza ladą ${s.cw}×${s.cd}`);
      if (!puts.slice(p0).some(q => q.name === g.name && Math.abs(q.x - g.x) < 1e-6 && Math.abs(q.z - g.z) < 1e-6)) fails.push(`${id}: ${g.name} nie postawiony przez put`);
    }
    if (p.ground && Math.hypot(p.ground.lx, p.ground.lz) > S.collideR) fails.push(`${id}: ${p.ground.name} na ziemi poza kołem kolizji`);
  }
  const bales = rec.slice(n0).filter(r => r.key.startsWith('cloth')), signs = rec.slice(n0).filter(r => r.key === 'sign');
  if (bales.length !== nBales) fails.push(`J: w B ${bales.length} bel zamiast ${nBales}`);
  if (signs.length !== plan.length) fails.push(`J: w B ${signs.length} szyldów kramów zamiast ${plan.length}`);
}
// G) wóz (props.js buildCart) — geometria Batch; modele przez stub put (rejestrowane w puts)
buildCart(W);
if (!puts.some(p => p.name === 'wooden_crate_01') || !puts.some(p => p.name === 'wicker_basket_01')) fails.push('G stub W.put: buildCart nie zarejestrował skrzyni i kosza na wozie');
{ const Ct = CONFIG.props.cart, shaft = V(Ct.shaft.lx, 0, 0).applyMatrix4(M4(Ct.x, 0, Ct.z, Ct.ry));   // koło pod dyszlem (B6): policzone dla (4,9, 11,3, ry 0,45+π) → (6,88, 0, 10,34)
  if (!col.circles.some(c => Math.hypot(c.x - Ct.x, c.z - Ct.z) < 1e-6 && c.r >= Ct.collideR)) fails.push('G wóz bez koła kolizji w CONFIG.props.cart');
  if (!col.circles.some(c => Math.hypot(c.x - shaft.x, c.z - shaft.z) < 1e-3 && c.r >= Ct.shaft.r)) fails.push(`G brak koła pod dyszlem w (${shaft.x.toFixed(2)}, ${shaft.z.toFixed(2)})`);
  for (const p of Ct.foreground) if (!puts.some(q => q.name === p.name && Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.z - p.z) < 1e-6)) fails.push(`G ${p.name} pierwszego planu nie postawiony przez put`); }
// K2) zieleń (greenery.js: greeneryPlan = funkcja czysta, buildGreenery = geometria W.B + modele przez stub W.put + asercje CHECK → E): liczby z CONFIG.greenery.
//     Donice: count, model przy domu bez setback, środek gap + d/2 przed licem parteru (wzdłuż normalnej (sin ry, 0, cos ry) od punktu tr domu: faceZ + 0,237), skraj ≥ archOut + gap
//     od drzwi, w obrysie domu; 2 krzewy w obrysie donicy (układ donicy przez odwrotność M4), spód 0,05..h−0,05. Skrzynki: count na parapetach bez okiennic: planks ze spodem na s.y,
//     2 iron z wierzchem na s.y, ziemia soil pod krawędzią, 2–3 rośliny put na ziemi skrzynki. Rabatki: po jednej na lipę, addRect w osi lipy hw = size/2, 4 deski planks
//     z wierzchem na h, plants roślin w odległości ring od pnia. Ławki: count na r dist, front (0,0,1)·M4(ry) · radialny ≥ 0,98. Kalibracja 2026-09-08: 0 FAIL przy seed 7.
let nGreen = { planters: 0, sillBoxes: 0, beds: 0, benches: 0 };
{
  const G = CONFIG.greenery, n0 = rec.length, p0 = puts.length, c0 = col.rects.length;
  buildGreenery(W); const items = rec.slice(n0), putsG = puts.slice(p0), plan = W.greenery;
  const near = (x, z, name, tol = 0.01) => putsG.filter(q => q.name === name && Math.hypot(q.x - x, q.z - z) < tol);
  nGreen.planters = plan.planters.length;
  if (plan.planters.length !== G.planters.count) fails.push(`K2 donic ${plan.planters.length} ≠ ${G.planters.count}`);
  for (const d of plan.planters) {
    const p = d.p, nrm = V(Math.sin(p.tr.ry), 0, Math.cos(p.tr.ry)), off = V(d.x, 0, d.z).sub(V(p.tr.x, 0, p.tr.z)).dot(nrm), want = p.faceZ + G.planters.gap + d.d / 2;
    if (p.setback) fails.push(`K2 donica przy domu zamykającym ulicę s${p.side}`);
    if (!near(d.x, d.z, G.planters.box).length) fails.push(`K2 donica s${p.side} along ${p.along.toFixed(1)}: brak put ${G.planters.box}`);
    if (Math.abs(off - want) > 0.005) fails.push(`K2 donica s${p.side}: ${off.toFixed(3)} przed osią domu (oczekiwane ${want.toFixed(3)})`);
    if (Math.abs(d.lx - p.doorX) - d.w / 2 < CONFIG.houseDetail.portal.archOut + G.planters.gap - 1e-6 || Math.abs(d.lx) + d.w / 2 > p.w / 2) fails.push(`K2 donica s${p.side}: w oprawie portalu albo poza domem (lx ${d.lx.toFixed(2)}, doorX ${p.doorX.toFixed(2)}, w ${p.w.toFixed(2)})`);
    const inv = M4(d.x, 0, d.z, d.ry).invert(), shrubs = putsG.filter(q => q.name === G.planters.shrub && V(q.x, 0, q.z).applyMatrix4(inv).length() < 0.5);
    if (shrubs.length !== G.planters.shrubs) fails.push(`K2 donica s${p.side}: ${shrubs.length} krzewów w donicy (oczekiwane ${G.planters.shrubs})`);
    for (const q of shrubs) { const l = V(q.x, q.y, q.z).applyMatrix4(inv); if (Math.abs(l.x) > d.w / 2 - 0.1 || Math.abs(l.z) > d.d / 2 || l.y < 0.05 || l.y > d.h - 0.05) fails.push(`K2 krzew poza donicą s${p.side}: lokalnie (${f2(l)})`); }
  }
  const S = G.sillBoxes; nGreen.sillBoxes = plan.sillBoxes.length;
  if (plan.sillBoxes.length !== S.count) fails.push(`K2 skrzynek ${plan.sillBoxes.length} ≠ ${S.count}`);
  for (const b of plan.sillBoxes) {
    const s = b.s, id = `K2 skrzynka s${s.side} p${s.floor} along ${s.along.toFixed(1)}`, nrm = V(Math.sin(s.ry), 0, Math.cos(s.ry));
    if (s.shut || s.setback) fails.push(`${id}: parapet z okiennicami albo dom zamykający ulicę`);
    const at = items.map(r => ({ key: r.key, b: r.bb.clone().applyMatrix4(r.m) })).filter(e => Math.hypot((e.b.min.x + e.b.max.x) / 2 - s.x, (e.b.min.z + e.b.max.z) / 2 - s.z) < 0.6 && Math.abs((e.b.min.y + e.b.max.y) / 2 - s.y) < 0.3);
    const planks = at.filter(e => e.key === "planks"), iron = at.filter(e => e.key === "iron"), soil = at.filter(e => e.key === "soil");
    if (planks.length !== 1 || Math.abs(planks[0].b.min.y - s.y) > 0.005) fails.push(`${id}: ${planks.length} skrzynek planks / spód nie na parapecie`);
    if (planks.length === 1) { const fr = Math.max(...[planks[0].b.min, planks[0].b.max].map(v => V(v.x, 0, v.z).dot(nrm))) - V(s.x, 0, s.z).dot(nrm), bk = Math.min(...[planks[0].b.min, planks[0].b.max].map(v => V(v.x, 0, v.z).dot(nrm))) - V(s.x, 0, s.z).dot(nrm); if (Math.abs(bk + S.onSill) > 0.005 || Math.abs(fr - (S.d - S.onSill)) > 0.005) fails.push(`${id}: tył ${bk.toFixed(3)} / przód ${fr.toFixed(3)} wzdłuż normalnej (oczekiwane ${-S.onSill} / ${(S.d - S.onSill).toFixed(2)})`); }
    if (iron.length !== 2 || iron.some(e => Math.abs(e.b.max.y - s.y) > 0.005)) fails.push(`${id}: ${iron.length} wsporników / wierzch nie na parapecie`);
    if (soil.length !== 1 || Math.abs(soil[0].b.max.y - (s.y + S.h - S.soil)) > 0.005) fails.push(`${id}: ziemia ${soil.length} / wierzch nie ${S.soil} pod krawędzią`);
    const pl = putsG.filter(q => S.species.includes(q.name) && Math.hypot(q.x - s.x, q.z - s.z) < 0.6 && Math.abs(q.y - (s.y + S.h - S.soil)) < 0.005);
    if (pl.length < S.plants[0] || pl.length > S.plants[1]) fails.push(`${id}: ${pl.length} roślin na ziemi skrzynki (oczekiwane ${S.plants[0]}–${S.plants[1]})`);
  }
  const Bd = G.beds; nGreen.beds = plan.beds.length;
  if (plan.beds.length !== W.trees.length) fails.push(`K2 rabatek ${plan.beds.length} ≠ lip ${W.trees.length}`);
  for (const bd of plan.beds) {
    const t = bd.t, id = `K2 rabatka (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`;
    if (!col.rects.slice(c0).some(r => Math.abs(r.x - t.x) < 0.01 && Math.abs(r.z - t.z) < 0.01 && Math.abs(r.hw - Bd.size / 2) < 1e-6)) fails.push(`${id}: brak addRect hw ${Bd.size / 2} w osi lipy`);
    const boards = items.filter(r => r.key === "planks").map(r => r.bb.clone().applyMatrix4(r.m)).filter(b => Math.hypot((b.min.x + b.max.x) / 2 - t.x, (b.min.z + b.max.z) / 2 - t.z) < Bd.size && b.min.y < 0.01);
    if (boards.length !== 4 || boards.some(b => Math.abs(b.max.y - Bd.h) > 0.005)) fails.push(`${id}: ${boards.length} desek na ziemi / wierzch nie ${Bd.h}`);
    const pl = putsG.filter(q => S.species.includes(q.name) && Math.abs(Math.hypot(q.x - t.x, q.z - t.z) - Bd.ring) < 0.01 && Math.abs(q.y - Bd.soilY) < 0.005);
    if (pl.length !== Bd.plants) fails.push(`${id}: ${pl.length} roślin na pierścieniu r ${Bd.ring} (oczekiwane ${Bd.plants})`);
  }
  if (process.env.DUMP_GREENERY) console.log("DUMP_GREENERY " + JSON.stringify({ planters: plan.planters.map(d => ({ side: d.p.side, along: +d.p.along.toFixed(2), x: +d.x.toFixed(2), z: +d.z.toFixed(2), ry: +d.ry.toFixed(3) })), sills: plan.sillBoxes.map(b => ({ side: b.s.side, floor: b.s.floor, along: +b.s.along.toFixed(2), x: +b.s.x.toFixed(2), y: +b.s.y.toFixed(2), z: +b.s.z.toFixed(2), w: b.s.w, n: b.plants.length, sp: b.plants[0].name })), benches: plan.benches.map(b => [+b.x.toFixed(2), +b.z.toFixed(2)]) }));   // DUMP_GREENERY=1: pozycje zieleni do kadrowania widoków (raport)
  const Bn = G.benches; nGreen.benches = plan.benches.length;
  if (plan.benches.length !== Bn.count) fails.push(`K2 ławek ${plan.benches.length} ≠ ${Bn.count}`);
  for (const b of plan.benches) {
    const front = V(0, 0, 1).transformDirection(M4(0, 0, 0, b.ry)), dot = front.dot(V(b.x, 0, b.z).normalize());
    if (Math.abs(Math.hypot(b.x, b.z) - Bn.dist) > 0.01 || dot < 0.98 || !near(b.x, b.z, Bn.model).length) fails.push(`K2 ławka (${b.x.toFixed(2)}, ${b.z.toFixed(2)}): r ${Math.hypot(b.x, b.z).toFixed(2)}, front·radial ${dot.toFixed(3)}, put ${near(b.x, b.z, Bn.model).length}`);
  }
}
// B6) obszar chodzenia: żaden element Batch (poza cobble|wet) z dolną krawędzią < 2 m nie ma AABB przecinającego prostokąta chodzenia (plac ± (half−0,3);
//     ulice (sw/2 − 0,3) × sl/2, jak addWalkable w layout.js) bez pokrycia kolizją: środek AABB w prostokącie/kole kolizji rozszerzonym o promień gracza 0,35
//     (ta sama tolerancja co C: słup kramu 1,70 m od środka przy kole 1,6 — gracz wchodzi ≤ 0,35 m w bryłę). Prawdziwe wady HEAD → KNOWN_B6 (lista ma się kurczyć).
{
  const half = W.half, sw = CONFIG.plaza.streetWidth, sl = CONFIG.plaza.streetLength;
  const walk = [{ x: 0, z: 0, hw: half - 0.3, hd: half - 0.3 }, ...[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dz]) => ({ x: dx * (half + sl / 2), z: dz * (half + sl / 2), hw: dx ? sl / 2 : sw / 2 - 0.3, hd: dz ? sl / 2 : sw / 2 - 0.3 }))];
  const tol = 0.35;
  const covered = (cx, cz) => col.rects.some(rc => Math.abs(cx - rc.x) <= rc.hw + tol && Math.abs(cz - rc.z) <= rc.hd + tol) || col.circles.some(c => Math.hypot(cx - c.x, cz - c.z) <= c.r + tol);
  for (const r of rec) {
    if (/^(cobble|wet)/.test(r.key)) continue;
    const wb = r.bb.clone().applyMatrix4(r.m); if (wb.min.y >= 2) continue;
    if (wb.max.y <= 0.02 && wb.max.y - wb.min.y <= 0.02) continue;   // płaskie nakładki na bruku (medalion roof2, kałuże water — motyw #13, y ≤ 1 cm, grubość 0): nie są przeszkodą, tak jak wet
    if (!walk.some(w => wb.max.x > w.x - w.hw && wb.min.x < w.x + w.hw && wb.max.z > w.z - w.hd && wb.min.z < w.z + w.hd)) continue;
    nWalk++;
    const cx = (wb.min.x + wb.max.x) / 2, cz = (wb.min.z + wb.max.z) / 2;
    if (covered(cx, cz)) continue;
    const msg = `B6 ${r.key} w obszarze chodzenia bez kolizji: środek AABB (${cx.toFixed(2)}, ${((wb.min.y + wb.max.y) / 2).toFixed(2)}, ${cz.toFixed(2)}), min.y ${wb.min.y.toFixed(2)}`;
    if (KNOWN_B6.some(k => k.key === r.key && Math.hypot(k.x - cx, k.z - cz) < 0.1)) { known++; notes.push('znane (KNOWN_B6): ' + msg); } else fails.push(msg);
  }
}
// S) panorama (skyline.js): plan z funkcji czystej skylinePlan + bryły z buildSkyline (ten sam rejestrator B)
{
  const half = W.half, houseRects = col.rects.slice(); // prostokąty kolizji domów pierzei (z buildHouses, w tym domy zamykające ulice)
  const n3 = rec.length; buildSkyline(W);
  const sky = rec.slice(n3), plan = W.skylinePlan, SK = CONFIG.skyline;
  const boxXZ = (r) => { const b = r.bb.clone().applyMatrix4(r.m); return new THREE.Box2(new THREE.Vector2(b.min.x, b.min.z), new THREE.Vector2(b.max.x, b.max.z)); };
  // S1) domy tła: odcinki A/B 6–8 na pierzeję za tyłem pierzei (half + depth + 0.3), poza domem zamykającym (krawędź sw/2 + depth + streetClear); tylna linia (h.back)
  // 2–5 na ulicę: w pasie |along| ≤ inner, najbliższa ściana ≥ tył domu zamykającego (half + depth + sl) + back.clear; kalenice w zakresie swojego odcinka; bez wzajemnych przecięć
  for (let side = 0; side < 4; side++) {
    const n = plan.houses.filter(h => h.side === side && !h.back).length, nb = plan.houses.filter(h => h.side === side && h.back).length;
    if (n < 6 || n > 8) fails.push(`S1 strona ${side}: ${n} domów tła A/B (ma być 6–8)`);
    if (nb < 2 || nb > 5) fails.push(`S1 strona ${side}: ${nb} domów tylnej linii (ma być 2–5; 24 m / szerokości 5–8 + przerwy)`);
  }
  const inner = W.sw / 2 + H.depth + SK.secondLine.streetClear;
  for (const h of plan.houses) {
    const near = half + H.depth / 2 + h.setback - h.d / 2, rg = SK.secondLine;
    if (near < half + H.depth + 0.3) fails.push(`S1 dom tła s${h.side} along=${h.along.toFixed(1)}: ściana ${near.toFixed(2)} m < tył pierzei ${(half + H.depth + 0.3).toFixed(1)}`);
    if (!h.back && Math.abs(h.along) - h.w / 2 < inner - 0.01) fails.push(`S1 dom tła s${h.side} along=${h.along.toFixed(1)}: krawędź ${(Math.abs(h.along) - h.w / 2).toFixed(2)} < ${inner} (dom zamykający ulicę)`);
    if (h.back && (Math.abs(h.along) + h.w / 2 > inner + 0.01 || near < half + H.depth + W.sl + SK.secondLine.back.clear - 0.01)) fails.push(`S1 dom tylnej linii s${h.side} along=${h.along.toFixed(1)}: poza pasem ±${inner} albo ściana ${near.toFixed(2)} < tył domu zamykającego ${(half + H.depth + W.sl + SK.secondLine.back.clear).toFixed(1)}`);
    if (h.ridgeY < rg.ridgeMin - 0.01 || h.ridgeY > rg.ridgeMax + 0.01) fails.push(`S1 dom tła${h.back ? ' (tył)' : ''}: kalenica ${h.ridgeY.toFixed(2)} poza ${rg.ridgeMin}–${rg.ridgeMax}`);
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
  // S5) widoczność ze startu (§5.3 (3), poprawka r1): skylinePlan → startVisibility (kamera §5.3, rzut kalenic) — ≥ housesMin kalenic tła i ≥ towersMin wież w oddali
  // ≥ over NDC nad sylwetką 1. linii w kadrze startu (check() w skylinePlan już liczy się w E; tu liczby do logu)
  const SVc = SK.secondLine.startVisible, sv = plan.startVisible;
  if (sv.houses.length < SVc.housesMin) fails.push(`S5 kalenice tła nad pierzeją w kadrze startu: ${sv.houses.length} < ${SVc.housesMin}`);
  if (sv.towers.length < SVc.towersMin) fails.push(`S5 wieże w oddali nad pierzeją w kadrze startu: ${sv.towers.length} < ${SVc.towersMin}`);
  console.log(`panorama: domów tła ${plan.houses.length} (tylna linia ${plan.houses.filter(h => h.back).length}), połaci ${nSlab}, elementów bram ${sky.filter(r => r.key === 'blocks').length}, wież w oddali ${plan.towers.length}, ptaków ${plan.birds.length}; S5 ze startu widoczne: ${sv.houses.map(v => `${v.id} +${v.over}`).join(', ')} | ${sv.towers.map(v => `${v.id} +${v.over}`).join(', ')}`);
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
    // G-zegar (poprawka r1): pasmo liny (lina → spód lampionu) w kadrze startowym poza tarczą zegara o ≥ clockClear.margin NDC (kalibracja: HEAD przed poprawką
    // lina z=12 zwis 1,64 → gap −0,129 = FAIL, uruchomione 2026-09-08; po regule zwis 2,34 → +0,063). W.clock z buildTower (D) na tym samym W; brak = test pusty → FAIL.
    const cl = clockClearance(W, ln.curve);
    if (!cl) fails.push(`${id}: brak W.clock (tower.js) — asercja G-zegar pusta`);
    else if (cl.gap < C.clockClear.margin) fails.push(`${id}: na tarczy zegara w kadrze startowym: odstęp ${cl.gap.toFixed(3)} < ${C.clockClear.margin} (t ${cl.t}, p ${f2(cl.p)}, zwis ${ln.zwis.toFixed(2)})`);
    if (ln.zwis > ln.zwis0 + 1e-6 && (!cl || cl.gap >= C.clockClear.margin + C.clockClear.sagStep)) fails.push(`${id}: zwis podniesiony ${ln.zwis0.toFixed(2)} → ${ln.zwis.toFixed(2)} bez potrzeby (odstęp ${cl?.gap.toFixed(3)})`);
  }
  const n4 = rec.length; buildBunting(W); const bun = rec.slice(n4);
  const keys = {}; for (const r of bun) keys[r.key] = (keys[r.key] || 0) + 1;
  if ((keys.bunting || 0) !== lines.length) fails.push(`G: geometrii bunting ${keys.bunting} ≠ lin ${lines.length}`);
  if ((keys.paperLit || 0) !== lines.length * C.lantern.count) fails.push(`G: lampionów ${keys.paperLit} ≠ ${lines.length * C.lantern.count}`);
  const lowest = Math.min(...bun.map(r => r.bb.clone().applyMatrix4(r.m).min.y));
  if (lowest < C.lantern.minY - 0.01) fails.push(`G: element girlandy poniżej ${C.lantern.minY}: y=${lowest.toFixed(2)}`);
  console.log(`girlandy: lin ${lines.length}, zwisy ${lines.map(l => l.zwis.toFixed(2)).join('/')}, y lin ${lines.map(l => l.A.y.toFixed(1)).join('/')}, lampionów ${keys.paperLit || 0}, elementów iron ${keys.iron || 0}, najniższy element ${lowest.toFixed(2)} m; zegar w kadrze startowym: odstępy ${lines.map(l => l.clock ? (l.clock.gap === Infinity ? '∞' : l.clock.gap.toFixed(3)) : '-').join('/')} (zwis losowy ${lines.map(l => l.zwis0.toFixed(2)).join('/')})`);
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
// U) podpisy miejsc (ui.js poiPlan, motyw #15): POI z CONFIG.pois, pozycje liczone z W — wieża = prostokąt kolizji z tower.js, karczma = dom szyldu
// (side 2, along > 0, pierwszy), kram = jeden z W.stalls, fontanna = koło (0,0); start gracza (jak main.js) poza r każdego; asercje check() z poiPlan liczą się w E
{
  W.ctx.player = { start: { x: 4, z: CONFIG.plaza.size / 2 - 3, yaw: 0.15 } }; // = rynek/src/main.js
  const pois = poiPlan(W), byAt = Object.fromEntries(pois.map(p => [p.at, p]));
  if (pois.length !== CONFIG.pois.length || pois.length < 4) fails.push(`U: POI ${pois.length} (CONFIG ${CONFIG.pois.length})`);
  // wieża po motywie #2 (tor A) jest walcem: kolizja = addCircle(tx, tz, rBot) i W.tower = {x, z, r}; ?notower2=1 → prostokąt 7×7 (stara kwadratowa)
  const tr = col.circles.find(c => Math.abs(c.r - CONFIG.tower.rBot) < 1e-6 && Math.abs(c.x - (W.tower?.x ?? NaN)) < 1e-6)
    ?? col.rects.find(r => Math.abs(r.hw - CONFIG.tower.size / 2) < 1e-6 && Math.abs(r.hd - CONFIG.tower.size / 2) < 1e-6);
  if (!tr || Math.hypot(tr.x - byAt.tower.x, tr.z - byAt.tower.z) > 0.01) fails.push(`U: POI wieży (${byAt.tower.x.toFixed(2)}, ${byAt.tower.z.toFixed(2)}) ≠ kolizja wieży ${tr ? `(${tr.x}, ${tr.z})` : 'brak'}`);
  const tav = allHouses.find(h => h.side === 2 && h.along > 0 && !h.setback);
  if (Math.abs(byAt.tavern.x + tav.along) > 0.01 || Math.abs(byAt.tavern.z - CONFIG.plaza.size / 2) > 0.01) fails.push(`U: POI karczmy (${byAt.tavern.x.toFixed(2)}, ${byAt.tavern.z.toFixed(2)}) ≠ lico domu szyldu (${-tav.along}, ${CONFIG.plaza.size / 2})`);
  if (!W.stalls.some(s => Math.hypot(s.x - byAt.stall.x, s.z - byAt.stall.z) < 1e-6)) fails.push('U: POI kramu nie leży na żadnym kramie');
  if (!col.circles.some(c => Math.abs(c.x) < 1e-6 && Math.abs(c.z) < 1e-6) || byAt.fountain.x !== 0 || byAt.fountain.z !== 0) fails.push('U: POI fontanny poza (0,0)');
  for (const p of pois) { const d = Math.hypot(p.x - 4, p.z - (CONFIG.plaza.size / 2 - 3)); if (d <= p.r) fails.push(`U: start w promieniu POI ${p.name} (d ${d.toFixed(2)} ≤ r ${p.r.toFixed(2)})`); }
  console.log(`POI: ${pois.map(p => `${p.at} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) r ${p.r.toFixed(2)} d(start) ${Math.hypot(p.x - 4, p.z - (CONFIG.plaza.size / 2 - 3)).toFixed(2)}`).join('; ')}`);
  // U2) bramka kadru (ui.js poiInView, wada ze zrzutów z S24: podpis „Kram sukiennika" wisiał, gdy kramu nie było w kadrze).
  // Telefon w pionie: fov pionowe 70°, aspect 412/915 → połowa POZIOMEGO kadru ≈ 18°; do tego kąt bryłowy own i luz CONFIG.ui.captionSlack.
  const halfH = Math.atan(Math.tan(CONFIG.bunting.clockClear.fov * Math.PI / 360) * (412 / 915)), sl = CONFIG.ui.captionSlack * Math.PI / 180;
  for (const q of pois) {                                  // z odległości r na osi: patrząc wprost — widać, tyłem i bokiem (90°) — nie
    const d = q.r, at = yaw => ({ x: q.x, z: q.z + d, yaw }); // gracz na południe od POI; app.js: yaw 0 → patrzy w −z, czyli na POI
    const lim = (halfH + Math.asin(Math.min(1, q.own / d)) + sl) * 180 / Math.PI;
    if (!poiInView(at(0), q, halfH, sl)) fails.push(`U2: ${q.name} niewidoczny mimo patrzenia wprost (d ${d.toFixed(2)}, limit ${lim.toFixed(1)}°)`);
    if (poiInView(at(Math.PI), q, halfH, sl)) fails.push(`U2: ${q.name} „widoczny" tyłem (180°, limit ${lim.toFixed(1)}°)`);
    if (lim < 90 && poiInView(at(Math.PI / 2), q, halfH, sl)) fails.push(`U2: ${q.name} „widoczny" bokiem (90°, limit ${lim.toFixed(1)}°)`);
    if (!poiInView({ x: q.x, z: q.z, yaw: Math.PI }, q, halfH, sl)) fails.push(`U2: ${q.name} niewidoczny, gdy gracz stoi w jego obrysie`);
    notes.push(`POI ${q.at}: połowa kadru ${(halfH * 180 / Math.PI).toFixed(1)}° + own ${(Math.asin(Math.min(1, q.own / d)) * 180 / Math.PI).toFixed(1)}° + luz ${CONFIG.ui.captionSlack}° = ${lim.toFixed(1)}° przy d = r = ${d.toFixed(2)} m`);
  }
}
// M) dym (props.js smokerChimneys — funkcja czysta, poprawka r1 K8): ≥ 2 kominy z dymem, wszystkie w kadrze startu (rzut kamerą startową jak w funkcji: |NDC| ≤ 1 − margin), ≤ max
{ const smokers = smokerChimneys(W), Sm = CONFIG.props.smoke, st = CONFIG.composition.start, K = CONFIG.bunting.clockClear;
  const cam = new THREE.PerspectiveCamera(K.fov, 412 / 915, 0.05, 300); cam.position.set(st.x, K.eye, st.z); cam.rotation.set(0, 0, 0, 'YXZ'); cam.rotation.y = st.yaw; cam.rotation.x = st.pitch; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const ndc = c => V(c.x, c.y, c.z).project(cam);
  if (smokers.length < 2 || smokers.length > Sm.max) fails.push(`M: ${smokers.length} kominów z dymem (oczekiwane 2..${Sm.max})`);
  for (const c of smokers) { const p = ndc(c); if (p.z >= 1 || Math.abs(p.x) > 1 - Sm.margin || Math.abs(p.y) > 1 - Sm.margin) fails.push(`M: komin s${c.side} along ${c.along.toFixed(1)} poza kadrem startu NDC (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`); }
  notes.push(`dym: ${smokers.length}/${W.chimneys.length} kominów w kadrze startu: ${smokers.map(c => `s${c.side} along ${c.along.toFixed(1)} NDC (${ndc(c).x.toFixed(2)}, ${ndc(c).y.toFixed(2)})`).join('; ')}`);
}
// E) asercje CHECK z modułów sceny (engine/src/check.js): w przeglądarce idą do results.errors renderu, tu liczą się jako FAIL
if (checkFailures() > 0) fails.push(`E: ${checkFailures()} nieudanych asercji CHECK w modułach sceny (linie "CHECK:" wyżej)`);
console.log(`sprawdzono: okien/ram ${nWin}, okien/ram wykuszy B1b ${nWinO}, połaci ${nRoof}, podparć B5 ${nSupp}, lukarn B5b ${nDormer}, kominów B7 ${nChim}, zastrzałów B8 ${nBrace} × okien ${nGlass} (przecięć ${nBraceHit}), szczytów schodkowych B5c ${nStep}, okien ścian bocznych B1c ${nSideWin}, domów ${allHouses.length}, kramów ${W.stalls.length}, wieża ${isRound ? 'walec' : 'prostopadłościan'} okien/tarcz ${nTowerWin}, szyldów F ${nSign} (stary łańcuch ${nSignOld}/8), szyldów F2 ${signs.length} (plakiet ${signs.filter(s => s.plaque).length}), lip H ${nTree}, parapetów K1 ${nSill}, zieleń K2 donic ${nGreen.planters}/skrzynek ${nGreen.sillBoxes}/rabatek ${nGreen.beds}/ławek ${nGreen.benches}, kramów J towar ${nGoods} bel ${nBales}, modeli put ${puts.length}, elementów w obszarze chodzenia B6 ${nWalk}, znanych wad (KNOWN_*) ${known}, asercji CHECK nieudanych ${checkFailures()}`);
notes.forEach(n => console.log('uwaga:', n));
console.log(fails.length ? `FAIL (${fails.length}):\n` + fails.join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
