# Research: silniki 3D w przeglądarce (agent researchowy, 2026-09-07)

Legenda: **[V]** = zweryfikowane przez pobranie oficjalnego źródła w dniu audytu; **[M]** = z pamięci, nie re-weryfikowane.

## Platforma [V]
- **WebGPU na Android Chrome**: domyślnie od Chrome 121 (Android 12+, GPU Qualcomm/ARM) — https://developer.chrome.com/blog/new-in-webgpu-121 ; caniuse: Chrome Android 152 i Samsung Internet 24+ wspierają, Firefox Android wyłączone — https://caniuse.com/webgpu . Zastrzeżenie [V]: three.js issue #33601 (maj 2026): urządzenia w „compat mode” Chrome 171 zgłaszają WebGPU i się wywalają; aplikacja musiała wymusić WebGL2. Wniosek: trzymać ścieżkę WebGL2.
- **GitHub Pages**: brak COOP/COEP → brak SharedArrayBuffer/wątków, chyba że `coi-serviceworker` (MIT, własny origin, jeden reload; https://github.com/gzuidhof/coi-serviceworker). Dotyczy tylko wielowątkowych buildów Godot/Unity.

## Tabela

| Silnik | Wersja / data [V] | Licencja | CDN | WebGL2 / WebGPU | Ocena |
|---|---|---|---|---|---|
| three.js | 0.185.1, 2026-07-01 | MIT | cdnjs + jsdelivr | WebGL2; WebGPURenderer z automatycznym fallbackiem do WebGL2 | **najlepszy wybór** |
| Babylon.js | 9.25.0, 2026-09-03 | Apache-2.0 | jsdelivr `babylonjs@9.25.0/babylon.js` (8,3 MB) | oba; WebGPU „complete” | mocna alternatywa, cięższy |
| PlayCanvas engine | 2.22.0, 2026-09-04 | MIT | jsdelivr `playcanvas@2.22.0/build/playcanvas.mjs` | WebGL2; WebGPU beta z fallbackiem | dobry, praca bez edytora jest kodochłonna |
| Godot 4 | 4.7.2, 2026-08-18 | MIT | własny hosting wasm | **tylko WebGL2** (Compatibility); brak WebGPU | słaby do fotorealizmu w webie |
| Unity 6 | 6.3 LTS | Personal free <200k USD | — | WebGL2; WebGPU eksperymentalne | działa, ale ciężki build (20–40 MB+) |
| Unreal | 5.8 | — | — | tylko Pixel Streaming | nie jest stroną statyczną |
| Filament (JS) | GitHub 1.76.0, ale npm `filament` 1.53.4 (2024-08) | Apache-2.0 | jsdelivr filament@1.53.4 | WebGL2 | niszowy, przestarzały npm |
| Wonderland | api 1.6.1 | własnościowa; free <120k USD/rok, potem 10% | npm | WebGL2 | pod XR, branding na ekranie ładowania |
| Needle Engine | 5.1.12 | własnościowa; free niekomercyjnie z logo, Pro 49 EUR/mies. | npm | WebGL2 (na three.js) | hobby OK, z logo |
| Rogue Engine | — | free Personal <80k USD | edytor | na three.js | edytor do three.js |
| Spline | — | free z watermarkiem | — | — | narzędzie designerskie, nie silnik |

## Fakty per kandydat

### three.js [V]
- npm `three@0.185.1` MIT; `build/three.webgpu.js` na jsdelivr. `forceWebGL` w WebGPURenderer wymusza backend WebGL2; bez tego sprawdza `navigator.gpu.requestAdapter` i automatycznie spada do WebGL.
- Dekodery: `https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/` (`basis_transcoder.js`, `.wasm` 527 KB), `.../libs/draco/gltf/` (`draco_decoder.wasm` 192 KB), `libs/meshopt_decoder.module.js`.
- GLTFLoader: KHR_materials_clearcoat, sheen, transmission, volume, ior, iridescence, anisotropy, dispersion, specular, emissive_strength, KHR_texture_basisu, KHR_draco_mesh_compression, EXT_meshopt_compression, EXT_texture_webp/avif.
- Przykłady realizmu w `examples/files.json`: `webgl_materials_physical_clearcoat`, `_transmission`, `webgl_loader_gltf_transmission/sheen/iridescence/anisotropy`, `webgpu_materials_lightmap`, `webgl_shadowmap_csm`, `webgl_shadowmap_pcss`, `_vsm`, `webgl_postprocessing_ssao/gtao/ssr`, `webgpu_postprocessing_ssr(_denoise)`, PMREM, `webgl_loader_texture_ktx2`, `_hdr/ultrahdr`. Węzły post TSL: GTAO, SSR, SSGI, Bloom, TRAA, FXAA, SMAA.
- Sterowanie dotykowe: brak wbudowanego FPS na dotyk (`PointerLockControls`, `FirstPersonControls` są pod mysz). Standard: nipplejs (npm 1.0.4, MIT; cdnjs `nipplejs/1.0.4/index.js`) + przeciąganie do rozglądania.
- Mobile: WebGPURenderer miał poprawki pod Androida (Adreno shadow compare PR #32548, regresja CPU na Pixel 8a #32675). WebGL2 pozostaje bezpieczniejszy na nieznanym sprzęcie.

### Babylon.js [V]
- 9.0 (2026-03-26): Frame Graph v1, Clustered Lighting, Volumetric lighting, OpenPBR alpha, **Dynamic IBL Shadows** (`IblShadowsRenderPipeline`; dokumentacja ostrzega, że wokselizacja jest droga na WebGL2).
- WebGPU: `new WebGPUEngine(canvas); await engine.initAsync()`; fallback do `Engine` trzeba napisać samemu.
- CSM: `CascadedShadowGenerator` (1–4 kaskady); PBRMaterial z clearcoat/sheen/iridescence/subsurface [M]; SSAO2, SSR, bloom [M].
- Loader glTF: dekodery Draco/Meshopt/KTX2 domyślnie z `cdn.babylonjs.com`, konfigurowalne na własny origin.
- Dotyk: `UniversalCamera` obsługuje dotyk; `VirtualJoysticksCamera`.

### PlayCanvas engine [V]
- WebGPU (beta) z automatycznym fallbackiem WebGL2. Clearcoat, anisotropy, sheen, transmission; IBL/HDR; SSAO, TAA, bloom, DoF (CameraFrame); runtime lightmapper; cienie PCF1/3/5, VSM, PCSS, kaskady 1–4. Brak SSR. Parsery Basis/KTX2/Draco/Meshopt w pakiecie.
- Dotyk FPS: `scripts/esm/camera-controls.mjs` z `mobileInputLayout` (joystick).

### Godot 4.7.2 [V]
- Web = tylko renderer Compatibility (WebGL2); „Godot currently does not support WebGPU”. Brak SDFGI/VoxelGI/SSR/SSAO z Forward+.
- Eksport jednowątkowy domyślnie od 4.3 (bez SAB, wymaga HTTPS). Wielowątkowy wymaga COOP/COEP (opcja PWA w eksporcie albo coi-serviceworker).
- Rozmiar ~40 MB wasm (ok. 5 MB Brotli). Mobile „z zastrzeżeniami”, znacznie wolniej niż natywnie.

### Unity 6 [V]
- Web oficjalnie wspiera mobilne przeglądarki od 6.0 (Chrome 58+ na Androidzie, wymaga WebGL2). WebGPU eksperymentalne. Personal free <200k USD, splash opcjonalny. Wady [M]: 20–40 MB+ build, presja na pamięć telefonu.

### Unreal [V]
- Eksport HTML5 zakończony na 4.24; web = Pixel Streaming (GPU serwera, WebRTC). Odrzucony.

### Filament JS [V]
- npm `filament` ostatnio 1.53.4 (sierpień 2024), GitHub v1.76.0. Własny build przez Emscripten. Nie polecany dla hobby.

## Rekomendacja agenta
three.js 0.185.1 z `WebGLRenderer` (gwarancja zgodności z Androidem) albo `WebGPURenderer` z detekcją i `forceWebGL`; MeshPhysicalMaterial + PMREM z HDRI + wypalone lightmapy/AO + CSM/PCSS; dekodery KTX2/Draco/meshopt na własnym originie; nipplejs lub własny joystick. Drugi wybór: Babylon.js 9 (IBL shadows, Frame Graph, większy bundle). Trzeci: PlayCanvas. Godot/Unity/Filament/Unreal — słabe dopasowanie do hostingu i urządzenia.
