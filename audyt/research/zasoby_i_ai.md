# Research: darmowe źródła zasobów 3D i generowanie AI (agent researchowy, 2026-09-07)

Legenda: **[V]** = zweryfikowane pobraniem z oficjalnego źródła w tej sesji, **[P]** = z pamięci / niezweryfikowane, **[V*]** = częściowo zweryfikowane. Poly Haven i anonimowe ZeroGPU zweryfikowane osobno w testach (patrz RAPORT.md).

## 1. Tekstury PBR i modele

| Źródło | Typ | Licencja | Atrybucja | API bez logowania | Weryfikacja |
|---|---|---|---|---|---|
| **ambientCG** | PBR tekstury, HDRI, modele | CC0 | nie | **TAK** `GET https://ambientcg.com/api/v2/full_json?type=Material&limit=N&include=downloadData` → `foundAssets[].downloadFolders.default.downloadFiletypeCategories.zip.downloads[]` (`downloadLink` = `https://ambientcg.com/get?file=Ground110_1K-JPG.zip`); 1K–8K, JPG/PNG | **[V]** JSON pobrany, 2009 materiałów |
| **Sketchfab** | modele glTF/GLB/USDZ | per model: CC0 / CC-BY / CC-BY-NC… | wg CC | Wyszukiwanie TAK: `GET https://api.sketchfab.com/v3/models?downloadable=true&license=cc0&count=24`. **Pobranie NIE**: `/v3/models/{uid}/download` → 401 (OAuth2/token) | **[V]** |
| **Quixel Megascans / Fab** | skany PBR | Fab Standard License | nie | **NIE** — konto Epic + EULA, pobieranie przez Fab/Bridge; brak publicznego API. „Claim all” darmowe zakończone 31.12.2024; dziś rotujące darmowe assety | **[V*]** |
| **Smithsonian 3D Open Access** | skany muzealne (GLB/OBJ) | CC0 (~3 500 obiektów, filtr `media_usage:CC0`) | nie | **TAK**: `https://api.si.edu/openaccess/api/v1.0/search?q=...&api_key=DEMO_KEY`; pliki: `https://3d-api.si.edu/content/document/<pkg-id>/document.json` | **[V]** search 200 |
| **NASA 3D Resources** | modele OBJ/FBX/BLEND | public domain (bez sugerowania endorsementu) | nie | **TAK** (GitHub raw `nasa/NASA-3D-Resources`) | **[V]** |
| **Kenney.nl** | low-poly kity | CC0 | nie | brak API; ZIP-y bez logowania | **[V]** |
| **Khronos glTF-Sample-Assets** | modele testowe | per model (większość CC0/CC-BY) | zależnie | **TAK**: `raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/model-index.json` | **[V]** |
| **cgbookcase** | PBR tekstury | CC0 | nie | brak API | **[V]** |
| **ShareTextures** | PBR tekstury + modele | CC0 | nie | brak API | **[V]** |
| **3Dassets.one** | agregator | wg źródła | wg źródła | brak własnego API | **[V]** |
| **FreePBR** | PBR tekstury | własna: darmowo tylko niekomercyjnie; komercyjnie 21 USD | – | brak | **[V]** |
| **Textures.com** | tekstury/skany | własna; free = małe rozmiary; **zakaz wydania pod licencją open source** (istotne przy publicznym repo) | nie | **NIE** — konto + dzienne kredyty | **[V]** |
| **Blender demo files** | sceny .blend | per plik CC0 lub CC-BY | dla CC-BY | bezpośrednie linki | **[V]** |
| **BlenderKit** | modele/materiały/HDRI | Royalty Free lub CC0; free plan = podzbiór | nie | Wyszukiwanie TAK (`/api/v1/search/`); **pobranie NIE** (403 bez API key) | **[V]** |

## 2. Skany fotogrametryczne

| Źródło | Licencja | Bez logowania | Weryfikacja |
|---|---|---|---|
| Sketchfab CC0 | CC0 per model | search tak / download nie (401) | **[V]** |
| Scan the World (MyMiniFactory) | miks CC0 / CC-BY-NC; STL (gęste siatki do druku) | strona 403 dla botów | **[V*]** |
| Objaverse (allenai/objaverse, HF) | dataset ODC-By; obiekty głównie CC-BY 4.0 (721 k), część NC — licencja w metadanych | TAK (nie-gated), setki GB | **[V]** |
| Objaverse-XL | ODC-By; licencje per obiekt nieujednolicone | TAK, wymaga narzędzia `objaverse` | **[V]** |
| Google Scanned Objects | CC-BY 4.0 (~1 000 obiektów, OBJ+tekstury) | **TAK**: `https://fuel.gazebosim.org/1.0/GoogleResearch/models?page=1&per_page=N` | **[V]** |
| Poly Haven models / ambientCG models | CC0 | tak | **[V]** |

## 3. Generowanie AI — licencje wyjścia, limity

| Narzędzie | Licencja modelu / output | Darmowy limit | Login/token | Weryfikacja |
|---|---|---|---|---|
| **Hunyuan3D-2.1** | Tencent Community License: **nie obowiązuje w UE, UK, Korei Płd.** (§1.l Territory; §5.c dotyczy także Output). Dla dewelopera w Polsce formalnie brak licencji nawet na output | wagi otwarte | nie (do wag) | **[V]** pełny tekst LICENSE |
| **TRELLIS (microsoft)** | MIT — output bez ograniczeń | wagi bez tokena | nie | **[V]** |
| **Stable Fast 3D** | Stability Community License: darmowo <1 M USD przychodu; wagi gated | – | TAK | **[V]** |
| **TripoSR** | MIT | wagi bez tokena | nie | **[V]** |
| **Meshy** | Free: 100 kredytów/mies., output **CC BY 4.0** (kredyt dla Meshy); płatne = pełna własność | 100 kr./mies. | TAK | **[V]** |
| **Tripo** | Free: 200 kredytów/mies., **tylko niekomercyjnie** | 200 kr./mies. | TAK | **[V]** |
| **Rodin / Hyper3D** | Free: eksport ograniczony; pełny eksport od planu Creator | – | TAK | **[V]** |
| **Poly (withpoly.com)** | serwis zmienił profil, generator tekstur PBR niedostępny | – | – | **[V]** |
| **MatForger (HF gvecchio)** | brak tagu licencji (prawdopodobnie research/NC) | lokalnie | – | **[V*]** |
| **Material Anything (3DTopia)** | MIT (kod) | lokalnie (GPU) | nie | **[V]** |
| **Dream Textures (Blender addon)** | GPL-3.0; output wg modelu SD | lokalnie | nie | **[V]** |
| **FLUX.1-schnell** | Apache-2.0 (output komercyjny OK); repo HF gated=auto (token) | ZeroGPU / kredyty | TAK do wag | **[V]** |
| **FLUX.1-dev** | wagi non-commercial | – | TAK | **[V*]** |
| **SDXL base 1.0** | OpenRAIL++-M, output komercyjny OK; wagi bez tokena | lokalnie | nie | **[V]** |
| **Blockade Labs Skybox AI** | Free: 5 generacji, tylko podgląd, **bez eksportu**; HDRI od planu Standard 48 USD | 5 | TAK | **[V*]** |
| **DiffusionLight (HDRI z obrazu)** | MIT | lokalnie (SDXL) | nie | **[V]** |
| **HF Inference Providers** | Free: 0,10 USD/mies. kredytów; PRO 2 USD/mies. + PAYG | – | TAK | **[V]** |
| **HF ZeroGPU** | dziennie: anonim 2 min, Free 5 min, PRO 40 min; Free wymaga tokena | – | TAK | **[V]** |

## 4. Narzędzia headless (Linux)

| Narzędzie | Licencja | Instalacja | Weryfikacja |
|---|---|---|---|
| pymeshlab | GPL-3.0 | `pip install pymeshlab` | **[V]** |
| Instant Meshes | BSD-3 | build CMake | **[V]** |
| xatlas | MIT (`pip install xatlas`, `npm i xatlas-web`) | pip/npm | **[V]** |
| gltfpack / meshoptimizer | MIT (`npm i gltfpack`) | npm | **[V]** |
| Materialize | GPL-3.0, Unity/Windows — nie headless | – | **[V]** |
| ArmorPaint | źródło open (zlib), binarki 19 USD | build ze źródeł | **[V*]** |
| Substance 3D | płatne (Adobe) | – | [P] |

## Wnioski agenta

1. Bez logowania, pełny pipeline JSON→plik: ambientCG, Poly Haven, Khronos raw, Smithsonian (DEMO_KEY), Google Scanned Objects, NASA GitHub, Objaverse. Sketchfab i BlenderKit — tylko wyszukiwanie.
2. Pułapki licencyjne: Hunyuan3D-2.1 nielicencjonowany w UE (także output); Tripo Free = niekomercyjnie; Meshy Free = CC-BY; FreePBR = niekomercyjnie; Textures.com zabrania open-source'owania; SF3D gated + limit przychodu.
3. Najbezpieczniej dla gry w publicznym repo: CC0 (ambientCG, Poly Haven, Kenney, cgbookcase, ShareTextures, Smithsonian CC0) + AI z TRELLIS/TripoSR (MIT) i SDXL/FLUX-schnell (własne GPU lub token HF).
4. Skyboxy AI za darmo praktycznie nie istnieją (Blockade bez eksportu) — HDRI Poly Haven (CC0) albo lokalnie DiffusionLight/SDXL.
