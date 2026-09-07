// Rekwizyty z modeli (instancjonowane lub klonowane), latarnie ze światłem, wóz, chorągwie, szyld, dym z kominów.
// Modele stawia put(name, x, y, z, ry, scale) w ŚWIECIE (spód modelu na y); geometria wozu ma własny układ lokalny przez L() (+z = front). Metry.
// Cięcia skanów (motyw #1, ?nocuts=1 wyłącza): W.cuts = CONFIG.props.cuts — limit instancji per model w put(), szkło bez transmisji, towar bez cienia.
import * as THREE from 'three';
import { box, plane, cylinder, M4 } from '../../engine/src/geometry.js';
import { signTexture, smokeTexture } from './materials.js';
import { check, checkHeight, checkAboveGround, checkCollisionCovers } from '../../engine/src/check.js';

// Ładuje modele i przygotowuje put()/flushInstances() dla reszty modułów.
export async function initProps(W) {
  const { ctx, scene, loaders, CONFIG } = W;
  const cuts = ctx.flags.nocuts ? null : CONFIG.props.cuts; W.cuts = cuts;   // ?nocuts=1: stan sprzed cięć skanów (motyw #1)
  const names = ['wooden_crate_01', 'wine_barrel_01', 'Barrel_01', 'wicker_basket_01', 'wooden_bucket_02', 'ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01', 'food_apple_01', 'treasure_chest', 'wooden_stool_02', 'wooden_lantern_01', 'horse_statue_01', 'grass_medium_02', 'fern_02', 'tree_stump_01', 'rock_moss_set_02', 'potted_plant_02', 'wine_bottles_01', 'Lantern_01'].filter(n => !cuts || n !== 'treasure_chest');   // z cięciami skrzynia skarbów nieładowana (10 332 tri)
  const models = new Map(await Promise.all(names.map(async n => [n, await loaders.loadModel(n)])));
  const bounds = new Map();
  for (const [n, g] of models) { g.scene.updateMatrixWorld(true); bounds.set(n, new THREE.Box3().setFromObject(g.scene)); }
  // Materiały z transmisją (butelki: KHR_materials_transmission) → zwykła przezroczystość alfa. Transmisja = WebGLRenderer.renderTransmissionPass:
  // każdy nieprzezroczysty obiekt sceny rysowany drugi raz do tekstury (zmierzone w bazie: modele bez cienia miały 2 wywołania i 2× trójkątów).
  const materialsOf = () => { const out = []; for (const [, g] of models) g.scene.traverse(o => { if (o.isMesh) out.push(...[].concat(o.material)); }); return out; };
  if (cuts) for (const m of materialsOf()) if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = cuts.glassOpacity; m.needsUpdate = true; }
  check(!cuts || materialsOf().every(m => !(m.transmission > 0)), 'materiał z transmisją (drugi przebieg renderera)');
  // Rekwizyty są instancjonowane: jeden draw call na (model × materiał) zamiast jednego na kopię.
  const placements = new Map();
  const NO_SHADOW = new Set([...CONFIG.props.noShadow, ...(cuts ? cuts.noShadow : [])]);
  const counts = new Map();   // ile razy proszono o model — limit CONFIG.props.cuts.maxCount pomija nadmiar (bez kolizji, bez bryły)
  function put(name, x, y, z, ry = 0, scale = 1, opts = {}) {
    const nth = counts.get(name) ?? 0; counts.set(name, nth + 1);
    if (cuts && nth >= (cuts.maxCount[name] ?? Infinity)) return false;
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
  const lights = Array.from({ length: ctx.flags.nolights ? 0 : 4 }, () => { const l = new THREE.PointLight(0xffa452, 5, 12, 2); scene.add(l); return l; });
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
    const kind = R.pick(['Barrel_01', 'wooden_crate_01', 'wine_barrel_01', 'wooden_bucket_02', 'wicker_basket_01', 'wooden_stool_02', 'potted_plant_02', 'wooden_crate_01']);
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
  put('rock_moss_set_02', half - 6, 0, -half + 5, 1.2, 0.8);
  if (!cuts) { put('treasure_chest', 9, 0, -7, 2.4, 0.9); put('Lantern_01', 9.2, 0.62, -7.1, 1.0, 1, { collide: false }); return; }   // stan bazowy: skrzynia i latarenka na jej wieku (0,62 m)
  // cięcia: bez skrzyni skarbów (10 332 tri + cień); latarenka staje na pieńku — wierzch pieńka = jego wysokość (put stawia spód na y),
  // pieniek stoi w skali 1 (obrót ry nie zmienia wysokości; bbox modelu y −0,193..0,378 → 0,571 m; latarenka 0,12 × 0,29 × 0,10 m)
  const sb = bounds.get('tree_stump_01'), lb = bounds.get('Lantern_01'), stumpTop = sb.max.y - sb.min.y;
  check(stumpTop >= 0.3 && stumpTop <= 1.2, 'pieniek: wysokość poza zakresem pieńka', { stumpTop });   // 0,3–1,2 m = pieniek, nie kłoda ani pień
  check(Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) <= 0.5 * Math.min(sb.max.x - sb.min.x, sb.max.z - sb.min.z), 'latarenka szersza niż pół pieńka');   // 0,5: mieści się na ściętym wierzchu, nie na korzeniach
  put('Lantern_01', -half + 5, stumpTop, half - 6, 1.0, 1, { collide: false });   // (x,z) pieńka = środek pnia (początek modelu), ry 1.0 jak w bazie
}

export function buildCart(W) {
  const { ctx, T, B, put } = W;
  {
    const x = -8, z = 9, ry = 0.7;
    const L = (lx, ly, lz, lry = 0, lrx = 0, lrz = 0) => M4(lx, ly, lz, lry, lrx, lrz).premultiply(M4(x, 0, z, ry));
    B.add('planks', box(2.4, 0.08, 1.2, T.planks.mpt), L(0, 0.9, 0));
    for (const sx of [-1, 1]) B.add('planks', box(0.06, 0.5, 1.2, T.planks.mpt), L(sx * 1.17, 1.19, 0));
    for (const sz of [-1, 1]) B.add('planks', box(2.4, 0.5, 0.06, T.planks.mpt), L(0, 1.19, sz * 0.57));
    B.add('timber', box(2.6, 0.12, 0.12, T.timber.mpt), L(0, 0.8, 0));
    for (const sz of [-1, 1]) {
      const wheel = new THREE.TorusGeometry(0.62, 0.06, 8, 20); wheel.rotateY(Math.PI / 2);
      B.add('timber', wheel, L(0.3, 0.62, sz * 0.72));
      for (let k = 0; k < 6; k++) B.add('timber', box(0.05, 1.2, 0.05, T.timber.mpt), L(0.3, 0.62, sz * 0.72, 0, k * Math.PI / 6, 0)); // rot: rx=k·π/6 → szprycha (0,1,0) obraca się w płaszczyźnie y-z koła: k=1 → (0, 0.866, 0.5)
      B.add('timber', box(0.14, 0.14, 1.6, T.timber.mpt), L(0.3, 0.62, 0));
    }
    for (const sz of [-1, 1]) B.add('timber', box(2.2, 0.1, 0.1, T.timber.mpt), L(-2.2, 0.75, sz * 0.4, 0, 0, 0.08)); // rot: rz=+0.08 → koniec +x (przy wozie) w GÓRĘ: (1,0,0)→(0.997,0.08,0); końce w świecie y 0.662 (czubek) / 0.838 (przy wozie)
    ctx.addCircle(x, z, 1.5);
    put('wooden_crate_01', x + 0.2, 0.94, z, ry, 0.8, { collide: false });
    put('wicker_basket_01', x - 0.7, 0.94, z + 0.2, ry + 1, 0.9, { collide: false });
  }
}

export function buildBanners(W) {
  const { R, H, half, B, mat, bannerMats, houses, sideTransform } = W;
  for (let i = 0; i < 8; i++) {
    const side = i % 4, along = (i < 4 ? -1 : 1) * R.range(half * 0.3, half * 0.85);
    const t = sideTransform(side, along, -H.depth / 2 - 0.4);
    // drzewiec wychylony od ściany ku placowi (lokalne +z), płótno zwisa pionowo z jego końca
    const base = M4(t.x, 5.0, t.z, t.ry);
    const tilt = new THREE.Matrix4().makeRotationX(0.35);
    B.add('iron', cylinder(0.03, 0.03, 1.6, 6, 1), base.clone().multiply(tilt).multiply(new THREE.Matrix4().makeTranslation(0, 0.8, 0)));
    const top = new THREE.Vector3(0, 1.6, 0).applyMatrix4(base.clone().multiply(tilt));
    B.add('banner' + (i % bannerMats.length), plane(0.9, 1.6, 1), M4(top.x, top.y - 0.85, top.z, t.ry));
  }
  // szyld karczmy: pierwszy dom po prawej od ulicy południowej
  {
    const tav = houses.find(h => h.side === 2 && h.along > 0 && !h.setback) || houses[0];
    const t = sideTransform(tav.side, tav.along - tav.w / 2 + 2.0, -H.depth / 2 - 0.5);
    mat.sign = new THREE.MeshStandardMaterial({ map: signTexture('Pod Złotym Gryfem'), roughness: 0.8, side: THREE.DoubleSide });
    B.add('iron', box(0.05, 0.05, 1.1), M4(t.x, 3.6, t.z, t.ry).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.3)));
    B.add('sign', plane(1.3, 0.8, 1), M4(t.x, 3.05, t.z, t.ry).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.8)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
  }
}

export function buildSmoke(W) {
  const { ctx, scene, R, chimneys } = W;
  // dym z kominów (co czwarty komin): cząstki unoszą się i rozwiewają, zapętlone
  const smokeTex = smokeTexture();
  const smokers = ctx.flags.nosmoke ? [] : chimneys.filter((c, i) => i % 4 === 1).slice(0, 6);
  for (const c of smokers) {
    const N = 28, pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => ({ t0: R() * 9, dx: R() - 0.5, dz: R() - 0.5 }));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: smokeTex, size: 1.6, transparent: true, opacity: 0.28, depthWrite: false, color: 0xd8d2c8, sizeAttenuation: true });
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
