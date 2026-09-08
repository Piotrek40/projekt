// Wejście bundla do testu geometrii (audyt/testy/geo_test.sh; komenda bundla w rynek/PROMPT.md §3.4): prawdziwe moduły sceny + three. Ścieżki względem tego pliku, więc działa w worktree.
export * as THREE from 'three';
export * from '../../../engine/src/geometry.js';
export { checkFailures, checksEnabled } from '../../../engine/src/check.js';
export { CONFIG } from '../../../rynek/src/config.js';
export { buildLayout } from '../../../rynek/src/layout.js';
export { buildHouses } from '../../../rynek/src/buildings.js';
export { buildStalls } from '../../../rynek/src/stalls.js';
export { buildTower } from '../../../rynek/src/tower.js';
export { buildCart, signMatrix, signPlacements } from '../../../rynek/src/props.js';   // wóz: geometria Batch (dyszel w KNOWN_B6); modele przez stub W.put w teście; signMatrix: funkcja czysta szyldu (asercja F)
export { treePlacements, buildTrees } from '../../../rynek/src/trees.js';   // lipy (motyw #7): funkcja czysta + geometria Batch (bez materiałów — W.sets brak offline); asercja H
export { stallPlacements, yawFrom } from '../../../rynek/src/stalls.js';   // kramy (motyw #7): pozycje (repoussoir + sektor bez kramu); asercja I
export { stallGoodsPlan, buildStallGoods } from '../../../rynek/src/stalls.js';   // role kramów (motyw #11): plan towaru/bel/szyldów (funkcja czysta) + geometria; asercja J
export { buildSkyline, skylinePlan, startVisibility } from '../../../rynek/src/skyline.js';   // startVisibility: funkcja czysta widoczności ze startu (asercja S5)
export { buntingCurves, buildBunting } from '../../../rynek/src/bunting.js';
export { fountainPlan, buildFountain } from '../../../rynek/src/fountain.js';
export { poiPlan } from '../../../rynek/src/ui.js';
export { greeneryPlan, buildGreenery } from '../../../rynek/src/greenery.js';   // zieleń (motyw #greenery): plan (funkcja czysta) + geometria/modele przez stub W.put; asercja K2
