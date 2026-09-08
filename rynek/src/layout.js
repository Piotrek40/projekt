// Układ placu: obszar chodzenia, ulice, podział pierzei na kamienice (z ziarna) i transformacja pierzeja→świat.
import { plane, rng } from '../../engine/src/geometry.js';
import { check } from '../../engine/src/check.js';
import { towerPlacement } from './tower.js';

export function buildLayout(W) {
  const { ctx, R, CONFIG, P, T, H, S, half, B } = W;
  const groundExtent = half + CONFIG.plaza.streetLength + H.depth + 6;
  B.place('cobble', plane(groundExtent * 2, groundExtent * 2, T.cobble.mpt), 0, 0, 0, 0, -Math.PI / 2); // rot: rx=−π/2 → normalna płaszczyzny (0,0,1) → (0,1,0): podłoga leży na XZ, licem do góry (policzone)
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
  W.sw = sw; W.sl = sl; W.houses = houses; W.sideTransform = sideTransform;
}
