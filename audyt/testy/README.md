# audyt/testy — kolejność weryfikacji sceny rynku

1. `bash audyt/testy/geo_test.sh` (z korzenia worktree, ~1 s) — test numeryczny geometrii bez przeglądarki: bundluje prawdziwe moduły sceny
   (`geo/entry.mjs` → `geo/scene.bundle.mjs`) i uruchamia `test_geometria.mjs` (asercje A–E, B5/B5b/B6; listy znanych wad `KNOWN_*` z datą).
   **ZAWSZE PRZED `render_scene.js`** — exit 1 = nie renderujesz.
2. `node audyt/testy/tools/rot_token.mjs rynek/src/<modul>.js` — każdy niezerowy `rx/rz` w `L()/M4()/place()` ma komentarz `rot:` z policzonym wynikiem (exit 0).
3. `node audyt/testy/tools/check_test.mjs` — po zmianie `engine/src/check.js` (oczekiwana liczba celowych FAIL w nagłówku pliku).
4. `cd audyt/testy && … node render_scene.js rynek - <nazwa>` — render (SwiftShader), `out/render/<nazwa>/results.json` (`errors` w ostatnim elemencie MUSI być `[]`).
5. `tools/img_diff.mjs`, `tools/color_probe.mjs`, `tools/measure_render.mjs` — pomiary na PNG. Szczegóły i progi: `rynek/PROMPT.md` §3.4–3.6, §6.
