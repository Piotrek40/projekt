// Zieleń (motyw #greenery, tor „plac"; ?nogreenery=1 = moduł pusty, props.js nie ładuje wtedy modeli CONFIG.greenery.models): donice z krzewami przy portalach
// (W.portals), skrzynki kwiatowe na parapetach (W.sills — kontrakt z buildings.js), rabatki w skrzyniach wokół lip (W.trees), ławki wokół fontanny.
// Układ lokalny każdej grupy: początek na ziemi pod punktem odniesienia (portal / lico parapetu / oś lipy / środek fontanny), +x wzdłuż fasady, +y w górę,
// +z = FRONT (od ściany ku placowi; przy lipach i ławkach od środka fontanny na zewnątrz). Metry. Do świata tylko przez L() = M4(lokalne).premultiply(M4(x, 0, z, ry)).
// greeneryPlan(W) = FUNKCJA CZYSTA (bez DOM/loaderów; asercja K2 w audyt/testy/test_geometria.mjs, eksport geo/entry.mjs); buildGreenery dodaje geometrię (W.B),
// modele (W.put — noinst działa) i asercje z TYCH SAMYCH macierzy. Wszystkie liczby: CONFIG.greenery. Bez Math.sin/cos: pozycje na okręgach przez M4(…, kąt).
import * as THREE from 'three';
import { box, M4, rng } from '../../engine/src/geometry.js';
import { check, checkInFrontOfWall, checkCollisionCovers, facadeNormal, bboxOf } from '../../engine/src/check.js';
import { oklch } from './color.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = m => new THREE.Vector3().setFromMatrixPosition(m);
const shuffle = (arr, R) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }; // Fisher–Yates na strumieniu R
const dims = (bounds, n) => { const b = bounds.get(n); return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; };

// Plan zieleni: {planters, sillBoxes, beds, benches} — pozycje modeli w świecie ({name, x, y, z, ry, scale}) i macierze skrzynek (W.B). Własny strumień
// rng(seed + seedOffset): reszta sceny (W.R) bez przetasowania. Wybór domów/parapetów losowy z tego strumienia.
export function greeneryPlan(W) {
  const { CONFIG, bounds } = W, portals = W.portals ?? [], sills = W.sills ?? [], trees = W.trees ?? [];
  const G = CONFIG.greenery, Po = CONFIG.houseDetail.portal, R = rng(CONFIG.seed + G.seedOffset), half = W.half, tower = W.tower;
  // tylko przed placem: domy narożne sąsiednich pierzei przenikają się (K8, layout.js), więc element o współrzędnej wzdłuż pierzei poza ±(half − pół szerokości) stałby w cudzym domu;
  // z dala od wieży (walec r W.tower.r wchodzi 2 m w plac przy pierzei N): odstęp ≥ pół szerokości + 0,1
  const onPlaza = (alongCoord, halfW) => Math.abs(alongCoord) + halfW <= half;
  const clearOfTower = (c, halfW) => !tower || Math.hypot(c.x - tower.x, c.z - tower.z) >= tower.r + halfW + 0.1; // 0.1: luz od podstawy wieży (r 3,5)
  // --- donice przy portalach: domy przy placu (bez setback), po stronie drzwi PRZECIWNEJ do ulicy (szyld wisi po stronie ulicy — props.js signPlacements) ---
  const Pl = G.planters, pb = dims(bounds, Pl.box), planters = [];
  for (const p of shuffle(portals.filter(p => !p.setback), R)) {
    if (planters.length >= Pl.count) break;
    const sgn = Math.sign(p.along) || 1;
    const lx = p.doorX + sgn * (Po.archOut + Pl.gap + pb.w / 2), lz = p.faceZ + Pl.gap + pb.d / 2; // środek: za ościeżem + luz + pół donicy; tył donicy luz przed licem parteru
    if (Math.abs(lx) + pb.w / 2 > p.w / 2 - Pl.edge) continue; // nie mieści się w obrysie domu (zapas edge od krawędzi)
    const F = (x, y, z, ry = 0) => M4(x, y, z, ry).premultiply(M4(p.tr.x, 0, p.tr.z, p.tr.ry)); // układ domu (portal) → świat
    const shrubY = pb.h - Pl.soilDepth; // spód krzewu soilDepth pod krawędzią donicy (ziemia w donicy)
    const shrubs = Array.from({ length: Pl.shrubs }, (_, i) => { const sx = (i - (Pl.shrubs - 1) / 2) * Pl.shrubX, q = P(F(lx + sx, shrubY, lz)); return { name: Pl.shrub, x: q.x, y: q.y, z: q.z, ry: R.range(0, Math.PI * 2), scale: Pl.shrubScale, lx: sx }; }); // krzewy co shrubX wokół środka donicy (3 → −0,28/0/+0,28; cykl 2: 2·shrubX = ±0,56 poza donicą 0,456 — CHECK)
    const c = P(F(lx, 0, lz)), soilM = F(lx, shrubY - Pl.soilT / 2, lz); // płyta ziemi: wierzch na poziomie spodu krzewów (zasłania folię donicy)
    if (!onPlaza(p.along + lx, pb.w / 2) || !clearOfTower(c, pb.w / 2)) continue; // lokalne +x = kierunek rosnącego along (§3.1: dla along > 0 lokalne −x wskazuje ulicę)
    planters.push({ name: Pl.box, x: c.x, y: 0, z: c.z, ry: p.tr.ry, lx, lz, shrubs, soilM, p, F, ...pb });
  }
  // --- skrzynki kwiatowe na parapetach: okna bez okiennic (skrzydła 0,39 od osi okna przy oknie 0,75: rośliny wchodziłyby w skrzydła) i bez zastrzału, domy przy placu ---
  const S = G.sillBoxes, sillBoxes = [];
  for (const s of shuffle(sills.filter(s => !s.setback && !s.shut && !s.braced), R)) { // bez zastrzału: belka X przechodzi przez okno i skrzynkę (cykl 1 PNG)
    if (sillBoxes.length >= S.count) break;
    if (!onPlaza(s.side % 2 === 0 ? s.x : s.z, s.w / 2) || !clearOfTower(V(s.x, 0, s.z), s.w / 2)) continue; // współrzędna wzdłuż pierzei: x dla N/S, z dla E/W
    const F = (x, y, z, ry = 0) => M4(x, y, z, ry).premultiply(M4(s.x, 0, s.z, s.ry)); // układ parapetu: początek na ziemi pod środkiem lica parapetu, +z od ściany
    const zBack = -S.onSill; // tył skrzynki onSill za licem parapetu (3 cm oparcia na parapecie), reszta na wspornikach
    const boxM = F(0, s.y + S.h / 2, zBack + S.d / 2), soilM = F(0, s.y + S.h - S.soil - S.soilT / 2, zBack + S.d / 2);
    const brackets = [-1, 1].map(k => F(k * (s.w / 2 - S.bracket.inset), s.y - S.bracket.t / 2, -S.bracket.back + S.bracket.len / 2)); // wierzch wspornika = wierzch parapetu = spód skrzynki
    const n = R.int(S.plants[0], S.plants[1]), species = R.pick(S.species);
    const plants = Array.from({ length: n }, (_, i) => { const lx = (i - (n - 1) / 2) * (s.w / n), q = P(F(lx, s.y + S.h - S.soil, zBack + S.d / 2)); return { name: species, x: q.x, y: q.y, z: q.z, ry: R.range(0, Math.PI * 2), scale: R.range(S.scale[0], S.scale[1]), lx }; }); // rośliny co w/n, spód na ziemi skrzynki
    sillBoxes.push({ s, boxM, soilM, brackets, plants, F });
  }
  // --- rabatki: kwadratowa skrzynia z desek wokół pnia każdej lipy (osiowa — kolizja addRect), ziemia, rośliny na pierścieniu co 360°/plants ---
  const Bd = G.beds, beds = trees.map(t => {
    const F = (x, y, z, ry = 0) => M4(x, y, z, ry).premultiply(M4(t.x, 0, t.z, 0)); // osiowo (ry 0): prostokąt kolizji osiowy jak bryła
    const e = Bd.size / 2 - Bd.t / 2; // środek deski: pół skrzyni − pół grubości
    const boards = [{ dim: [Bd.size, Bd.h, Bd.t], m: F(0, Bd.h / 2, e) }, { dim: [Bd.size, Bd.h, Bd.t], m: F(0, Bd.h / 2, -e) }, { dim: [Bd.t, Bd.h, Bd.size - 2 * Bd.t], m: F(e, Bd.h / 2, 0) }, { dim: [Bd.t, Bd.h, Bd.size - 2 * Bd.t], m: F(-e, Bd.h / 2, 0) }];
    const soil = { dim: [Bd.size - 2 * Bd.t, Bd.soilT, Bd.size - 2 * Bd.t], m: F(0, Bd.soilY - Bd.soilT / 2, 0) }; // wierzch ziemi na soilY
    const phase = R.range(0, Math.PI * 2), species = R.pick(G.sillBoxes.species);
    const plants = Array.from({ length: Bd.plants }, (_, k) => { const q = V(0, Bd.soilY, Bd.ring).applyMatrix4(M4(t.x, 0, t.z, phase + k * Math.PI * 2 / Bd.plants)); return { name: species, x: q.x, y: q.y, z: q.z, ry: R.range(0, Math.PI * 2), scale: Bd.scale }; }); // pierścień r ring wokół pnia przez M4(…, kąt)
    return { t, boards, soil, plants, rect: { x: t.x, z: t.z, hw: Bd.size / 2, hd: Bd.size / 2 } };
  });
  // --- ławki wokół fontanny: okrąg r dist, kąty phase + k·2π/count, ry = kąt → siedzisko (+z modelu) na zewnątrz (policzone §3.1: (0,0,1)·M4(0,0,0,a) = kierunek radialny) ---
  const Bn = G.benches, benches = Array.from({ length: Bn.count }, (_, k) => { const a = Bn.phase + k * Math.PI * 2 / Bn.count, q = V(0, 0, Bn.dist).applyMatrix4(M4(0, 0, 0, a)); return { name: Bn.model, x: q.x, y: 0, z: q.z, ry: a, scale: 1 }; });
  return { planters, sillBoxes, beds, benches };
}

export function buildGreenery(W) {
  const { ctx, CONFIG, B, T, put, bounds, mat, sets } = W;
  if (ctx.flags.nogreenery) return;
  const G = CONFIG.greenery, Po = CONFIG.houseDetail.portal, Fo = CONFIG.fountain, St = CONFIG.stalls, Tr = CONFIG.trees;
  if (sets && mat) mat.soil = sets[G.soil.set].material({ color: oklch(...G.soil.color), params: { roughness: 1, metalness: 0 } }); // nowy klucz W.B PRZED W.B.build (world.js); test offline bez W.sets
  const plan = greeneryPlan(W);
  W.greenery = plan;
  // donice przy portalach (kolizja: put() sam dodaje koło r 0,9·0,456 = 0,41 — donica przy ścianie, w prostokącie domu + 0,35)
  const Pl = G.planters, sh = dims(bounds, Pl.shrub);
  check(plan.planters.length === Pl.count, 'donice: mniej niż CONFIG.greenery.planters.count', { n: plan.planters.length, count: Pl.count });
  for (const d of plan.planters) {
    const { p } = d, id = `donica s${p.side} along${p.along.toFixed(1)}`, nrm = facadeNormal(p.tr.ry), LP = (x, y, z) => V(x, y, z).applyMatrix4(M4(p.tr.x, 0, p.tr.z, p.tr.ry));
    put(d.name, d.x, d.y, d.z, d.ry, 1);
    B.add('soil', box(d.w - 2 * Pl.soilInset, Pl.soilT, d.d - 2 * Pl.soilInset, T.cobble.mpt), d.soilM); // ziemia w donicy (wewnątrz desek: inset od obrysu)
    check(Pl.soilInset >= 0.05 && Pl.soilInset < d.w / 4, `${id} płyta ziemi poza deskami donicy`, { inset: Pl.soilInset }); // 0.05: deski donicy ok. 4 cm (bounds − wnętrze modelu)
    checkInFrontOfWall(`${id} środek`, V(d.x, 0, d.z), LP(d.lx, 0, p.faceZ), nrm, Pl.gap + d.d / 2 - 0.005); // 0,237 przed licem parteru (0.005: float)
    check(Math.abs(d.lx - p.doorX) - d.w / 2 >= Po.archOut + Pl.gap - 0.001, `${id} w oprawie portalu`, { lx: d.lx, doorX: p.doorX }); // skraj donicy ≥ ościeże + luz (0.001: float)
    check(Math.abs(d.lx) + d.w / 2 <= p.w / 2, `${id} poza obrysem domu`, { lx: d.lx, w: p.w });
    for (const s of d.shrubs) {
      put(s.name, s.x, s.y, s.z, s.ry, s.scale, { collide: false });
      check(s.y >= 0.05 && s.y <= d.h - 0.05, `${id} krzew nie w donicy`, { y: s.y, h: d.h }); // spód krzewu między dnem a krawędzią (0.05: zapas)
      check(s.y + sh.h * s.scale >= d.h + 0.3, `${id} krzew nie wystaje ≥ 0,3 m ponad donicę`, { top: s.y + sh.h * s.scale, h: d.h }); // 0.3: krzew ma zasłonić folię i być widoczny
      check(Math.abs(s.lx) + sh.w * s.scale / 2 <= d.w / 2 + 0.02 && sh.d * s.scale / 2 <= d.d / 2 + 0.02, `${id} krzew poza donicą`, { lx: s.lx }); // 0.02: liście mogą wystawać 2 cm za deskę
    }
  }
  // skrzynki kwiatowe na parapetach (W.sills): planks + ziemia (soil) + 2 wsporniki iron pod wysięgiem; rośliny bez cienia i kolizji (na wysokości parapetu)
  const S = G.sillBoxes;
  check(plan.sillBoxes.length === S.count, 'skrzynki: mniej niż CONFIG.greenery.sillBoxes.count', { n: plan.sillBoxes.length, count: S.count });
  check(S.onSill <= S.sillLip - S.glassOut - 0.01, 'skrzynka w szkle okna', S); // tył skrzynki ≥ 1 cm przed licem szkła (parapet 0,07, szkło 0,03 przed licem ściany — buildings.js)
  for (const b of plan.sillBoxes) {
    const { s } = b, id = `skrzynka s${s.side} p${s.floor} along${s.along.toFixed(1)}`, nrm = facadeNormal(s.ry), sp = V(s.x, s.y, s.z), dN = q => q.clone().sub(sp).dot(nrm);
    const bg = box(s.w, S.h, S.d, T.planks.mpt), bb = bboxOf(bg, b.boxM);
    B.add('planks', bg, b.boxM);
    B.add('soil', box(s.w - 2 * S.t, S.soilT, S.d - 2 * S.t, T.cobble.mpt), b.soilM);
    check(Math.abs(bb.min.y - s.y) < 0.005, `${id} nie stoi na parapecie`, { bottom: bb.min.y, sill: s.y }); // 0.005: float
    checkInFrontOfWall(`${id} środek`, P(b.boxM), sp, nrm, S.d / 2 - S.onSill - 0.005); // środek 0,06 przed licem parapetu
    check(dN(V(0, 0, -S.d / 2).applyMatrix4(b.boxM)) >= -S.onSill - 0.001 && dN(V(0, 0, S.d / 2).applyMatrix4(b.boxM)) <= S.d, `${id} tył/przód skrzynki`, { back: dN(V(0, 0, -S.d / 2).applyMatrix4(b.boxM)) }); // tył −0,03 (na parapecie), przód +0,15
    const soilTop = bboxOf(box(1, S.soilT, 1), b.soilM).max.y;
    check(Math.abs(soilTop - (s.y + S.h - S.soil)) < 0.005, `${id} ziemia nie ${S.soil} m pod krawędzią`, { soilTop }); // 0.005: float
    for (const m of b.brackets) {
      B.add('iron', box(S.bracket.t, S.bracket.t, S.bracket.len), m);
      const top = bboxOf(box(S.bracket.t, S.bracket.t, S.bracket.len), m).max.y, back = dN(V(0, 0, -S.bracket.len / 2).applyMatrix4(m)), front = dN(V(0, 0, S.bracket.len / 2).applyMatrix4(m));
      check(Math.abs(top - s.y) < 0.005 && back <= -S.sillLip - 0.03 && front <= S.d - S.onSill - 0.005, `${id} wspornik nie pod skrzynką / nie w ścianie`, { top, back, front }); // ≥ 3 cm w ścianie (lico ściany −0,07), koniec przed przodem skrzynki
    }
    for (const pl of b.plants) {
      put(pl.name, pl.x, pl.y, pl.z, pl.ry, pl.scale, { collide: false });
      check(Math.abs(pl.y - (s.y + S.h - S.soil)) < 0.005 && Math.abs(pl.lx) <= s.w / 2 - S.t, `${id} roślina poza ziemią skrzynki`, { y: pl.y, lx: pl.lx }); // 0.005: float; środek rośliny wewnątrz desek
    }
  }
  // rabatki wokół lip: deski (planks) osiowe → addRect z tej samej bryły; ziemia poniżej desek; rośliny na pierścieniu wokół odziomka
  const Bd = G.beds;
  check(plan.beds.length === (W.trees ?? []).length, 'rabatki: inna liczba niż lip', { n: plan.beds.length });
  check(Bd.soilY <= Bd.h - 0.02 && Bd.size / 2 - Bd.t >= Tr.trunk.root.r + 0.1 && Bd.ring <= Bd.size / 2 - Bd.t - 0.05, 'rabatka: ziemia ponad deskami / ciaśniejsza niż odziomek / rośliny w desce', Bd); // 0.02/0.1/0.05: zapasy (deska 0,3, odziomek r 0,42 → wnętrze 0,65, pierścień 0,45)
  for (const bd of plan.beds) {
    const id = `rabatka (${bd.t.x.toFixed(1)}, ${bd.t.z.toFixed(1)})`, frame = new THREE.Box3();
    for (const { dim, m } of bd.boards) { const g = box(...dim, T.planks.mpt); B.add('planks', g, m); frame.union(bboxOf(g, m)); }
    B.add('soil', box(...bd.soil.dim, T.cobble.mpt), bd.soil.m);
    ctx.addRect(bd.rect.x, bd.rect.z, bd.rect.hw, bd.rect.hd); W.dbgRect?.(bd.rect.x, bd.rect.z, bd.rect.hw, bd.rect.hd);
    checkCollisionCovers(id, frame, bd.rect);
    check(Math.abs(frame.max.x - frame.min.x - Bd.size) < 0.005 && Math.abs(frame.min.y) < 0.005, `${id} skrzynia nie ${Bd.size} m / nie na ziemi`, { w: frame.max.x - frame.min.x, y: frame.min.y }); // 0.005: float
    for (const pl of bd.plants) {
      put(pl.name, pl.x, pl.y, pl.z, pl.ry, pl.scale, { collide: false });
      check(Math.abs(Math.hypot(pl.x - bd.t.x, pl.z - bd.t.z) - Bd.ring) < 0.005 && Math.abs(pl.y - Bd.soilY) < 0.005, `${id} roślina poza pierścieniem`, pl); // 0.005: float
    }
  }
  // ławki wokół fontanny: put() dodaje koło kolizji (r 0,9·0,58 = 0,52); tyłem do fontanny, poza schodkiem, mokrym brukiem, lipami i pierścieniem kramów
  const Bn = G.benches, bn = dims(bounds, Bn.model);
  for (const b of plan.benches) {
    const id = `ławka (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`;
    put(b.name, b.x, b.y, b.z, b.ry, b.scale);
    const front = V(0, 0, 1).transformDirection(M4(0, 0, 0, b.ry)), radial = V(b.x, 0, b.z).normalize(), dist = Math.hypot(b.x, b.z);
    check(front.dot(radial) >= 0.98, `${id} nie siedziskiem na zewnątrz (tyłem do fontanny)`, { dot: front.dot(radial) }); // 0.98: jak test A (≤ 11°); policzone dla 4 kątów: 1,000
    check(dist - bn.d / 2 >= Fo.radius + Fo.collide + 0.5 && dist - bn.d / 2 >= Fo.wet.r, `${id} za blisko fontanny / na mokrym bruku`, { inner: dist - bn.d / 2 }); // 0.5: przejście między kołem fontanny a ławką
    check(dist + bn.w / 2 <= St.ringRadius - St.ringJitter - St.collideR, `${id} w pierścieniu kramów`, { outer: dist + bn.w / 2 });
    for (const t of W.trees ?? []) check(Math.hypot(b.x - t.x, b.z - t.z) >= t.r + bn.w / 2 + 0.5, `${id} za blisko lipy`, { d: Math.hypot(b.x - t.x, b.z - t.z) }); // 0.5: przejście
  }
}
