# Dziedziniec — scena demonstracyjna

Scena 3D do chodzenia na telefonie (Android, Chrome). three.js (WebGL2), zasoby Poly Haven (CC0).

## Uruchomienie

Strona jest statyczna. Wystarczy dowolny serwer HTTP wskazujący na katalog `demo/`:

```
npx http-server demo -p 8080
```

Docelowo: GitHub Pages z tego repozytorium (Settings → Pages → branch, folder `/demo` albo root z przekierowaniem).

## Sterowanie

- Telefon: lewa część ekranu = joystick (chodzenie), reszta = przeciąganie (rozglądanie). Oba naraz.
- Komputer: kliknięcie w scenę blokuje kursor; WASD/strzałki + mysz.
- Przycisk w prawym dolnym rogu przełącza jakość (low / medium / high): rozdzielczość renderowania, rozmiar mapy cieni, anizotropia. Wybór zapamiętany w przeglądarce.
- Lewy górny róg: licznik FPS, p95 czasu klatki, liczba draw calls, trójkąty, DPR, rozdzielczość. Lewy dolny: nazwa GPU.

## Budowa

- `demo/build.sh` bundluje `src/main.js` esbuildem do `app.js` (wariant plikowy: `src/loaders_ktx2.js`) i do `demo_artifact/app_inline.js` (wariant data URI: `src/loaders_inline.js`). Wybór modułu ładowania przez alias `scene-loaders`.
- `demo_artifact/build_artifact.mjs` składa jednoplikową stronę `demo_artifact/dziedziniec.html` (14,5 MB) do publikacji jako Artifact.
- Zasoby: `build_assets.sh` (surowe pliki w `audyt/assets_src/`, wynik w `assets/`). Modele: meshopt + KTX2 (ETC1S kolor/ARM, UASTC normalne). Tekstury podłoża/murów: KTX2 przez toktx. HDRI: 1k `.hdr`.
- `vendor/basis/`: transkoder Basis Universal (z pakietu three.js).

## Struktura konfiguracji

Cała skala i rozmieszczenie sceny są w obiekcie `CONFIG` na początku `src/main.js`: rozmiar dziedzińca, wysokość murów, słońce, poziomy jakości, skala tekstur w metrach, lista obiektów (`props`) z pozycjami i kolizjami. Nowy obiekt = nowy wpis w `props` + plik w `assets/models/`.
