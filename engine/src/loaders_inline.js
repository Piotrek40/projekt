// Ładowanie zasobów wpisanych w stronę jako data URI (wariant Artifact: brak WASM, brak zewnętrznych plików).
// window.__ASSETS = { 'models/x.glb': 'data:...', 'textures/x_diff.jpg': 'data:...', 'hdri/sky.hdr': 'data:...' }
//
// Piaskownica Artifactu blokuje fetch() do adresów data: i blob: (CSP connect-src), a loadery three.js
// (FileLoader, ImageBitmapLoader, obrazy z GLB przez URL.createObjectURL) idą właśnie przez fetch.
// Dlatego fetch jest tu przechwycony: data: dekodujemy w JS, blob: oddajemy z własnej mapy — zero ruchu sieciowego.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const blobs = new Map();
const origCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = obj => { const u = origCreateObjectURL(obj); blobs.set(u, obj); return u; };
const origRevoke = URL.revokeObjectURL.bind(URL);
URL.revokeObjectURL = u => { blobs.delete(u); origRevoke(u); };

function decodeDataUri(uri) {
  const comma = uri.indexOf(',');
  const meta = uri.slice(5, comma), payload = uri.slice(comma + 1);
  const mime = meta.split(';')[0] || 'application/octet-stream';
  if (!/;base64/.test(meta)) return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  const bin = atob(payload), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

const origFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (url && url.startsWith('data:')) {
    const { mime, bytes } = decodeDataUri(url);
    return Promise.resolve(new Response(bytes, { status: 200, headers: { 'Content-Type': mime, 'Content-Length': String(bytes.length) } }));
  }
  if (url && url.startsWith('blob:') && blobs.has(url)) {
    const b = blobs.get(url);
    return Promise.resolve(new Response(b, { status: 200, headers: { 'Content-Type': b.type || 'application/octet-stream' } }));
  }
  return origFetch(input, init);
};

export function createLoaders(manager) {
  const A = window.__ASSETS || {};
  const gltf = new GLTFLoader(manager);
  // tekstury przez ImageBitmap (idzie przez przechwycony fetch), nie przez <img src="data:"> — img-src też może być zablokowany
  const bitmap = new THREE.ImageBitmapLoader(manager).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  const hdr = new HDRLoader(manager);
  const p = (loader, key) => new Promise((res, rej) => A[key] ? loader.load(A[key], res, undefined, rej) : rej(new Error('brak zasobu ' + key)));
  return {
    loadTexture: async (name, map) => {
      const img = await p(bitmap, `textures/${name}_${map}.jpg`);
      const t = new THREE.Texture(img); t.flipY = false; t.needsUpdate = true; return t;
    },
    loadModel: name => p(gltf, `models/${name}.glb`),
    loadSky: () => p(hdr, 'hdri/sky.hdr'), // wariant inline ma jedno niebo
    mode: 'inline',
  };
}
