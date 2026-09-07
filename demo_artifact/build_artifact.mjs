// Buduje jednoplikową wersję sceny do publikacji jako Artifact (claude.ai):
// wszystkie zasoby jako data URI, tekstury JPG (bez KTX2 — transkoder WASM nie może być pobrany z CDN),
// geometria skwantyzowana (bez meshopt — dekoder WASM). Limit strony: 16 MB.
// Użycie: node demo_artifact/build_artifact.mjs  → demo_artifact/dziedziniec.html
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(import.meta.url)(join(ROOT, 'tools/node_modules/sharp'));
const GT = join(ROOT, 'tools/node_modules/.bin/gltf-transform');
const SRC = join(ROOT, 'audyt/assets_src');
const tmp = mkdtempSync(join(tmpdir(), 'artifact-'));

// rozmiar tekstur per model (px) — kompromis między jakością z bliska a limitem 16 MB
const MODELS = { marble_bust_01: 1024, wooden_table_02: 1024, rock_moss_set_01: 1024, Barrel_01: 512, potted_plant_02: 512, Lantern_01: 512, wine_bottles_01: 512 };
const TEXTURES = { stone_tiles_02: 1024, castle_brick_02_red: 1024, medieval_blocks_03: 512 };
const assets = {};
const b64 = (buf, mime) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
let total = 0;

for (const [name, size] of Object.entries(MODELS)) {
  const out = join(tmp, `${name}.glb`);
  execFileSync(GT, ['optimize', join(SRC, 'models', name, `${name}.gltf`), out, '--compress', 'quantize', '--texture-compress', 'auto', '--texture-size', String(size), '--simplify', 'false', '--join', 'true', '--flatten', 'true'], { stdio: 'ignore' });
  const buf = readFileSync(out); total += buf.length;
  assets[`models/${name}.glb`] = b64(buf, 'model/gltf-binary');
  console.log(`model ${name} ${size}px: ${(buf.length / 1e6).toFixed(2)} MB`);
}
for (const [name, size] of Object.entries(TEXTURES)) {
  for (const [map, file, q] of [['diff', 'Diffuse', 82], ['nor', 'nor_gl', 88], ['arm', 'arm', 80]]) {
    const buf = await sharp(join(SRC, 'textures', name, `${name}_${file}_2k.jpg`)).resize(size, size).jpeg({ quality: q, chromaSubsampling: map === 'diff' ? '4:2:0' : '4:4:4' }).toBuffer();
    total += buf.length; assets[`textures/${name}_${map}.jpg`] = b64(buf, 'image/jpeg');
  }
  console.log(`tekstury ${name} ${size}px`);
}
{
  const buf = readFileSync(join(SRC, 'hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr')); total += buf.length;
  assets['hdri/sky.hdr'] = b64(buf, 'image/vnd.radiance');
}
const app = readFileSync(join(ROOT, 'demo_artifact/app_inline.js'), 'utf8');
const html = readFileSync(join(ROOT, 'demo/index.html'), 'utf8')
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
  .replace(/<\/head>\s*<body>\s*/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace('<script type="module" src="./app.js"></script>', () => `<script>window.__ASSETS=${JSON.stringify(assets)};</script>\n<script>${app.replace(/<\/script>/g, '<\\/script>')}</script>`); // funkcja: String.replace interpretuje $& i $' w tekście zastępującym
const outPath = join(ROOT, 'demo_artifact/dziedziniec.html');
writeFileSync(outPath, html);
rmSync(tmp, { recursive: true, force: true });
console.log(`zasoby surowe: ${(total / 1e6).toFixed(2)} MB, strona: ${(html.length / 1e6).toFixed(2)} MB → ${outPath}`);
if (html.length > 16e6) console.error('UWAGA: strona przekracza 16 MB');
