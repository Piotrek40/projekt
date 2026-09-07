// Wejście bundla do testu geometrii (audyt/testy/geo_test.sh; komenda bundla w rynek/PROMPT.md §3.4): prawdziwe moduły sceny + three. Ścieżki względem tego pliku, więc działa w worktree.
export * as THREE from 'three';
export * from '../../../engine/src/geometry.js';
export { checkFailures, checksEnabled } from '../../../engine/src/check.js';
export { CONFIG } from '../../../rynek/src/config.js';
export { buildLayout } from '../../../rynek/src/layout.js';
export { buildHouses } from '../../../rynek/src/buildings.js';
export { buildStalls } from '../../../rynek/src/stalls.js';
export { buildTower } from '../../../rynek/src/tower.js';
export { buildCart, signMatrix } from '../../../rynek/src/props.js';   // wóz: geometria Batch (dyszel w KNOWN_B6); modele przez stub W.put w teście; signMatrix: funkcja czysta szyldu (asercja F)
