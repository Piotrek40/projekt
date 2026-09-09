// Rekwizyty z modeli (instancjonowane lub klonowane), latarnie ze światłem, wóz, chorągwie, szyldy cechowe z herbami (motyw #10b), dym z kominów.
// Modele stawia put(name, x, y, z, ry, scale) w ŚWIECIE (spód modelu na y); geometria wozu ma własny układ lokalny przez L() (+z = front). Metry.
// Cięcia skanów (motyw #1, ?nocuts=1 wyłącza): W.cuts = CONFIG.props.cuts — limit instancji per model w put(), szkło bez transmisji, towar bez cienia.
import * as THREE from 'three';
import { box, plane, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { signTexture, signTextTexture, smokeTexture } from './materials.js';
import { check, checkHeight, checkAboveGround, checkCollisionCovers, checkInFrontOfWall, facadeNormal, bboxOf } from '../../engine/src/check.js';
import { oklch } from './color.js';

// Ładuje modele i przygotowuje put()/flushInstances() dla reszty modułów.
export async function initProps(W) {
  const { ctx, scene, loaders, CONFIG } = W;
  const cuts = ctx.flags.nocuts ? null : CONFIG.props.cuts; W.cuts = cuts;   // ?nocuts=1: stan sprzed cięć skanów (motyw #1)
  const names = ['wooden_crate_01', 'wine_barrel_01', 'Barrel_01', 'wicker_basket_01', 'wooden_bucket_02', 'ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01', 'food_apple_01', 'treasure_chest', 'wooden_stool_02', 'wooden_lantern_01', 'horse_statue_01', 'grass_medium_02', 'fern_02', 'tree_stump_01', 'rock_moss_set_02', 'potted_plant_02', 'wine_bottles_01', 'Lantern_01', ...(ctx.flags.nokinds ? [] : CONFIG.stalls.goods.models), ...(ctx.flags.nogreenery ? [] : CONFIG.greenery.models), ...(ctx.flags.nomodel || loaders.mode === 'inline' ? [] : [CONFIG.stalls.model.name])].filter(n => !cuts || n !== 'treasure_chest');   // z cięciami skrzynia skarbów nieładowana (10 332 tri); towar ról kramów (motyw #11, zasoby_etap2.md) tylko bez ?nokinds=1; zieleń (motyw #greenery, CONFIG.greenery.models) tylko bez ?nogreenery=1
  const models = new Map(await Promise.all(names.map(async n => [n, await loaders.loadModel(n)])));
  const bounds = new Map();
  for (const [n, g] of models) { g.scene.updateMatrixWorld(true); bounds.set(n, new THREE.Box3().setFromObject(g.scene)); }
  // Materiały z transmisją (butelki: KHR_materials_transmission) → zwykła przezroczystość alfa. Transmisja = WebGLRenderer.renderTransmissionPass:
  // każdy nieprzezroczysty obiekt sceny rysowany drugi raz do tekstury (zmierzone w bazie: modele bez cienia miały 2 wywołania i 2× trójkątów).
  const materialsOf = () => { const out = []; for (const [, g] of models) g.scene.traverse(o => { if (o.isMesh) out.push(...[].concat(o.material)); }); return out; };
  if (cuts) for (const m of materialsOf()) if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = cuts.glassOpacity; m.needsUpdate = true; }
  check(!cuts || materialsOf().every(m => !(m.transmission > 0)), 'materiał z transmisją (drugi przebieg renderera)');
  // Tint modeli z CONFIG.props.tint (poprawka r2, krytyk reżyserii): biały posąg konia był najjaśniejszym obiektem kadru (sonda L 0,703 C 0,019)
  // i nie należał do żadnej rodziny palety — patyna wiąże go z miedzianym hełmem wieży (rodzina H 170–200). ?notint=1 przywraca kolory modeli.
  if (!ctx.flags.notint) for (const [n, c] of Object.entries(CONFIG.props.tint || {})) {
    const g = models.get(n); if (!g) continue;
    g.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { m.color.setHex(oklch(...c)); m.needsUpdate = true; } });
  }
  // Rekwizyty są instancjonowane: jeden draw call na (model × materiał) zamiast jednego na kopię.
  const placements = new Map();
  const NO_SHADOW = new Set([...CONFIG.props.noShadow, ...(cuts ? cuts.noShadow : []), ...CONFIG.greenery.noShadow]);   // + kwiaty/krzewy/donice (motyw #greenery)
  const counts = new Map();   // ile razy proszono o model — limit CONFIG.props.cuts.maxCount pomija nadmiar (bez kolizji, bez bryły)
  function put(name, x, y, z, ry = 0, scale = 1, opts = {}) {
    const nth = counts.get(name) ?? 0; counts.set(name, nth + 1);
    if (cuts && !opts.force && nth >= (cuts.maxCount[name] ?? Infinity)) return false;   // force: celowe ustawienie (beczka pierwszego planu, buildCart) poza limitem rozsypki
    const b = bounds.get(name);
    const m = M4(x, y - b.min.y * scale, z, ry, 0, 0, scale);
    if (!placements.has(name)) placements.set(name, []);
    placements.get(name).push(m);
    W.dbgBox?.(b.clone().applyMatrix4(m)); // ?boxes=1: obrys bryły w świecie (AABB po obrocie)
    // Asercje liczone na bryle w układzie własnym modelu przesuniętej na (x,z), BEZ obrotu ry: koło kolizji jest niezmiennicze względem obrotu
    // wokół (x,z), a AABB bryły obróconej o ~45° byłby o √2 większy i dawałby fałszywe alarmy; obrót wokół y nie zmienia zakresu y.
    const wb = b.clone().applyMatrix4(M4(x, y - b.min.y * scale, z, 0, 0, 0, scale));
    checkAboveGround(name, wb); // put() sam podnosi o -min.y*scale, więc pilnuje głównie ujemnego y z wywołania
    if (opts.collide !== false) {
      const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * scale / 2;
      if (r > 0.3 && y < 0.5) { ctx.addCircle(x, z, r * 0.9); W.dbgCircle?.(x, z, r * 0.9); checkCollisionCovers(name, wb, { x, z, r: r * 0.9 }); }
    }
    return true;
  }
  function flushInstances() {
    for (const [name, mats] of placements) {
      const root = models.get(name).scene;
      // tryb noinst (Xclipse): klony zamiast instancji; nazwy = nazwa modelu, żeby __stats grupował po modelu tak samo jak dla InstancedMesh
      if (ctx.flags.noinst) { for (const m of mats) { const c = root.clone(true); c.applyMatrix4(m); c.name = name; c.traverse(o => { if (o.isMesh) { o.castShadow = !NO_SHADOW.has(name); o.receiveShadow = true; o.name = name; } }); scene.add(c); } continue; }
      root.traverse(o => {
        if (!o.isMesh) return;
        // niektóre skany mają morph targets (nieużywane) — InstancedMesh bez influences wywala renderer, więc je usuwamy
        if (Object.keys(o.geometry.morphAttributes || {}).length) { o.geometry.morphAttributes = {}; o.geometry.morphTargetsRelative = false; }
        const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
        for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i].clone().multiply(o.matrixWorld));
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = !NO_SHADOW.has(name); im.receiveShadow = true; im.name = name;
        im.computeBoundingSphere(); // sfera obejmująca wszystkie kopie (inaczej frustum culling gubi mesh)
        scene.add(im);
      });
    }
  }
  // Kram z Blendera (Etap 3, CONFIG.stalls.model): podmiana materiałów na zestawy PBR sceny + wypalone AO na drugim UV.
  // Model ma UV0 w METRACH (rzut sześcienny cube_size = 1 m), a zestawy z loadPbrSet mają repeat = 1/mpt — więc po prostu
  // użycie materiału sceny daje na modelu DOKŁADNIE tę samą skalę tekstury co na geometrii proceduralnej obok, bez rozciągania.
  // aoMap w three.js czyta uv1 (texture.channel = 1) i działa na światło pośrednie — to jest ten cień w narożach i pod ladą,
  // którego proceduralna geometria nie ma. ?nomodel=1 = wersja proceduralna (porównanie przed/po tą samą kamerą), ?noao=1 = model bez AO.
  if (!ctx.flags.nomodel && loaders.mode !== 'inline') {
    const M = CONFIG.stalls.model, g = models.get(M.name);
    check(!!g, 'model kramu nie wczytany', { name: M.name });
    if (g) {
      let ao = null;
      if (!ctx.flags.noao) {
        try { ao = await loaders.loadTexture(M.ao, 'ao'); ao.flipY = false; ao.channel = 1; ao.needsUpdate = true; }
        catch (e) { console.error('CHECK: brak tekstury AO kramu', e); }   // brak AO nie może wywalić sceny — model bez AO wygląda gorzej, ale działa
      }
      const dressed = {};
      for (const [nazwaGLB, key] of Object.entries(M.materials)) {
        const base = W.mat[key];
        check(!!base, 'brak materiału sceny dla modelu kramu', { nazwaGLB, key });
        if (!base) continue;
        const m = base.clone(); if (ao) { m.aoMap = ao; m.aoMapIntensity = M.aoIntensity; } m.needsUpdate = true;
        dressed[nazwaGLB] = m;
      }
      let n = 0, nieznane = [];
      g.scene.traverse(o => { if (!o.isMesh) return; n++;
        const nm = [].concat(o.material)[0]?.name || '';
        if (dressed[nm]) o.material = dressed[nm]; else nieznane.push(nm);
        check(!!o.geometry.attributes.uv1 || !ao, 'model kramu bez drugiego zestawu UV — AO nie ma na czym leżeć', { mesh: o.name, nm });
      });
      check(nieznane.length === 0, 'materiał modelu kramu bez wpisu w CONFIG.stalls.model.materials', { nieznane });
      check(n >= Object.keys(M.materials).length - 1, 'model kramu ma mniej siatek niż materiałów w mapie', { n });
      const s = W.stalls.find(q => q.kind === M.kind);
      check(!!s, 'brak kramu rodzaju modelu w W.stalls', { kind: M.kind });
      if (s) put(M.name, s.x, 0, s.z, s.ry + (M.yaw ?? 0), 1, { collide: false, force: true });   // kolizję dodał już buildStalls (koło collideR); M.yaw: korekta osi Blender→glTF
    }
  }
  W.models = models; W.bounds = bounds; W.put = put; W.flushInstances = flushInstances;
}

export function placeStatue(W) {
  const { R, CONFIG, bounds, put } = W;
  { const b = bounds.get('horse_statue_01'); const sc = 2.6 / (b.max.y - b.min.y); checkHeight('horse_statue_01', b, sc, 2.4, 2.8); put('horse_statue_01', 0, CONFIG.fountain.rim + CONFIG.fountain.columnHeight + 0.35, 0, R.range(0, 6.28), sc, { collide: false }); } // posąg 2.6 m
}

export function buildLanterns(W) {
  const { ctx, scene, CONFIG, T, B, mat, bounds, put } = W;
  const lanternLights = [];
  for (let i = 0; i < CONFIG.lanterns.count; i++) {
    const a = (i + 0.5) / CONFIG.lanterns.count * Math.PI * 2;
    const x = Math.sin(a) * CONFIG.lanterns.ringRadius, z = Math.cos(a) * CONFIG.lanterns.ringRadius; // ring: pozycja na pierścieniu latarni
    // układ lokalny latarni: początek u stóp słupa, ry = a, ramię wzdłuż lokalnego +x (świat: (cos a, 0, −sin a) — policzone dla a=0.393: (0.924, 0, −0.383))
    const L = (lx, ly, lz) => M4(lx, ly, lz).premultiply(M4(x, 0, z, a));
    B.place('timber', box(0.16, 2.8, 0.16, T.timber.mpt), x, 1.4, z);
    B.add('timber', box(0.6, 0.1, 0.1, T.timber.mpt), L(0.3, 2.75, 0));   // ramię: środek 0,3 m od słupa (policzone = dawne x + cos a·0.3)
    const lb = bounds.get('wooden_lantern_01'); const sc = 0.55 / (lb.max.y - lb.min.y); checkHeight('wooden_lantern_01', lb, sc, 0.45, 0.65); // latarnia 0.55 m
    const { x: lx, z: lz } = new THREE.Vector3().setFromMatrixPosition(L(0.52, 2.15, 0));   // zawieszenie 0,52 m od słupa (policzone = dawne x + cos a·0.52)
    put('wooden_lantern_01', lx, 2.15, lz, a, sc, { collide: false });
    ctx.addCircle(x, z, 0.25);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat.flame); flame.position.set(lx, 2.4, lz); scene.add(flame);
    lanternLights.push({ x: lx, z: lz });
  }
  const lights = Array.from({ length: ctx.flags.nolights ? 0 : 4 }, () => { const l = new THREE.PointLight(W.hex.lanternLight, 5, 12, 2); scene.add(l); return l; }); // kolor z palety (CONFIG.paletteOKLCH.lanternLight)
  ctx.updaters.push((dt, t, p) => {
    // cztery najbliższe latarnie świecą (koszt świateł punktowych rośnie z ich liczbą)
    const near = lanternLights.map(l => ({ l, d: (l.x - p.x) ** 2 + (l.z - p.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 4);
    near.forEach((n, i) => { if (lights[i]) { lights[i].position.set(n.l.x, 2.4, n.l.z); lights[i].intensity = 5 + Math.sin(t * 7 + i) * 0.6; } });
  });
}

export function scatterProps(W) {
  const { R, H, half, sw, sideTransform, put, bounds, cuts } = W;
  for (let i = 0; i < 14; i++) {
    const side = R.int(0, 3), along = R.range(-half + 3, half - 3);
    if (Math.abs(along) < sw / 2 + 1.5) continue;
    const t = sideTransform(side, along, -H.depth / 2 - 0.7);
    const kind = R.pick(['wine_barrel_01', 'wooden_crate_01', 'wine_barrel_01', 'wooden_bucket_02', 'wicker_basket_01', 'wooden_stool_02', 'potted_plant_02', 'wooden_crate_01']);   // poprawka po zrzutach z telefonu: Barrel_01 to czerwona beczka STALOWA z piktogramem (Poly Haven: industrial) — nie na rynek fantasy; długość listy bez zmian → strumień R nieprzetasowany
    put(kind, t.x, 0, t.z, R.range(0, 6.28));
    if (kind === 'wooden_crate_01' && R() < 0.5) put('wooden_crate_01', t.x, 0.62, t.z, R.range(0, 6.28), 0.9, { collide: false });
  }
  // kępy zieleni u podnóża pierzei: 14 losowań jak w bazie (ten sam strumień ziarna → chorągwie i reszta sceny bez zmian), a z cięciami
  // stawiane są tylko pierwsze CONFIG.props.scatter[model] kęp danego modelu (baza: 10 traw + 4 paprocie)
  const left = cuts ? { ...cuts.scatter } : null;   // ile kęp danego modelu jeszcze postawić
  for (let i = 0; i < 14; i++) {
    const side = R.int(0, 3), along = R.range(-half + 1, half - 1);
    const t = sideTransform(side, along, -H.depth / 2 - 0.35);
    const name = R.pick(['grass_medium_02', 'fern_02', 'grass_medium_02']), ry = R.range(0, 6.28), sc = R.range(0.8, 1.2);   // obrót 0–2π i skala 0,8–1,2 kępy — te same losowania co w bazie
    if (left) { if (!(left[name] > 0)) continue; left[name]--; }
    put(name, t.x, 0, t.z, ry, sc, { collide: false });
  }
  if (left) check(Object.values(left).every(v => v === 0), 'scatter: za mało losowań na liczbę kęp z CONFIG.props.scatter', left);
  put('tree_stump_01', -half + 5, 0, half - 6, 0.4);
  // poprawka po zrzutach z telefonu: omszałe głazy (prop leśny) leżały na BRUKU przed drzwiami kamienicy — usunięte ze sceny

  if (!cuts) { put('treasure_chest', 9, 0, -7, 2.4, 0.9); put('Lantern_01', 9.2, 0.62, -7.1, 1.0, 1, { collide: false }); return; }   // stan bazowy: skrzynia i latarenka na jej wieku (0,62 m)
  // cięcia: bez skrzyni skarbów (10 332 tri + cień); latarenka staje na pieńku — wierzch pieńka = jego wysokość (put stawia spód na y),
  // pieniek stoi w skali 1 (obrót ry nie zmienia wysokości; bbox modelu y −0,193..0,378 → 0,571 m; latarenka 0,12 × 0,29 × 0,10 m)
  const sb = bounds.get('tree_stump_01'), lb = bounds.get('Lantern_01'), stumpTop = sb.max.y - sb.min.y;
  check(stumpTop >= 0.3 && stumpTop <= 1.2, 'pieniek: wysokość poza zakresem pieńka', { stumpTop });   // 0,3–1,2 m = pieniek, nie kłoda ani pień
  check(Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) <= 0.5 * Math.min(sb.max.x - sb.min.x, sb.max.z - sb.min.z), 'latarenka szersza niż pół pieńka');   // 0,5: mieści się na ściętym wierzchu, nie na korzeniach
  put('Lantern_01', -half + 5, stumpTop, half - 6, 1.0, 1, { collide: false });   // (x,z) pieńka = środek pnia (początek modelu), ry 1.0 jak w bazie
}

// Wóz: układ lokalny — początek na środku podstawy, +x wzdłuż skrzyni (dyszel na −x), +y w górę, +z bok. Metry. Do świata tylko przez L().
// Pozycja z CONFIG.props.cart (poprawka r1 reżyserii: pierwszy plan startu; ?nocart2=1 = pozycja HEAD cart.legacy); dyszel ma własne koło kolizji.
export function buildCart(W) {
  const { ctx, T, B, put, CONFIG } = W, Ct = CONFIG.props.cart;
  {
    const { x, z, ry } = ctx.flags.nocart2 ? Ct.legacy : Ct;
    const L = (lx, ly, lz, lry = 0, lrx = 0, lrz = 0) => M4(lx, ly, lz, lry, lrx, lrz).premultiply(M4(x, 0, z, ry));
    B.add('planks', box(2.4, 0.08, 1.2, T.planks.mpt), L(0, 0.9, 0));
    for (const sx of [-1, 1]) B.add('planks', box(0.06, 0.5, 1.2, T.planks.mpt), L(sx * 1.17, 1.19, 0));
    for (const sz of [-1, 1]) B.add('planks', box(2.4, 0.5, 0.06, T.planks.mpt), L(0, 1.19, sz * 0.57));
    B.add('timber', box(2.6, 0.12, 0.12, T.timber.mpt), L(0, 0.8, 0));
    // WÓZ TOCZY SIĘ PO LOKALNYM +x, więc tarcza koła leży w płaszczyźnie x-y, a jego oś obrotu biegnie po +z — tak samo jak
    // oś wozu box(0.14, 0.14, 1.6) rozciągnięta po z. TorusGeometry leży domyślnie w x-y, więc NIE wolno go obracać:
    // dawne wheel.rotateY(π/2) przestawiało tarczę do y-z, czyli koła stały W POPRZEK wozu, prostopadle do własnej osi (zrzut z telefonu).
    // Promień zewnętrzny 0.62 + 0.06 = 0.68, więc środek koła i oś muszą stać na y = 0.68, inaczej obręcz wchodzi w bruk.
    const wheelY = 0.68, wheelG = new THREE.TorusGeometry(0.62, 0.06, 8, 20), axleG = box(0.14, 0.14, 1.6, T.timber.mpt);
    for (const sz of [-1, 1]) {
      B.add('timber', wheelG, L(0.3, wheelY, sz * 0.72));   // Batch.add klonuje geometrię, więc wheelG zostaje nietknięte dla asercji niżej
      for (let k = 0; k < 6; k++) B.add('timber', box(0.05, 1.2, 0.05, T.timber.mpt), L(0.3, wheelY, sz * 0.72, 0, 0, k * Math.PI / 6)); // rot: rz=k·π/6 → szprycha (0,1,0) obraca się w płaszczyźnie x-y, czyli W TARCZY koła: k=1 → (−0.5, 0.866, 0)
    }
    B.add('timber', axleG, L(0.3, wheelY, 0));   // oś: JEDNA, poza pętlą po kołach (wcześniej ta sama bryła lądowała w batchu dwa razy w tym samym miejscu)
    // Asercje na zbudowanej geometrii w układzie wozu (bez L — obrót ry wozu obraca koło i oś tak samo, więc nie zmienia ich wzajemnego ułożenia).
    const ext = b => [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    const eW = ext(bboxOf(wheelG)), eA = ext(bboxOf(axleG));
    const cienkaOsKola = eW.indexOf(Math.min(...eW)), dlugaOsWozu = eA.indexOf(Math.max(...eA));
    check(cienkaOsKola === dlugaOsWozu, 'wóz: tarcza koła nie jest prostopadła do osi wozu (koła w poprzek)', { eW, eA, cienkaOsKola, dlugaOsWozu });
    const eS = ext(bboxOf(box(0.05, 1.2, 0.05), M4(0, 0, 0, 0, 0, Math.PI / 6)));   // szprycha k=1: ma się rozejść w x-y, a zostać cienka po z
    check(eS[2] < 0.06 && eS[0] > 0.5, 'wóz: szprychy nie rozchodzą się w tarczy koła', { eS });
    check(Math.abs(wheelY - eW[1] / 2) < 0.005, 'wóz: obręcz nie dotyka bruku', { wheelY, dolKola: wheelY - eW[1] / 2 });
    for (const sz of [-1, 1]) B.add('timber', box(2.2, 0.1, 0.1, T.timber.mpt), L(-2.2, 0.75, sz * 0.4, 0, 0, 0.08)); // rot: rz=+0.08 → koniec +x (przy wozie) w GÓRĘ: (1,0,0)→(0.997,0.08,0); końce w świecie y 0.662 (czubek) / 0.838 (przy wozie)
    ctx.addCircle(x, z, Ct.collideR);
    const shaft = new THREE.Vector3().setFromMatrixPosition(L(Ct.shaft.lx, 0, 0));   // koło pod dyszlem (§3.4 B6: czubek 2,24 m od koła wozu r 1,5 — gracz wchodził w dyszel)
    ctx.addCircle(shaft.x, shaft.z, Ct.shaft.r); W.dbgCircle?.(shaft.x, shaft.z, Ct.shaft.r);
    for (const sz of [-1, 1]) checkCollisionCovers('dyszel wozu', bboxOf(box(2.2, 0.1, 0.1), L(-2.2, 0.75, sz * 0.4, 0, 0, 0.08)), { x: shaft.x, z: shaft.z, r: Ct.shaft.r }); // rot: rz=+0.08 jak belka wyżej (ta sama macierz)
    // Rekwizyty w skrzyni liczone przez MACIERZ WOZU (§3.1), nie przesunięciami w metrach świata. Przy ry = 0,9 + π
    // światowe (−0,7; +0,2) dawały lokalne (0,592; 0,424), a wnętrze burty kończy się na |lz| = 0,54 — kosz przechodził
    // deskę burty na wylot i był widoczny na jej ZEWNĘTRZNEJ stronie (zrzut z telefonu).
    for (const [nazwa, lx, lz, dry, sc] of [['wooden_crate_01', 0.5, -0.2, 0, 0.8], ['wicker_basket_01', -0.6, 0.25, 1, 0.9]]) {
      const q = new THREE.Vector3().setFromMatrixPosition(L(lx, 0, lz));
      const bb = W.bounds.get(nazwa);
      // Obrys po obrocie o dry wokół y: półzasięgi rzutują się na siebie przez |cos| i |sin| (nie max z boków — to zawyżało).
      const hx = (bb.max.x - bb.min.x) / 2 * sc, hz = (bb.max.z - bb.min.z) / 2 * sc;
      const c = Math.abs(Math.cos(dry)), si = Math.abs(Math.sin(dry));
      const rx = c * hx + si * hz, rz = si * hx + c * hz;
      // Test offline nie ładuje modeli i podstawia jednostkową bryłę (0,0,0)–(1,1,1) — wtedy asercja mierzyłaby zaślepkę,
      // więc jej nie liczymy. W przeglądarce bryły są prawdziwe i asercja działa; to tam widać było kosz przez burtę.
      const zaslepka = bb.min.x === 0 && bb.min.y === 0 && bb.min.z === 0 && bb.max.x === 1 && bb.max.y === 1 && bb.max.z === 1;
      if (!zaslepka) check(Math.abs(lz) + rz <= 0.52 && Math.abs(lx) + rx <= 1.12, `wóz: ${nazwa} wystaje poza wnętrze skrzyni (burta na |lz| = 0,54)`, { lx, lz, rx, rz });
      put(nazwa, q.x, 0.94, q.z, ry + dry, sc, { collide: false });
    }
    if (!ctx.flags.nocart2) checkCartPlacement(W, { x, z, ry }, L);
  }
  // drewno na pierwszym planie startu (beczka przy latarni, kosz obok) — put() sam dodaje koła kolizji (r > 0,3 → 0,9·r; kosz mniejszy bez koła)
  if (!ctx.flags.nocart2) for (const p of Ct.foreground) { put(p.name, p.x, 0, p.z, p.ry, 1, { force: true }); checkForegroundProp(W, p); }
}
// Asercje wozu na pierwszym planie (liczby seed-niezależne, policzone w config.js): (1) koło wozu poza kołami kramów, lip, latarni i kałuż; (2) wóz w placu;
// (3) każdy róg skrzyni widziany ze startu ma yaw ≤ lewy skraj dolnej misy (yaw fontanny − asin(bowls[0].r/d)) − bowlClear: wóz nachodzi co najwyżej na
//     prawy skraj cembrowiny, misy i posąg zostają wolne (§5.3 (1); policzone: 0,111 ≤ 0,137 − 0,02);
// (4) czubek dyszla poza kołami kramów. yaw jak app.js (yaw 0 = −z): atan2(−dx, −dz).
function checkCartPlacement(W, { x, z, ry }, L) {
  const { CONFIG, half, stalls } = W, Ct = CONFIG.props.cart, F = CONFIG.fountain, st = CONFIG.composition.start, Ln = CONFIG.lanterns, Tr = CONFIG.trees;
  const yawTo = (px, pz) => Math.atan2(-(px - st.x), -(pz - st.z));
  const clear = (px, pz, r, what) => check(Math.hypot(px - x, pz - z) >= Ct.collideR + r, `wóz nachodzi na ${what}`, { x, z, px, pz });
  for (const s of stalls) clear(s.x, s.z, CONFIG.stalls.collideR, 'kram');
  for (let i = 0; i < Ln.count; i++) { const a = (i + 0.5) / Ln.count * Math.PI * 2, l = new THREE.Vector3(0, 0, Ln.ringRadius).applyMatrix4(M4(0, 0, 0, a)); clear(l.x, l.z, 0.25, 'latarnię'); }   // jak buildLanterns
  check(Math.hypot(x, z) - Ct.collideR >= Tr.dist + Tr.collideR, 'wóz przy lipach', { d: Math.hypot(x, z) });   // lipy na okręgu dist wokół fontanny
  for (const p of W.puddles ?? []) clear(p.x, p.z, p.r, 'kałużę');
  check(Math.abs(x) + Ct.collideR <= half - 0.3 && Math.abs(z) + Ct.collideR <= half - 0.3, 'wóz poza placem');   // 0,3: margines obszaru chodzenia (layout.js addWalkable)
  const corners = [[1.2, 0.6], [1.2, -0.6], [-1.2, 0.6], [-1.2, -0.6]].map(([lx, lz]) => new THREE.Vector3().setFromMatrixPosition(L(lx, 0.9, lz)));   // rogi skrzyni (box 2,4 × 1,2; yaw nie zależy od y)
  const yawCart = Math.max(...corners.map(c => yawTo(c.x, c.z))), yawBowlL = yawTo(0, 0) - Math.asin(F.bowls[0].r / Math.hypot(st.x, st.z));   // policzone: 0,111 vs 0,227 − asin(1,8/20,0) = 0,137
  check(yawCart <= yawBowlL - Ct.bowlClear, 'wóz zasłania misy fontanny ze startu', { yawCart, yawBowlL });
  const tip = new THREE.Vector3().setFromMatrixPosition(L(Ct.shaft.lx - 1.1, 0, 0));   // czubek dyszla (belka 2,2 od −2,2 → koniec −3,3)
  for (const s of stalls) check(Math.hypot(s.x - tip.x, s.z - tip.z) >= CONFIG.stalls.collideR + 0.35, 'dyszel wozu w kramie', { tip: tip.toArray() });   // 0,35: promień gracza (przejście)
}
// Beczka/kosz pierwszego planu: w placu, poza kałużami (skraj modelu z W.bounds), ≥ 0,25 od latarni (słup 0,16), poza kołem wozu; para nie nachodzi na siebie.
function checkForegroundProp(W, p) {
  const { CONFIG, half, bounds } = W, Ct = CONFIG.props.cart, Ln = CONFIG.lanterns, b = bounds.get(p.name), r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
  const id = `${p.name} (${p.x}, ${p.z})`;
  check(Math.abs(p.x) + r <= half - 0.3 && Math.abs(p.z) + r <= half - 0.3, id + ' poza placem');   // 0,3: margines obszaru chodzenia
  for (const q of W.puddles ?? []) check(Math.hypot(q.x - p.x, q.z - p.z) >= q.r + r, id + ' w kałuży', { d: Math.hypot(q.x - p.x, q.z - p.z), q });
  for (let i = 0; i < Ln.count; i++) { const a = (i + 0.5) / Ln.count * Math.PI * 2, l = new THREE.Vector3(0, 0, Ln.ringRadius).applyMatrix4(M4(0, 0, 0, a)); check(Math.hypot(l.x - p.x, l.z - p.z) >= r + 0.25, id + ' w latarni'); }   // 0,25: koło kolizji latarni (buildLanterns); (i + 0,5): kąty jak tam
  check(Math.hypot(Ct.x - p.x, Ct.z - p.z) >= Ct.collideR + r, id + ' w kole wozu');
  for (const q of Ct.foreground) if (q !== p) { const rq = Math.max(bounds.get(q.name).max.x - bounds.get(q.name).min.x, bounds.get(q.name).max.z - bounds.get(q.name).min.z) / 2; check(Math.hypot(q.x - p.x, q.z - p.z) >= r + rq, id + ' nachodzi na ' + q.name); }
}

export function buildBanners(W) {
  const { R, H, half, B, mat, bannerMats, houses, sideTransform } = W;
  W.banners = []; // {side, along} — girlandy (bunting.js) omijają chorągwie kotwicami
  for (let i = 0; i < 8; i++) {
    const side = i % 4, along = (i < 4 ? -1 : 1) * R.range(half * 0.3, half * 0.85);
    W.banners.push({ side, along });
    const t = sideTransform(side, along, -H.depth / 2 - 0.4);
    // drzewiec wychylony od ściany ku placowi (lokalne +z), płótno zwisa pionowo z jego końca
    const base = M4(t.x, 5.0, t.z, t.ry);
    const tilt = new THREE.Matrix4().makeRotationX(0.35);
    B.add('iron', cylinder(0.03, 0.03, 1.6, 6, 1), base.clone().multiply(tilt).multiply(new THREE.Matrix4().makeTranslation(0, 0.8, 0)));
    const top = new THREE.Vector3(0, 1.6, 0).applyMatrix4(base.clone().multiply(tilt));
    // PlaneGeometry, NIE plane(): plane() skaluje UV przez rozmiar/mpt, więc przy mpt 1 wychodziło UV 0..0,90 × 0..1,60,
    // a tekstura herbu jest ClampToEdge — prawdziwy obraz dostawało 62 % płótna, GÓRNE 38 % było zaciśniętym górnym wierszem
    // canvasu, a 10 % szerokości herbu nie pokazywało się nigdy. To ta sama pułapka, która zrobiła białą płytę pod kramem.
    B.add('banner' + (i % bannerMats.length), new THREE.PlaneGeometry(0.9, 1.6), M4(top.x, top.y - 0.85, top.z, t.ry));
  }
  if (!W.ctx.flags.nosign) { buildSigns(W); return; }
  // ?nosign=1: szyld karczmy z HEAD (pierwszy dom po prawej od ulicy południowej) — jedna macierz na obiekt zamiast łańcucha multiply (K3; wynik identyczny:
  // T(t)·R(ry)·T(0,3.05,0.8)·R(π/2) = M4(0,3.05,0.8,π/2)·M4(t), bo translacja w y komutuje z obrotem wokół y); normalna (−1,0,0) dla karczmy = tył DoubleSide = lustro (K2, celowo — stan sprzed cechy)
  {
    const tav = houses.find(h => h.side === 2 && h.along > 0 && !h.setback) || houses[0];
    const t = sideTransform(tav.side, tav.along - tav.w / 2 + 2.0, -H.depth / 2 - 0.5), T0 = M4(t.x, 0, t.z, t.ry); // HEAD: 2 m od krawędzi domu, t 0,5 m przed licem
    mat.sign = new THREE.MeshStandardMaterial({ map: signTextTexture('Pod Złotym Gryfem', W.hex), roughness: 0.8, side: THREE.DoubleSide }); // kolory szyldu z palety (W.hex)
    B.add('iron', box(0.05, 0.05, 1.1), M4(0, 3.6, 0.3).premultiply(T0)); // HEAD: wspornik 1,1 m ze środkiem 0,3 przed t (t = 0,5 m przed licem)
    B.add('sign', plane(1.3, 0.8, 1), M4(0, 3.05, 0.8, Math.PI / 2).premultiply(T0)); // HEAD: szyld 0,8 przed t, obrócony o π/2 (front na −x w świecie dla side 2)
  }
}

// UV kafelka atlasu szyldów (A = CONFIG.houseDetail.sign.atlas): okno szyldu tile × win px wyśrodkowane w pionie w kafelku i; square = kwadrat plq × plq wokół
// środka tarczy (plakieta herbowa; kafelek 0 ma tarczę wyżej, nad napisem: środek cyText). Canvas rośnie w dół, tekstura (flipY) ma v = 1 u góry → v1 = 1 − yTop/H.
// PlaneGeometry: uv (0,1) w lewym górnym rogu.
export function signTileUV(i, A, square = false) {
  const Wpx = A.cols * A.tile, Hpx = A.rows * A.tile, winTop = Math.floor(i / A.cols) * A.tile + (A.tile - A.win) / 2, cx = (i % A.cols) * A.tile + A.tile / 2;
  const cy = winTop + (i === 0 ? A.cyText : A.win / 2), half = square ? A.plq / 2 : 0;
  const x0 = square ? cx - half : (i % A.cols) * A.tile, x1 = square ? cx + half : x0 + A.tile, yTop = square ? cy - half : winTop, yBot = square ? cy + half : winTop + A.win;
  return { u0: x0 / Wpx, u1: x1 / Wpx, v0: 1 - yBot / Hpx, v1: 1 - yTop / Hpx };
}
export function tilePlane(w, h, uv) {
  const g = new THREE.PlaneGeometry(w, h), a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv.u0 + a.getX(i) * (uv.u1 - uv.u0), uv.v0 + a.getY(i) * (uv.v1 - uv.v0));
  return g;
}
// Rozmieszczenie szyldów (funkcja czysta, bez DOM — asercja F2 w test_geometria.mjs): dla domów przy placu (W.portals bez setback) udział S.share ze strumienia
// rng(seedLocal + 7) (r() domu bez zmian), karczma (s2, along > 0, pierwsza) zawsze z kafelkiem S.tavernTile. Szyld na x = doorX − sign(along)·fromDoor (ku ulicy);
// gdy wykusz (orielX, piętro 1: bryła od y 3,195 w dół do kroksztynów) bliżej niż oriel.r + orielGap — po drugiej stronie drzwi, inaczej bez szyldu.
// Zwraca [{p, x, tile, m (signMatrix), mBack, bracket, hangers[], plaque|null, tr, dirToStreet}] — buildSigns tylko dodaje z tego geometrię i asercje.
export function signPlacements(W) {
  const { CONFIG, portals, sideTransform } = W, S = CONFIG.houseDetail.sign, O = CONFIG.houseDetail.oriel, C = O.corbel;
  const tavern = portals.find(p => p.side === 2 && p.along > 0 && !p.setback);
  const out = []; let pool = []; // pula kafelków bez powtórzeń (bez kafelka karczmy), uzupełniana po wyczerpaniu — 8 godeł na ~10 szyldów
  for (const p of portals) {
    if (p.setback) continue; // domy zamykające ulice: along = 0, brak „strony ulicy"
    const Rg = rng(p.seedLocal + 7), has = Rg() < S.share, draw = Rg(); // oba losowania zawsze (ten sam strumień niezależnie od karczmy i puli)
    if (!has && p !== tavern) continue;
    if (!pool.length) pool = S.tiles.map((_, i) => i).filter(i => i !== S.tavernTile);
    const tile = p === tavern ? S.tavernTile : pool.splice(Math.floor(draw * pool.length), 1)[0], sgn = Math.sign(p.along);
    const clear = x => p.orielX === null || Math.abs(x - p.orielX) >= O.r + S.orielGap;
    const x = [p.doorX - sgn * S.fromDoor, p.doorX + sgn * S.fromDoor].find(x => clear(x) && Math.abs(x) <= p.w / 2 - 0.3); // 0.3: zapas od krawędzi domu
    if (x === undefined) continue;
    const tr = sideTransform(p.side, p.along + x, p.setback), F = (lx, ly, lz, ry = 0) => M4(lx, ly, lz, ry).premultiply(M4(tr.x, 0, tr.z, tr.ry)); // układ domu przesunięty na x szyldu
    const m = signMatrix(tr, p.along, { y: S.y, faceZ: p.faceZ1, out: S.out });
    const mBack = M4(0, 0, -S.gapBack, Math.PI).premultiply(m); // druga płaszczyzna: obrócona o π wokół własnej osi y, gapBack za pierwszą (czytelna z drugiej strony, nie lustro)
    const bracket = F(0, S.bracketY, p.faceZ1 - S.bracket.back + S.bracket.len / 2);
    const hangers = [-1, 1].map(s => F(0, S.bracketY - S.bracket.t / 2 - S.hanger.h / 2 + 0.01, p.faceZ1 + S.out + s * (S.w / 2 - 0.15))); // 0.01: wieszak 1 cm w wsporniku; 0.15: od krawędzi szyldu
    const plaqueOK = p.orielX === null || Math.abs(p.doorX - p.orielX) >= C.step / 2 + C.t / 2 + S.plaque.w / 2 + 0.01; // kroksztyny wykusza (x = cx ± step/2, grubość t) obok plakiety
    const plaque = plaqueOK ? F(p.doorX - x, S.plaque.y, p.faceZ + S.plaque.out) : null;
    out.push({ p, x, tile, m, mBack, bracket, hangers, plaque, tr, dirToStreet: new THREE.Vector3(-sgn, 0, 0).transformDirection(M4(0, 0, 0, tr.ry)) });
  }
  return out;
}
// Szyldy cechowe + herby (motyw #10b): geometria z signPlacements(W); klucz `sign` = atlas (1 materiał), wspornik i wieszaki `iron`. Flaga ?nosign=1 → buildBanners (szyld HEAD).
function buildSigns(W) {
  const { CONFIG, B, mat, ctx } = W, S = CONFIG.houseDetail.sign, A = S.atlas, Po = CONFIG.houseDetail.portal;
  mat.sign = new THREE.MeshStandardMaterial({ map: signTexture(W.hex, A, S.tavernText), roughness: 0.8 }); // jednostronny: 2 płaszczyzny back-to-back
  const placements = signPlacements(W);
  check(placements.length >= 3 && placements.some(s => s.tile === S.tavernTile), 'szyldy: mniej niż 3 albo brak karczmy', { n: placements.length }); // 3: seed 7 daje ~10
  for (const s of placements) {
    const { p, m, tr } = s, id = `szyld s${p.side} along${p.along.toFixed(1)}`, nrm = facadeNormal(tr.ry), LP = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry));
    B.add('sign', tilePlane(S.w, S.h, signTileUV(s.tile, A)), m);
    B.add('sign', tilePlane(S.w, S.h, signTileUV(s.tile, A)), s.mBack);
    check(new THREE.Vector3(0, 0, 1).transformDirection(m).dot(s.dirToStreet) > 0.9, `${id} tyłem do ulicy`, { n: new THREE.Vector3(0, 0, 1).transformDirection(m).toArray() }); // §5.2 #10; F2 offline
    check(new THREE.Vector3(0, 0, 1).transformDirection(s.mBack).dot(s.dirToStreet) < -0.9, `${id} druga płaszczyzna nie tyłem`); // −0,9: jak próg F, z drugiej strony
    checkInFrontOfWall(`${id} środek`, new THREE.Vector3().setFromMatrixPosition(m), LP(0, S.y, p.faceZ1), nrm, S.out - 0.005); // 0,8 przed licem piętra 1
    B.add('iron', box(S.bracket.t, S.bracket.t, S.bracket.len), s.bracket);
    const bBack = new THREE.Vector3(0, 0, -S.bracket.len / 2).applyMatrix4(s.bracket), bFront = new THREE.Vector3(0, 0, S.bracket.len / 2).applyMatrix4(s.bracket), wall = LP(0, S.bracketY, p.faceZ1);
    check(bBack.clone().sub(wall).dot(nrm) <= -0.05 && bFront.clone().sub(wall).dot(nrm) >= S.out + S.w / 2, `${id} wspornik nie w ścianie / krótszy niż szyld`, { back: bBack.clone().sub(wall).dot(nrm), front: bFront.clone().sub(wall).dot(nrm) }); // −0,1 ≤ −0,05; 1,5 ≥ 1,45
    check(S.y + S.h / 2 <= S.bracketY - S.bracket.t / 2 && S.y - S.h / 2 >= 2.6, `${id} szyld nie pod wspornikiem / za nisko`, { top: S.y + S.h / 2, bracketBottom: S.bracketY - S.bracket.t / 2 }); // 3,45 ≤ 3,475; spód 2,65 ≥ 2,6 (nad głową 1,65 + zapas)
    for (const hm of s.hangers) B.add('iron', box(S.hanger.t, S.hanger.h, S.hanger.t), hm);
    if (s.plaque) { // herb nad zwornikiem portalu (ten sam kafelek, kwadratowe okno)
      B.add('sign', tilePlane(S.plaque.w, S.plaque.h, signTileUV(s.tile, A, true)), s.plaque);
      const kTop = Po.impostY + Po.archOut + Po.keystone.up, pc = new THREE.Vector3().setFromMatrixPosition(s.plaque);
      if (!ctx.flags.noportal) check(S.plaque.y - S.plaque.h / 2 >= kTop + 0.02, `${id} plakieta w zworniku`, { bottom: S.plaque.y - S.plaque.h / 2, kTop }); // 2,65 ≥ 2,645
      check(S.plaque.y + S.plaque.h / 2 <= CONFIG.house.groundFloor - 0.16 - 0.02, `${id} plakieta w belkach jetty`, { top: S.plaque.y + S.plaque.h / 2 }); // 3,01 ≤ 3,02 (belki bt 0,16 od gf)
      checkInFrontOfWall(`${id} plakieta`, pc, LP(p.doorX - s.x, S.plaque.y, p.faceZ), nrm, S.plaque.out - 0.005); // 2 cm przed licem parteru
    }
  }
  W.signs = placements;
}

// Macierz szyldu (funkcja czysta — asercja F w audyt/testy/test_geometria.mjs, eksport w geo/entry.mjs): szyld wisi PROSTOPADLE do fasady,
// FRONTEM (lokalne +z płaszczyzny) DO ULICY, czyli ku along = 0 wzdłuż pierzei: ry = tr.ry − sign(along)·π/2. Policzone (§3.1) dla 4 pierzei × 2 znaki
// along: n·dirToStreet = 1,00 w 8/8, dirToStreet = (−sign(along),0,0)·M4(0,0,0,tr.ry); stary łańcuch z HEAD M4(…,tr.ry)·T(0,0,0.8)·RotY(π/2) nie zależał
// od along i dawał 4/8 (PROMPT §3.4 pisał „0/8" — K13: dla along < 0 przechodził przypadkiem, dla along > 0, w tym karczma s2, tył DoubleSide = lustro).
// tr = sideTransform(side, along szyldu, setback) = punkt na osi domu; szyld na wysokości y, out m przed licem faceZ (lokalne +z domu = front).
export function signMatrix(tr, along, { y = 3.05, faceZ = 4, out = 0.8 } = {}) { // słownik skali §3.7: środek szyldu 3,05, wysięg 0,8; lico parteru d/2 = 4
  return M4(0, y, faceZ + out, -Math.sign(along) * Math.PI / 2).premultiply(M4(tr.x, 0, tr.z, tr.ry));
}

// FUNKCJA CZYSTA (poprawka r1 K8): kominy, których wierzch (W.chimneys z buildings.js — na kalenicy) rzutuje się w kadr startowy (CONFIG.composition.start; kamera jak
// bunting.js clockClearance: fov/oko z CONFIG.bunting.clockClear, aspect 412/915 jak §5.3), |NDC x|, |NDC y| ≤ 1 − margin, przed kamerą; najbliższe `max` w kolejności odległości.
// HEAD: co czwarty komin (i % 4 === 1) — żaden nie leżał w kadrze startu. Test: asercja M w test_geometria.mjs (≥ 2 smokerów, każdy w kadrze).
export function smokerChimneys(W) {
  const { CONFIG, chimneys } = W, st = CONFIG.composition.start, K = CONFIG.bunting.clockClear, Sm = CONFIG.props.smoke;
  const cam = new THREE.PerspectiveCamera(K.fov, 412 / 915, 0.05, 300);   // portret S24 (§5.3); near/far jak app.js:44
  cam.position.set(st.x, K.eye, st.z); cam.rotation.set(0, 0, 0, 'YXZ'); cam.rotation.y = st.yaw; cam.rotation.x = st.pitch;   // jak app.js:154
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const inFrame = c => { const p = new THREE.Vector3(c.x, c.y, c.z).project(cam); return p.z < 1 && Math.abs(p.x) <= 1 - Sm.margin && Math.abs(p.y) <= 1 - Sm.margin; };
  return chimneys.filter(inFrame).map(c => ({ c, d: Math.hypot(c.x - st.x, c.z - st.z) })).sort((a, b) => a.d - b.d).slice(0, Sm.max).map(x => x.c);
}

export function buildSmoke(W) {
  const { ctx, scene, R, chimneys } = W;
  // dym z kominów w kadrze startu (smokerChimneys; HEAD: co czwarty komin): cząstki unoszą się i rozwiewają, zapętlone
  const smokeTex = smokeTexture();
  const smokers = ctx.flags.nosmoke ? [] : smokerChimneys(W);
  check(ctx.flags.nosmoke || smokers.length >= 2, 'za mało kominów z dymem w kadrze startu', { n: smokers.length, kominów: chimneys.length });
  for (const c of smokers) {
    const N = 28, pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => ({ t0: R() * 9, dx: R() - 0.5, dz: R() - 0.5 }));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: smokeTex, size: 1.6, transparent: true, opacity: 0.28, depthWrite: false, color: W.hex.smoke, sizeAttenuation: true }); // kolor z palety (CONFIG.paletteOKLCH.smoke)
    const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene.add(pts);
    ctx.updaters.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        const life = ((t + seeds[i].t0) % 9) / 9; // 0..1
        pos[i * 3] = c.x + seeds[i].dx * life * 3 + Math.sin(t * 0.5 + i) * 0.2 * life;
        pos[i * 3 + 1] = c.y + life * 5.5;
        pos[i * 3 + 2] = c.z + seeds[i].dz * life * 3 + 0.6 * life; // lekki wiatr
      }
      geo.attributes.position.needsUpdate = true;
    });
  }
}
