// Ładowanie zasobów z plików (GitHub Pages / dowolny serwer HTTP).
// Tryb tekstur (parametr URL ?tex=): 'ktx2' (GLB z meshopt + KTX2, tekstury KTX2), 'jpg' (GLB z meshopt + JPG, tekstury JPG).
// Domyślnie 'auto': KTX2, chyba że GPU jest na liście znanych problemów (Samsung Xclipse przez ANGLE/Vulkan dekoduje KTX2 na czarno).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ASSETS = './assets/';
const KNOWN_BAD_KTX2 = [/Xclipse/i];

export function createLoaders(manager, renderer) {
  const params = new URLSearchParams(location.search);
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  let mode = params.get('tex') || 'auto';
  if (mode === 'auto') mode = KNOWN_BAD_KTX2.some(re => re.test(gpu)) ? 'jpg' : 'ktx2';

  const ktx2 = new KTX2Loader(manager).setTranscoderPath('./vendor/basis/').detectSupport(renderer);
  const gltf = new GLTFLoader(manager).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const tex = new THREE.TextureLoader(manager);
  const hdr = new HDRLoader(manager);
  const p = (loader, url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const info = {
    mode, gpu,
    ktx2: ktx2.workerConfig,
    ext: Object.fromEntries(['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_s3tc', 'EXT_texture_compression_bptc', 'EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'EXT_texture_filter_anisotropic'].map(e => [e, renderer.extensions.has(e)])),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
  return {
    // name: nazwa zestawu, map: 'diff' | 'nor' | 'arm'
    loadTexture: mode === 'jpg'
      ? (name, map) => p(tex, `${ASSETS}textures/${name}_${map}.jpg`)
      : (name, map) => p(ktx2, `${ASSETS}textures/${name}_${map}.ktx2`),
    loadModel: name => p(gltf, `${ASSETS}${mode === 'jpg' ? 'models_jpg' : 'models'}/${name}.glb`),
    // loadAsset: GLB spod ścieżki względem assets/, POZA rozróżnieniem ktx2/jpg. Dla zasobów bez tekstur
    // (ciało NPC, klipy animacji na samej armaturze) oba warianty byłyby bajt w bajt takie same.
    loadAsset: rel => p(gltf, `${ASSETS}${rel}`),
    loadSky: (file = 'sky_1k.hdr') => p(hdr, `${ASSETS}hdri/${file}`),
    mode, info,
  };
}
