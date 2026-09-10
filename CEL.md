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

### Etap 3 — realizm jednego fragmentu (2026-09-08/09, częściowo)
- **Widać:** kram sukiennika z modelu Blendera (symulacja tkaniny wypieczona w geometrię, AO 2048²), przebudowana ciesiołka kramów, cień kontaktowy pod kramem, chorągwie z pełnym herbem, koła wozu w płaszczyźnie jazdy.
- **Nie ruszone:** elewacja i bruk z pierwotnego zadania etapu, szyby okienne, węgarki, mozaika bruku.

### Etap 4 — NPC z mocapu, ruch jak u człowieka (2026-09-09/10, zrobione)
- **Widać:** nagi mieszczanin na rynku — stoi, przenosi ciężar, rozgląda się, rusza, idzie 1,196 m/s, zatrzymuje się, odwraca głowę za graczem. Podgląd z bliska: https://piotrek40.github.io/projekt/npc_test/ruch.html
- **Zakazy etapu:** żadnego klipu bez licencji zezwalającej na utwory zależne; żadnej poprawki animacji „na oko" (każda ma pomiar przed i po); żaden krok potoku nie może być liczony w czasie gry — wszystko przy ładowaniu; `results.errors` puste.
- **Test eskalacji:** tak — potok `przygotuj → przenies → zapetlij → przyziem → zablokujStopy → odsunRece → wydzielRuchKorzenia` jest niezależny od liczby klipów i od tego, który to klip. Nowy klip to wpis w tablicy, nie nowy kod. Ograniczenie: `przygotuj` liczy pozę odniesienia raz, na klipie Male1 — klipy innego aktora (np. ukłon z Male2) będą wymagały własnej pozy odniesienia.
- **Co powstało:** `engine/src/retarget.js` (1097 linii) — przeniesienie mocapu, domknięcie pętli, przyziemienie, blokada stóp z IK dwukostnym, odsunięcie rąk od tułowia; `rynek/src/npc.js` — maszyna stanów i kontroler; `npc_test/ruch.html` — podgląd; 60 asercji w `audyt/testy/retarget_test.sh`.
- **Wady znalezione ze zrzutów Piotra i naprawione (każda z pomiarem):** załamanie w pasie 45,4 → 12,1°; stopy nad brukiem mediana 12,3 → 1,9 mm; dłoń w tułowiu 48,3 mm przez 282/282 klatek → 0 klatek; skok na szwie pętli 11,75 → 0,24°; kołysanie przenoszone na stopy 150,5 → 33,7 mm; bark 53 i 82 mm za nisko → 0,7 i 11,5 mm.
- **Wspólna przyczyna trzech z nich:** dopasowywanie KIERUNKÓW kości przenosi geometrię cudzego szkieletu, nie ruch. Dopasowywane są dziś wyłącznie ramię i przedramię; wszystko inne dostaje przeniesienie ZMIANY względem pozy odniesienia.
- **Zostaje:** skóra (ciało ma jednolity kolor, zero tekstur), oddech i mruganie (w mocapie ich nie ma — zmierzone 1,2 mm ruchu głowy w klipie stojącym), faza lotu 0,13 s na cykl chodu (jest w samym nagraniu).

### Etap 5 — zachowania NPC (plan, 2026-09-10)
- **Ma być widać:** kilkunastu mieszczan, każdy przy swoim zajęciu — ktoś przenosi skrzynię przez plac, ktoś stoi przy kramie, ktoś przechodzi i skręca w ulicę. Kiedy podejdziesz, przerywają zajęcie, odwracają się i kłaniają. Kiedy wejdziesz komuś w drogę, schodzi z niej.
- **Zakazy etapu:**
  - Żadnej ręcznie wypisanej listy „NPC nr 3 idzie do punktu B i tam macha". Trasa i zajęcie wynikają z reguł i z tego, co jest na placu.
  - Żadnego przejścia między klipami wpisanego ręcznie — graf ruchu powstaje z POMIARU (poza końcowa klipu A vs początkowa klipu B, ta sama stopa podporowa).
  - Żadnego skręcania przez obracanie obiektu w miejscu, gdy w bibliotece jest klip skrętu. Kąt dobierany po ZMIERZONEJ wartości, nie po nazwie pliku.
  - Liczba postaci jest parametrem `CONFIG`, nigdy liczbą w kodzie.
  - Klip innego aktora niż Male1 wchodzi dopiero po zmierzeniu, że przenosi się tak samo czysto (te same asercje co etap 4).
- **Test eskalacji:** do rozstrzygnięcia przed pierwszą linią kodu — czy ten sam kontroler obsłuży kilkunastu NPC po zmianie parametru. Wąskie gardło NIE jest animacyjne, tylko rysunkowe: scena bez ludzi to 583 k trójkątów przy limicie 700 k, więc na ludzi zostaje 117 k, czyli 7,8 k na postać przy piętnastu — a ciało ma 26,8 k. Wniosek: potrzebny jest wariant uproszczony ciała (redukcja o 71%) albo mniej postaci. Do zmierzenia na telefonie, nie do zgadnięcia.

## 5. Reguły zamiast danych

- Pozycje obiektów: dziś z konfiguracji. Docelowo do ustalenia, czy świat ma być układany ręcznie (autor związany regułami skali i licencji), czy generowany z ziarna.
- Oświetlenie: jedno źródło prawdy (HDRI + słońce z niego wyliczone), nie ręcznie dobrane światła per obiekt.

## 6. Stan bieżący

- **Etap:** 5 — zachowania NPC (plan zapisany wyżej, kod jeszcze nie ruszony). Etap 4 zamknięty.
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

- 2026-09-09 — Ruch NPC: mocap ACCAD Open Motion Project, licencja CC BY 3.0 (jedyne z rozważanych źródeł dające naraz otwartą licencję, użycie komercyjne i utwory zależne). Atrybucja OBOWIĄZKOWA, także na ekranie „Zasoby" w grze — treść w `Piotrek40/Postac/ATRYBUCJA.md`.
- 2026-09-09 — Retarget własny, nie `SkeletonUtils.retargetClip`. Powód: ten ostatni ustawia rotacje światowe bez kompensacji różnicy póz spoczynkowych (zmierzone 51° na barku) i rzuca TypeError na klipach bez siatki.
- 2026-09-10 — **Osobne repozytorium `Piotrek40/Postac`** na źródła postaci: 299 plików BVH, archiwa źródłowe, zmierzony katalog, narzędzia, ciało. Powód: przez cztery etapy materiał źródłowy leżał wyłącznie w katalogu roboczym kontenera i znikał razem z sesją — w repozytorium było sześć gotowych klipów, ale nie materiał, z którego dało by się wyciąć siódmy.
- 2026-09-10 — Wybór klipu mocap jest ZAPYTANIEM do zmierzonego katalogu, nie wyszukiwaniem po nazwie. Powód: nazwy w tym zbiorze kłamią — `Male1_A1_Stand` kończy się odejściem 0,87 m/s, `WalkTurnLeft90` skręca o 102,7°, `WalkTurnRight90` o −82,5°.
- 2026-09-10 — **Skala docelowa placu: kilkunastu mieszczan**, żyjących swoim zajęciem, którzy zauważają gracza i reagują (odwracają się, kłaniają, schodzą z drogi). Decyzja Piotra. Konsekwencja: kontroler zachowań i graf ruchu muszą być pisane od razu pod wielu NPC, a nie pod jednego.
- 2026-09-10 — Powitanie: **ukłon z mocapu** (`Male2_D7_WalkToBow` + `D8_BowToReady`), nie machanie ręką. Powód: machania nie ma w całej 299-plikowej bibliotece — sprawdzone pomiarem, nie po nazwach (kandydaci na „gest w górę" to niemal wyłącznie sztuki walki). Ukłon do średniowiecznego rynku pasuje lepiej.
- 2026-09-10 — Female1 do ponownego rozważenia jako źródło ruchu. Odrzucona w etapie 4 za proporcje nóg (udo/podudzie 1,22 wobec normy ~1,0), ale retarget po etapie 4 przenosi ZMIANĘ, nie geometrię źródła, więc powód mógł przestać obowiązywać. Ma 650 s materiału, w tym serię D (`Wait`, `ConversationGestures`, `Urban`) — najbogatszy materiał na „ludzi, którzy coś robią rękami". Do rozstrzygnięcia pomiarem.
