// Dostęp do three r185 z katalogu audyt/testy, który NIE ma własnego node_modules (ESM nie czyta NODE_PATH,
// a `import 'three'` z /home/user/projekt/audyt/testy/ nie znajduje pakietu). Rozwiązanie bez dotykania repo:
// dynamiczny import po ścieżce PLIKU. Bare-importy WEWNĄTRZ GLTFLoader.js ('three') node rozwiązuje już sam,
// bo plik leży w tools/node_modules/three/examples/… i szukanie w górę trafia na tools/node_modules/three.
// Ścieżkę tools/node_modules szukamy jak audyt/testy/geo_test.sh: w górę od tego pliku, z fallbackiem na absolutną
// (worktree nie ma tools/node_modules).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
function znajdzTools() {
  const kandydaci = [];
  for (let d = HERE; ; d = path.dirname(d)) { kandydaci.push(path.join(d, 'tools/node_modules')); if (d === path.dirname(d)) break; }
  kandydaci.push('/home/user/projekt/tools/node_modules');
  for (const c of kandydaci) if (fs.existsSync(path.join(c, 'three/package.json'))) return c;
  throw new Error('test_ruch: nie znaleziono tools/node_modules/three (szukane: ' + kandydaci.join(', ') + ')');
}
export const TOOLS = znajdzTools();
const imp = p => import(pathToFileURL(path.join(TOOLS, p)).href);

export const THREE = await imp('three/build/three.module.js');
export const { GLTFLoader } = await imp('three/examples/jsm/loaders/GLTFLoader.js');
export const { BVHLoader } = await imp('three/examples/jsm/loaders/BVHLoader.js');
export const REVISION = THREE.REVISION;
