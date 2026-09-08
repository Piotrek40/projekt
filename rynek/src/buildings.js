// Kamienice szachulcowe (parter kamienny z portalem łukowym, piętra z jetty, belki, okna z okiennicami, wykusz wieloboczny na kroksztynach, dach, komin).
// W.portals = [{x, z, ry, …}] — punkt na ziemi przed drzwiami każdego domu (kontrakt z greenery.js; szyldy w props.js czytają doorX/faceZ1/orielX).
// W.chimneys = [{x, y, z, side, along, setback}] — wierzch komina w świecie (props.js buildSmoke wybiera kominy w kadrze startu).
// W.sills = [{x, y, z, ry, w, floor, side, along, setback, shut, braced}] — środek górnej-PRZEDNIEJ krawędzi parapetu (timber box(w+0.16, 0.08, 0.1) na front+0.02 →
// wierzch +0.04, lico +0.07) okien parteru (floor 0) i piętra 1 (floor 1), ry = obrót fasady, w = szerokość okna, shut = okno z okiennicami, braced = pole z zastrzałem (kontrakt z greenery.js: skrzynki kwiatowe).
// Układ lokalny: początek na środku podstawy, +x wzdłuż pierzei, +y w górę, +z = FRONT (do placu). Metry. Do świata tylko przez L().
import * as THREE from 'three';
import { box, plane, gable, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall, checkCollisionCovers, checkAboveSurface, facadeNormal } from '../../engine/src/check.js';

// Graniastosłup z dowolnego wielokąta (Shape w XY, punkty [[x, y], …]), grubość t wzdłuż z (wyśrodkowana), UV w metrach — jak gable(); do naczółka (#12c)
function prism(points, t, mpt = 2) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mpt, uv.getY(i) / mpt);
  return g;
}

// Półpierścień łuku pełnego (oprawa portalu): promień wewnętrzny rIn, zewnętrzny rOut, w płaszczyźnie XY nad y = 0 (impost), wyciągnięty na grubość t
// wzdłuż z (wyśrodkowany), UV w metrach jak gable(). Policzone (seg 8): bbox x ±rOut, y 0..rOut, z ±t/2; wierzchołki nad y 0,05 mają r ∈ [rIn, rOut] — otwór pusty.
function archRing(rIn, rOut, t, seg, mpt = 2) {
  const s = new THREE.Shape(); s.moveTo(rOut, 0); s.absarc(0, 0, rOut, 0, Math.PI, false); s.lineTo(-rIn, 0); s.absarc(0, 0, rIn, Math.PI, 0, true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, curveSegments: seg, bevelEnabled: false }); g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mpt, uv.getY(i) / mpt);
  return g;
}

export function buildHouses(W) {
  const { ctx, CONFIG, P, T, H, B, houses, sideTransform, half } = W;
  const chimneys = [], portals = [], sills = [];
  for (const h of houses) {
    const r = rng(h.seedLocal);
    const tr = sideTransform(h.side, h.along, h.setback);
    const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(tr.x, 0, tr.z, tr.ry)); // lokalny → świat
    const LP = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry)); // punkt lokalny → świat (do asercji)
    const nrm = facadeNormal(tr.ry), id = `dom s${h.side} along${h.along.toFixed(1)}`; // normalna fasady w świecie (fasada w lokalnym +z); NIE `n` — w pętli pięter `n` to liczba słupków
    const w = h.w, d = H.depth, gf = H.groundFloor, fh = h.floorHeight; // wysokość kondygnacji per dom (layout.js, motyw #3)
    const off = [r(), r()];
    // parter kamienny
    B.add('stone', box(w, gf, d, T.stone.mpt, off), L(0, gf / 2, 0));
    // kolizja: obrys domu (osiowy w świecie — domy stoją wzdłuż osi)
    const wx = (h.side % 2 === 0) ? w : d, wz = (h.side % 2 === 0) ? d : w;
    ctx.addRect(tr.x, tr.z, wx / 2, wz / 2);
    checkCollisionCovers(id, new THREE.Box3().setFromPoints([LP(-w / 2, 0, -d / 2), LP(w / 2, gf, d / 2)]), { x: tr.x, z: tr.z, hw: wx / 2, hd: wz / 2 }); // prostokąt kolizji pokrywa parter
    W.dbgRect?.(tr.x, tr.z, wx / 2, wz / 2); W.dbgAxes?.(tr.x, 0.05, tr.z, tr.ry, 2); // ?boxes=1: L(0,0,0) domu, niebieska oś +z = fasada
    // piętra z jetty: każde wyższe piętro wysunięte do przodu
    let y = gf, jet = 0, frontBelow = d / 2; // frontBelow: lico kondygnacji niżej (parter d/2) — ściana, na której wiszą kroksztyny wykusza
    const plasterKey = 'plaster' + h.plaster;
    // Motyw #6 „wykusz wieloboczny + kroksztyny" (?nooriel=1): domy szersze niż minW, bliżej osi pierzei niż half − edgeGap (|along| = środek domu; przy krawędzi
    // ulicy wykusz wchodziłby w narożnik) i z kondygnacją NAD piętrem wykusza (daszek chowa wierzchołek w jej bryle). Pozycja i światło okien z osobnego strumienia
    // rng(seedLocal + 4) — wywołania r() domu bez zmian, więc reszta domu (okna, zastrzały, lukarna, komin) jak bez motywu.
    const O = CONFIG.houseDetail.oriel, Ro = rng(h.seedLocal + 4);
    const oriel = (!ctx.flags.nooriel && w > O.minW && Math.abs(h.along) < half - O.edgeGap && h.floors > O.floor + 1)
      ? { f: O.floor, cx: (Ro() - 0.5) * 2 * Math.min(w / 2 - O.r - O.edge, O.cxMax), lit: [0, 1, 2].map(() => Ro() < O.litShare) } : null; // cx równomiernie w ±min(…); 3 okna: świecące z udziałem litShare
    const inOriel = (f, x) => !!oriel && (f === oriel.f || f === oriel.f + 1) && Math.abs(x - oriel.cx) < O.r + 0.1; // 0.1: zapas, słupek/belka 0,16 przy wierzchołku ±90° wystawałaby z bryły
    // Motyw #9 „okiennice" (?noshutters=1; CONFIG.shutters): skrzydła w paint0..2 (kolor per dom), uchylone od ściany. Liczby policzone (§5.2 #9 K13):
    // zawias 0,030 przed licem ramy, wolny koniec 0,092 dla 4 pierzei i obu skrzydeł; przesunięcia cos/sin przez M4 (bez ręcznego sin/cos — §3.1).
    const Sh = CONFIG.shutters, Rs = rng(h.seedLocal + 6), paintKey = 'paint' + Rs.int(0, 2), noShut = ctx.flags.noshutters || ctx.flags.nopalette; // ?nopalette=1: nie ma kluczy paint*
    const Tb = CONFIG.houseDetail.timber, Ch = CONFIG.houseDetail.chimney; // poprawki r1: reguła zastrzał/okno, komin na kalenicy
    // Poprawka r1 (reżyseria): odsłonięte ściany boczne (h.open z layout.js: krawędź przy ulicy albo przy luce wieży) dostają siatkę belek jak fasada
    // (podwalina, oczep, słupki co Sw.field, zastrzały w polach nieparzystych, okna w parzystych), okno parteru i okna poddasza w szczycie bocznym; ?nosidewall=1.
    // Własny strumień rng(seedLocal + 8) → wywołania r() domu bez zmian. Lico ściany bocznej x = sx·w/2 (bryły pięter box(fw, …) bez wysunięcia w x),
    // element 0,01 przed licem jak na fasadzie (K4/K5); normalna ściany w świecie = lokalne (sx,0,0) = facadeNormal(tr.ry + sx·π/2) (policzone ry 0: (1,0,0) dla sx=+1).
    const Sw = CONFIG.houseDetail.sideWall, Rw = rng(h.seedLocal + 8), openSides = ctx.flags.nosidewall ? [] : [-1, 1].filter(sx => h.open?.[sx > 0 ? 1 : 0]);
    function sideWall(sx, f, y, fh, jet) {
      const xs = sx * w / 2, xf = xs + sx * 0.01, fd = d + jet, zc0 = jet / 2, nz = Math.max(2, Math.round(fd / Sw.field)), nS = facadeNormal(tr.ry + sx * Math.PI / 2), bt = 0.16; // bt jak belki fasady
      const idS = `${id} ściana ${sx > 0 ? '+x' : '-x'} p${f}`;
      B.add('timber', box(bt, bt, fd + bt, T.timber.mpt), L(xf, y + bt / 2, zc0));       // podwalina (długość fd + bt: końce w słupkach narożnych)
      B.add('timber', box(bt, bt, fd + bt, T.timber.mpt), L(xf, y + fh - bt / 2, zc0));  // oczep
      for (let i = 0; i <= nz; i++) {
        const z = zc0 - fd / 2 + i * fd / nz, field = fd / nz;
        B.add('timber', box(bt, fh, bt, T.timber.mpt), L(xf, y + fh / 2, z));
        if (i >= nz) continue;
        const zc = z + field / 2;
        if (i % 2 === 1) { // pole nieparzyste: zastrzał (w płaszczyźnie yz — obrót rx)
          if (Rw() < Sw.braceShare) { const sgn = Rw() < 0.5 ? 1 : -1; B.add('timber', box(bt * 0.8, Math.hypot(field, fh) * 0.7, bt * 0.8, T.timber.mpt), L(xf, y + fh / 2, zc, 0, Math.atan2(field, fh) * sgn)); } // rot: rx=+atan2(field, fh) → góra zastrzału (0,1,0) ku +z: rx=+0.540 → (0, 0.857, 0.514) (policzone); znak losowy = kierunek
        } else if (Rw() < Sw.windowShare) { // pole parzyste: okno (ry = sx·π/2: lokalne +z okna → ±x domu — policzone (0,0,1) → (±1,0,0))
          const [ww, wh] = Sw.win, wy = y + fh * 0.55, ry = sx * Math.PI / 2; // 0.55: wysokość środka jak okna fasady
          B.add(Rw() < Sw.litShare ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(xf, wy, zc, ry)); // szkło 0,04 jak okna fasady, 1 cm przed licem
          checkInFrontOfWall(`${idS} okno`, LP(xf, wy, zc), LP(xs, wy, zc), nS); // środek 1 cm przed licem ściany bocznej (d = 0,01 ≥ 0,005) — test dla 4 pierzei × 2 znaki sx w test_geometria
          B.add('timber', box(ww + 0.16, 0.08, 0.1), L(xs + sx * 0.02, wy - wh / 2, zc, ry)); // parapet / nadproże / słupek ramy jak okna fasady
          B.add('timber', box(ww + 0.16, 0.08, 0.1), L(xs + sx * 0.02, wy + wh / 2, zc, ry)); // nadproże (wymiary ram jak okna fasady)
          B.add('timber', box(0.06, wh, 0.1), L(xs + sx * 0.02, wy, zc, ry)); // słupek ramy
        }
      }
    }
    // parter i szczyt boczny odsłoniętej ściany: okno parteru w połowie głębokości; w szczycie bocznym (dom ∥ x) słup królewski + 2 okna poddasza po obu stronach kalenicy
    function sideWallGround(sx) {
      const xs = sx * w / 2, nS = facadeNormal(tr.ry + sx * Math.PI / 2), ry = sx * Math.PI / 2, [ww, wh] = Sw.groundWin, wy = 1.8; // 1.8: środek okna parteru jak na fasadzie
      B.add(Rw() < Sw.litShare ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(xs + sx * 0.01, wy, 0, ry)); // szkło 0,04, 1 cm przed licem parteru (x = sx·w/2), w połowie głębokości
      checkInFrontOfWall(`${id} ściana ${sx > 0 ? '+x' : '-x'} okno parteru`, LP(xs + sx * 0.01, wy, 0), LP(xs, wy, 0), nS); // d = 0,01 ≥ 0,005
      B.add('timber', box(ww + 0.15, 0.08, 0.1), L(xs + sx * 0.02, wy - wh / 2, 0, ry)); // rama 1,05 jak parter fasady
      B.add('timber', box(ww + 0.15, 0.08, 0.1), L(xs + sx * 0.02, wy + wh / 2, 0, ry)); // nadproże jak parter fasady
    }
    function sideWallAttic(sx, y, rise, topD, jet) {
      const xs = sx * w / 2, nS = facadeNormal(tr.ry + sx * Math.PI / 2), ry = sx * Math.PI / 2, [ww, wh] = Sw.atticWin, bt = 0.16; // szczyt boczny: gable(topD, rise, 0.3) z licem na x = sx·w/2
      B.add('timber', box(bt, rise * 0.9, bt, T.timber.mpt), L(xs + sx * 0.01, y + rise * 0.45, jet / 2)); // słup królewski (jak belka szczytu HEAD)
      for (const sz of [-1, 1]) {
        const zc = jet / 2 + sz * Sw.atticZ, wy = y + Sw.atticY, edge = y + rise * (1 - (Math.abs(zc - jet / 2) + ww / 2) / (topD / 2)); // krawędź szczytu nad skrajem okna
        check(wy + wh / 2 <= edge - 0.1, `${id} okno poddasza poza szczytem bocznym`, { top: wy + wh / 2, edge }); // 0.1: rama 0,08 + luz
        B.add(Rw() < Sw.litShare ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(xs + sx * 0.01, wy, zc, ry)); // szkło 0,04, 1 cm przed licem szczytu bocznego
        checkInFrontOfWall(`${id} ściana ${sx > 0 ? '+x' : '-x'} okno poddasza`, LP(xs + sx * 0.01, wy, zc), LP(xs, wy, zc), nS); // d = 0,01 ≥ 0,005
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(xs + sx * 0.02, wy - wh / 2, zc, ry)); // parapet (rama jak okna fasady)
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(xs + sx * 0.02, wy + wh / 2, zc, ry)); // nadproże
      }
    }
    for (const sx of openSides) sideWallGround(sx);
    const wingTip = new THREE.Vector3(Sh.wing / 2, 0, 0).applyMatrix4(M4(0, 0, 0, Sh.open)); // koniec skrzydła (wing/2, 0, 0) po obrocie open: x = wing/2·cos (0,121), z = wing/2·sin (0,031)
    const shutterReach = (ww, wing) => ww / 2 + Sh.gap + wingTip.x * (wing / Sh.wing) + wing / 2; // odległość środek okna → zewnętrzny skraj skrzydła (0,641 przy ww 0,75; 0,913 na parterze)
    const shutterOK = (field, cx, ground) => !noShut && (ground ? Math.abs(cx) + shutterReach(Sh.ground.ww, Sh.ground.wing) + Sh.ground.edgeGap <= w / 2 : field >= 2 * (shutterReach(Sh.ww, Sh.wing) + Sh.postClear)); // parter: w obrysie domu; piętro: pole ≥ 1,442
    function shutters(cx, wy, wh, faceZ, ww, wing, idS, posts) {
      const tipX = wingTip.x * (wing / Sh.wing), tipZ = Math.abs(wingTip.z) * (wing / Sh.wing), frameFace = faceZ + 0.02 + 0.05; // lico ramy okna: box(…, 0.1) na faceZ + 0.02 → przód +0,07; |tipZ|: koniec +x po ry>0 idzie w −z (tabela §3.1), a środek trzeba cofnąć o tyle W PRZÓD (pierwsza wersja bez abs: zawias 8 cm w ścianie — CHECK)
      const zc = frameFace + Sh.t / 2 + Sh.gap / 2 + tipZ; // środek skrzydła: tył przy zawiasie na frameFace + gap/2 (0,08), wolny koniec 2·tipZ dalej (0,162)
      for (const s of [-1, 1]) {
        const sx = cx + s * (ww / 2 + Sh.gap + tipX), m = L(sx, wy, zc, -s * Sh.open); // rot: ry=−s·open → wolny koniec (s·wing/2,0,0) ku +z (od ściany): s=−1, ry=+0.25: (−0.125,0,0) → (−0.121, 0, +0.031); zawias (+0.125,0,0) → (0.121, 0, −0.031) — policzone
        B.add(paintKey, box(wing, wh, Sh.t), m);
        const hinge = new THREE.Vector3(-s * wing / 2, 0, 0).applyMatrix4(m), free = new THREE.Vector3(s * wing / 2, 0, 0).applyMatrix4(m), d = p => p.clone().sub(LP(cx, wy, frameFace)).dot(nrm);
        check(d(hinge) >= 0.02 && d(hinge) <= 0.05, `${idS} okiennica: zawias nie przy ramie`, { d: d(hinge) });      // oczekiwane 0,030 (z tej samej macierzy m)
        check(d(free) >= 0.08, `${idS} okiennica: wolny koniec nie na zewnątrz`, { d: d(free) });                    // oczekiwane 0,092
        if (posts) check(Math.min(...posts.map(px => Math.abs(sx - px))) >= wing / 2 + Sh.postClear, `${idS} okiennica w słupku`, { sx, posts }); // ≥ 0,205 (K8; 0,234 przy polu 1,50)
        check(Math.abs(sx) + wing / 2 <= w / 2, `${idS} okiennica poza obrysem domu`, { sx, w });
      }
    }
    for (let f = 1; f < h.floors; f++) {
      if (h.jetty) jet += H.jetty;
      const fw = w, fd = d + jet;
      B.add(plasterKey, box(fw, fh, fd, T.plaster.mpt, off), L(0, y + fh / 2, jet / 2));
      // belki: narożne, poziome (podwalina/oczep), słupki co ~1.6 m, zastrzały ukośne
      const front = jet / 2 + fd / 2; // lico fasady w układzie domu (bryła piętra jest przesunięta o jet/2)
      const bt = 0.16, zf = front + 0.01;
      B.add('timber', box(fw + bt, bt, bt, T.timber.mpt), L(0, y + bt / 2, zf));
      B.add('timber', box(fw + bt, bt, bt, T.timber.mpt), L(0, y + fh - bt / 2, zf));
      const n = Math.max(2, Math.round(fw / 1.6));
      const orielHere = !!oriel && f === oriel.f, hidden = (x, halfW) => orielHere && Math.abs(x - oriel.cx) < O.r + halfW; // element piętra wykusza (środek x, półszerokość halfW) nachodzący na bryłę wykusza: geometria pominięta, r() bez zmian
      const braced = []; // braced[i] = pole i ma zastrzał (okiennice tylko w polach bez zastrzału — motyw #9)
      for (let i = 0; i <= n; i++) {
        const x = -fw / 2 + i * fw / n;
        if (!hidden(x, 0.2)) B.add('timber', box(bt, fh, bt, T.timber.mpt), L(x, y + fh / 2, zf)); // 0.2: pół słupka 0,08 + luz — słupek fasady nie zlewa się ze słupkiem narożnym wykusza (na ±1,11)
        if (i < n) { // zastrzał w polu — poprawka r1 (geometria): TYLKO pola nieparzyste (parzyste = okna; §5.2 „przęsła: parzyste okno, nieparzyste X"); na HEAD zastrzał i okno w środku TEGO SAMEGO pola: 148/316 okien pięter z belką przez szkło
          const draw = r() < Tb.braceShare; braced[i] = draw && i % 2 === 1; // to samo wywołanie r() co na HEAD (r() < 0.5) — kolejność losowań domu bez zmian; próg z CONFIG
          const len = Math.hypot(fw / n, fh) * 0.7, sgn = draw ? (r() < 0.5 ? 1 : -1) : 1; // HEAD: zastrzał 0,7 przekątnej pola, znak losowy pół na pół (r() znaku przy każdym losowaniu jak na HEAD)
          if (braced[i] && !hidden(x + fw / n / 2, 0.7 * fw / n / 2 + 0.1)) B.add('timber', box(bt * 0.8, len, bt * 0.8, T.timber.mpt), L(x + fw / n / 2, y + fh / 2, zf, 0, 0, Math.atan2(fw / n, fh) * sgn)); // rot: rz=±atan2(fw/n, fh) → góra zastrzału (0,1,0) ku ∓x: rz=+0.5 → (−0.479, 0.878, 0) (policzone); znak losowy = kierunek zastrzału; zasięg zastrzału w x = 0,7·pół pola + luz 0,1
        }
      }
      // belki stropowe wystające pod jetty (nie w zasięgu wykusza: pod nim kroksztyny, nad nim daszek)
      if (h.jetty) for (let i = 0; i <= n; i++) { const x = -fw / 2 + i * fw / n; if (!inOriel(f, x)) B.add('timber', box(bt, bt, H.jetty + 0.3, T.timber.mpt), L(x, y - bt / 2, front - (H.jetty + 0.3) / 2 - 0.05)); } // HEAD: belka jetty + 0,3 w ścianie, koniec 0,05 za licem
      // okna piętra: w polach między słupkami
      for (let i = 0; i < n; i++) {
        const skip = r() < 1 - Tb.windowShare, lit = !skip && r() < 0.35; // r() jak na HEAD (okno 75 %, świecące 35 % — losowane tylko przy oknie)
        if (braced[i] || (skip && i % 2 === 1)) continue; // poprawka r1: pole z zastrzałem bez okna (AABB zastrzału ∩ AABB okna = ∅, asercja B8 w teście); pole parzyste zawsze z oknem
        const cx = -fw / 2 + (i + 0.5) * fw / n, wh = 1.3; // HEAD: środek pola, okno 1,3 wys.
        const shut = shutterOK(fw / n, cx, false) && !braced[i] && Rs() < Sh.share; // okiennice: pole bez zastrzału, dość szerokie, udział share (strumień Rs — r() domu bez zmian)
        const ww = shut ? Sh.ww : Math.min(1.0, fw / n - 0.5); // okno z okiennicami zwężone do Sh.ww (0,75), inaczej HEAD
        if (hidden(cx, (shut ? shutterReach(Sh.ww, Sh.wing) : ww / 2 + 0.16) + 0.1)) continue; // pół okna + rama 0,08 z każdej strony (box ww + 0,16) albo zasięg okiennic + luz 0,1: nic nie wchodzi w słupek narożny wykusza
        B.add(lit ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(cx, y + fh * 0.55, front + 0.01));
        checkInFrontOfWall(`${id} okno p${f}`, LP(cx, y + fh * 0.55, front + 0.01), LP(cx, y + fh * 0.55, front), nrm); // środek okna 1 cm przed licem (d=0.01 ≥ 0.005)
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 - wh / 2, front + 0.02));
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 + wh / 2, front + 0.02));
        B.add('timber', box(0.06, wh, 0.1), L(cx, y + fh * 0.55, front + 0.02));
        if (shut) shutters(cx, y + fh * 0.55, wh, front, ww, Sh.wing, `${id} p${f} pole ${i}`, [cx - fw / n / 2, cx + fw / n / 2]); // 0.55: wysokość środka okna jak HEAD; słupki pola na ±pole/2 od środka
        if (f === 1) { const sp = LP(cx, y + fh * 0.55 - wh / 2 + 0.08 / 2, front + 0.02 + 0.1 / 2); sills.push({ x: sp.x, y: sp.y, z: sp.z, ry: tr.ry, w: ww, floor: f, side: h.side, along: h.along, setback: h.setback || 0, shut, braced: !!braced[i] }); } // W.sills (greenery.js): wierzch parapetu = środek + 0,08/2, lico = front + 0,02 + 0,1/2 (wymiary parapetu wyżej)
      }
      if (orielHere) orielBay(y, front, frontBelow, front + (h.jetty ? H.jetty : 0), bt);
      for (const sx of openSides) sideWall(sx, f, y, fh, jet);
      frontBelow = front;
      y += fh;
    }
    // Wykusz sześcioboczny (motyw #6): graniastosłup cylinder(r, r, fh, seg) obrócony o pół ściany (ry = π/seg → ŚCIANA, nie wierzchołek, na +z; policzone dla r 1,1:
    // wierzchołki (±0.55, ±0.953), (±1.1, 0)) ze środkiem NA licu piętra → połowa w fasadzie, 3 ściany na zewnątrz (k = −1/0/+1, normalne (∓0.866, 0, 0.5) / (0,0,1)),
    // każda z oknem i ramą timber; apotema ap = r·cos(π/seg) = 0,953 = wysięg. Daszek: stożek seg-boczny w kluczu dachu, podstawa na wierzchu wykusza, wierzchołek w bryle
    // piętra wyżej. Kroksztyny: trójkąty prostokątne pod wykuszem, pionowy bok na licu kondygnacji niżej (faceZBelow), wierzch pod podwaliną piętra (styk — B5).
    function orielBay(y, faceZ, faceZBelow, faceZAbove, bt) {
      const { cx, lit } = oriel, R = O.r, sect = 2 * Math.PI / O.seg, idO = `${id} wykusz`;
      const apOf = rad => new THREE.Vector3(0, 0, rad).applyMatrix4(M4(0, 0, 0, sect / 2)).z, ap = apOf(R); // apotema = z wierzchołka (0,0,r) obróconego o pół ściany (= r·cos(π/seg) = 0,953; macierzą, nie ręcznym cos — §3.1)
      const F = (k, x, y, z, ry = 0) => M4(x, y, z, ry).premultiply(L(cx, 0, faceZ, k * sect)); // układ ściany k (obrót o k·60° wokół osi wykusza; k połówkowe = wierzchołki) → świat
      const FP = (k, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(L(cx, 0, faceZ, k * sect)); // punkt w układzie ściany k → świat (do asercji)
      B.add(plasterKey, cylinder(R, R, fh + 0.01, O.seg, T.plaster.mpt), L(cx, y + fh / 2 - 0.005, faceZ, sect / 2)); // 0.01/0.005: spód 1 cm pod spodem bryły piętra — nie koplanarny (K5), wierzch na y + fh
      const [ww, wh] = O.win, wy = y + fh * 0.55; // okna na wysokości okien piętra
      for (const k of [-1, 0, 1]) {
        const nK = new THREE.Vector3(0, 0, 1).transformDirection(M4(0, 0, 0, tr.ry + k * sect)); // normalna ściany k w świecie — policzone dla ry 0: (−0.866,0,0.5) / (0,0,1) / (0.866,0,0.5)
        B.add(lit[k + 1] ? 'glassLit' : 'glass', box(ww, wh, 0.04), F(k, 0, wy, ap + 0.01));                    // szkło 1 cm przed licem ściany wykusza (jak okna pięter)
        checkInFrontOfWall(`${idO} okno ${k}`, FP(k, 0, wy, ap + 0.01), FP(k, 0, wy, ap), nK);               // d = 0,010 ≥ 0,005 wzdłuż WŁASNEJ normalnej ściany k
        B.add('timber', box(ww + 0.16, 0.08, 0.1), F(k, 0, wy - wh / 2, ap + 0.02));                          // parapet / nadproże / słupek ramy jak okna pięter
        B.add('timber', box(ww + 0.16, 0.08, 0.1), F(k, 0, wy + wh / 2, ap + 0.02));                          // nadproże (wymiary ram jak okna pięter)
        B.add('timber', box(0.06, wh, 0.1), F(k, 0, wy, ap + 0.02));                                          // słupek ramy
        B.add('timber', box(R + bt, bt, bt, T.timber.mpt), F(k, 0, y + bt / 2, ap + 0.01));                    // podwalina i oczep ściany k (długość bok + bt → końce w słupkach narożnych)
        B.add('timber', box(R + bt, bt, bt, T.timber.mpt), F(k, 0, y + fh - bt / 2, ap + 0.01));               // oczep ściany k
      }
      checkInFrontOfWall(`${idO} przód`, FP(0, 0, wy, ap + 0.01), LP(cx, wy, faceZ), nrm, ap);                 // środek okna przedniego ap + 0,01 = 0,963 przed licem piętra (wysięg = apotema)
      for (const kv of [-1.5, -0.5, 0.5, 1.5]) B.add('timber', box(bt, fh, bt, T.timber.mpt), F(kv, 0, y + fh / 2, R + 0.01)); // słupki narożne na wierzchołkach ±30°, ±90° (±90° = na licu piętra)
      // daszek: stożek; podstawa 1 cm pod wierzchem wykusza (w bryle wykusza; nie koplanarna ze spodem piętra wyżej — K5); wierzchołek za licem piętra wyżej
      const capM = L(cx, y + fh - 0.01 + O.capH / 2, faceZ, sect / 2); // 0.01: podstawa 1 cm pod wierzchem wykusza
      B.add('roof' + h.roof, cylinder(0, O.capR, O.capH, O.seg, T.roof.mpt), capM); // klucz dachu domu (roofKey niżej jest const w TDZ w chwili wywołania)
      const apex = new THREE.Vector3(0, O.capH / 2, 0).applyMatrix4(capM);
      check(apex.clone().sub(LP(cx, apex.y, faceZAbove)).dot(nrm) <= 0.005, `${idO} daszek przebija lico piętra wyżej`, { apex: apex.toArray(), faceZAbove }); // 0.005: bez jetty wierzchołek leży NA licu (d = 0)
      check(apOf(O.capR) >= ap + 0.1, `${idO} daszek bez okapu`, { capAp: apOf(O.capR), ap });                                 // 0.1: minimalny okap daszka przed ścianą wykusza (1,126 − 0,953 = 0,17)
      // kroksztyny co step pod wykuszem (2 przy r 1,1): prism (profil w XY: (0,0) ściana-góra, (w + ext, 0) zewnętrzny-góra, (ext, −h) i (0, −h) ściana-dół), grubość t.
      // ext = faceZ − faceZBelow (jetty 0,35 / 0 bez jetty — cykl 2): przy jetty kroksztyn z murem parteru sięga w + ext = 0,70 → wierzch 0,35 PRZED osią wykusza,
      // pod spodem sześciokąta (spód sięga z 0,745 przy x = cx ± 0,67 — policzone), a nie tylko pod strefą jetty; ścięcie 45° w × h na końcu, spód y − h bez zmian
      const C = O.corbel, nC = Math.max(2, Math.round(2 * R / C.step)), ext = faceZ - faceZBelow, reach = C.w + ext;
      const corbelProfile = ext > 0.01 ? [[0, 0], [reach, 0], [ext, -C.h], [0, -C.h]] : [[0, 0], [C.w, 0], [0, -C.h]]; // 0.01: bez jetty punkty (ext,−h) i (0,−h) by się pokryły — trójkąt
      for (let i = 0; i < nC; i++) {
        const xc = cx + (i - (nC - 1) / 2) * C.step;
        const mC = L(xc, y, faceZBelow, -Math.PI / 2); // ry=−π/2: lokalne +x (wysięg) → +z domu, policzone (0.35,0,0) → (0,0,0.35); wierzch na y = spód podwaliny
        B.add('timber', prism(corbelProfile, C.t, T.timber.mpt), mC);
        const inner = new THREE.Vector3(0, 0, 0).applyMatrix4(mC), outer = new THREE.Vector3(reach, 0, 0).applyMatrix4(mC); // policzone: (0.7,0,0) → dom (xc, y, faceZBelow + 0.7), (0.35,−0.35,0) → (xc, y − 0.35, faceZBelow + 0.35)
        checkInFrontOfWall(`${idO} kroksztyn ${i}`, outer, LP(xc, y, faceZBelow), nrm, reach - 0.005);        // zewnętrzny górny róg w + ext przed ścianą niżej (orientacja; 0.005: float)
        check(ext < 0.01 || outer.clone().sub(LP(xc, y, faceZ)).dot(nrm) >= C.w - 0.005, `${idO} kroksztyn ${i} nie sięga pod spód wykusza`, { ext, reach }); // przy jetty róg zewnętrzny ≥ w przed osią wykusza (pod sześciokątem)
        const back = LP(xc, y, faceZ + 0.01 - bt / 2), dIn = inner.clone().sub(back).dot(nrm), dOut = outer.clone().sub(back).dot(nrm); // rzut wierzchu kroksztynu na normalną od tyłu podwaliny
        check(Math.abs(inner.y - y) < 0.005 && Math.min(dOut, bt) - Math.max(dIn, 0) >= 0.05, `${idO} kroksztyn ${i} nie styka się z podwaliną`, { dIn, dOut, top: inner.y, y }); // nakładanie w rzucie ≥ 0,05 (min(dOut, bt) = 0,16 z jetty przy reach 0,70 / 0,09 bez), ten sam y
      }
    }
    // parter: drzwi w portalu łukowym (motyw #10a, ?noportal=1 = drzwi 2,3 + nadproże belkowe HEAD) i okna
    const doorX = (r() - 0.5) * (w - 3), faceZ0 = d / 2; // lico parteru (bez jetty)
    const Po = CONFIG.houseDetail.portal, portal = !ctx.flags.noportal, doorH = portal ? Po.doorH : 2.3; // 2.3: wysokość drzwi HEAD (z ?noportal=1)
    B.add('door', box(Po.doorW, doorH, 0.1, Po.doorW), L(doorX, doorH / 2, faceZ0 + 0.02)); // HEAD: drzwi 0,1 gr., UV doorW m/kafel, lico 2 cm przed parterem
    if (portal) portalArch(doorX, faceZ0);
    else B.add('timber', box(1.5, 0.14, 0.2, T.timber.mpt), L(doorX, 2.4, faceZ0 + 0.02)); // HEAD: nadproże belkowe
    { const pp = LP(doorX, 0, faceZ0 + Po.front); // punkt zieleni: front m przed licem drzwi, na ziemi (greenery.js: donice); szyldy (props.js) czytają resztę pól
      checkInFrontOfWall(`${id} punkt portalu`, pp, LP(doorX, 0, faceZ0), nrm, Po.front - 0.005); // 0.005: float
      portals.push({ x: pp.x, z: pp.z, ry: tr.ry, side: h.side, along: h.along, setback: h.setback || 0, w, seedLocal: h.seedLocal, doorX, faceZ: faceZ0, faceZ1: faceZ0 + (h.jetty ? H.jetty : 0), orielX: oriel ? oriel.cx : null, tr }); } // faceZ1: lico piętra 1 (jetty)
    for (const sx of [-1, 1]) {
      const cx = doorX + sx * 2.2; if (Math.abs(cx) > w / 2 - 0.9) continue;
      B.add(r() < 0.3 ? 'glassLit' : 'glass', box(0.9, 1.1, 0.04), L(cx, 1.8, faceZ0 + 0.01)); // HEAD: okno parteru 0,9 × 1,1, środek 1,8, 1 cm przed licem
      checkInFrontOfWall(`${id} okno parteru`, LP(cx, 1.8, faceZ0 + 0.01), LP(cx, 1.8, faceZ0), nrm); // HEAD
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 - 0.55, faceZ0 + 0.02)); // HEAD: parapet
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 + 0.55, faceZ0 + 0.02)); // HEAD: nadproże okna
      const shutG = shutterOK(0, cx, true) && Rs() < Sh.share;
      if (shutG) shutters(cx, 1.8, 1.1, faceZ0, Sh.ground.ww, Sh.ground.wing, `${id} parter`, null); // parter bez jetty: lico = d/2; skrzydła 0,45 przy oknie 0,9 (rama 1,05)
      { const sp = LP(cx, 1.8 - 0.55 + 0.08 / 2, faceZ0 + 0.02 + 0.1 / 2); sills.push({ x: sp.x, y: sp.y, z: sp.z, ry: tr.ry, w: 0.9, floor: 0, side: h.side, along: h.along, setback: h.setback || 0, shut: shutG, braced: false }); } // W.sills (greenery.js): parapet parteru (1,25 + 0,04 = 1,29; lico faceZ0 + 0,07), okno 0,9
      if (portal) check(Math.abs(cx - doorX) - (shutG ? shutterReach(Sh.ground.ww, Sh.ground.wing) : 1.05 / 2) >= Po.archOut + 0.05, `${id} okno parteru w oprawie portalu`, { cx, doorX }); // skraj ramy 1,05 (1,675 od drzwi) / okiennicy (1,287) ≥ ościeże 0,9 + 0,05
    }
    // Portal łukowy (motyw #10a): oprawa `key` (blocks) 1 cm przed licem parteru: ościeża od archIn do archOut, półpierścień archRing na impoście,
    // zwornik na szczycie łuku (out przed oprawą), próg na ziemi. Drzwi zostają w ścianie (lico +0,02) — widoczne przez otwór, rogi za pierścieniem.
    function portalArch(doorX, faceZ0) {
      const { archIn, archOut, impostY, t, key, keystone: K, threshold: Th } = Po, idP = `${id} portal`;
      const zc = faceZ0 + 0.01 + t / 2; // środek oprawy: od 1 cm przed licem (K5) do 1 cm + t
      for (const sx of [-1, 1]) B.add(key, box(archOut - archIn, impostY, t, T.blocks.mpt, off), L(doorX + sx * (archIn + archOut) / 2, impostY / 2, zc)); // ościeże: x od archIn do archOut od osi drzwi
      B.add(key, archRing(archIn, archOut, t, Po.seg, T.blocks.mpt), L(doorX, impostY, zc));
      checkInFrontOfWall(`${idP} łuk`, LP(doorX, impostY, zc), LP(doorX, impostY, faceZ0), nrm, t / 2 + 0.005); // środek łuku t/2 + 0,01 = 0,135 przed licem
      check(Math.hypot(Po.doorW / 2, doorH - impostY) <= archOut - 0.02, `${idP} róg drzwi wystaje za pierścień łuku`, { r: Math.hypot(Po.doorW / 2, doorH - impostY), archOut }); // 0,849 ≤ 0,88 (K13)
      const kTop = impostY + archOut + K.up, kZ = faceZ0 + 0.01 + (t + K.out) / 2; // zwornik: wierzch up nad szczytem łuku, od lica oprawy wystaje out
      B.add(key, box(K.w, K.h, t + K.out, T.blocks.mpt, off), L(doorX, kTop - K.h / 2, kZ));
      checkInFrontOfWall(`${idP} zwornik`, LP(doorX, kTop - K.h / 2, kZ + (t + K.out) / 2), LP(doorX, kTop - K.h / 2, zc + t / 2), nrm, K.out - 0.005); // przód zwornika out = 0,05 przed oprawą
      check(kTop <= gf - 0.05 && kTop <= gf - 0.16 - 0.02, `${idP} zwornik wyżej niż parter / belki jetty`, { kTop, gf }); // 2,625 ≤ 3,15 i ≤ 3,02 (belki jetty bt 0,16 od gf w dół)
      B.add(key, box(2 * archOut, Th.h, Th.d, T.blocks.mpt, off), L(doorX, Th.h / 2, faceZ0 + 0.01 + Th.d / 2)); // próg: spód na y = 0, od 1 cm przed licem do 1 cm + d
      check(Th.h <= 0.15, `${idP} próg wyższy niż stopień`, { h: Th.h }); // 0.15: stopień, nie przeszkoda
      // kolizja oprawy (K10): przy domach zamykających ulice obszar chodzenia sięga lica (layout.js: ulica do half + sl), więc ościeża 0,26 m i próg 0,36 m
      // przed licem dostają własny prostokąt osiowy (domy stoją wzdłuż osi) — środek i półwymiary z tej samej macierzy L co bryły
      const depthF = Math.max(t + K.out, Th.d) + 0.01, cF = LP(doorX, 0, faceZ0 + depthF / 2), alongAxisX = h.side % 2 === 0; // side 0/2: fasada wzdłuż x
      ctx.addRect(cF.x, cF.z, alongAxisX ? archOut : depthF / 2, alongAxisX ? depthF / 2 : archOut); W.dbgRect?.(cF.x, cF.z, alongAxisX ? archOut : depthF / 2, alongAxisX ? depthF / 2 : archOut);
      checkCollisionCovers(idP, new THREE.Box3().setFromPoints([LP(doorX - archOut, 0, faceZ0), LP(doorX + archOut, kTop, faceZ0 + depthF)]), { x: cF.x, z: cF.z, hw: alongAxisX ? archOut : depthF / 2, hd: alongAxisX ? depthF / 2 : archOut });
    }
    // dach
    const roofKey = 'roof' + h.roof, ov = H.overhang, pitch = h.pitch; // spadek per dom (layout.js, motyw #3)
    const topD = d + jet;
    let ridge, roofTopAt; // kalenica {topY, xHalf, zMid, zHalf} i wierzch połaci nad (x, z) w układzie domu — do komina (poprawka r1 K8/K9)
    if (h.gableFront) {
      // kalenica wzdłuż z: szczyt widoczny od placu
      const rise = (w / 2) * Math.tan(pitch), slope = Math.hypot(w / 2 + ov, rise), aG = Math.atan2(rise, w / 2 + ov), faceZ = topD / 2 + jet / 2; // faceZ: lico fasady poddasza
      // Motyw #12b „szczyt schodkowy" (?nostep=1 = trójkąt HEAD): decyzja i liczba schodków z osobnego strumienia rng(seedLocal + 2) (r() domu bez zmian)
      const St = CONFIG.houseDetail.step, Rd = rng(h.seedLocal + 2), stepped = !ctx.flags.nostep && Rd() < St.share, nSteps = Rd.int(...St.steps);
      const cut = stepped ? ov + St.slabIn : 0; // skrócenie połaci i kalenicy z przodu: koniec slabIn m za licem, schowany w murze schodków (bez okapu przed szczytem)
      const hw0 = w / 2 + ov, roofTopG = x => y + rise * (1 - Math.abs(x) / hw0) + 0.07 * slope / hw0; // wierzch połaci szczytowej nad x (płyta 0,14: +0,07/cos = ·slope/hw0)
      // poprawka r1 (K9, schodki): przy schodkach płyta kończy się out m WEWNĄTRZ muru szczytu (mur w + 2·side), bez okapu bocznego — na HEAD mur w + 2·ov miał narożniki 0,55 m poza ścianą boczną w powietrzu
      const xEnd = stepped ? w / 2 + St.side - St.out : hw0, fr = xEnd / hw0; // koniec połaci w x i udział długości połaci od kalenicy (bez schodków 1 = HEAD)
      for (const sx of [-1, 1]) B.add(roofKey, box(slope * fr, 0.14, topD + 2 * ov - cut, T.roof.mpt, off), L(sx * xEnd / 2, y + rise * (1 - fr / 2), jet / 2 - cut / 2, 0, 0, -sx * aG)); // rot: rz=−sx·a → koniec sx·x (okap) W DÓŁ, koniec x=0 (kalenica) w górze; policzone w 8, pitch 0.85, sx=+1, fr 1: okap (4.55, y, jet/2), kalenica (0, y+4.55, jet/2); środek = środek odcinka (0, y+rise) → (sx·xEnd, y + rise·(1 − fr))
      roofTopAt = (x, z) => roofTopG(x);
      ridge = { topY: y + rise + Math.max(0.1, 0.07 * slope / hw0), xHalf: 0, zMid: (jet / 2 - topD / 2 + faceZ - cut) / 2, zHalf: Math.max(0, (topD - cut) / 2 - Ch.endGap) }; // belka kalenicy 0,2 → +0,1 / wierzch płyty +0,07/cos; kalenica od tyłu do lica (−cut)
      B.add(plasterKey, gable(w, rise, topD, T.plaster.mpt), L(0, y, jet / 2));
      B.add('timber', box(0.2, 0.2, topD + 2 * ov - cut, T.timber.mpt), L(0, y + rise, jet / 2 - cut / 2)); // belka kalenicy 0,2 (HEAD), skrócona jak połacie
      if (stepped) stepGable(nSteps);
      else B.add('timber', box(0.14, rise * 0.9, 0.14, T.timber.mpt), L(0, y + rise * 0.45, faceZ + 0.01)); // belka szczytu (HEAD)
      // schodki: stos n boxów 'blocks' malejącej szerokości; schodek i ma spód na linii połaci przy zewnętrznym narożniku (y + i·sh) i wierzch par m nad
      // linią połaci przy wewnętrznym; lico muru St.out przed licem fasady; asercja: wierzch schodka ≥ wierzch płyty (oś + 0,07/cos) + 0,05 przy wewnętrznym narożniku
      // Poprawka r1 (K9): mur schodków w + 2·side (side 0,04 za ścianą boczną, nie ov 0,55 — narożnik nad ścianą, asercja B5c), schodek i od wierzchu płyty przy zewnętrznym
      // narożniku hwAt(i) (schodek 0 od stropu y) do parapet nad wierzchem przy wewnętrznym hwAt(i+1); nachodzenie kolejnych schodków = parapet (jak HEAD).
      function stepGable(n) {
        const hwS = w / 2 + St.side, hwAt = i => hwS * (1 - i / n); // półszerokość muru; zewnętrzny narożnik schodka i (x)
        check(hwS <= w / 2 + 0.05, `${id} mur schodków poza ścianą boczną`, { hwS, w }); // B5c: rzut narożnika najniższego stopnia nad ścianą (|x| ≤ w/2 + 0,05)
        for (let i = 0; i < n; i++) {
          const hw = hwAt(i), bottom = i === 0 ? y : roofTopG(hw), top = roofTopG(hwAt(i + 1)) + St.parapet;
          B.add('blocks', box(2 * hw, top - bottom, St.t, T.blocks.mpt, off), L(0, (bottom + top) / 2, faceZ + St.out - St.t / 2));
          check(top >= roofTopG(hwAt(i + 1)) + 0.05 && bottom <= roofTopG(hw) + 1e-6, `${id} schodek ${i} pod połacią / wisi nad połacią`, { top, bottom, roofTop: roofTopG(hwAt(i + 1)) }); // 0.05: margines jak B5b
        }
      }
    } else {
      // kalenica wzdłuż x: okap nad fasadą. Powierzchnia połaci (§5.2 #12): oś płyty roofY(z) = y + (eaveZ − z)·s, s = rise/(topD/2 + ov)
      // (NIE tan(pitch) — okap wydłuża połać); wierzch roofTopY = roofY + roofT/2 / cos(a) (+0,100 przy pitch 0,85; policzone 11,121 / 9,908 / 13,344 dla z 3,2 / 4,4 / 1,0)
      const rise = (topD / 2) * Math.tan(pitch), slope = Math.hypot(topD / 2 + ov, rise), a = Math.atan2(rise, topD / 2 + ov), s = rise / (topD / 2 + ov);
      const eaveZ = jet / 2 + topD / 2 + ov, roofT = 0.14; // z okapu (koniec +z płyty przedniej); grubość płyty
      const roofY = z => y + (eaveZ - z) * s, roofTopY = z => roofY(z) + roofT / 2 * slope / (topD / 2 + ov); // oś płyty / wierzch płyty: +roofT/2 / cos(a) = ·slope/(topD/2+ov) (nad połacią liczy się wierzch — K9)
      // Motyw #12c „naczółek" (?nohip=1 = pełny szczyt HEAD): decyzja z osobnego strumienia rng(seedLocal + 3); hipIn > 0 = kalenica krótsza o hipIn z każdej strony
      const Hp = CONFIG.houseDetail.hip, hipIn = (!ctx.flags.nohip && rng(h.seedLocal + 3)() < Hp.share) ? Hp.inset : 0;
      roofTopAt = (x, z) => roofTopY(jet / 2 + Math.abs(z - jet / 2)); // połać tylna = odbicie względem kalenicy z = jet/2 (dla |x| ≤ w/2 − hipIn)
      ridge = { topY: y + rise + Math.max(0.1, roofT / 2 * slope / (topD / 2 + ov)), xHalf: Math.max(0, w / 2 - hipIn - Ch.endGap), zMid: jet / 2, zHalf: 0 }; // kalenica od naczółka do naczółka (hipIn 0 bez naczółka)
      for (const sx of openSides) sideWallAttic(sx, y, rise, topD, jet);
      if (!hipIn) {
        for (const sz of [-1, 1]) B.add(roofKey, box(w + 2 * ov, roofT, slope, T.roof.mpt, off), L(0, y + rise / 2, jet / 2 + sz * (topD / 4 + ov / 2), 0, sz * a)); // rot: rx=+a (sz=+1, połać przednia) opuszcza koniec +z: okap (0, y, eaveZ), kalenica (0, y+rise, jet/2) — policzone (0, 9, 5.25) / (0, 13.952, 0.35) dla y 9, jet 0.7, pitch 0.85
        // szczyty boczne (trójkąty) — widoczne między domami różnej wysokości
        for (const sx of [-1, 1]) B.add(plasterKey, gable(topD, rise, 0.3, T.plaster.mpt), L(sx * (w / 2 - 0.15), y, jet / 2, Math.PI / 2)); // HEAD: ściana 0,3 w licu ściany bocznej
        B.add('timber', box(w + 2 * ov, 0.2, 0.2, T.timber.mpt), L(0, y + rise, jet / 2)); // HEAD: belka kalenicy 0,2 na całej długości z okapami
      } else hipRoof(hipIn);
      // naczółek: trójkąt dachu o podstawie 2hw na wysokości yb (przy x = ±(w/2+ov)) i wierzchołku na kalenicy w x = ±(w/2 − hipIn); połacie = sześciokąty
      // w płaszczyźnie stoku (okap w + 2ov, kalenica w − 2·hipIn, ukośny styk z naczółkiem); ściany szczytowe ścięte trapezem na wysokości osi naczółka przy licu zewnętrznym
      function hipRoof(hipIn) {
        const drop = (hipIn + ov) * Math.tan(pitch), yb = y + rise - drop, hw = drop / s, slant = Math.hypot(hipIn + ov, drop), tilt = Math.atan2(hipIn + ov, drop);
        const vS = slope * (1 - hw / (topD / 2 + ov)); // styk naczółka z połacią przy x = ±(w/2+ov), mierzony wzdłuż stoku od okapu
        const hexa = [[-(w / 2 + ov), 0], [w / 2 + ov, 0], [w / 2 + ov, vS], [w / 2 - hipIn, slope], [-(w / 2 - hipIn), slope], [-(w / 2 + ov), vS]]; // u wzdłuż x, v od okapu (0) do kalenicy (slope)
        for (const sz of [-1, 1]) B.add(roofKey, prism(hexa, roofT, T.roof.mpt), L(0, y, jet / 2 + sz * (topD / 2 + ov), 0, -sz * (Math.PI / 2 - a))); // rot: rx=−sz·(π/2−a) → lokalne +y (0,1,0) → (0, sin a, −sz·cos a): od okapu w górę stoku do kalenicy (0, y+rise, jet/2) — policzone s0 along 13.9: (0, 13.3, 0.35) dla obu sz
        for (const sx of [-1, 1]) {
          const m = L(sx * (w / 2 + ov), yb, jet / 2, -sx * Math.PI / 2, tilt); // rot: ry=−sx·π/2, rx=+tilt → wierzchołek (0, slant, 0) → (sx·(w/2−hipIn), y+rise, jet/2), podstawa (±hw, 0, 0) → z = jet/2 ± hw — policzone s0 along 13.9: apex (±3.61, 13.3, 0.35), podstawa (±5.16, 11.8, −1.4 / 2.1)
          B.add(roofKey, gable(2 * hw, slant, roofT, T.roof.mpt), m);
          const apex = new THREE.Vector3(0, slant, 0).applyMatrix4(m), base = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
          check(apex.y > base.y + 0.5, `${id} naczółek odwrócony`, { apex: apex.toArray(), base: base.toArray() });                 // 0.5: drop ≥ 1,34 przy pitch ≥ 0,7
          check(apex.distanceTo(LP(sx * (w / 2 - hipIn), y + rise, jet / 2)) < 0.01, `${id} naczółek nie na kalenicy`, { apex: apex.toArray() }); // 0.01: arytmetyka float
          const hCut = rise - hipIn * Math.tan(pitch); // wysokość ścięcia ściany szczytowej = oś naczółka przy licu zewnętrznym x = ±w/2 (wierzch ściany 0,07/cos w płycie)
          B.add(plasterKey, prism([[-topD / 2, 0], [topD / 2, 0], [hipIn, hCut], [-hipIn, hCut]], 0.3, T.plaster.mpt), L(sx * (w / 2 - 0.15), y, jet / 2, Math.PI / 2)); // trapez jak gable(topD, rise, 0.3) HEAD
        }
        B.add('timber', box(w - 2 * hipIn, 0.2, 0.2, T.timber.mpt), L(0, y + rise, jet / 2)); // belka kalenicy między wierzchołkami naczółków
      }
      // lukarna (te same 2 wywołania r() co na HEAD → komin bez zmian)
      if (r() < 0.5) {
        let dx = (r() - 0.5) * (w - 3); // HEAD: pozycja lukarny (2. wywołanie r())
        if (hipIn) { const dxMax = w / 2 - hipIn - CONFIG.houseDetail.dormer.w / 2 - 0.3; dx = Math.max(-dxMax, Math.min(dxMax, dx)); } // lukarna poza naczółkiem (0,3 m luzu)
        if (ctx.flags.nodormer) { // HEAD: pudełko zakopane w połaci (okno 0,26–0,74 m pod wierzchem płyty — KNOWN_B5B w teście)
          B.add(plasterKey, box(1.4, 1.2, 1.2, T.plaster.mpt), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.9)); // HEAD bez zmian
          B.add(roofKey, box(1.8, 0.12, 1.4, T.roof.mpt, off), L(dx, y + 1.5, topD / 2 + jet / 2 - 0.9, 0, 0.5)); // rot: rx=+0.5 → przód (+z, okap lukarny) niżej niż tył: (0,0,1) → (0, −0.479, 0.878)
          B.add('glass', box(0.7, 0.6, 0.04), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.28)); // HEAD bez zmian
        } else dormer(dx);
      }
      // Motyw #12a „lukarna NA połaci" (?nodormer=1): ściana czołowa stoi W płycie (spód roofTopY(zF) − sink), okno nad dachówką
      // (spód roofTopY(zF) + winUp), daszek pulpitowy łagodniejszy od połaci spotyka ją po `depth` m, policzki pod daszkiem schowane w strychu.
      function dormer(dx) {
        const D = CONFIG.houseDetail.dormer, idD = `${id} lukarna`;
        const zF = eaveZ - D.fromEave, Rf = roofTopY(zF);                                       // lico ściany czołowej; wierzch połaci pod nim
        const wallBottomY = Rf - D.sink, wallTopY = Rf + D.hFront, winBottomY = Rf + D.winUp;
        B.add(plasterKey, box(D.w, wallTopY - wallBottomY, D.wallT, T.plaster.mpt, off), L(dx, (wallBottomY + wallTopY) / 2, zF - D.wallT / 2));
        check(wallBottomY <= Rf - 0.05, `${idD} wisi nad połacią`, { wallBottomY, roofTopY: Rf, zF });          // 0.05: próg B5b (i) z §3.4
        const [ww, wh] = D.win;
        B.add('glass', box(ww, wh, 0.04), L(dx, winBottomY + wh / 2, zF + 0.01));                                // szkło 4 cm, 1 cm przed licem (jak okna pięter)
        checkAboveSurface(`${idD} okno`, LP(dx, winBottomY, zF), Rf, 0.05);                                     // spód okna ≥ wierzch płyty + 0,05 (B5b ii)
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(dx, winBottomY - 0.04, zF + 0.02));                        // parapet jak rama okien pięter; spód winUp − 0,08 = +0,02 nad połacią
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(dx, winBottomY + wh + 0.04, zF + 0.02));                   // nadproże jw.
        // daszek: oś capY(z) = wallTopY + capGap + (zF − z)·tc; tc < s, więc połać dogania daszek po depth = (hFront + capGap)/(s − tc) — obcięte do D.depth
        const drop = D.hFront + D.capGap;
        const depth = Math.min(D.depth[1], Math.max(D.depth[0], drop / (s - Math.tan(pitch * D.capRatio))));
        const tc = s - drop / depth, capPitch = Math.atan(tc), zBack = zF - depth;
        check(zBack > jet / 2 + 0.3, `${idD} sięga kalenicy`, { zBack, ridgeZ: jet / 2 });                        // 0.3: zapas przed belką kalenicy (0,2)
        const capY = z => wallTopY + D.capGap + (zF - z) * tc;
        const zA = zF + D.capOver, zB = zBack - 0.1, capLen = Math.hypot(zA - zB, capY(zA) - capY(zB));         // tył 0,1 m za punktem styku (schowany w płycie)
        const capM = L(dx, (capY(zA) + capY(zB)) / 2, (zA + zB) / 2, 0, capPitch); // rot: rx=+capPitch → koniec +z (przód, okap daszka) W DÓŁ; policzone dla s0 along 13.9 (capPitch 0.204, capLen 2.76): przód (−2.67, 12.08, 3.85), tył (−2.67, 12.63, 1.15)
        B.add(roofKey, box(D.w + 0.3, D.capT, capLen, T.roof.mpt, off), capM);                                  // daszek 0,15 m szerszy z każdej strony
        const capFront = new THREE.Vector3(0, 0, capLen / 2).applyMatrix4(capM), capBack = new THREE.Vector3(0, 0, -capLen / 2).applyMatrix4(capM);
        check(capBack.y > capFront.y + 0.2, `${idD} daszek odwrócony`, { front: capFront.toArray(), back: capBack.toArray() }); // 0.2: min różnica przód/tył (najpłytszy 0,43)
        // policzki: w układzie daszka (górna krawędź capGap pod osią daszka), od lica ściany do tyłu daszka; spód hC pod daszkiem = w strychu
        const hC = D.hFront + 0.3, cheekLen = capLen - D.capOver * Math.hypot(1, tc) - 0.02;                       // hypot(1,tc) = 1/cos(capPitch); 0.3: zapas, by spód policzka był ≥ 0,15 pod wierzchem płyty przy licu; 0.02: luz za licem
        for (const sx of [-1, 1]) B.add(plasterKey, box(D.cheekT, hC, cheekLen, T.plaster.mpt, off), M4(sx * (D.w - D.cheekT) / 2, -(hC / 2 + D.capGap), -(capLen - cheekLen) / 2).premultiply(capM));
      }
    }
    // komin NA kalenicy (poprawka r1 K8/K9; ?nochimridge=1 = HEAD: z = −1,5 od okapu, wierzch y + 2,2 — policzone kominy.mjs: 18/28 pod wierzchem płyty o 0,2–5,4 m, 8 w kalenicy
    // bez płyty nad sobą, 2 wystają; w elewacjach side1..3 zero kominów). To samo (jedyne) wywołanie r() co na HEAD; pozycja wzdłuż kalenicy Ch.endGap od jej końców (naczółek:
    // kalenica krótsza o hipIn; szczyt: od tyłu do lica), wierzch Ch.above nad wierzchem kalenicy (belka 0,2 → +0,1 / płyta +0,07/cos a); asercja z roofTopAt TEJ SAMEJ połaci.
    const u = r() - 0.5, legacy = !!ctx.flags.nochimridge; // HEAD: chx = (r() − 0,5)·(w − 2)
    const chx = legacy ? u * (w - 2) : u * 2 * ridge.xHalf, chz = legacy ? -1.5 : ridge.zMid + u * 2 * ridge.zHalf, chimTop = legacy ? y + 2.2 : ridge.topY + Ch.above; // HEAD (legacy): z −1,5 od środka, wierzch y + 2,2
    B.add('stone', box(Ch.w, chimTop - gf, Ch.w, T.stone.mpt, off), L(chx, (gf + chimTop) / 2, chz));
    if (!legacy) check(chimTop - roofTopAt(chx, chz) >= Ch.minAbove, `${id} komin pod połacią`, { chimTop, roofTop: roofTopAt(chx, chz), chx, chz }); // B7: wierzch komina ≥ minAbove nad wierzchem płyty pod nim (oczekiwane 0,9 na kalenicy)
    chimneys.push({ ...new THREE.Vector3(chx, chimTop, chz).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry)), side: h.side, along: h.along, setback: h.setback || 0 }); // {x, y, z} wierzchu + dom (props.js buildSmoke: dym z kominów w kadrze startu)
  }
  W.chimneys = chimneys; W.portals = portals; W.sills = sills;
}
