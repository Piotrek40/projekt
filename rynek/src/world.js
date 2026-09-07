// Rynek w stylu high fantasy: plac z fontanną, kamienice szachulcowe wokół, wieża ratusza, kramy, wóz, latarnie, chorągwie.
// Cały układ wynika z CONFIG i ziarna losowego — nowy rynek to inne ziarno, większy rynek to inny rozmiar, nie nowy kod.
import * as THREE from 'three';
import { box, plane, gable, cylinder, Batch, M4, rng } from '../../engine/src/geometry.js';
import { repeatSet } from '../../engine/src/materials.js';
import { followShadow } from '../../engine/src/sky.js';

export const CONFIG = {
  seed: 7,
  plaza: { size: 44, streetWidth: 6, streetLength: 16 },
  house: { depth: 8, floorHeight: 2.9, groundFloor: 3.2, jetty: 0.35, roofPitch: 0.85, overhang: 0.55, widthMin: 6, widthMax: 9.5, floorsMin: 2, floorsMax: 3 },
  tower: { size: 7, height: 15, roofHeight: 6 },
  fountain: { radius: 3.2, rim: 0.75, columnHeight: 1.6, blockScale: 1.1 },
  stalls: { count: 7, ringRadius: 11.5 },
  lanterns: { count: 8, ringRadius: 15.5 },
  sky: { file: 'sky_1k.hdr', environmentIntensity: 0.6, sunIntensity: 5.0, sunColor: 0xffd6a6, minElevationDeg: 30, rotation: -0.25, shadowExtent: 22 },
  // paleta: ciepłe tynki, ciemny dąb, dachówka; baldachimy i chorągwie w barwach heraldycznych
  palette: {
    plaster: [0xe3d3b2, 0xd6c39d, 0xe8dfcf, 0xc9b58f, 0xdcc7b4],
    roof: [0xb8734f, 0xa0654a, 0x8d5a45],
    cloth: [0x8c1f28, 0x1f4d3a, 0xc98a1b, 0x2b3a6b],
    timber: 0x5a4030,
    stone: 0xcfc6b8,
    water: 0x2f5a63,
  },
  textures: {
    cobble:  { name: 'cobblestone_floor_04', mpt: 2.5 },
    plaster: { name: 'plastered_wall',       mpt: 2.0 },
    timber:  { name: 'old_planks_02',        mpt: 1.5 },
    planks:  { name: 'weathered_planks',     mpt: 2.0 },
    roof:    { name: 'roof_09',              mpt: 2.0 },
    stone:   { name: 'rustic_stone_wall_02', mpt: 2.0 },
    blocks:  { name: 'medieval_blocks_05',   mpt: 2.0 },
    slates:  { name: 'castle_wall_slates',   mpt: 2.0 },
  },
};

export async function buildWorld(ctx) {
  const { scene, loaders } = ctx;
  const R = rng(CONFIG.seed);
  const P = CONFIG.palette, T = CONFIG.textures, H = CONFIG.house;
  const S = CONFIG.plaza.size, half = S / 2;

  // ---------- niebo i słońce ----------
  const skyFile = new URLSearchParams(location.search).get('sky') || CONFIG.sky.file;
  const sun = await ctx.sky({ ...CONFIG.sky, file: skyFile, minElevation: THREE.MathUtils.degToRad(CONFIG.sky.minElevationDeg) });
  ctx.updaters.push((dt, t, p) => followShadow(sun, p.x, p.z));

  // ---------- tekstury i materiały ----------
  const sets = {};
  await Promise.all(Object.entries(T).map(async ([k, v]) => { sets[k] = await ctx.loadPbrSet(v.name, { metersPerTile: v.mpt }); }));
  const mat = {};
  mat.cobble = sets.cobble.material({ color: 0xb9b3aa });
  mat.stone = sets.stone.material({ color: P.stone });
  mat.blocks = sets.blocks.material();
  mat.slates = sets.slates.material({ color: 0xb8b4ae });
  mat.timber = sets.timber.material({ color: P.timber });
  mat.planks = sets.planks.material();
  mat.door = sets.planks.material({ color: 0x6b4a33 });
  P.plaster.forEach((c, i) => { mat['plaster' + i] = sets.plaster.material({ color: c }); });
  P.roof.forEach((c, i) => { mat['roof' + i] = sets.roof.material({ color: c }); });
  mat.roofTower = sets.roof.material({ color: 0x4a4d56 });
  const fabricNor = await loaders.loadTexture('fabric_pattern_07', 'nor'), fabricArm = await loaders.loadTexture('fabric_pattern_07', 'arm');
  for (const t of [fabricNor, fabricArm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = ctx.aniso(); }
  P.cloth.forEach((c, i) => { mat['cloth' + i] = new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, normalMap: fabricNor, roughnessMap: fabricArm, side: THREE.DoubleSide }); });
  mat.glass = new THREE.MeshPhysicalMaterial({ color: 0x1a222c, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.5 });
  mat.glassLit = new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffb257, emissiveIntensity: 1.6, roughness: 0.3 });
  mat.iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.55, metalness: 0.9 });
  mat.water = new THREE.MeshPhysicalMaterial({ color: P.water, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.85, envMapIntensity: 1.8, normalMap: sets.cobble.normalMap.clone(), normalScale: new THREE.Vector2(0.25, 0.25) });
  mat.water.normalMap.repeat.set(3, 3); mat.water.normalMap.needsUpdate = true;
  mat.flame = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const bannerMats = P.cloth.map((c, i) => new THREE.MeshStandardMaterial({ map: heraldry(c, P.cloth[(i + 2) % P.cloth.length], i), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 }));
  bannerMats.forEach((m, i) => { mat['banner' + i] = m; });
  const windUniform = { value: 0 };
  const sway = (m, amp, byUv) => { m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n float swayK = ${byUv ? '(1.0 - clamp(uv.y, 0.0, 1.0))' : '1.0'};\n transformed.x += sin(uWind * 2.1 + position.y * 2.0 + position.z * 0.7) * ${amp} * swayK;\n transformed.z += cos(uWind * 1.7 + position.x * 1.3) * ${amp * 0.5} * swayK;`);
  }; };
  bannerMats.forEach(m => sway(m, 0.08, true));
  ctx.updaters.push((dt, t) => { windUniform.value = t; });

  const B = new Batch();

  // ---------- plac i ulice ----------
  const groundExtent = half + CONFIG.plaza.streetLength + H.depth + 6;
  B.place('cobble', plane(groundExtent * 2, groundExtent * 2, T.cobble.mpt), 0, 0, 0, 0, -Math.PI / 2);
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
      let pos = a;
      while (b - pos > H.widthMin) {
        let w = Math.min(R.range(H.widthMin, H.widthMax), b - pos);
        if (b - pos - w < H.widthMin) w = b - pos; // ostatni dom domyka pierzeję
        houses.push({ side, along: pos + w / 2, w, floors: R.int(H.floorsMin, H.floorsMax), plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: R() < 0.35, jetty: R() < 0.7, seedLocal: R.int(1, 1e6) });
        pos += w;
      }
    }
  }
  for (let s = 0; s < 4; s++) layoutSide(s);
  // domy zamykające ulice (widok w głąb ulicy kończy się fasadą)
  for (let s = 0; s < 4; s++) houses.push({ side: s, along: 0, w: sw + 2 * H.depth, floors: 3, plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: false, jetty: true, seedLocal: R.int(1, 1e6), setback: sl });

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

  const chimneys = [];
  for (const h of houses) {
    const r = rng(h.seedLocal);
    const tr = sideTransform(h.side, h.along, h.setback);
    const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(tr.x, 0, tr.z, tr.ry)); // lokalny → świat
    const w = h.w, d = H.depth, gf = H.groundFloor, fh = H.floorHeight;
    const off = [r(), r()];
    // parter kamienny
    B.add('stone', box(w, gf, d, T.stone.mpt, off), L(0, gf / 2, 0));
    // kolizja: obrys domu (osiowy w świecie — domy stoją wzdłuż osi)
    const wx = (h.side % 2 === 0) ? w : d, wz = (h.side % 2 === 0) ? d : w;
    ctx.addRect(tr.x, tr.z, wx / 2, wz / 2);
    // piętra z wykuszem (jetty): każde wyższe piętro wysunięte do przodu
    let y = gf, jet = 0;
    const plasterKey = 'plaster' + h.plaster;
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
      for (let i = 0; i <= n; i++) {
        const x = -fw / 2 + i * fw / n;
        B.add('timber', box(bt, fh, bt, T.timber.mpt), L(x, y + fh / 2, zf));
        if (i < n && r() < 0.5) { // zastrzał w polu
          const len = Math.hypot(fw / n, fh) * 0.7;
          B.add('timber', box(bt * 0.8, len, bt * 0.8, T.timber.mpt), L(x + fw / n / 2, y + fh / 2, zf, 0, 0, Math.atan2(fw / n, fh) * (r() < 0.5 ? 1 : -1)));
        }
      }
      // belki stropowe wystające pod wykuszem
      if (h.jetty) for (let i = 0; i <= n; i++) B.add('timber', box(bt, bt, H.jetty + 0.3, T.timber.mpt), L(-fw / 2 + i * fw / n, y - bt / 2, front - (H.jetty + 0.3) / 2 - 0.05));
      // okna piętra: w polach między słupkami
      for (let i = 0; i < n; i++) {
        if (r() < 0.25) continue;
        const cx = -fw / 2 + (i + 0.5) * fw / n, ww = Math.min(1.0, fw / n - 0.5), wh = 1.3;
        const lit = r() < 0.35;
        B.add(lit ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(cx, y + fh * 0.55, front + 0.01));
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 - wh / 2, front + 0.02));
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 + wh / 2, front + 0.02));
        B.add('timber', box(0.06, wh, 0.1), L(cx, y + fh * 0.55, front + 0.02));
      }
      y += fh;
    }
    // parter: drzwi i okna
    const doorX = (r() - 0.5) * (w - 3);
    B.add('door', box(1.2, 2.3, 0.1, 1.2), L(doorX, 1.15, d / 2 + 0.02));
    B.add('timber', box(1.5, 0.14, 0.2, T.timber.mpt), L(doorX, 2.4, d / 2 + 0.02));
    for (const sx of [-1, 1]) {
      const cx = doorX + sx * 2.2; if (Math.abs(cx) > w / 2 - 0.9) continue;
      B.add(r() < 0.3 ? 'glassLit' : 'glass', box(0.9, 1.1, 0.04), L(cx, 1.8, d / 2 + 0.01));
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 - 0.55, d / 2 + 0.02));
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 + 0.55, d / 2 + 0.02));
    }
    // dach
    const roofKey = 'roof' + h.roof, ov = H.overhang, pitch = H.roofPitch;
    const topD = d + jet;
    if (h.gableFront) {
      // kalenica wzdłuż z: szczyt widoczny od placu
      const span = w + 2 * ov, rise = (w / 2) * Math.tan(pitch), slope = Math.hypot(w / 2 + ov, rise);
      for (const sx of [-1, 1]) B.add(roofKey, box(slope, 0.14, topD + 2 * ov, T.roof.mpt, off), L(sx * (w / 4 + ov / 2), y + rise / 2, jet / 2, 0, 0, -sx * Math.atan2(rise, w / 2 + ov)));
      B.add(plasterKey, gable(w, rise, topD, T.plaster.mpt), L(0, y, jet / 2));
      B.add('timber', box(0.2, 0.2, topD + 2 * ov, T.timber.mpt), L(0, y + rise, jet / 2));
      // belki szczytu
      B.add('timber', box(0.14, rise * 0.9, 0.14, T.timber.mpt), L(0, y + rise * 0.45, topD / 2 + jet / 2 + 0.01));
    } else {
      // kalenica wzdłuż x: okap nad fasadą
      const rise = (topD / 2) * Math.tan(pitch), slope = Math.hypot(topD / 2 + ov, rise);
      for (const sz of [-1, 1]) B.add(roofKey, box(w + 2 * ov, 0.14, slope, T.roof.mpt, off), L(0, y + rise / 2, jet / 2 + sz * (topD / 4 + ov / 2), 0, -sz * Math.atan2(rise, topD / 2 + ov)));
      // szczyty boczne (trójkąty) — widoczne między domami różnej wysokości
      for (const sx of [-1, 1]) B.add(plasterKey, gable(topD, rise, 0.3, T.plaster.mpt), L(sx * (w / 2 - 0.15), y, jet / 2, Math.PI / 2));
      B.add('timber', box(w + 2 * ov, 0.2, 0.2, T.timber.mpt), L(0, y + rise, jet / 2));
      // lukarna
      if (r() < 0.5) {
        const dx = (r() - 0.5) * (w - 3);
        B.add(plasterKey, box(1.4, 1.2, 1.2, T.plaster.mpt), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.9));
        B.add(roofKey, box(1.8, 0.12, 1.4, T.roof.mpt), L(dx, y + 1.5, topD / 2 + jet / 2 - 0.9, 0, -0.5));
        B.add('glass', box(0.7, 0.6, 0.04), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.28));
      }
    }
    // komin
    const chx = (r() - 0.5) * (w - 2);
    B.add('stone', box(0.9, y + 2.2 - gf, 0.9, T.stone.mpt, off), L(chx, (gf + y + 2.2) / 2, -1.5));
    chimneys.push(new THREE.Vector3(chx, y + 2.2, -1.5).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry)));
  }

  // ---------- wieża ratusza (północna pierzeja, przy ulicy) ----------
  {
    const tw = CONFIG.tower.size, th = CONFIG.tower.height, rh = CONFIG.tower.roofHeight;
    const tx = sw / 2 + tw / 2 + 0.5, tz = -half - tw / 2 - 0.2;
    B.place('slates', box(tw, th, tw, T.slates.mpt), tx, th / 2, tz);
    ctx.addRect(tx, tz, tw / 2, tw / 2);
    // gzyms, okna strzelnicze, zegar-tarcza, dach ostrosłupowy
    B.place('blocks', box(tw + 0.6, 0.5, tw + 0.6, T.blocks.mpt), tx, th - 0.25, tz);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, ox = Math.sin(a) * (tw / 2 + 0.01), oz = Math.cos(a) * (tw / 2 + 0.01);
      B.place('glassLit', box(0.7, 1.6, 0.08), tx + ox, th - 3.2, tz + oz, a);
      B.place('glass', box(0.5, 1.2, 0.08), tx + ox, th - 8, tz + oz, a);
      B.place('timber', box(0.9, 0.1, 0.16, T.timber.mpt), tx + ox, th - 2.35, tz + oz, a);
    }
    const roofG = new THREE.ConeGeometry(tw / 2 * 1.45, rh, 4, 1);
    roofG.rotateY(Math.PI / 4);
    { const uv = roofG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tw * 2 / T.roof.mpt, uv.getY(i) * rh / T.roof.mpt); }
    B.place('roofTower', roofG, tx, th + rh / 2, tz);
    B.place('iron', cylinder(0.05, 0.05, 2.2, 6, 1), tx, th + rh + 1.0, tz);
    B.place('banner2', plane(1.4, 0.9, 1), tx + 0.7, th + rh + 1.6, tz);
    // zadaszone wejście
    B.place('blocks', box(2.2, 0.4, 1.4, T.blocks.mpt), tx, 3.0, tz + tw / 2 + 0.6);
    B.place('door', box(1.6, 2.8, 0.1, 1.6), tx, 1.4, tz + tw / 2 + 0.03);
  }

  // ---------- fontanna ----------
  {
    const F = CONFIG.fountain, r = F.radius;
    const bm = F.blockScale;
    B.place('blocks', cylinder(r, r + 0.1, F.rim, 8, bm), 0, F.rim / 2, 0);
    B.place('blocks', cylinder(r + 0.25, r + 0.25, 0.14, 8, bm), 0, F.rim + 0.07, 0);
    B.place('blocks', cylinder(0.7, 0.85, F.columnHeight, 8, bm), 0, F.rim + F.columnHeight / 2, 0);
    B.place('blocks', cylinder(1.2, 1.0, 0.3, 8, bm), 0, F.rim + F.columnHeight + 0.15, 0);
    // schodek wokół
    B.place('blocks', cylinder(r + 1.1, r + 1.2, 0.18, 8, bm), 0, 0.09, 0);
    ctx.addCircle(0, 0, r + 1.0);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.05, 32), mat.water);
    water.rotation.x = -Math.PI / 2; water.position.y = F.rim - 0.1; water.receiveShadow = true;
    scene.add(water);
    ctx.updaters.push((dt, t) => { mat.water.normalMap.offset.set(t * 0.02, t * 0.013); });
  }

  // ---------- kramy ----------
  const stalls = [];
  for (let i = 0; i < CONFIG.stalls.count; i++) {
    const a = (i / CONFIG.stalls.count) * Math.PI * 2 + R.range(-0.15, 0.15);
    const rad = CONFIG.stalls.ringRadius + R.range(-1.5, 1.5);
    const x = Math.sin(a) * rad, z = Math.cos(a) * rad, ry = a + Math.PI + R.range(-0.2, 0.2); // front do fontanny
    const L = (lx, ly, lz, lry = 0, lrx = 0, lrz = 0) => M4(lx, ly, lz, lry, lrx, lrz).premultiply(M4(x, 0, z, ry));
    const cw = 2.6, cd = 1.0, ch = 0.95, ph = 2.3;
    B.add('planks', box(cw, 0.08, cd, T.planks.mpt), L(0, ch, 0));
    B.add('planks', box(cw, ch - 0.1, 0.06, T.planks.mpt), L(0, (ch - 0.1) / 2, cd / 2 - 0.03));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.12, ph, 0.12, T.timber.mpt), L(sx * (cw / 2 - 0.1), ph / 2, sz * (cd / 2 + 0.6)));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph - 0.05, cd / 2 + 0.6));
    B.add('timber', box(cw + 0.3, 0.1, 0.1, T.timber.mpt), L(0, ph + 0.35, -(cd / 2 + 0.6)));
    // baldachim: jedna połać opadająca ku przodowi, plus zwis z przodu
    const cloth = 'cloth' + R.int(0, P.cloth.length - 1);
    const depth = cd + 1.4, rise = 0.4, slope = Math.hypot(depth, rise);
    B.add(cloth, plane(cw + 0.5, slope, 1), L(0, ph + 0.15, 0, 0, -Math.PI / 2 + Math.atan2(rise, depth)));
    B.add(cloth, plane(cw + 0.5, 0.35, 1), L(0, ph - 0.22, cd / 2 + 0.62));
    stalls.push({ x, z, ry, cw, ch, L, cloth });
    // kolizja: prostokąt przybliżony kołem (kramy są obrócone)
    ctx.addCircle(x, z, 1.6);
  }

  // ---------- rekwizyty (modele) ----------
  const names = ['wooden_crate_01', 'wine_barrel_01', 'Barrel_01', 'wicker_basket_01', 'wooden_bucket_02', 'ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01', 'food_apple_01', 'treasure_chest', 'wooden_stool_02', 'wooden_lantern_01', 'horse_statue_01', 'grass_medium_02', 'fern_02', 'tree_stump_01', 'rock_moss_set_02', 'potted_plant_02', 'wine_bottles_01', 'Lantern_01'];
  const models = new Map(await Promise.all(names.map(async n => [n, await loaders.loadModel(n)])));
  const bounds = new Map();
  for (const [n, g] of models) { g.scene.updateMatrixWorld(true); bounds.set(n, new THREE.Box3().setFromObject(g.scene)); }
  // Rekwizyty są instancjonowane: jeden draw call na (model × materiał) zamiast jednego na kopię.
  const placements = new Map();
  const NO_SHADOW = new Set(['grass_medium_02', 'fern_02', 'food_apple_01', 'wooden_bowl_01', 'ceramic_vase_01', 'ceramic_vase_02', 'wine_bottles_01', 'potted_plant_02']);
  function put(name, x, y, z, ry = 0, scale = 1, opts = {}) {
    const b = bounds.get(name);
    const m = M4(x, y - b.min.y * scale, z, ry, 0, 0, scale);
    if (!placements.has(name)) placements.set(name, []);
    placements.get(name).push(m);
    if (opts.collide !== false) { const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * scale / 2; if (r > 0.3 && y < 0.5) ctx.addCircle(x, z, r * 0.9); }
  }
  function flushInstances() {
    for (const [name, mats] of placements) {
      const root = models.get(name).scene;
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
  // wektor lokalny kramu → świat
  const stallWorld = (s, lx, lz) => ({ x: s.x + Math.sin(s.ry) * lz + Math.cos(s.ry) * lx, z: s.z + Math.cos(s.ry) * lz - Math.sin(s.ry) * lx });
  const goodsSets = [
    ['wicker_basket_01', 'food_apple_01', 'food_apple_01'],
    ['ceramic_vase_01', 'ceramic_vase_02', 'wooden_bowl_01'],
    ['wine_bottles_01', 'wooden_bowl_01'],
    ['wooden_bowl_01', 'food_apple_01', 'ceramic_vase_01'],
  ];
  stalls.forEach((s, i) => {
    const goods = goodsSets[i % goodsSets.length];
    goods.forEach((g, j) => {
      const lx = -s.cw / 2 + 0.5 + j * (s.cw - 1) / Math.max(1, goods.length - 1) + R.range(-0.15, 0.15);
      const p = stallWorld(s, lx, -0.05);
      put(g, p.x, s.ch + 0.04, p.z, R.range(0, 6.28), 1, { collide: false });
    });
    // zaplecze kramu: beczka albo skrzynie
    const back = stallWorld(s, R.range(-0.8, 0.8), -1.4);
    put(R.pick(['wine_barrel_01', 'wooden_crate_01', 'Barrel_01']), back.x, 0, back.z, R.range(0, 6.28));
  });
  // posąg na fontannie
  { const b = bounds.get('horse_statue_01'); const sc = 2.6 / (b.max.y - b.min.y); put('horse_statue_01', 0, CONFIG.fountain.rim + CONFIG.fountain.columnHeight + 0.35, 0, R.range(0, 6.28), sc, { collide: false }); }
  // latarnie na słupach wokół placu + światła punktowe (bez cieni; kilka najbliższych)
  const lanternLights = [];
  for (let i = 0; i < CONFIG.lanterns.count; i++) {
    const a = (i + 0.5) / CONFIG.lanterns.count * Math.PI * 2;
    const x = Math.sin(a) * CONFIG.lanterns.ringRadius, z = Math.cos(a) * CONFIG.lanterns.ringRadius;
    B.place('timber', box(0.16, 2.8, 0.16, T.timber.mpt), x, 1.4, z);
    B.place('timber', box(0.6, 0.1, 0.1, T.timber.mpt), x + Math.cos(a) * 0.3, 2.75, z - Math.sin(a) * 0.3, a);
    const lb = bounds.get('wooden_lantern_01'); const sc = 0.55 / (lb.max.y - lb.min.y);
    const lx = x + Math.cos(a) * 0.52, lz = z - Math.sin(a) * 0.52;
    put('wooden_lantern_01', lx, 2.15, lz, a, sc, { collide: false });
    ctx.addCircle(x, z, 0.25);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat.flame); flame.position.set(lx, 2.4, lz); scene.add(flame);
    lanternLights.push({ x: lx, z: lz });
  }
  const lights = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffa452, 5, 12, 2); scene.add(l); return l; });
  ctx.updaters.push((dt, t, p) => {
    // cztery najbliższe latarnie świecą (koszt świateł punktowych rośnie z ich liczbą)
    const near = lanternLights.map(l => ({ l, d: (l.x - p.x) ** 2 + (l.z - p.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 4);
    near.forEach((n, i) => { lights[i].position.set(n.l.x, 2.4, n.l.z); lights[i].intensity = 5 + Math.sin(t * 7 + i) * 0.6; });
  });
  // beczki, skrzynie, kosze pod ścianami; roślinność przy fundamentach
  for (let i = 0; i < 14; i++) {
    const side = R.int(0, 3), along = R.range(-half + 3, half - 3);
    if (Math.abs(along) < sw / 2 + 1.5) continue;
    const t = sideTransform(side, along, -H.depth / 2 - 0.7);
    const kind = R.pick(['Barrel_01', 'wooden_crate_01', 'wine_barrel_01', 'wooden_bucket_02', 'wicker_basket_01', 'wooden_stool_02', 'potted_plant_02', 'wooden_crate_01']);
    put(kind, t.x, 0, t.z, R.range(0, 6.28));
    if (kind === 'wooden_crate_01' && R() < 0.5) put('wooden_crate_01', t.x, 0.62, t.z, R.range(0, 6.28), 0.9, { collide: false });
  }
  for (let i = 0; i < 14; i++) {
    const side = R.int(0, 3), along = R.range(-half + 1, half - 1);
    const t = sideTransform(side, along, -H.depth / 2 - 0.35);
    put(R.pick(['grass_medium_02', 'fern_02', 'grass_medium_02']), t.x, 0, t.z, R.range(0, 6.28), R.range(0.8, 1.2), { collide: false });
  }
  put('tree_stump_01', -half + 5, 0, half - 6, 0.4);
  put('rock_moss_set_02', half - 6, 0, -half + 5, 1.2, 0.8);
  put('treasure_chest', 9, 0, -7, 2.4, 0.9);
  put('Lantern_01', 9.2, 0.62, -7.1, 1.0, 1, { collide: false });

  // ---------- wóz ----------
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
      for (let k = 0; k < 6; k++) B.add('timber', box(0.05, 1.2, 0.05, T.timber.mpt), L(0.3, 0.62, sz * 0.72, 0, k * Math.PI / 6, 0));
      B.add('timber', box(0.14, 0.14, 1.6, T.timber.mpt), L(0.3, 0.62, 0));
    }
    for (const sz of [-1, 1]) B.add('timber', box(2.2, 0.1, 0.1, T.timber.mpt), L(-2.2, 0.75, sz * 0.4, 0, 0, 0.08));
    ctx.addCircle(x, z, 1.5);
    put('wooden_crate_01', x + 0.2, 0.94, z, ry, 0.8, { collide: false });
    put('wicker_basket_01', x - 0.7, 0.94, z + 0.2, ry + 1, 0.9, { collide: false });
  }

  // ---------- chorągwie i szyld karczmy (tekstury generowane) ----------
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

  flushInstances();
  B.build(mat, scene);

  // dym z kominów (co czwarty komin): cząstki unoszą się i rozwiewają, zapętlone
  const smokeTex = smokeTexture();
  const smokers = chimneys.filter((c, i) => i % 4 === 1).slice(0, 6);
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

function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Chorągiew heraldyczna: pole w kolorze, pas i prosty emblemat; generowana na canvasie, żeby nie wozić bitmap.
function heraldry(field, charge, variant) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  const hex = v => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hex(field); g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#d9b34a';
  if (variant % 3 === 0) { g.fillRect(0, 220, 256, 70); }
  else if (variant % 3 === 1) { g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 512); g.lineTo(256, 440); g.lineTo(60, 0); g.fill(); }
  else { g.beginPath(); g.arc(128, 256, 80, 0, Math.PI * 2); g.fill(); g.fillStyle = hex(charge); g.beginPath(); g.arc(128, 256, 55, 0, Math.PI * 2); g.fill(); }
  // zębaty dół
  g.fillStyle = 'rgba(0,0,0,0)'; g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 512); g.lineTo(x + 32, 470); g.lineTo(x + 64, 512); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#3a2718'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#5a4030'; g.fillRect(12, 12, 488, 296);
  g.strokeStyle = '#d9b34a'; g.lineWidth = 6; g.strokeRect(24, 24, 464, 272);
  g.fillStyle = '#d9b34a'; g.font = 'bold 62px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = text.split(' ');
  g.fillText(words.slice(0, 2).join(' '), 256, 120); g.fillText(words.slice(2).join(' '), 256, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
