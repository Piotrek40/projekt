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
import { buildTrees } from './trees.js';
import { buildGreenery } from './greenery.js';
import { buildSkyline } from './skyline.js';
import { initUI } from './ui.js';
import { checksEnabled, checkNoCoplanar } from '../../engine/src/check.js';
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
  buildTrees(W);      // lipy (W.B)
  buildGreenery(W);   // zieleń z modeli (W.put) — po initProps, przed flushInstances
  buildSkyline(W);    // panorama za pierzejami (W.B)

  W.flushInstances();
  // PRZED B.build (po scaleniu nie ma osobnych brył): koplanarne płaszczyzny tego samego materiału = z-fighting. Tylko klucze z cienkimi
  // płaszczyznami (kilkadziesiąt sztuk, O(n²)); dla timber/stone nie ma sensu — bryły grubsze niż 6 cm, a 2000 belek to 2 mln par.
  for (const [key, geos] of W.B.groups) if (/^(cloth|banner|glass|sign|clock|wet|bunting|jet)/.test(key)) checkNoCoplanar(key, geos);
  W.B.build(W.mat, W.scene);
  buildSmoke(W);
  initUI(W);          // UI po zbudowaniu świata (podpisy miejsc czytają W)
}
