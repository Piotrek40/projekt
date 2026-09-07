// Ładowanie zasobów z plików (GitHub Pages / dowolny serwer HTTP): GLB z meshopt + KTX2, tekstury KTX2, HDRI .hdr.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ASSETS = './assets/';

export function createLoaders(manager, renderer) {
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('./vendor/basis/').detectSupport(renderer);
  const gltf = new GLTFLoader(manager).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const hdr = new HDRLoader(manager);
  const p = (loader, url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  return {
    // name: nazwa zestawu, map: 'diff' | 'nor' | 'arm'
    loadTexture: (name, map) => p(ktx2, `${ASSETS}textures/${name}_${map}.ktx2`),
    loadModel: name => p(gltf, `${ASSETS}models/${name}.glb`),
    loadSky: () => p(hdr, `${ASSETS}hdri/sky_1k.hdr`),
    mode: 'ktx2',
  };
}
