# CEL — gra 3D na telefon (nazwa robocza: „Dziedziniec”)

> Ten plik czytasz na starcie KAŻDEJ sesji, zanim cokolwiek zaproponujesz.
> Ten plik aktualizujesz na końcu KAŻDEJ sesji.
> Wersja docelowa opisana niżej jest wiążąca. Nie wolno jej pomniejszyć bez wyraźnej decyzji Piotra zapisanej w sekcji „Zmiany decyzji".

---

## 1. Czym to jest na końcu

**DO USTALENIA Z PIOTREM.** Na razie wiadomo tylko tyle: gra 3D, którą Piotr otwiera linkiem na swoim telefonie z Androidem, chodzi swobodnie po świecie, rozgląda się i ogląda otoczenie z bliska. Grafika ma być tak blisko fotorealizmu, jak pozwala telefon. Co się w tym świecie dzieje poza chodzeniem — nieustalone.

## 2. Skala docelowa

**DO USTALENIA.** Pytania, na które Piotr ma odpowiedzieć zachowaniem, nie technologią:
- Jeden zamknięty obszar (pokój, dziedziniec, ulica), czy otwarty teren, po którym idzie się minutami?
- Czy w świecie jest coś, co się rusza samo (ludzie, zwierzęta, pogoda, pora dnia), czy jest to świat statyczny do oglądania?
- Docelowa płynność: 60 kl./s na telefonie Piotra (model do ustalenia) przy rozdzielczości renderowania niższej niż ekran.

## 3. Zakazy stałe — obowiązują na każdym etapie

- Żadna liczba określająca skalę nie występuje w kodzie inaczej niż jako konfiguracja (`CONFIG` w `demo/src/main.js` jest pierwszą taką konfiguracją).
- Żadnych danych przykładowych udających prawdziwe. Brak danych = widoczna pustka.
- Żadnych zasobów o niejasnej licencji. Każdy model, tekstura, HDRI ma wpis w `audyt/research/licencje_zasobow.md` zanim trafi do sceny.
- Żadnych płatnych usług jako fundamentu (hosting, generowanie zasobów, silnik).
- Żadnej tekstury wysyłanej na telefon bez kompresji GPU (KTX2). Żadnego modelu bez kompresji geometrii (meshopt).
- Pomiary wydajności podaje się zawsze z nazwą urządzenia. Wynik z serwera/komputera nigdy nie jest dowodem płynności na telefonie.

## 4. Etapy

### Etap 0 — audyt narzędzi i scena demonstracyjna (2026-09-07, zrobione)
- **Widać:** zamknięty dziedziniec z czterema murami, stołem z butelkami i latarnią, popiersiem na cokole, beczką, rośliną i kamieniami; słońce wyliczone z HDRI rzuca cienie; chodzenie joystickiem, rozglądanie przeciąganiem; licznik FPS na ekranie.
- **Zakazy etapu:** brak postprocesu (SSAO, bloom), brak wypalonego oświetlenia — najpierw pomiar bazowy na telefonie.
- **Test eskalacji:** tak — scena jest budowana z listy `CONFIG.props`, nowe obiekty to wpisy w konfiguracji, nie nowy kod. Sterowanie, kolizje i jakość nie zależą od liczby obiektów.

### Etap 1 — rynek high fantasy (2026-09-07, pierwsza wersja)
- **Widać:** plac 44×44 m z fontanną i posągiem, pierzeje kamienic szachulcowych z wykuszami, szczytami, lukarnami i oświetlonymi oknami, wieża ratusza z chorągwią, 7 kramów z towarem, wóz, beczki i skrzynie, latarnie ze światłem, falujące chorągwie, dym z kominów; cztery ulice zamknięte fasadami. Chodzenie po całym placu i ulicach z kolizjami.
- **Zakazy etapu:** żadnego ręcznego rozstawiania domów — pierzeje wynikają z rozmiaru placu i ziarna; żadnych zasobów spoza CC0; brak postprocesu do czasu pomiaru na telefonie.
- **Test eskalacji:** tak — `CONFIG.plaza.size`, `CONFIG.seed`, liczba kramów i latarni to parametry; większy rynek albo inne miasto to zmiana liczb, nie kodu. Ograniczenie: kolizje domów są osiowe, więc pierzeje pod kątem wymagałyby rozszerzenia silnika.

### Etap 2 — [do ustalenia po pomiarze na telefonie Piotra]
- **Widać:**
- **Zakazy etapu:**
- **Test eskalacji:**

## 5. Reguły zamiast danych

- Pozycje obiektów: dziś z konfiguracji. Docelowo do ustalenia, czy świat ma być układany ręcznie (autor związany regułami skali i licencji), czy generowany z ziarna.
- Oświetlenie: jedno źródło prawdy (HDRI + słońce z niego wyliczone), nie ręcznie dobrane światła per obiekt.

## 6. Stan bieżący

- **Etap:** 1 — pierwsza wersja rynku gotowa, czeka na pomiar z telefonu.
- **Ostatnio powstało:** wspólny silnik (`engine/`), rynek (`rynek/`, https://piotrek40.github.io/projekt/rynek/), wariant jednoplikowy do Artifact (`demo_artifact/build_artifact.mjs rynek`, 13 MB), dziedziniec przepięty na silnik.
- **Następny krok:** Piotr podaje z telefonu FPS/p95/GPU dla rynku w trzech jakościach. Potem: wypalone oświetlenie pośrednie (Blender), drzewa (własne, lekkie — skany Poly Haven mają 40–950 MB geometrii), postaci/NPC, dźwięk.
- **Odłożone świadomie:** drzewa ze skanów (za ciężkie), generowanie zasobów AI (token HF), WebGPU, lightmapy (najpierw pomiar).

## 7. Zmiany decyzji

- 2026-09-07 — Gra ma działać na telefonie Piotra (Android, Chrome) jako link, nie wewnątrz Cowork/Artifact. Powód: doprecyzowanie Piotra po pierwszym opisie zadania.
- 2026-09-07 — Silnik: three.js (WebGL2). Powód: wynik audytu (`audyt/RAPORT.md`).
- 2026-09-07 — Repo publiczne, hosting GitHub Pages z brancha `claude/repo-cleanup-q1fkk3`. Powód: darmowy link na telefon bez limitu 16 MB Artifactu.
- 2026-09-07 — Pierwsza lokacja: rynek high fantasy o złotej godzinie (HDRI kloppenheim_06, słońce podniesione do 30°, bo przy prawdziwym zachodzie cały plac był w cieniu kamienic).
