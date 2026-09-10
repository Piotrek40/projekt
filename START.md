# Start na nowej maszynie

Od świeżego klona do działającej sceny i przechodzących testów.

## 1. Zależności

```bash
cd tools && npm install && cd ..      # esbuild, three, gltf-transform, sharp (~2 min)
```

To jedyny krok instalacyjny. `tools/node_modules` jest w `.gitignore`, więc po klonie
go nie ma — a bez niego nie zbudujesz bundli ani nie uruchomisz testów.

Do renderów kontrolnych (headless Chromium) potrzebny jest jeszcze Playwright
i http-server; skrypty w `audyt/testy/` szukają ich pod ścieżkami z kontenera
(`/opt/node22/...`) — na laptopie trzeba je podmienić na lokalne.

Do przebudowy ciała lub eksportu nowych klipów mocap: Blender z `bpy`
(sprawdzone na 5.0.1) — patrz repozytorium **[Piotrek40/Postac](https://github.com/Piotrek40/Postac)**.

## 2. Budowanie bundli — NIE POMIJAĆ

`rynek/app.js` i `npc_test/*_app.js` to pliki **zbundlowane**. Edycja `rynek/src/*.js`
nie ma żadnego wpływu, dopóki nie przebudujesz. To najczęstsza pułapka w tym projekcie:
render pokazuje wtedy starą scenę i wygląda, jakby poprawka nie zadziałała.

```bash
TOOLS=$PWD/tools/node_modules
# scena rynku
"$TOOLS/.bin/esbuild" rynek/src/main.js --bundle --minify --format=esm \
  --alias:three="$TOOLS/three" --alias:three/addons="$TOOLS/three/examples/jsm" \
  --alias:scene-loaders=./engine/src/loaders_ktx2.js --outfile=rynek/app.js
# podglądy NPC
for p in "src.js:app.js" "cialo.js:cialo_app.js" "ruch.js:ruch_app.js"; do
  "$TOOLS/.bin/esbuild" npc_test/${p%%:*} --bundle --minify --format=esm \
    --alias:three="$TOOLS/three" --alias:three/addons="$TOOLS/three/examples/jsm" \
    --outfile=npc_test/${p##*:}
done
```

`--minify` też nie jest opcjonalne: bez niego bundle podglądu rosną z 542 kB do 1,15 MB,
a to leci na telefon po komórkowym internecie.

## 3. Testy

```bash
bash audyt/testy/geo_test.sh          # geometria sceny (~0,3 s)
bash audyt/testy/retarget_test.sh     # przeniesienie mocapu, 60 asercji (~40 s)
node audyt/testy/tools/rot_token.mjs rynek/src/*.js   # każdy obrót ma policzony komentarz
```

Obie ścieżki testowe bundlują sobie kod same, więc działają na źródłach — ale render
kontrolny czyta bundle, więc **przed renderem zawsze przebuduj**.

## 4. Podgląd

```bash
npx http-server . -p 8080 -c-1
```

- `http://localhost:8080/rynek/` — scena gry
- `http://localhost:8080/npc_test/ruch.html` — podgląd ruchu NPC (klipy, siatka 0,5 m)
- `http://localhost:8080/npc_test/cialo.html` — podgląd ciała i póz testowych
- `http://localhost:8080/npc_test/` — test sterownika (skinning, cienie, wydajność)

Flagi w adresie: `?noui=1`, `?nonpc=1`, `?noskin=1`, `?noinst=1`, `?top=1`, `?boxes=1`,
`?lineup=1`, `?roles=1` — służą do bisekcji, gdy coś wygląda źle na telefonie.

## 5. Publikacja

Branch `claude/repo-cleanup-q1fkk3` jest podpięty pod GitHub Pages:
<https://piotrek40.github.io/projekt/rynek/>. Push na ten branch = publikacja
(wejście w życie ok. 1–2 min).

## 6. Gdzie co jest

| katalog | co |
|---|---|
| `rynek/src/` | scena: kamienice, kramy, fontanna, zieleń, UI, NPC |
| `engine/src/` | silnik: pętla, wczytywanie, `check()`, **`retarget.js`** (mocap → nasz szkielet) |
| `npc_test/` | podglądy postaci |
| `audyt/testy/` | testy i harness renderów |
| `audyt/research/` | badania: licencje, limity mobilne, mocap |
| `assets_blender/` | skrypty Blendera (ciało, kram sukiennika) |
| `CEL.md` | **czytaj na starcie każdej sesji** — etapy, zakazy, decyzje |

Źródła postaci (299 klipów mocap, katalog, narzędzia): **[Piotrek40/Postac](https://github.com/Piotrek40/Postac)**.
