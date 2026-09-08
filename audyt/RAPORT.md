# Audyt narzędzi do gry 3D na telefon (Android, Chrome) — 2026-09-07

Cel: ustalić, czym w tej sesji da się realnie zbudować grę 3D z możliwie fotorealistyczną grafiką, w której Piotr chodzi po świecie i ogląda otoczenie z bliska na swoim telefonie z Androidem, otwierając ją linkiem w przeglądarce.

Oznaczenia statusu w tabelach:
- **[SPRAWDZONE]** — sprawdzone w działaniu w tej sesji (uruchomione, wynik obejrzany lub zmierzony)
- **[DOKUMENTACJA]** — potwierdzone dokumentacją lub oficjalnym źródłem, nieprzetestowane tutaj
- **[UŻYTKOWNIK]** — wymaga działania Piotra (logowanie, token, zmiana ustawienia)
- **[NIEDOSTĘPNE]** — nie da się użyć z tej sesji

## 1. Zakres i luki audytu

Sprawdzone: środowisko wykonawcze sesji, narzędzia MCP (GitHub, Hugging Face, Context7, Exa), możliwości Artifact, instalacja i użycie narzędzi open source (three.js, gltf-transform, KTX-Software, Blender jako moduł Pythona, Chromium headless), API Poly Haven, ambientCG i kilkunastu innych źródeł zasobów (raporty w `research/`), licencje. Zbudowana i wyrenderowana jedna scena demonstracyjna.

Nie sprawdzone lub sprawdzone tylko dokumentacją: Babylon.js i PlayCanvas w działaniu (nie było potrzeby po wyborze three.js), Godot i Unity (odrzucone na podstawie dokumentacji), generowanie AI w praktyce (zablokowane brakiem tokena), rzeczywista wydajność na telefonie Piotra (nie ma go w tej sesji), WebGPU na Androidzie (tylko dokumentacja), GitHub Pages (repo jest prywatne).

## 2. Środowisko: gdzie tworzę, a gdzie gra działa

| | Środowisko tworzenia (ta sesja) | Urządzenie docelowe (telefon Piotra) |
|---|---|---|
| Procesor | 4 rdzenie Xeon 2,8 GHz (AVX-512) | nieznany model Androida |
| Pamięć | 15 GB RAM, 30 GB dysku | nieznana |
| GPU | **brak** (render tylko programowy SwiftShader) | GPU mobilne (Mali/Adreno), WebGL2 pewne, WebGPU niepewne |
| Przeglądarka | Chromium 141 headless, WebGL2 przez SwiftShader, bez WebGPU | Chrome na Androidzie |
| Uprawnienia | root, apt, pip, npm; sieć otwarta (npm, PyPI, GitHub, Poly Haven, HF) | — |
| Rola | budowa zasobów, kompresja, wypalanie, testy poprawności i wyglądu | jedyne miarodajne miejsce pomiaru płynności |

Wniosek: tutaj mogę zrobić wszystko poza jednym — nie zmierzę FPS na telefonie. Każda liczba wydajności z tej sesji jest liczbą z procesora serwera i nie mówi nic o telefonie.

## 3. Tabela narzędzi

| Narzędzie | Zastosowanie | Koszt / licencja | Dostępność tutaj | Wynik testu | Ograniczenia |
|---|---|---|---|---|---|
| **three.js 0.185.1** | silnik renderujący w przeglądarce | MIT, bezpłatny | **[SPRAWDZONE]** npm, bundlowany esbuildem | scena PBR + HDRI + cienie + KTX2 + meshopt renderuje się w headless Chromium | brak wbudowanego sterowania dotykowego FPS (napisane własne); `PCFSoftShadowMap` przestarzały |
| Babylon.js 9.25 | alternatywny silnik | Apache-2.0 | [DOKUMENTACJA] | — | bundle 8 MB, dekodery domyślnie z CDN Babylona |
| PlayCanvas engine 2.22 | alternatywny silnik | MIT | [DOKUMENTACJA] | — | bez edytora dużo kodu ręcznego |
| Godot 4.7 web | silnik z edytorem | MIT | [DOKUMENTACJA] | — | web tylko WebGL2 Compatibility, ~40 MB wasm, słaby do fotorealizmu |
| Unity 6 Web | silnik | Personal free | [DOKUMENTACJA] | — | 20–40 MB buildy, nie ma edytora w tej sesji |
| Unreal | silnik | — | **[NIEDOSTĘPNE]** | — | web tylko Pixel Streaming (serwer z GPU) |
| **gltf-transform 4.5** | optymalizacja glTF: meshopt, Draco, KTX2, resize, join | MIT | **[SPRAWDZONE]** npm | popiersie 2,02 MB → Draco 1,66 MB (0,6 s), meshopt 1,72 MB (0,6 s), ETC1S 1,86 MB (6 s); pełny pipeline dla 7 modeli | `optimize --texture-compress ktx2` domyślnie używa najwolniejszego UASTC z RDO — trzeba jawnie `etc1s`/`uastc` |
| **KTX-Software 4.4 (toktx)** | kompresja tekstur GPU do KTX2 | Apache-2.0 | **[SPRAWDZONE]** .deb z GitHub | 3 zestawy PBR 2k/1k → KTX2 z mipmapami; ETC1S 2k ≈ 0,7–0,9 MB, UASTC 2k ≈ 3,5–5 MB (z RDO mniej) | UASTC na CPU jest wolny; ETC1S psuje mapy normalnych |
| **Blender 5.0 (bpy z PyPI)** | import glTF, wypalanie AO/lightmap (Cycles CPU), eksport GLB | GPL (wyniki wolne) | **[SPRAWDZONE]** `pip install bpy` (ok. 300 MB, pobieranie z PyPI bywa przerywane) | import Barrel_01 0,1 s, wypalenie AO 512 px 32 próbek 5,1 s na CPU, eksport GLB 0,04 s | tylko CPU; pełne lightmapy sceny to minuty, nie sekundy |
| Chromium 141 headless + Playwright | render testowy, zrzuty, pomiar poprawności | BSD/Apache | **[SPRAWDZONE]** | WebGL2 działa (SwiftShader), zrzuty 412×915 i 824×1830 | 17–35 kl./s na CPU — pomiar niereprezentatywny dla telefonu; brak WebGPU |
| esbuild | bundlowanie JS | MIT | **[SPRAWDZONE]** | 687 KB bundle w 0,15 s | — |
| **Poly Haven API** | modele, tekstury PBR, HDRI | CC0, bez logowania | **[SPRAWDZONE]** | 521 modeli, 857 tekstur, 301 HDRI; pobrano 7 modeli, 3 tekstury, 1 HDRI | dl.polyhaven.org oddał raz 403 przy równoległych pobraniach (retry pomaga) |
| ambientCG API | tekstury PBR, modele | CC0, bez logowania | [DOKUMENTACJA] (JSON pobrany przez agenta) | 2009 materiałów | — |
| Smithsonian 3D, Google Scanned Objects, Khronos samples, NASA | skany i modele | CC0 / CC-BY / PD | [DOKUMENTACJA] | endpointy odpowiadają 200 | GSO wymaga atrybucji CC-BY |
| Sketchfab, BlenderKit | modele | per model | **[UŻYTKOWNIK]** | wyszukiwanie działa, pobieranie 401/403 | wymaga tokena konta |
| Quixel Megascans / Fab | skany fotogrametryczne | Fab Standard | **[UŻYTKOWNIK]** | — | konto Epic, brak API, tylko rotujące darmowe |
| **Hugging Face (konektor MCP)** | generowanie obrazów/tekstur/modeli 3D | konto Free | **[NIEDOSTĘPNE]** w tej konfiguracji | `dynamic_space invoke` zwraca „disabled because gradio=none” | ustawienie konektora HF po stronie Piotra |
| Hugging Face Spaces (gradio_client, anonimowo) | j.w. | ZeroGPU: anonim 2 min/dzień, Free 5 min, PRO 40 min | **[UŻYTKOWNIK]** | FLUX.1-schnell: „exceeded ZeroGPU quota (90s requested vs 0s left)”; Hunyuan3D-2.1: „GPU task aborted”; TRELLIS (microsoft): CONFIG_ERROR, trellis-community: endpointy dostępne | token HF w zmiennej środowiskowej odblokuje 5 min/dzień |
| TRELLIS, TripoSR (modele) | image-to-3D | MIT (wyniki wolne) | **[UŻYTKOWNIK]** (GPU lub token) | — | brak GPU tutaj; lokalnie na RTX 5000 Piotra realne |
| Hunyuan3D-2.1 | image-to-3D | licencja Tencent **nie obowiązuje w UE** (także wyniki) | **[NIEDOSTĘPNE]** prawnie | — | nie używać w projekcie |
| Meshy / Tripo / Rodin (free) | text/image-to-3D | Meshy free = CC-BY, Tripo free = niekomercyjne, Rodin free bez eksportu | **[UŻYTKOWNIK]** | — | limity kredytów |
| Blockade Labs Skybox | HDRI z AI | free bez eksportu | **[NIEDOSTĘPNE]** praktycznie | — | HDRI Poly Haven wystarczają |
| Artifact (Cowork) | hosting strony | w planie | **[SPRAWDZONE]** możliwości: artifact, db, downloads, mcp, room, sample; **brak `assets`** | — | limit 16 MB, zasoby tylko inline, WASM z CDN blokowany → bez KTX2/meshopt |
| GitHub Pages | hosting strony (link na telefon) | bezpłatny dla **publicznych** repo | **[UŻYTKOWNIK]** | repo `Piotrek40/projekt` jest prywatne, Pages wyłączone | Pages w prywatnym repo = płatny plan |
| GitHub API (MCP) | commit, push, PR | — | **[SPRAWDZONE]** dla tego repo | push działa | tworzenie nowego repo: 403 |

## 4. Wyniki testów w liczbach

### Kompresja jednego modelu (marble_bust_01, 3 tekstury 2k JPG, 17 456 trójkątów)

| Wariant | Rozmiar pliku | Pamięć GPU tekstur | Czas |
|---|---|---|---|
| glTF surowy (JPG) | 2,02 MB | 67 MB (3 × 22 MB nieskompresowane) | — |
| Draco | 1,66 MB | 67 MB | 0,6 s |
| meshopt | 1,72 MB | 67 MB | 0,6 s |
| meshopt + KTX2 ETC1S (wszystkie mapy) | 1,86 MB | 8,4 MB (3 × 2,8 MB) | 6 s |
| meshopt + KTX2 UASTC (wszystkie mapy) | 11,5 MB | 17 MB | ~60 s |
| meshopt + ETC1S kolor/ARM + UASTC normalna, bez RDO | 4,9 MB | 11,2 MB | ~30 s |
| **meshopt + ETC1S kolor/ARM + UASTC normalna z RDO λ=3 (finalnie w demo)** | 3,6 MB | 11,2 MB | ~50 s |

Wniosek: KTX2 zmniejsza pamięć GPU 6–8×, co na telefonie jest ważniejsze niż rozmiar pliku. UASTC tylko dla map normalnych, z RDO. Pułapka znaleziona w praktyce: gltf-transform 4.5 nie przekazuje flag RDO do `ktx create` (sprawdzone z `--verbose`), więc RDO dla normalnych robi własny skrypt `tools/ktx_normals.mjs` wywołujący `toktx` bezpośrednio.

Całość zasobów demo po kompresji: 30 MB (modele 19 MB, tekstury podłoża i murów 9,3 MB, HDRI 1,4 MB). To dużo jak na wejście przez sieć komórkową; na Wi-Fi akceptowalne. Do zmniejszenia w następnym etapie (1k normalne na kamieniach i murach, ETC1S wyższej jakości zamiast UASTC tam, gdzie relief jest gruby).

### Wypalanie w Blenderze (CPU, 4 rdzenie)

| Operacja | Czas |
|---|---|
| import glTF (Barrel_01) | 0,1 s |
| wypalenie AO 512×512, 32 próbki | 5,1 s |
| eksport GLB | 0,04 s |

### Scena demo (render headless, SwiftShader = CPU, NIE telefon)

| Widok | Rozdzielczość | Draw calls | Trójkąty | FPS (CPU serwera) |
|---|---|---|---|---|
| start | 412×915 (DPR 1) | 122 | 503 k | 17 |
| start | 824×1830 (DPR 2) | 122 | 503 k | 17 |
| popiersie z bliska | 824×1830 | 59 | 297 k | 35 |
| mur i podłoże | 824×1830 | 57 | 227 k | 24 |
| pod słońce (cienie) | 824×1830 | 110 | 608 k | 33 |

Draw calls liczone z przebiegiem cieni (dwa przebiegi na obiekt). Cztery mury to 24 wywołania, bo każdy mur ma trzy materiały (ściana, wierzch, krawędź) — do połączenia w jedną geometrię w następnym etapie. Trójkąty 500–600 k w szerokich ujęciach to górna granica budżetu dla średniego Androida; roślina (59 k) i kamienie są pierwszymi kandydatami do uproszczenia (`gltf-transform simplify`).

Pobranie strony: 32 MB (po RDO; przed RDO 36,8 MB). Czas do gotowości w headless: 3–5 s z lokalnego serwera (bez sieci, z kompilacją shaderów na CPU).

Te FPS mówią tylko, że scena jest poprawna i nie jest absurdalnie ciężka. Względem budżetu dla średniego Androida z researchu (≤150 draw calls, ≤500 k trójkątów) scena mieści się w limicie, ale przy górnej granicy trójkątów — rośliny i kamienie są gęste (roślina 59 k). To pierwsza rzecz do uproszczenia, jeśli telefon pokaże spadki.

## 5. Scena demonstracyjna

Katalog `demo/`. Zamknięty dziedziniec 14×14 m z czterema murami z cegły, posadzką z kamiennych płyt, cokołem z bloków, popiersiem marmurowym, stołem z butelkami i latarnią, beczką, rośliną w donicy i grupą omszałych kamieni. Niebo i oświetlenie otoczenia z jednego HDRI (PMREM), słońce kierunkowe z cieniem PCF, mapowanie tonów AgX, MSAA sprzętowe. Wszystkie materiały PBR: kolor, normalna, AO/roughness/metalness. Butelki używają transmisji (szkło) z rozszerzeń glTF.

Kierunek słońca nie jest wpisany ręcznie: przy starcie scena szuka najjaśniejszego piksela HDRI i stawia tam światło kierunkowe (sprawdzone: kamera skierowana w wyliczony kierunek widzi tarczę słońca, zrzut `testy/out/render/debug_look_at_sun.png`). Znaleziony po drodze problem: HDRI typu „puresky” ma słońce wtopione w mapę otoczenia, więc przy pełnej intensywności otoczenia scena była płaska i bez cieni (`debug_noenv.png` pokazuje, że cienie działały). Rozwiązanie: udział otoczenia 0,35, słońce 3,5 — to są parametry w `CONFIG.sun`.

Dwa warianty budowy tej samej sceny (jeden kod, dwa moduły ładowania zasobów):
- `demo/` — pliki KTX2 + meshopt, do hostowania na GitHub Pages (32 MB, tekstury w pamięci GPU skompresowane).
- `demo_artifact/dziedziniec.html` — jeden plik 14,5 MB ze wszystkim w base64, tekstury JPG (KTX2 i meshopt wymagają WASM, którego Artifact nie może pobrać), do natychmiastowego testu na telefonie przez claude.ai. Na telefonie zajmie ~5× więcej pamięci GPU niż wariant KTX2. Pułapka znaleziona na telefonie Piotra: piaskownica Artifactu blokuje `fetch` do adresów `data:` i `blob:`, a loadery three.js pobierają nimi nawet zasoby wpisane w stronę („Failed to fetch”). Wariant inline przechwytuje więc `fetch` i obsługuje te adresy w JS; sprawdzone lokalnie pod CSP `connect-src 'self'; img-src 'self'` (`testy/test_artifact_csp.js`). Opublikowany: https://claude.ai/code/artifact/bc051dfc-49fc-49b2-adb6-eb7f49d0074a

Sterowanie: joystick dotykowy (lewa część ekranu) + przeciąganie (rozglądanie), kolizje z murami i obiektami. Trzy poziomy jakości do przełączenia na telefonie. HUD z FPS, p95 czasu klatki, draw calls, trójkątami i nazwą GPU — to z niego Piotr odczyta pierwszy prawdziwy pomiar.

Zrzuty z renderu headless: `testy/out/render/phone_high_*.png`. Ocena wyglądu na ich podstawie:
- Dobrze: cegła i kamień z bliska mają relief z map normalnych, marmur popiersia ma wiarygodny połysk i cienie własne, drewno stołu ma słoje i odbicia. Skala tekstur zgadza się z rzeczywistością (cegły ok. 25 cm).
- Dobrze: cienie stołu, beczki i popiersia padają na posadzkę zgodnie ze słońcem z HDRI; mur po przeciwnej stronie jest w cieniu, oświetlony tylko niebem.
- Słabo: brak wypalonego oświetlenia pośredniego (róg murów w cieniu jest płaski, bez odbicia światła od posadzki), brak AO kontaktowego pod obiektami, niebo z HDRI 1k jest miękkie. Posadzka jest zbyt jednorodna (jedna tekstura powtórzona 7×), a jej mapa normalnych daje słaby relief.
- To jest poziom „dobra wizualizacja architektoniczna w czasie rzeczywistym”, nie fotorealizm.

## 6. Decyzja

**Rekomendowany zestaw:**
1. **three.js (WebGL2, `WebGLRenderer`)** jako silnik. Uzasadnienie: jedyny sprawdzony w działaniu, MIT, wszystko potrzebne (PBR, IBL, KTX2, meshopt, lightmapy) jest w pakiecie, WebGL2 działa na każdym Androidzie. WebGPU odkładam: na Androidzie są znane awarie w trybie compat, a zysk dla tej sceny jest żaden.
2. **Poly Haven + ambientCG (CC0)** jako źródła zasobów, z Smithsonian/GSO na skany. Zero problemów licencyjnych w publicznym repo.
3. **gltf-transform + toktx** jako pipeline kompresji (meshopt, ETC1S kolor, UASTC normalne). Sprawdzony, skryptowalny (`demo/build_assets.sh`).
4. **Blender bpy** do wypalania AO i lightmap na CPU. Sprawdzony na małym przykładzie; pełna scena to zadanie na następny etap.
5. **Chromium headless** do testów poprawności i zrzutów, **telefon Piotra** do pomiaru wydajności.

**Jaki poziom grafiki jest realnie osiągalny:** oświetlenie liczone offline (Cycles) wypalone do lightmap i AO + materiały PBR ze skanów + IBL z HDRI + jedno słońce z cieniem, w rozdzielczości renderowania 1–1,5× CSS px, MSAA 4×. To daje wygląd zbliżony do wizualizacji wnętrz i dobrych viewerów produktowych. Nie daje: globalnego oświetlenia w czasie rzeczywistym, odbić ekranowych, wielu dynamicznych świateł z cieniami, postprocesu w pełnej rozdzielczości. Fotorealizm w sensie „nie odróżnić od zdjęcia” na telefonie w WebGL2 nie jest osiągalny; osiągalny jest „wiarygodny materiał oglądany z bliska w statycznym świetle”.

**Największe ograniczenie:** brak pomiaru z prawdziwego telefonu. Wszystko, co zdecyduję o jakości (rozdzielczość cieni, DPR, ile trójkątów, czy stać nas na SSAO), zależy od jednej liczby, której tu nie ma.

**Najbardziej wartościowy następny krok:** uruchomić `demo/` na telefonie Piotra i odczytać HUD (FPS, p95, GPU) w trzech poziomach jakości. Do tego potrzebne jest jedno z dwóch działań Piotra:
- upublicznić repo i włączyć GitHub Pages (Settings → Pages → branch `claude/repo-cleanup-q1fkk3`, folder `/demo` lub root), albo
- podać mi inny hosting statyczny (Netlify/Cloudflare Pages — darmowe, ale wymagają konta).

Po pomiarze: wypalenie lightmap całej sceny w Blenderze (róg murów, cień pod stołem, kontakt kamieni z posadzką) — to jest krok, który da największy skok wyglądu przy zerowym koszcie na telefonie.

## 6a. Pierwszy pomiar na telefonie Piotra (Galaxy S24, Samsung Xclipse 940, Chrome, ANGLE/Vulkan)

| Scena | Jakość | FPS | p95 | Draw calls | Trójkąty |
|---|---|---|---|---|---|
| Rynek (bez instancjonowania, tekstury JPG) | medium (DPR 1,5, 540×961) | 60 | 16,8 ms | 199 | 429 k |
| Rynek (z instancjonowaniem, obraz uszkodzony) | medium | 41–60 | 17–33 ms | 152–166 | 831–865 k |

Dwa błędy sterownika znalezione bisekcją na urządzeniu (przełączniki `?noinst=1`, `?tex=jpg` itd. w URL):
1. **KTX2 dekoduje się na czarno** (GPU zgłasza ASTC/ETC2/S3TC, ale wynik jest czarny). Obejście: tekstury JPG wybierane automatycznie po nazwie GPU. Koszt: kilka razy więcej pamięci GPU na tekstury.
2. **InstancedMesh psuje rendering po obrocie kamery** — po zmianie kolejności rysowania zwykłe siatki dostają macierze instancji i rozciągają się w wielkie trójkąty. Obejście: zwykłe klony zamiast instancji na tym GPU. Koszt: 158 → 199 draw calls; na S24 nadal 60 fps.

Wniosek ogólny: pomiar na telefonie był niezbędny — żaden z tych błędów nie występuje w headless Chromium ani nie wynika z dokumentacji.

## 6b. Etap 2 — rynek dopracowany jako pierwsza scena gry (2026-09-08)

Scena `rynek/` przeszła Etap 2: 15 motywów (wieża okrągła, zróżnicowanie kamienic, lukarny i szczyty, wykusze, portale i szyldy, paleta OKLCH z okiennicami, fontanna wielopoziomowa ze strumieniami, girlandy z lampionami, lipy i zieleń, role kramów, bruk z medalionem, panorama z mgłą i bramami, kompozycja startu, UI), potem dwie rundy krytyki adwersarialnej i poprawki. Reguły pracy: `rynek/PROMPT.md`.

Pomiar headless (SwiftShader = CPU serwera, 824×1830, quality high; FPS NIE jest miarą telefonu):

| widok | draw calls | trójkąty (HUD) | errors |
|---|---|---|---|
| start_plac / start_v2 | 114 | 599 991 | [] |
| fontanna_zblizenie | 104 | 560 227 | [] |
| kram_zblizenie | 107 | 578 223 | [] |
| pierzeja_wschodnia | 90 | 511 529 | [] |
| ulica_poludnie | 83 | 425 629 | [] |
| ten sam widok w trybie telefonu (`?noinst=1`) | ok. 122 | ok. 250 000 | [] |

Limity z `PROMPT.md` §2: 250 draw / 700 000 trójkątów w HUD (HUD liczy podwójnie: przebieg cieni + główny; zmierzony stosunek 2,05). Wszystkie widoki mieszczą się w limicie w obu trybach.

Co dołożyły narzędzia weryfikacji (§8 promptu): `engine/src/check.js` (asercje geometryczne trafiające do `results.errors`), test numeryczny `audyt/testy/geo_test.sh` (asercje A–K na prawdziwych modułach sceny, bez przeglądarki), widoki diagnostyczne `?top=`/`?side=`/`?boxes=1`, lineup materiałów `?lineup=1`, maska ról `?roles=1`, sondy koloru `tools/color_probe.mjs`, `measure_render.mjs`, `hist_chroma.mjs`, `hist_roles.mjs`, porównanie zrzutów `img_diff.mjs`, predyktor palety `palette_predict.mjs`/`agx_predict.mjs`.

Zasoby: 17 nowych modeli CC0 z Poly Haven w obu wariantach (KTX2/meshopt i JPG) — `audyt/research/zasoby_etap2.md`, licencje w `audyt/research/licencje_zasobow.md`. Strona Artifactu 15,4 MB z limitu 16 MB (próg ostrzegawczy 15,0 MB wpisany w `demo_artifact/build_artifact.mjs`).

Znane braki po Etapie 2 (świadomie zostawione): gradient w oknach `glassLit` (jednolite prostokąty w zbliżeniu), bele sukiennika poza kadrem startowym, ulica południowa uboga w rekwizyty, chroma wody i patyny posągu poniżej celu predyktora (L zmierzone w normie), rundy 3 krytyki nie było — limit modelu przerwał dwóch krytyków rundy 2.

### Poprawki po zrzutach z telefonu Piotra (druga tura)

| co było widać na zrzucie | przyczyna w kodzie | poprawka | jak sprawdzone |
|---|---|---|---|
| podpis „Kram sukiennika" wisiał, choć kramu nie było w kadrze | `initCaption` wybierał POI wyłącznie po odległości `d/r`; telefon w pionie ma poziome pole widzenia ≈ 36°, więc miejsce 90° w bok jest blisko, ale niewidoczne | `poiInView(p, q, halfHFov, slack)` w `rynek/src/ui.js`: kąt do POI ≤ połowa POZIOMEGO fov + `asin(own/d)` + `CONFIG.ui.captionSlack` (6°) | test U2 w `geo_test.sh` (wprost/tyłem/bokiem dla każdego POI) + zrzuty z Playwrighta: yaw 0° i 30° → podpis, 90° → brak |
| liny girland jak czarne kable na tle nieba | lina i sznurki lampionów szły na materiale `iron` (metalness 0,9, tint L 0,30) | nowy materiał `rope` (konopie, OKLCH 0,58 / 0,040 / 78, roughness 0,95, metalness 0) w `materials.js`, użyty w `bunting.js` | render `start_plac` przed/po; +2 draw calle (115 → 117 z limitu 250) |
| bele sukiennika jak plastikowe rury (a wcześniej jak klocki) | walec bez detalu: denko to płaski wielokąt bez cieniowania, pięć sztuk w równej kracie | drewniany wałek (`bale.core`, klucz `timber`) wystający 9 cm z obu końców, `seg` 12 → 14, obrót ±0,10 rad i skrócenie do 12 % na rolkę z własnego strumienia rng | `geo_test.sh` OK (asercje spodu, podpór, zasięgu w x); zbliżenie 2,5 m od lady |

Wariant odrzucony po renderze: rolki **w poprzek** lady (długość 1,8 m wzdłuż x). Z 2 m czytały się gorzej niż wzdłuż — zlewały się w poziome pasy koloru bez sylwetki. Zapisane w komentarzu przy `goods.bale` w `config.js`, żeby nikt nie próbował drugi raz.

Co nadal jest słabe w tym zbliżeniu (nie ukrywam): rolki sukna wciąż czytają się bardziej jak zwoje papieru niż tkanina — denka są dużymi płaskimi plamami koloru w pełnym słońcu, a faktura tkaniny na nich prawie nie pracuje. Zmierzone chromy są w normie palety (C 0,068–0,115 przy tle lady C 0,014), więc to nie kwestia „za jaskrawych" kolorów, tylko braku detalu na denku.

## 7. Co wymaga działania Piotra i co to odblokuje

| Działanie | Odblokowuje |
|---|---|
| Upublicznienie repo + włączenie GitHub Pages | link do gry na telefon, pierwszy prawdziwy pomiar |
| Token Hugging Face (Free) jako `HF_TOKEN` w środowisku sesji lub poprawa ustawienia konektora HF (`gradio`) | 5 min ZeroGPU dziennie: FLUX (tekstury, skyboxy), TRELLIS/TripoSR (image-to-3D, MIT) |
| Token Sketchfab | pobieranie skanów CC0 ze Sketchfaba |
| Konto Epic (Fab) | rotujące darmowe Megascans — ręcznie, bez API |
| Własny laptop Piotra (RTX 5000) | lokalnie Blender GPU (lightmapy w sekundach zamiast minut), TRELLIS/SDXL bez limitów |

## 8. Pliki

- `RAPORT.md` — ten dokument
- `research/silniki.md`, `research/zasoby_i_ai.md`, `research/limity_mobile.md` — raporty agentów researchowych ze źródłami
- `research/licencje_zasobow.md` — licencje wszystkiego, co jest w demo
- `testy/webgl_probe.js` — test WebGL2 w headless Chromium
- `testy/bpy_bake_test.py` — test Blendera (import, bake AO, eksport)
- `testy/render_demo.js` — render sceny demo, zrzuty i pomiary
- `testy/out/` — wyniki (zrzuty, JSON, logi buildów)
- `assets_src/` — surowe zasoby Poly Haven (CC0) + skrypt pobierania
- `../demo/` — scena demo
- `../CEL.md` — plik celu projektu (do wypełnienia z Piotrem)
