// Koduje mapy normalnych w pliku GLB do KTX2 UASTC z RDO przez toktx.
// Powód: gltf-transform 4.5 `uastc --rdo` nie przekazuje RDO do `ktx create`, a bez RDO normalna 2k to ~3,6 MB.
// Użycie: node ktx_normals.mjs in.glb out.glb [rdo_lambda]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [,, inPath, outPath, lambdaArg] = process.argv;
const lambda = lambdaArg || '2';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inPath);
const basisu = doc.createExtension(KHRTextureBasisu).setRequired(true);
const tmp = mkdtempSync(join(tmpdir(), 'ktxn-'));
const done = new Set();
for (const mat of doc.getRoot().listMaterials()) {
  const tex = mat.getNormalTexture();
  if (!tex || done.has(tex)) continue;
  done.add(tex);
  const ext = tex.getMimeType() === 'image/png' ? 'png' : 'jpg';
  const src = join(tmp, `${done.size}.${ext}`), dst = join(tmp, `${done.size}.ktx2`);
  writeFileSync(src, tex.getImage());
  execFileSync('toktx', ['--t2', '--genmipmap', '--assign_oetf', 'linear', '--encode', 'uastc', '--uastc_quality', '1', '--uastc_rdo_l', lambda, '--zcmp', '18', dst, src], { stdio: 'ignore' });
  const before = tex.getImage().byteLength, ktx = readFileSync(dst);
  tex.setImage(ktx).setMimeType('image/ktx2');
  console.log(`normal ${tex.getName() || mat.getName()}: ${(before / 1e6).toFixed(2)} MB → ${(ktx.byteLength / 1e6).toFixed(2)} MB (UASTC RDO λ=${lambda})`);
}
if (done.size === 0) basisu.dispose();
await io.write(outPath, doc);
rmSync(tmp, { recursive: true, force: true });
