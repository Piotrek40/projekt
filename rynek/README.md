# Rynek — lokacja high fantasy

Link: https://piotrek40.github.io/projekt/rynek/ (Chrome na Androidzie; ok. 48 MB przy pierwszym wejściu, potem z cache).

Generowany z `CONFIG` w `src/world.js`: rozmiar placu, ziarno, liczba kramów i latarni, paleta, tekstury. Kamienice powstają z reguł (szerokość, liczba pięter, wykusz, szczyt, lukarna, komin losowane z ziarna), ulice zamykają fasady, wieża i fontanna są parametryczne. Rekwizyty to skany Poly Haven (CC0) instancjonowane per model.

Budowa: `rynek/build_assets.sh` (zasoby KTX2/meshopt), `demo/build.sh` (bundle), `node demo_artifact/build_artifact.mjs rynek` (wersja jednoplikowa ≤16 MB do Artifactu).

Sterowanie i HUD jak w `demo/README.md`. Silnik wspólny: `engine/src/`.
