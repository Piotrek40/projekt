// Rynek w stylu high fantasy: plac z fontanną, kamienice szachulcowe wokół, wieża ratusza, kramy, wóz, latarnie, chorągwie.
// Cały układ wynika z CONFIG i ziarna losowego — nowy rynek to inne ziarno, większy rynek to inny rozmiar, nie nowy kod.
// Ten plik tylko składa moduły w kolejności; każdy moduł dostaje wspólny kontekst W i dopisuje do niego swoje wyniki.
import * as THREE from 'three';
import { Batch, rng } from '../../engine/src/geometry.js';
import { followShadow } from '../../engine/src/sky.js';
import { CONFIG } from './config.js';
import { buildMaterials } from './materials.js';
import { buildLayout } from './layout.js';
import { buildHouses } from './buildings.js';
import { buildTower } from './tower.js';
import { buildFountain } from './fountain.js';
import { buildStalls, placeGoods } from './stalls.js';
import { initProps, placeStatue, buildLanterns, scatterProps, buildCart, buildBanners, buildSmoke } from './props.js';
import { buildBunting } from './bunting.js';
import { buildTrees } from './trees.js';
import { buildGreenery } from './greenery.js';
import { buildSkyline } from './skyline.js';
import { initUI } from './ui.js';
import { checksEnabled, checkNoCoplanar, check } from '../../engine/src/check.js';
import { initDebug } from './debug.js';
import { buildLineup } from './lineup.js';

export { CONFIG };

export async function buildWorld(ctx) {
  const W = { ctx, scene: ctx.scene, loaders: ctx.loaders, R: rng(CONFIG.seed), CONFIG, P: CONFIG.palette, T: CONFIG.textures, H: CONFIG.house, S: CONFIG.plaza.size, half: CONFIG.plaza.size / 2, B: new Batch() };
  checksEnabled(!ctx.flags.nocheck); // asercje sceny (console.error 'CHECK: …' → results.errors renderu); ?nocheck=1 wyłącza do bisekcji
  initDebug(W);                      // ?boxes=1: W.dbgBox/dbgRect/dbgCircle/dbgAxes (bez flagi — puste funkcje)

  // niebo i słońce; flagi diagnostyczne na czas sesji (jak ?sky=): ?sun=ffe6c8 (sunColor hex), ?env=0.8 (environmentIntensity),
  // ?exposure=1.1 (toneMappingExposure) — do prób oświetlenia na lineupie bez edycji config.js
  const skyFile = ctx.flags.sky || CONFIG.sky.file;
  const skyOpt = { ...CONFIG.sky, file: skyFile, minElevation: THREE.MathUtils.degToRad(CONFIG.sky.minElevationDeg) };
  if (ctx.flags.sun) skyOpt.sunColor = parseInt(ctx.flags.sun.replace('#', ''), 16);
  if (ctx.flags.env) skyOpt.environmentIntensity = +ctx.flags.env;
  if (ctx.flags.exposure) ctx.renderer.toneMappingExposure = +ctx.flags.exposure;
  if (ctx.flags.sunint !== undefined) skyOpt.sunIntensity = +ctx.flags.sunint;   // ?sunint=0: sam cień (pomiar chłodu w cieniu na lineupie, §4.3.3/§4.3.6)
  const sun = await ctx.sky(skyOpt);
  if (!ctx.flags.nofollow) ctx.updaters.push((dt, t, p) => followShadow(sun, p.x, p.z));

  await buildMaterials(W);
  if (ctx.flags.lineup) { buildLineup(W, ctx.flags.lineup); return; }   // ?lineup=1 (wszystkie klucze W.mat) albo ?lineup=cloth (prefiks) — zamiast rynku
  buildLayout(W);
  buildHouses(W);
  buildTower(W);
  buildFountain(W);
  buildStalls(W);
  await initProps(W);
  placeGoods(W);
  placeStatue(W);
  buildLanterns(W);
  scatterProps(W);
  buildCart(W);
  buildBanners(W);
  buildBunting(W);    // girlandy chorągiewek + lampiony (W.B; po buildBanners — kotwice omijają chorągwie z W.banners)
  buildTrees(W);      // lipy (W.B)
  buildGreenery(W);   // zieleń z modeli (W.put) — po initProps, przed flushInstances
  buildSkyline(W);    // panorama za pierzejami (W.B)

  W.flushInstances();
  // PRZED B.build (po scaleniu nie ma osobnych brył): koplanarne płaszczyzny tego samego materiału = z-fighting. Tylko klucze z cienkimi
  // płaszczyznami (kilkadziesiąt sztuk, O(n²)); dla timber/stone nie ma sensu — bryły grubsze niż 6 cm, a 2000 belek to 2 mln par.
  // bez `wet` (scalenie torów A/B): mokry bruk (fountain.js) to dysk r 4,6 + pierścień 4,6–5,2 na tym samym y — powierzchnie się NIE nakładają,
  // ale checkNoCoplanar porównuje AABB (pierścień ma AABB pokrywające dysk) → fałszywy FAIL; nachodzenie pilnuje check „rFull poza (schodek, r)" w fountain.js
  for (const [key, geos] of W.B.groups) if (/^(cloth|banner|glass|sign|clock|bunting|jet)/.test(key)) checkNoCoplanar(key, geos);
  // UV poza zakresem 0..1 na materiale z teksturą ZACISKANĄ DO KRAWĘDZI (ClampToEdge) = cała powierzchnia poza pierwszym
  // kafelkiem dostaje rozciągnięty brzeg mapy zamiast obrazu. Ta jedna pomyłka dała już: białą płytę pod kramem (decal
  // `contact` — 97 % powierzchni z brzegu mapy) oraz chorągwie i flagi, w których 38 % / 17 % płótna to zaciśnięty pasek.
  // Źródło pomyłki jest zawsze to samo: plane(w, h, mpt) skaluje UV przez rozmiar/mpt, a te płótna mają pokazać JEDEN obraz,
  // nie kafelkować — czyli potrzebują gołej PlaneGeometry. Asercja pilnuje tego dla każdego klucza w Batchu.
  for (const [key, geos] of W.B.groups) {
    const m = W.mat[key]; if (!m) continue;
    const tex = m.map ?? m.alphaMap; if (!tex || tex.wrapS !== THREE.ClampToEdgeWrapping || tex.wrapT !== THREE.ClampToEdgeWrapping) continue;
    let umax = 0, vmax = 0;
    for (const g of geos) { const uv = g.attributes?.uv; if (!uv) continue;
      for (let i = 0; i < uv.count; i++) { umax = Math.max(umax, uv.getX(i)); vmax = Math.max(vmax, uv.getY(i)); } }
    check(umax <= 1 + 1e-6 && vmax <= 1 + 1e-6, `${key}: UV sięga ${umax.toFixed(2)} × ${vmax.toFixed(2)} przy teksturze ClampToEdge — poza 0..1 widać rozciągnięty brzeg mapy, nie obraz`, { umax, vmax });
  }
  W.B.build(W.mat, W.scene, { noShadow: new RegExp(CONFIG.noShadowKeys), renderOrder: CONFIG.renderOrderKeys }); // klucze bez cienia (§8 #17): CONFIG.noShadowKeys; kolejność przezroczystych (motyw #8): CONFIG.renderOrderKeys
  buildSmoke(W);
  initUI(W);          // UI po zbudowaniu świata (podpisy miejsc czytają W)
  if (ctx.flags.roles) applyRoles(W);   // ?roles=1(&noaa=1): maska ról do hist_roles.mjs (§4.3.5) — zamiast obrazu
}

// Maska ról (§4.3.5): każdy mesh dostaje MeshBasicMaterial w kolorze roli z CONFIG.roles (klucz W.mat po materiale, model po nazwie z put(),
// bez wpisu → „inne" biel), bez tone mappingu, bez cieni, tło czarne, bez mgły; wycinanki alfa (liście) zachowują map + alphaTest, a kolor
// wymusza onBeforeCompile (diffuseColor.rgb = diffuse po map_fragment). Cząstki (dym) ukryte. Render z ?noaa=1, żeby krawędzie nie mieszały heksów.
function applyRoles(W) {
  const { scene, mat, CONFIG } = W, R = CONFIG.roles;
  const byMat = new Map(Object.entries(mat).map(([k, m]) => [m, k]));
  const roleOf = o => { const key = byMat.get(Array.isArray(o.material) ? o.material[0] : o.material); return key !== undefined ? (R.mat[key] ?? 'x') : (R.props[o.name] ?? (o.name ? R.props.default : 'x')); };
  const mk = (m, role) => {
    const b = new THREE.MeshBasicMaterial({ color: R.color[role] ?? R.color.x, map: m.alphaTest > 0 ? m.map : null, alphaTest: m.alphaTest, side: m.side, toneMapped: false });
    if (b.map) b.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = diffuse;'); };
    return b;
  };
  scene.traverse(o => {
    if (o.isPoints || o.isSprite) { o.visible = false; return; }
    if (!o.isMesh) return;
    const role = roleOf(o);
    o.material = Array.isArray(o.material) ? o.material.map(m => mk(m, role)) : mk(o.material, role);
    o.castShadow = o.receiveShadow = false;
  });
  scene.background = new THREE.Color(R.color.bg); scene.fog = null; scene.environment = null;
}
