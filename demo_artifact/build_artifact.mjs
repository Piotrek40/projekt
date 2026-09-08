// Buduje jednoplikową wersję sceny do publikacji jako Artifact (claude.ai):
// wszystkie zasoby jako data URI, tekstury JPG (bez KTX2 — transkoder WASM nie może być pobrany z CDN),
// geometria skwantyzowana (bez meshopt — dekoder WASM). Limit strony: 16 MB.
// Użycie: node demo_artifact/build_artifact.mjs <scena: demo|rynek>  → demo_artifact/<scena>.html
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(import.meta.url)(join(ROOT, 'tools/node_modules/sharp'));
const GT = join(ROOT, 'tools/node_modules/.bin/gltf-transform');
const SRC = join(ROOT, 'audyt/assets_src');
const tmp = mkdtempSync(join(tmpdir(), 'artifact-'));
const scene = process.argv[2] || 'demo';

// Konfiguracja per scena: rozmiar tekstur modeli (px) i ewentualne uproszczenie geometrii; tekstury zestawów PBR: [diff, nor, arm] px.
const SCENES = {
  demo: {
    models: { marble_bust_01: [1024], wooden_table_02: [1024], rock_moss_set_01: [1024], Barrel_01: [512], potted_plant_02: [512], Lantern_01: [512], wine_bottles_01: [512] },
    textures: { stone_tiles_02: [1024, 1024, 512], castle_brick_02_red: [1024, 1024, 512], medieval_blocks_03: [512, 512, 256] },
    hdri: 'kloofendal_48d_partly_cloudy_puresky_1k.hdr',
  },
  rynek: {
    models: {
      horse_statue_01: [512, 0.5], wooden_lantern_01: [256, 0.4], wooden_crate_01: [512, 0.6], wine_barrel_01: [512, 0.3], Barrel_01: [512],
      wicker_basket_01: [256, 0.2], wooden_bucket_02: [256, 0.5], ceramic_vase_01: [256, 0.3], ceramic_vase_02: [256, 0.3], wooden_bowl_01: [256, 0.2],
      food_apple_01: [256, 0.2], treasure_chest: [512, 0.1], wooden_stool_02: [256, 0.4], grass_medium_02: [512], fern_02: [512],
      tree_stump_01: [512, 0.15], rock_moss_set_02: [512, 0.15], potted_plant_02: [512, 0.12], wine_bottles_01: [512, 0.35], Lantern_01: [256, 0.2],
      // Etap 2 (razem ≈ 1,8 MB surowych; limit strony 16 MB — 256 px i ostrzejsze simplify niż w rynek/build_assets_jpg.sh)
      shrub_04_c: [256, 0.4], planter_box_01: [256, 0.3], periwinkle_plant_03: [256, 0.35], celandine_01_c: [256, 0.4], flower_gazania_h: [256, 0.4],
      hamburger_buns: [256, 0.25], food_pears_asian_01: [256, 0.25], ceramic_pot: [256, 0.6], brass_pot_01: [256, 0.6], wicker_basket_02: [256, 0.2],
      wooden_crate_02: [256, 0.5], painted_wooden_bench: [256], wooden_bowl_02: [128, 0.4], carved_wooden_plate: [128], brass_vase_01: [256, 0.2],
      // gothic_statue i marble_bust_01 usunięte (krytyka r1, config): rynek ich nie ładuje (brak w liście names props.js, CONFIG.stalls.goods.models
      // i CONFIG.greenery.models — w config.js tylko rola palety) — 540 228 B base64 balastu; strażnik niżej (modelUnused) wykrywa takie wpisy.
    },
    textures: {
      cobblestone_floor_04: [1024, 1024, 512], plastered_wall: [1024, 512, 512], old_planks_02: [512, 512, 256], weathered_planks: [512, 512, 256],
      roof_09: [1024, 512, 256], rustic_stone_wall_02: [1024, 512, 512], medieval_blocks_05: [1024, 512, 512], castle_wall_slates: [512, 512, 256],
      fabric_pattern_07: [0, 512, 256], stone_tiles_02: [1024, 512, 512],   // Etap 2, motyw #9: baza łupku i miedzi (roof2, roofTower)
    },
    hdri: 'kloppenheim_06_puresky_1k.hdr',
  },
};
const cfg = SCENES[scene];
if (!cfg) throw new Error('nieznana scena ' + scene);
// Progi rozmiaru strony (bajty): LIMIT = limit Artifactu (16 MB, twardy → exit 1); WARN = próg ostrzegawczy 15,0 MB (margines < 1 MB na wzrost
// bundla ≈ 10 KB/commit i nowe zasoby). Pomiar 2026-09-08 (krytyka r1): 15 947 807 B PRZED usunięciem posągów, 15 407 518 B PO (bajty UTF-8 pliku, nie html.length).
const LIMIT = 16e6, WARN = 15e6;
// Strażnik balastu: model z SCENES, którego nazwa nie występuje jako łańcuch 'nazwa' w <scena>/src/*.js, nie może być załadowany przez
// loaders.loadModel (props.js names / CONFIG.*.models) — same klucze ról palety (config.js) nie ładują modelu. Ostrzeżenie, nie błąd:
// nazwa może być składana dynamicznie.
const srcDir = join(ROOT, scene, 'src');
const srcText = readdirSync(srcDir).filter(f => f.endsWith('.js')).map(f => readFileSync(join(srcDir, f), 'utf8')).join('\n');
const modelUnused = name => !new RegExp(`['"]${name}['"]`).test(srcText);
for (const name of Object.keys(cfg.models)) if (modelUnused(name)) console.warn(`UWAGA: model ${name} jest w SCENES.${scene}, ale ${scene}/src nie ładuje go po nazwie — balast`);
const assets = {};
const b64 = (buf, mime) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
let total = 0;

for (const [name, [size, simp]] of Object.entries(cfg.models)) {
  const out = join(tmp, `${name}.glb`);
  const simpArgs = simp ? ['--simplify', 'true', '--simplify-ratio', String(simp), '--simplify-error', '0.01'] : ['--simplify', 'false'];
  execFileSync(GT, ['optimize', join(SRC, 'models', name, `${name}.gltf`), out, '--compress', 'quantize', '--texture-compress', 'auto', '--texture-size', String(size), ...simpArgs, '--join', 'true', '--flatten', 'true'], { stdio: 'ignore' });
  const buf = readFileSync(out); total += buf.length;
  assets[`models/${name}.glb`] = b64(buf, 'model/gltf-binary');
  console.log(`model ${name} ${size}px${simp ? ' ×' + simp : ''}: ${(buf.length / 1e6).toFixed(2)} MB`);
}
for (const [name, sizes] of Object.entries(cfg.textures)) {
  const maps = [['diff', 'Diffuse', 82, sizes[0]], ['nor', 'nor_gl', 86, sizes[1]], ['arm', 'arm', 78, sizes[2]]];
  for (const [map, file, q, size] of maps) {
    if (!size) continue;
    const src = [`${name}_${file}_2k.jpg`, `${name}_${file}_1k.jpg`].map(f => join(SRC, 'textures', name, f)).find(existsSync);
    if (!src) { console.warn('brak', name, file); continue; }
    const buf = await sharp(src).resize(size, size).jpeg({ quality: q, chromaSubsampling: map === 'diff' ? '4:2:0' : '4:4:4' }).toBuffer();
    total += buf.length; assets[`textures/${name}_${map}.jpg`] = b64(buf, 'image/jpeg');
  }
  console.log(`tekstury ${name} ${sizes.join('/')}px`);
}
{
  const buf = readFileSync(join(SRC, 'hdri', cfg.hdri)); total += buf.length;
  assets['hdri/sky.hdr'] = b64(buf, 'image/vnd.radiance');
}
const app = readFileSync(join(ROOT, `demo_artifact/${scene}_inline.js`), 'utf8');
const html = readFileSync(join(ROOT, `${scene}/index.html`), 'utf8')
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
  .replace(/<\/head>\s*<body>\s*/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace('<script type="module" src="./app.js"></script>', () => `<script>window.__ASSETS=${JSON.stringify(assets)};</script>\n<script>${app.replace(/<\/script>/g, '<\\/script>')}</script>`); // funkcja: String.replace interpretuje $& i $' w tekście zastępującym
const outPath = join(ROOT, `demo_artifact/${scene}.html`);
writeFileSync(outPath, html);
rmSync(tmp, { recursive: true, force: true });
const size = Buffer.byteLength(html, 'utf8');   // bajty pliku (limit Artifactu liczy bajty; String.length = jednostki UTF-16, o ~20 B mniej przez polskie znaki)
console.log(`zasoby surowe: ${(total / 1e6).toFixed(2)} MB, strona: ${size} B = ${(size / 1e6).toFixed(2)} MB (limit ${LIMIT / 1e6} MB, margines ${((LIMIT - size) / 1e6).toFixed(2)} MB) → ${outPath}`);
if (size > LIMIT) { console.error(`BŁĄD: strona ${size} B przekracza limit ${LIMIT} B — Artifact nie opublikuje się`); process.exitCode = 1; }
else if (size > WARN) console.warn(`UWAGA: strona ${size} B powyżej progu ostrzegawczego ${WARN} B — margines do limitu ${LIMIT - size} B (< 1 MB); tnij tekstury/modele w SCENES.${scene}`);
