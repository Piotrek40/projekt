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
- `demo_artifact/dziedziniec.html` — jeden plik 14,5 MB ze wszystkim w base64, tekstury JPG (KTX2 i meshopt wymagają WASM, którego Artifact nie może pobrać), do natychmiastowego testu na telefonie przez claude.ai. Na telefonie zajmie ~5× więcej pamięci GPU niż wariant KTX2.

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
