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

### Etap 2 — dopracowanie rynku jako pierwszej sceny gry RPG (2026-09-08, zrobione)
- **Widać:** okrągła wieża zegarowa 36 m z miedzianym hełmem i tarczą zegara jako punkt skupienia kadru startowego; kamienice o różnych wysokościach (2–4 piętra), spadkach dachów, z wykuszami wielobocznymi na kroksztynach, lukarnami, szczytami schodkowymi, naczółkami, portalami łukowymi, okiennicami i szyldami cechowymi z herbami; paleta OKLCH (5 tynków różniących się odcieniem, dachówka ciepła/zgaszona/łupek, patyna wieży, cztery barwy heraldyczne); fontanna trzypoziomowa ze strumieniami, kręgami na wodzie i mokrym brukiem; girlandy chorągiewek z lampionami nad placem; dwie lipy przy fontannie, kwiaty w skrzynkach na parapetach, donice przy portalach, ławki; role kramów (piekarz, owocarz, garncarz, kotlarz, sukiennik, zielarz, winiarz) z towarem z modeli CC0; medalion i kałuże na bruku; druga linia dachów, wieże w oddali, bramy zamykające ulice, mgła i ptaki; ekran startowy „Rynek Srebrnych Liści”, pergaminowy HUD i podpisy miejsc.
- **Zakazy etapu:** żadnego ręcznego stawiania obiektu, którego pozycja może wynikać z `CONFIG` i ziarna; żadnej liczby obrotu wpisanej „na czucie” (każda policzona w Node i zapisana w komentarzu); żadnego koloru poza `CONFIG.paletteOKLCH` (hex tylko przez `oklch()`); budżet `calls ≤ 250`, `triangles ≤ 700 000` w każdym widoku, w obu trybach (instancje i `noinst`); brak postprocesu.
- **Test eskalacji:** tak — nowa lokacja to nowe `CONFIG` (rozmiar placu, ziarno, paleta, role kramów, liczba girland, wież w oddali) plus te same moduły; ograniczenie: pierzeje nadal osiowe (kolizje `addRect`), a wieża i kompozycja startu są dostrojone do jednego kadru — inne miasto wymaga przeliczenia kompozycji.
- **Jak to powstało:** `rynek/PROMPT.md` (protokół przestrzenny i kolorystyczny) + 15 motywów wykonanych przez agentów w dwóch torach, scalenie, dwie rundy krytyki (reżyseria, geometria, budżet) i poprawki. Raporty motywów: `audyt/raporty/etap2_*.md`.

## 5. Reguły zamiast danych

- Pozycje obiektów: dziś z konfiguracji. Docelowo do ustalenia, czy świat ma być układany ręcznie (autor związany regułami skali i licencji), czy generowany z ziarna.
- Oświetlenie: jedno źródło prawdy (HDRI + słońce z niego wyliczone), nie ręcznie dobrane światła per obiekt.

## 6. Stan bieżący

- **Etap:** 3 — realizm jednego fragmentu (kram sukiennika z modelu Blendera + poprawki zgłaszane ze zrzutów z telefonu). Elewacja i bruk z zadania jeszcze nie ruszone.
- **Ostatnio powstało (etap 3):** model `kram_sukiennik.glb` z Blendera (symulacja tkaniny wypieczona w geometrię + AO 2048², `assets_blender/kram_sukiennik.py`), przebudowana ciesiołka kramów (belki, zastrzały, lada bez szpary), cień kontaktowy pod każdym kramem, splot sukna z mapy AO, chorągwie z pełnym herbem, koła wozu w płaszczyźnie jazdy.
- **Ostatnio powstało (etap 2):** Etap 2 rynku (wieża, paleta, fontanna, zieleń, girlandy, panorama, role kramów, UI) — https://piotrek40.github.io/projekt/rynek/ i Artifact (15,4 MB z limitu 16 MB); narzędzia weryfikacji (`engine/src/check.js`, `?top/?side/?boxes/?lineup/?roles`, `audyt/testy/geo_test.sh`, `audyt/testy/tools/*`), 17 nowych zasobów CC0 (`audyt/research/zasoby_etap2.md`), `rynek/PROMPT.md`.
- **Pomiar (SwiftShader, 824×1830, high):** start_plac 117 draw / 578 k tri w HUD (limit 250 / 700 k), errors [] we wszystkich widokach. FPS z SwiftShader nie jest miarą telefonu.
- **Pomiar z telefonu (2026-09-08, Galaxy S24, Samsung Xclipse 940, Vulkan 1.3.279, OpenGL ES 3.2, Chrome, GitHub Pages):**
  | jakość | DPR | rozdzielczość | fps | p95 | draw | tri (HUD) | kadr |
  |---|---|---|---|---|---|---|---|
  | high | 2.00 | 720×1282 | 58 | **20,5 ms** | 151 | 347 k | korona lipy wypełnia kadr |
  | high | 2.00 | 720×1282 | 59 | 17,1 ms | 115 | 275 k | wieża i kram, lipy poza kadrem |
  | medium | 1.50 | 540×961 | 58 | 17,1 ms | 158 | 361 k | kadr zbliżony do startowego |
  | high (2026-09-09, po etapie 3) | 2.00 | 720×1282 | **60** | **16,8 ms** | 117 | 276 k | wóz i kram na pierwszym planie, bez lipy |
  Odczyt: 58–59 fps to sufit odświeżania 60 Hz, więc miarą jest p95 (16,7 ms = pełne 60 fps). Jakość medium ma p95 na poziomie sufitu mimo WIĘKSZEJ
  geometrii niż high, a jedyny kadr z p95 ponad sufitem to ten z lipą — telefon jest bliżej limitu wypełniania pikseli niż geometrii.
- **Następny krok:** do wyboru Piotra — dokończyć resztki z rundy krytyki (szyby okienne, mozaika bruku czytana jak naklejony papier, węgarki okien), albo wrócić do zadania etapu 3 i wziąć elewację i bruk. Dopiero po nich decyzja, co dalej: wnętrza i interakcja, NPC, dźwięk, czy wypalone światło (Blender).
- **Odłożone świadomie:** drzewa ze skanów (za ciężkie), generowanie zasobów AI (token HF), WebGPU, lightmapy (najpierw pomiar).

## 7. Zmiany decyzji

- 2026-09-07 — Telefon Piotra: Galaxy S24 (Samsung Xclipse 940). Na tym GPU nie używamy KTX2 ani InstancedMesh (błędy sterownika znalezione bisekcją; szczegóły w `audyt/RAPORT.md` §6a). Obejścia włączają się automatycznie po nazwie GPU.

- 2026-09-07 — Gra ma działać na telefonie Piotra (Android, Chrome) jako link, nie wewnątrz Cowork/Artifact. Powód: doprecyzowanie Piotra po pierwszym opisie zadania.
- 2026-09-07 — Silnik: three.js (WebGL2). Powód: wynik audytu (`audyt/RAPORT.md`).
- 2026-09-07 — Repo publiczne, hosting GitHub Pages z brancha `claude/repo-cleanup-q1fkk3`. Powód: darmowy link na telefon bez limitu 16 MB Artifactu.
- 2026-09-07 — Pierwsza lokacja: rynek high fantasy o złotej godzinie (HDRI kloppenheim_06, słońce podniesione do 30°, bo przy prawdziwym zachodzie cały plac był w cieniu kamienic).

- 2026-09-08 — Nazwa lokacji: „Rynek Srebrnych Liści" w mieście Srebrny Bród (Wybrzeże Mieczy); karczma „Pod Złotym Gryfem". Nazwy własne nasze, nie z podręczników WotC. Powód: Etap 2 wymagał tożsamości miejsca (heraldyka, podpisy, ekran startowy).
- 2026-09-08 — Kolory sceny wyłącznie jako OKLCH w `CONFIG.paletteOKLCH` (hex przez `oklch()`), tinty liczone z mnożnika tekstury i sprawdzane sondą na zrzucie. Powód: tint mnoży teksturę, a AgX kompresuje jasność i chromę — dobór „na oko" dawał czarne belki i mleczną wodę.
- 2026-09-08 — Każda cecha ma flagę URL `?no<cecha>=1` i asercję `check()`; render pomiarowy zawsze z `?noui=1&nosmoke=1&nosway=1&nowater=1`. Powód: bisekcja na telefonie i porównywalność zrzutów.
- 2026-09-08 — Po pomiarze na S24: budżet sceny liczymy w DWÓCH walutach, nie jednej. Geometria (draw calls, trójkąty) jest tania — 151/250 draw i 347 k/700 k tri przy p95 na sufitie. Kosztem krytycznym jest praca NA PIKSEL: alfa-test, przezroczystość, overdraw, DoubleSide. Powód: jedyny zmierzony kadr ponad sufitem 60 Hz (p95 20,5 ms) to ten z koroną lipy na cały ekran — przy MNIEJSZEJ geometrii niż kadr, który sufit trzymał.
