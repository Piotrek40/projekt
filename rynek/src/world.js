// Rynek w stylu high fantasy: plac z fontanną, kamienice szachulcowe wokół, wieża ratusza, kramy, wóz, latarnie, chorągwie.
// Cały układ wynika z CONFIG i ziarna losowego — nowy rynek to inne ziarno, większy rynek to inny rozmiar, nie nowy kod.
// Ten plik tylko składa moduły w kolejności; każdy moduł dostaje wspólny kontekst W i dopisuje do niego swoje wyniki.
import * as THREE from 'three';
import { Batch, rng } from '../../engine/src/geometry.js';
import { followShadow } from '../../engine/src/sky.js';
import { CONFIG } from './config.js';
import { buildMaterials } from './materials.js';
import { buildLayout } from './layout.js';
import { buildHouses, buildTower } from './buildings.js';
import { buildFountain } from './fountain.js';
import { buildStalls, placeGoods } from './stalls.js';
import { initProps, placeStatue, buildLanterns, scatterProps, buildCart, buildBanners, buildSmoke } from './props.js';

export { CONFIG };

export async function buildWorld(ctx) {
  const W = { ctx, scene: ctx.scene, loaders: ctx.loaders, R: rng(CONFIG.seed), CONFIG, P: CONFIG.palette, T: CONFIG.textures, H: CONFIG.house, S: CONFIG.plaza.size, half: CONFIG.plaza.size / 2, B: new Batch() };

  // niebo i słońce
  const skyFile = new URLSearchParams(location.search).get('sky') || CONFIG.sky.file;
  const sun = await ctx.sky({ ...CONFIG.sky, file: skyFile, minElevation: THREE.MathUtils.degToRad(CONFIG.sky.minElevationDeg) });
  if (!ctx.flags.nofollow) ctx.updaters.push((dt, t, p) => followShadow(sun, p.x, p.z));

  await buildMaterials(W);
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

  W.flushInstances();
  W.B.build(W.mat, W.scene);
  buildSmoke(W);
}
