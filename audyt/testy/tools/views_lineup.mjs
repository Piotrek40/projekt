#!/usr/bin/env node
// Generuje audyt/testy/views_lineup.json z układu lineupu (rynek/src/lineup.js: LINEUP, MAT_KEYS, lineupView): widok k = kamera 6 m przed rzędem k,
// rows = ceil(kluczy / 7). Klucze: MAT_KEYS z lineup.js albo --results=<results.json renderu ?lineup=1> (pole lineup.keys) albo --keys=N.
// Użycie: node views_lineup.mjs [--results=…] [--keys=N] [--out=../views_lineup.json]   (po zmianie kluczy W.mat: ten skrypt, potem lineup_rects.mjs)
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '../../..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
const threeDir = fs.existsSync(resolve(ROOT, 'tools/node_modules/three')) ? resolve(ROOT, 'tools/node_modules/three') : '/home/user/projekt/tools/node_modules/three';
registerHooks({ resolve(spec, ctx, next) { // bare 'three' / 'three/addons/…' → tools/node_modules/three (jak alias w demo/build.sh)
  if (spec === 'three') return { url: pathToFileURL(resolve(threeDir, 'build/three.module.js')).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: pathToFileURL(resolve(threeDir, 'examples/jsm', spec.slice('three/addons/'.length))).href, shortCircuit: true };
  return next(spec, ctx); } });
const { MAT_KEYS, lineupRows, lineupView, LINEUP } = await import(pathToFileURL(resolve(ROOT, 'rynek/src/lineup.js')).href);
const n = args.keys ? +args.keys : args.results ? JSON.parse(fs.readFileSync(args.results, 'utf8')).at(-1).lineup.keys.length : MAT_KEYS.length;
const rows = lineupRows(n), views = Array.from({ length: rows }, (_, k) => lineupView(k));
const out = args.out || resolve(here, '../views_lineup.json');
fs.writeFileSync(out, '[\n' + views.map(v => '  ' + JSON.stringify(v)).join(',\n') + '\n]\n');
console.log(`${n} kluczy → ${rows} rzędów (row ${LINEUP.row} m, z0 ${LINEUP.z0}) → ${out}: z kamer ${views.map(v => v.z).join(', ')}`);
