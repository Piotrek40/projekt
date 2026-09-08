// Układ placu: obszar chodzenia, ulice, podział pierzei na kamienice (z ziarna) i transformacja pierzeja→świat.
import * as THREE from 'three';
import { plane, rng, M4 } from '../../engine/src/geometry.js';
import { check, bboxOf } from '../../engine/src/check.js';
import { towerPlacement } from './tower.js';

export function buildLayout(W) {
  const { ctx, R, CONFIG, P, T, H, S, half, B } = W;
  // z panoramą (skyline.js) bruk sięga CONFIG.skyline.groundExtent (wieże w oddali stoją na gruncie); ?noskyline=1 → jak dawniej
  const extent0 = half + CONFIG.plaza.streetLength + H.depth + 6; // zasięg bez panoramy (52 m)
  const groundExtent = (!ctx.flags.noskyline && CONFIG.skyline.groundExtent) || extent0;
  // uvOffset kotwiczy wzór bruku tak, jak przy zasięgu extent0 (UV płaszczyzny liczy się od jej rogu — bez tego większa płaszczyzna przesuwa wzór na całym placu)
  B.place('cobble', plane(groundExtent * 2, groundExtent * 2, T.cobble.mpt, [(extent0 - groundExtent) / T.cobble.mpt, (extent0 - groundExtent) / T.cobble.mpt]), 0, 0, 0, 0, -Math.PI / 2); // rot: rx=−π/2 → normalna płaszczyzny (0,0,1) → (0,1,0) w górę, góra UV (0,1,0) → (0,0,−1) = północ (policzone §3.1)
  ctx.addWalkable(0, 0, half - 0.3, half - 0.3);
  const sw = CONFIG.plaza.streetWidth, sl = CONFIG.plaza.streetLength;
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const cx = dx * (half + sl / 2), cz = dz * (half + sl / 2);
    ctx.addWalkable(cx, cz, dx ? sl / 2 : sw / 2 - 0.3, dz ? sl / 2 : sw / 2 - 0.3);
  }

  // ---------- kamienice wokół placu ----------
  // Każda pierzeja: domy jeden przy drugim, przerwa na ulicę pośrodku. Dom stoi tuż za linią placu.
  const houses = [];
  function layoutSide(side) {
    // side: 0 = północ (z<0), 1 = wschód (x>0), 2 = południe (z>0), 3 = zachód (x<0)
    const segs = [[-half - H.depth, -sw / 2], [sw / 2, half + H.depth]]; // dwa odcinki pierzei z przerwą na ulicę
    for (const [a, b] of segs) {
      let pos = a, prev = null;
      while (b - pos > H.widthMin) {
        let w = Math.min(R.range(H.widthMin, H.widthMax), b - pos);
        if (b - pos - w < H.widthMin) w = b - pos; // ostatni dom domyka pierzeję
        const h = { side, along: pos + w / 2, w, floors: R.int(H.floorsMin, floorsMax), plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: R() < 0.35, jetty: R() < 0.7, seedLocal: R.int(1, 1e6) }; // szczyt od placu 35 %, wykusz 70 % (jak na HEAD)
        varyHouse(h, prev);
        houses.push(h); prev = h;
        pos += w;
      }
    }
  }
  // Motyw #3 „różne wysokości i spadki" (?noheights=1 = wszystkie domy jak na HEAD: 2–3 piętra, 2,9 m, 0,85 rad). Liczba pięter z ziarna
  // głównego R (ta sama liczba wywołań R co bez motywu → tynki, kramy i rekwizyty bez przetasowania); wysokość kondygnacji, spadek
  // i kierunek korekty z osobnego strumienia rng(seedLocal + 1) (buildings.js zaczyna od rng(seedLocal), więc inny strumień).
  // Reguła „nie dwa takie same obok": floors === prev.floors → ±1 (−1 przy maksimum albo losowo, gdy nie minimum; inaczej +1).
  const vary = ctx.flags.noheights ? null : H.vary;
  const floorsMax = vary ? vary.floorsMax : H.floorsMax;
  function varyHouse(h, prev) {
    const Rv = rng(h.seedLocal + 1);
    h.floorHeight = vary ? Rv.range(...vary.floorHeight) : H.floorHeight;
    h.pitch = vary ? Rv.range(...vary.roofPitch) : H.roofPitch;
    if (vary && prev && prev.floors === h.floors) h.floors += (h.floors === floorsMax || (h.floors > H.floorsMin && Rv() < 0.5)) ? -1 : 1; // 0.5: kierunek korekty losowy (pół na pół)
  }
  for (let s = 0; s < 4; s++) layoutSide(s);
  if (vary) checkHeights(houses, vary);
  // asercje motywu #3 (na liczbach seed 7 PRZED kodem: 16 par sąsiadów, 0 z tą samą liczbą pięter; piętra 2/3/4 = 3/11/10 → 3 różne)
  function checkHeights(houses, vary) {
    let same = 0, pairs = 0;
    for (let s = 0; s < 4; s++) {
      const row = houses.filter(h => h.side === s).sort((a, b) => a.along - b.along);
      for (let i = 1; i < row.length; i++) if (Math.abs((row[i].along - row[i].w / 2) - (row[i - 1].along + row[i - 1].w / 2)) < 0.01) { pairs++; if (row[i].floors === row[i - 1].floors) same++; } // sąsiedzi = stykające się krawędzie
    }
    check(same === 0, 'sąsiednie domy z tą samą liczbą pięter', { same, pairs });
    check(new Set(houses.map(h => h.floors)).size >= vary.minDistinctFloors, 'za mało różnych liczb pięter w pierzejach', { floors: [...new Set(houses.map(h => h.floors))] });
    for (const h of houses) check(h.floors >= H.floorsMin && h.floors <= vary.floorsMax && h.floorHeight >= vary.floorHeight[0] && h.floorHeight <= vary.floorHeight[1] && h.pitch >= vary.roofPitch[0] && h.pitch <= vary.roofPitch[1], 'dom poza zakresami motywu #3', { side: h.side, along: h.along, floors: h.floors, fh: h.floorHeight, pitch: h.pitch });
  }
  if (!ctx.flags.notower2) fitToTower(houses, towerPlacement(CONFIG), H);   // motyw #2: pierzeja N-W kończy się przed obrysem okrągłej wieży
  // domy zamykające ulice (widok w głąb ulicy kończy się fasadą)
  for (let s = 0; s < 4; s++) { const h = { side: s, along: 0, w: sw + 2 * H.depth, floors: 3, plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: false, jetty: true, seedLocal: R.int(1, 1e6), setback: sl }; varyHouse(h, null); houses.push(h); } // 3 piętra stałe; wysokość kondygnacji i spadek per dom
  if (!ctx.flags.nopalette) assignRoofs(houses, CONFIG.paletteOKLCH.slateShare);
  // Motyw #9 (paleta, §4.4): dom z plaster3 (róż H 15) zawsze pod roof2 (łupek) — roof0 H 44 / roof1 H 47 pod tynkiem H 43 to jedna barwa; udział łupku
  // = kwota round(slateShare·N) domów (przy losowaniu jednostajnym R.int(0,2) wychodziło 13/28 = 46 %): brakujące k = kwota − n(plaster3) domy to te
  // o najniższym Rs() ze strumienia rng(seedLocal + 5) (osobny strumień: R domu bez zmian → reszta sceny bez przetasowania); pozostałe roof0/roof1 z Rs.int.
  // Policzone dla seed 7: N 28, plaster3 3, kwota 8 → 5 losowych; roof2 = 8 (29 %). Losowanie R.int(0,2) w pętli zostaje (te same wywołania R), wynik nadpisany.
  function assignRoofs(houses, share) {
    const n3 = houses.filter(h => h.plaster === 3).length, quota = Math.round(share * houses.length), k = Math.max(0, quota - n3);
    const draws = new Map(houses.map(h => [h, rng(h.seedLocal + 5)]));
    const extra = new Set(houses.filter(h => h.plaster !== 3).map(h => [h, draws.get(h)()]).sort((a, b) => a[1] - b[1]).slice(0, k).map(x => x[0]));
    for (const h of houses) h.roof = h.plaster === 3 || extra.has(h) ? 2 : draws.get(h).int(0, 1);
    const n2 = houses.filter(h => h.roof === 2).length;
    check(houses.every(h => h.plaster !== 3 || h.roof === 2), 'dom plaster3 bez łupku');
    check(Math.abs(n2 / houses.length - share) <= 0.1, 'udział łupku poza slateShare ± 0,1', { n2, N: houses.length, share }); // 0.1: kwota zaokrąglona (1/28 = 0,036) + n3 > kwoty przy innym ziarnie
  }

  // Motyw #2: pierzeja N-W (side 0, along < 0) kończy się na krawędzi houseEdgeMax = tx − rBot − 0,3 = −10,5 (nie −3): ostatnie domy od strony
  // ulicy są odcinane — dom, który po odcięciu byłby węższy niż widthMin, znika, a poprzedni domyka pierzeję do tej krawędzi (ta sama reguła,
  // co „ostatni dom domyka pierzeję" w layoutSide). Odcinanie PO losowaniu (a nie krótszy segment) zostawia te same wywołania R, więc reszta
  // sceny (tynki, kramy, rekwizyty) nie przetasowuje się. Asercja „dom w wieży" na KRAWĘDZI (along = środek domu, nie krawędź).
  function fitToTower(houses, { tx, rBot, houseEdgeMax }, H) {
    const row = () => houses.filter(h => h.side === 0 && !h.setback && h.along < 0).sort((a, b) => b.along - a.along);
    let last = row()[0];
    while (last && last.along - last.w / 2 > houseEdgeMax - H.widthMin) { houses.splice(houses.indexOf(last), 1); last = row()[0]; } // po odcięciu < widthMin → znika
    if (last) { const left = last.along - last.w / 2; last.w = houseEdgeMax - left; last.along = left + last.w / 2; }
    check(Math.max(...row().map(h => h.along + h.w / 2)) <= houseEdgeMax + 0.01, 'dom w wieży', { tx, rBot, houseEdgeMax }); // policzone: dom along −12 w 8 (krawędź −8) oblewa, krawędź −10,5 przechodzi
    check(row().length >= 2 && !!last && last.w >= H.widthMin, 'pierzeja N-W po odcięciu ma < 2 domy albo dom węższy niż widthMin', { n: row().length, w: last?.w });
  }
  // transformacja: układ lokalny domu (fasada w +z, oś domu wzdłuż x) → świat
  function sideTransform(side, along, setback = 0) {
    const dist = half + H.depth / 2 + setback;
    switch (side) {
      case 0: return { x: along, z: -dist, ry: 0 };
      case 2: return { x: -along, z: dist, ry: Math.PI };
      case 1: return { x: dist, z: along, ry: -Math.PI / 2 };
      default: return { x: -dist, z: -along, ry: Math.PI / 2 };
    }
  }
  markOpenSides(houses);
  // Poprawka r1 (reżyseria): odsłonięte ściany boczne — krawędź domu (along ± w/2) bez sąsiada w tej samej pierzei i nie w narożniku placu (|krawędź| < half:
  // domy narożne sąsiednich pierzei przenikają się — K8, zamierzone); domy zamykające ulice pomijane (ściany boczne za domami narożnymi). buildings.js stawia
  // na nich belki i okna (?nosidewall=1). Policzone: zawsze 8 (2 segmenty pierzei × 4, każdy z jednym końcem przy ulicy albo przy luce wieży) — asercja.
  function markOpenSides(houses) {
    for (const h of houses) h.open = [-1, 1].map(sx => { const xe = h.along + sx * h.w / 2; return !h.setback && Math.abs(xe) < half && !houses.some(o => o !== h && o.side === h.side && !o.setback && xe > o.along - o.w / 2 - 0.1 && xe < o.along + o.w / 2 + 0.1); }); // 0.1: luz na styk krawędzi
    const n = houses.reduce((k, h) => k + h.open.filter(Boolean).length, 0);
    check(n === 8, 'liczba odsłoniętych ścian bocznych ≠ 8', { n, open: houses.filter(h => h.open.some(Boolean)).map(h => [h.side, +h.along.toFixed(1), h.open]) });
  }
  W.sw = sw; W.sl = sl; W.houses = houses; W.sideTransform = sideTransform;
  if (!ctx.flags.noground) buildGround(W);   // motyw #13: medalion wokół fontanny + kałuże pierwszego planu (CONFIG.ground)
}

// Motyw #13 „bruk" (?noground=1; poprawka r1 reżyserii): medalion wokół fontanny (pierścień rIn–rOut + rays promieni, klucz roof2 = łupek na stone_tiles_02,
// inny wzór i chłodniejszy od bruku) i kałuże pierwszego planu startu (klucz wet jak mokry bruk fontanny: ciemniejszy, gładszy; brzeg nieregularny). Nakładki leżą w XY i idą na XZ
// przez M4(0, y, 0, 0, −π/2) — rot: rx=−π/2 → normalna (0,0,1)→(0,1,0), lokalne +y → −z (policzone §3.1, jak fountain.js buildWet); UV jak podłoga:
// (x + extent0)/mpt (layout: plane 2·extent z uvOffset → UV bruku = (x + extent0)/mpt). Liczby: CONFIG.ground; pozycje kałuż policzone dla kamery startu (config.js).
function buildGround(W) {
  const { CONFIG, B, T, H, half } = W, G = CONFIG.ground, F = CONFIG.fountain, S = CONFIG.stalls, Cp = CONFIG.composition;
  const extent0 = half + CONFIG.plaza.streetLength + H.depth + 6; // = extent0 wyżej (zasięg bruku bez panoramy, 52 m) — kotwica wzoru
  const ground = (g, mpt, y) => { // UV w metrach świata + macierz nakładki na bruku
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + extent0) / mpt, (p.getY(i) + extent0) / mpt);
    return M4(0, y, 0, 0, -Math.PI / 2); // rot: rx=−π/2 → nakładka w XZ, normalna w górę, lokalne +y → −z (policzone §3.1)
  };
  // --- medalion: pierścień + promienie (sektory RingGeometry) ---
  const M = G.medallion, mpt = T.tiles.mpt, rayR0 = M.rOut + M.rayGap, rayR1 = rayR0 + M.rayLen;
  check(M.rIn >= F.wet.r + M.gapWet, 'medalion na mokrym bruku fontanny', { rIn: M.rIn, wet: F.wet.r });   // 6,0 ≥ 5,2 + 0,5
  check(M.rIn >= CONFIG.greenery.benches.dist + M.gapBench, 'medalion pod ławkami', { rIn: M.rIn, benches: CONFIG.greenery.benches.dist });   // 6,0 ≥ 5,6 + 0,3
  check(rayR1 <= S.ringRadius - S.ringJitter - S.collideR, 'promienie medalionu pod kramami', { rayR1, ringIn: S.ringRadius - S.ringJitter - S.collideR });   // 8,2 ≤ 8,4
  { const ring = new THREE.RingGeometry(M.rIn, M.rOut, M.seg, 1); B.add('roof2', ring, ground(ring, mpt, M.y)); }
  for (let k = 0; k < M.rays; k++) {
    const a = k * Math.PI * 2 / M.rays, dth = M.rayW / M.rOut;   // kąt świata promienia (od +z ku +x, jak ring:), szerokość kątowa = rayW przy rOut
    // theta RingGeometry biegnie od lokalnego +x ku +y; po rx=−π/2 lokalne +y → −z, więc kąt świata a (od +z ku +x) = theta a − π/2 (policzone pos2.mjs: a 0,5 → środek (3,73, 0, 6,83))
    const g = new THREE.RingGeometry(rayR0, rayR1, 2, 1, a - Math.PI / 2 - dth / 2, dth), m = ground(g, mpt, M.y);
    const c = bboxOf(g, m).getCenter(new THREE.Vector3()), da = Math.abs(((Math.atan2(c.x, c.z) - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    check(da < 0.01 && Math.abs(Math.hypot(c.x, c.z) - (rayR0 + rayR1) / 2) < 0.05, 'promień medalionu nie na swoim kącie/promieniu', { k, a, c: c.toArray(), da });   // środek AABB sektora na kącie a i promieniu środkowym ± 5 cm
    B.add('roof2', g, m);
  }
  // --- kałuże: dyski wet (nieregularny brzeg) na pierwszym planie startu ---
  const Pd = G.puddles, ringOuter = S.ringRadius + Math.max(S.ringJitter, Cp.repoussoir.ringOut) + S.collideR;   // 11,5 + 1,5 + 1,6 = 14,6: zewnętrzny skraj kół kolizji kramów
  const Ln = CONFIG.lanterns, lanterns = Array.from({ length: Ln.count }, (_, i) => { const a = (i + 0.5) / Ln.count * Math.PI * 2; return new THREE.Vector3(0, 0, Ln.ringRadius).applyMatrix4(M4(0, 0, 0, a)); });   // jak props.js buildLanterns: (sin a·R, cos a·R)
  Pd.list.forEach((p, i) => {
    const id = `kałuża ${i} (${p.x}, ${p.z})`;
    check(Math.hypot(p.x, p.z) - p.r >= ringOuter, id + ' w pierścieniu kramów', { d: Math.hypot(p.x, p.z) - p.r, ringOuter });
    check(Math.abs(p.x) + p.r <= half - 0.3 && Math.abs(p.z) + p.r <= half - 0.3, id + ' poza placem');   // 0,3: margines obszaru chodzenia (addWalkable wyżej)
    check(lanterns.every(l => Math.hypot(l.x - p.x, l.z - p.z) >= p.r + Pd.lanternGap), id + ' pod latarnią');
    check(Pd.list.every((q, j) => j === i || Math.hypot(q.x - p.x, q.z - p.z) >= p.r + q.r), id + ' nachodzi na inną kałużę');
    const g = new THREE.CircleGeometry(p.r, Pd.seg), pos = g.attributes.position, Rj = rng(Pd.seed + i);   // wierzchołek 0 = środek, 1..seg+1 = obwód (ostatni = pierwszy)
    for (let k = 1; k <= Pd.seg; k++) { const f = 1 + Pd.jitter * (Rj() * 2 - 1); pos.setXY(k, pos.getX(k) * f, pos.getY(k) * f); }   // brzeg r·(1 ± jitter)
    pos.setXY(Pd.seg + 1, pos.getX(1), pos.getY(1));   // domknięcie obwodu (CircleGeometry powtarza pierwszy wierzchołek obwodu)
    g.translate(p.x, -p.z, 0);   // lokalne +y → −z, więc z świata = −y lokalne (ta sama macierz co medalion)
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: pos.count }, () => [1, 1, 1, 1]).flat(), 4));   // mat.wet: vertexColors RGBA — kałuża pełnym kryciem (ostry brzeg)
    const m = ground(g, T.cobble.mpt, Pd.y), c = bboxOf(g, m).getCenter(new THREE.Vector3());
    check(Math.abs(c.x - p.x) <= p.r * Pd.jitter + 0.01 && Math.abs(c.z - p.z) <= p.r * Pd.jitter + 0.01 && Math.abs(c.y - Pd.y) < 1e-6, id + ' nie tam, gdzie CONFIG', { c: c.toArray() });   // środek AABB w r·jitter + 1 cm od (x, z)
    B.add('wet', g, m);
  });
  W.puddles = Pd.list;
}
