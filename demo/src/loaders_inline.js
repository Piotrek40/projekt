// Ładowanie zasobów wpisanych w stronę jako data URI (wariant Artifact: brak WASM, brak zewnętrznych plików).
// window.__ASSETS = { 'models/x.glb': 'data:...', 'textures/x_diff.jpg': 'data:...', 'hdri/sky.hdr': 'data:...' }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export function createLoaders(manager) {
  const A = window.__ASSETS || {};
  const gltf = new GLTFLoader(manager);
  const tex = new THREE.TextureLoader(manager);
  const hdr = new HDRLoader(manager);
  const p = (loader, key) => new Promise((res, rej) => A[key] ? loader.load(A[key], res, undefined, rej) : rej(new Error('brak zasobu ' + key)));
  return {
    loadTexture: (name, map) => p(tex, `textures/${name}_${map}.jpg`),
    loadModel: name => p(gltf, `models/${name}.glb`),
    loadSky: () => p(hdr, 'hdri/sky.hdr'),
    mode: 'inline',
  };
}
