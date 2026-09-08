// Test numeryczny geometrii rynku BEZ przeglądarki: uruchamia prawdziwe moduły sceny (layout, buildings, stalls, tower) ze stubem
// kontekstu i sprawdza asercje przestrzenne na faktycznych macierzach (klasy błędów z przestrzen.md §3: znak obrotu, lico vs środek,
// kolizja vs bryła, 4 strony pierzei). Uruchom: bash audyt/testy/geo_test.sh (= bundle geo/entry.mjs → geo/scene.bundle.mjs + ten test)
// albo komendą z rynek/PROMPT.md §3.4. Exit 1 przy FAIL. Nową cechę dopisujesz jako nową asercję (najpierw skalibrowaną na znanym-dobrym przypadku).
import { THREE, M4, rng, CONFIG, buildLayout, buildHouses, buildStalls, buildTower, buildCart, signMatrix, signPlacements, checkFailures } from './geo/scene.bundle.mjs';
// Znane wady HEAD (B6): element w obszarze chodzenia bez kolizji — lista ma się KURCZYĆ (kto dotyka modułu, naprawia i usuwa wpis). Dopasowanie: klucz + środek AABB ± 0,1 m.
const KNOWN_B6 = [
  { key: 'timber', x: -9.94, z: 10.11, why: 'dyszel wozu (props.js buildCart, box(2.2,0.1,0.1) na L(−2.2,0.75,±0.4,0,0,0.08)): 2,24 m od koła (−8,9) r 1,5 — gracz wchodzi w dyszel; naprawa: addCircle w L(−2.2,0,0) r 0,6 (motyw dotykający buildCart)', date: '2026-09-07' },
  { key: 'timber', x: -9.43, z: 10.72, why: 'dyszel wozu, druga belka (jw.)', date: '2026-09-07' },
];
// Znane wady HEAD (B5b ii): okna lukarn zakopane w połaci (buildings.js blok „lukarna" na HEAD: spód okna 0,44 m POD wierzchem płyty) — usuwa motyw #12 (lukarny NA połaci).
const KNOWN_B5B = []; // 10 lukarn HEAD usunięte 2026-09-07 przez motyw #12a (lukarny NA połaci: spód okna +0,10 nad wierzchem płyty)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const f2 = v => v.toArray().map(x => +x.toFixed(2));
function makeW() {
  const rec = [];
  const B = { add(key, g, m) { g.computeBoundingBox(); rec.push({ key, bb: g.boundingBox.clone(), m: m ? m.clone() : new THREE.Matrix4(), type: g.type, params: g.parameters }); }, // type/params: klasyfikacja trzonu wieży w D (box vs walec)
              place(key, g, x, y, z, ry = 0, rx = 0, rz = 0) { this.add(key, g, M4(x, y, z, ry, rx, rz)); } };
  const col = { rects: [], circles: [] };
  const ctx = { addWalkable() {}, addRect: (x, z, hw, hd) => col.rects.push({ x, z, hw, hd }), addCircle: (x, z, r) => col.circles.push({ x, z, r }), flags: {} };
  // stub modeli (PROMPT §3.4): W.bounds = Map z Box3 (0,0,0)→(1,1,1) dla KAŻDEJ nazwy (modele z Poly Haven nie są ładowane offline), W.put rejestruje
  // {name, x, y, z, ry, scale} w `puts` (buildCart stawia nim skrzynię i kosz na wozie; motywy #5/#7/#10 mogą sprawdzać pozycje modeli z funkcji czystych)
  const bounds = new (class extends Map { get(n) { return super.get(n) ?? new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)); } })();
  const puts = [];
  const put = (name, x, y, z, ry = 0, scale = 1) => { puts.push({ name, x, y, z, ry, scale }); return true; };
  return { W: { ctx, R: rng(CONFIG.seed), CONFIG, P: CONFIG.palette, T: CONFIG.textures, H: CONFIG.house, S: CONFIG.plaza.size, half: CONFIG.plaza.size / 2, B, put, bounds }, rec, col, puts };
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
const allPortals = []; // W.portals z każdego izolowanego buildHouses (do F2)
for (const h of allHouses) {
  const n0 = rec.length; W.houses = [h]; buildHouses(W); allPortals.push(...W.portals);
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
    if (r.key.startsWith('glass')) {
      const top = roofTopAt(c.z);
      if (top === null) fails.push(`B5b ${idH}: okno lukarny poza połacią (z ${c.z.toFixed(2)})`);
      else if (b.min.y < top + 0.05) { const msg = `B5b(ii) ${idH}: okno lukarny zakopane — spód ${b.min.y.toFixed(2)} < wierzch połaci ${top.toFixed(2)} + 0,05 przy z ${c.z.toFixed(2)}`; if (KNOWN_B5B.some(k => k.side === h.side && Math.abs(k.along - h.along) < 0.05)) { known++; notes.push('znane (KNOWN_B5B): ' + msg); } else fails.push(msg); }
    }
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
// G) wóz (props.js buildCart) — geometria Batch; modele przez stub put (rejestrowane w puts)
buildCart(W);
if (!puts.some(p => p.name === 'wooden_crate_01') || !puts.some(p => p.name === 'wicker_basket_01')) fails.push('G stub W.put: buildCart nie zarejestrował skrzyni i kosza na wozie');
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
    if (!walk.some(w => wb.max.x > w.x - w.hw && wb.min.x < w.x + w.hw && wb.max.z > w.z - w.hd && wb.min.z < w.z + w.hd)) continue;
    nWalk++;
    const cx = (wb.min.x + wb.max.x) / 2, cz = (wb.min.z + wb.max.z) / 2;
    if (covered(cx, cz)) continue;
    const msg = `B6 ${r.key} w obszarze chodzenia bez kolizji: środek AABB (${cx.toFixed(2)}, ${((wb.min.y + wb.max.y) / 2).toFixed(2)}, ${cz.toFixed(2)}), min.y ${wb.min.y.toFixed(2)}`;
    if (KNOWN_B6.some(k => k.key === r.key && Math.hypot(k.x - cx, k.z - cz) < 0.1)) { known++; notes.push('znane (KNOWN_B6): ' + msg); } else fails.push(msg);
  }
}
// E) asercje CHECK z modułów sceny (engine/src/check.js): w przeglądarce idą do results.errors renderu, tu liczą się jako FAIL
if (checkFailures() > 0) fails.push(`E: ${checkFailures()} nieudanych asercji CHECK w modułach sceny (linie "CHECK:" wyżej)`);
console.log(`sprawdzono: okien/ram ${nWin}, okien/ram wykuszy B1b ${nWinO}, połaci ${nRoof}, podparć B5 ${nSupp}, lukarn B5b ${nDormer}, domów ${allHouses.length}, kramów ${W.stalls.length}, wieża ${isRound ? 'walec' : 'prostopadłościan'} okien/tarcz ${nTowerWin}, szyldów F ${nSign} (stary łańcuch ${nSignOld}/8), szyldów F2 ${signs.length} (plakiet ${signs.filter(s => s.plaque).length}), modeli put ${puts.length}, elementów w obszarze chodzenia B6 ${nWalk}, znanych wad (KNOWN_*) ${known}, asercji CHECK nieudanych ${checkFailures()}`);
notes.forEach(n => console.log('uwaga:', n));
console.log(fails.length ? `FAIL (${fails.length}):\n` + fails.join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
