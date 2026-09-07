// Linie, w których L(...)/M4(...)/.place(...) dostaje NIEZEROWY argument rx lub rz (5./6. arg L i M4, 7./8. arg place), a w linii nie ma tokenu 'rot:'.
// Argumenty liczone po nawiasach (nie regexem), więc łapie też `L(sx * (w / 4 + ov / 2), …, 0, 0, -sx * Math.atan2(…))`.
// Pomija: definicje (`=> M4(`), argumenty `0`, oraz przekazywanie dalej (`rx`, `rz`, `lrx`, `lrz`). Exit 1 gdy są trafienia.
// Użycie: node rot_token.mjs rynek/src/buildings.js [...]
import { readFileSync } from 'node:fs';
let hits = 0;
const passthru = /^(l?r[xz])$/;
for (const file of process.argv.slice(2)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('//') || /=>\s*(new THREE\.Matrix4\(\)|M4\()/.test(line)) return;
    for (const m of line.matchAll(/\b(L|M4|place)\(/g)) {
      let depth = 1, j = m.index + m[0].length, cur = '', args = [];
      for (; j < line.length && depth > 0; j++) { const c = line[j]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--; if (depth === 0) break; if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; } else cur += c; }
      args.push(cur.trim());
      const rot = m[1] === 'place' ? args.slice(6, 8) : args.slice(4, 6);
      const live = rot.some(a => a && a !== '0' && !passthru.test(a));
      if (live && !line.includes('rot:')) { hits++; console.log(`${file}:${i + 1}: ${m[1]}(rx=${rot[0] ?? '-'}, rz=${rot[1] ?? '-'}) bez 'rot:'`); }
    }
  });
}
process.exit(hits ? 1 : 0);
