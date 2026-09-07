// Wycina jeden wariant z zestawu Poly Haven (kilka roślin/obiektów w jednym pliku gltf) do osobnego źródła,
// żeby build_assets.sh / build_assets_jpg.sh / build_artifact.mjs mogły go traktować jak zwykły model.
// Użycie: node tools/ph_variant.mjs <zestaw> <wybór> <nazwa_wyjściowa> [--mask]
//   <wybór>: nazwa węzła (np. shrub_02_a) albo x:<min>:<max> — trójkąty o środku w tym zakresie X
//            (współrzędne lokalne mesha) z pierwszego mesha zestawu; zestawy w jednym meshu (shrub_04) dzieli się tak;
//            albo `all` — nic nie wycina, tylko wypieka transformacje wszystkich węzłów (nazwa wyjściowa może być tą samą:
//            zapis w miejscu). Potrzebne dla zestawów kilku obróconych obiektów (food_pears_asian_01): `gltf-transform join`
//            zostawia rotację pierwszego węzła, a przez nią W.put() liczy zawyżony bbox i obiekt lewituje.
//   --mask : alphaMode BLEND → MASK (cutoff 0.5) — liście bez sortowania przezroczystości (instancje).
// Wynik: audyt/assets_src/models/<nazwa>/<nazwa>.gltf + .bin; obrazy wskazują ../<zestaw>/textures/ (bez kopii tekstur).
// Wariant jest wyśrodkowany w XZ (spód zostaje na y zestawu). Źródła nie są w gicie — polecenia odtwarzające: audyt/assets_src/README.md.
import { NodeIO, Format } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, compactPrimitive, transformMesh } from '@gltf-transform/functions';
import { getBounds } from '@gltf-transform/core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'audyt/assets_src/models');
const [, , set, sel, out, ...flags] = process.argv;
if (!set || !sel || !out) { console.error('użycie: ph_variant.mjs <zestaw> <węzeł|x:min:max> <nazwa> [--mask]'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(join(SRC, set, `${set}.gltf`));
const root = doc.getRoot();
let node;
if (sel === 'all') {
  const used = new Map(); for (const n of root.listNodes()) if (n.getMesh()) used.set(n.getMesh(), (used.get(n.getMesh()) || 0) + 1);
  for (const n of root.listNodes()) {
    if (!n.getMesh()) continue;
    if (used.get(n.getMesh()) > 1) { console.warn(`pomijam ${n.getName()}: mesh współdzielony`); continue; }
    transformMesh(n.getMesh(), n.getWorldMatrix()); n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
} else if (sel.startsWith('x:')) {
  const [, a, b] = sel.split(':').map(Number);
  node = root.listNodes().find(n => n.getMesh());
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray();
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      const cx = (pos[idx[i] * 3] + pos[idx[i + 1] * 3] + pos[idx[i + 2] * 3]) / 3;
      if (cx >= a && cx <= b) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    prim.getIndices().setArray(new Uint32Array(keep));
    compactPrimitive(prim);
  }
} else {
  node = root.listNodes().find(n => n.getName() === sel);
  if (!node) throw new Error(`brak węzła ${sel}; są: ${root.listNodes().map(n => n.getName()).join(', ')}`);
}
if (node) {
if (node.getParentNode()) console.warn('UWAGA: węzeł ma rodzica z transformacją — centrowanie może być niedokładne');
for (const n of root.listNodes()) if (n !== node && n.getMesh()) n.dispose();
// Wypiekamy rotację/skalę węzła w wierzchołki: three.js Box3.setFromObject (używane przez W.put) liczy bbox z obróconego
// AABB geometrii, więc obrócony węzeł dawałby zawyżony bbox i ujemne minY (obiekt lewitowałby nad ziemią).
transformMesh(node.getMesh(), node.getMatrix());
node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const b = getBounds(node);
node.setTranslation([-(b.min[0] + b.max[0]) / 2, 0, -(b.min[2] + b.max[2]) / 2]);
node.setName(out); node.getMesh().setName(out);
}
if (flags.includes('--mask')) for (const m of root.listMaterials()) if (m.getAlphaMode() === 'BLEND') m.setAlphaMode('MASK').setAlphaCutoff(0.5);
await doc.transform(prune());

// Zapis ręczny: jeden .bin, obrazy jako odwołania do tekstur zestawu.
const { json, resources } = await io.writeJSON(doc, { format: Format.GLTF, basename: out });
const dir = join(SRC, out); mkdirSync(dir, { recursive: true });
for (const buf of json.buffers || []) { writeFileSync(join(dir, `${out}.bin`), resources[buf.uri]); buf.uri = `${out}.bin`; }
for (const img of json.images || []) {
  const file = basename(img.uri); const rel = out === set ? `textures/${file}` : `../${set}/textures/${file}`;
  if (!existsSync(join(dir, rel))) throw new Error(`brak tekstury ${rel}`);
  img.uri = rel;
}
writeFileSync(join(dir, `${out}.gltf`), JSON.stringify(json));
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
const nb = getBounds(root.listScenes()[0]);
console.log(`${out}: ${Math.round(tris)} tri, ${nb.max.map((v, i) => (v - nb.min[i]).toFixed(2)).join(' x ')} m → ${dir}`);
