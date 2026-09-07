# Research: limity i dobre praktyki 3D w Chrome na Androidzie (agent researchowy, 2026-09-07)

Legenda: **[F]** = zweryfikowane pobraniem źródła, **[S]** = potwierdzone tylko snippetem z oficjalnej domeny, **[M]** = z pamięci/doświadczenia.

## 1. Ograniczenia GPU na Androidzie

| Parametr | Stan | Źródło |
|---|---|---|
| `MAX_TEXTURE_SIZE` (WebGL2) | Android: 4096 = 100% urządzeń, 8192 = 73%, 16384 = ~2–3%. **Projektować pod 4096.** | [F] web3dsurvey.com |
| Budżet pamięci na kartę | Brak oficjalnej liczby. Chrome Android traci kontekst WebGL przy GPU-OOM. Praktyka: **~150–250 MB tekstur+RT mid-range, <400 MB flagship**. | [F] webgl-dev-list; [M] budżety |
| ETC2/EAC | Android 99,96% w WebGL2 | [F] web3dsurvey |
| ASTC | Android 99,61%, iOS 99,87%, Windows 2,5% | [F] web3dsurvey |
| KTX2 | KTX2Loader transkoduje ETC1S/UASTC do ASTC/ETC2/BC wg `detectSupport`; ETC1S → ETC1/ETC2 bezpieczna ścieżka | [F] three.js KTX2Loader, Khronos KTXDeveloperGuide |
| `EXT_color_buffer_float` | Android 99,82% | [F] web3dsurvey |
| WebGPU Chrome Android | domyślnie od Chrome 121 (Android 12+, Adreno/Mali); **Compatibility mode** od Chrome 146 (02/2026) z ograniczeniami; 23% Androida bez Vulkan 1.1 | [F] developer.chrome.com/blog/new-in-webgpu-146, blink-dev |
| three.js a WebGPU | `WebGPURenderer` spada sam do WebGL2; `EffectComposer`/`ShaderMaterial` w nim nie działają; `WebGLRenderer` wspierany, bez nowych dużych funkcji | [F] threejs.org/manual webgpurenderer |

## 2. Liczby dla 60 kl./s na mid-range Androidzie

- **Draw calls:** PlayCanvas: 100–200 dla low-end mobile [F]. Praktycznie **≤150 mid-range, ≤300 flagship** [M].
- **Trójkąty:** Qualcomm: każdy trójkąt ≥4 piksele (LOD) [S]. Bezpiecznie **300–500k tri/klatkę mid-range, ~1M flagship** [M].
- **Fill-rate / DPR:** telefon DPR=3 przy 412×915 to 3,4 Mpx — więcej niż 1080p na GPU 10–20× słabszym. PlayCanvas zaleca `maxPixelRatio` wg tieru [F]. Praktyka: `setPixelRatio(min(dpr, 1.5–2))` [M].
- **Overdraw:** GPU tile-based; każdy pass post-processingu = pełny store+load ekranu do DRAM [F] blog ARM.
- **MSAA vs FXAA:** na tile-based **MSAA 4× niemal darmowe** (Mali ≤10% kosztu; Adreno w tile memory) [S]. FXAA/SMAA tylko gdy post-pipeline zabija MSAA.
- **Cienie:** 1 DirectionalLight, mapa 1024² (2048² flagship), `PCFShadowMap`. **`PCFSoftShadowMap` deprecated od r186** [F] three.js constants.js.
- **SSAO/GTAO:** 5–10 ms na Mali-G5x w natywnej rozdzielczości; N8AO half-res 2–4× szybciej [F]. Na mid-range **wypiekać AO** zamiast SSAO.
- **Anizotropia:** ARM: 8× AF = 8× koszt bilinear; zacząć od 2, włączać tylko na podłogach [S].
- **Post-processing:** bloom OK w half/quarter res; DoF, SSR, motion blur nie na mid-range [F] PlayCanvas; [M].

## 3. Tanie techniki realizmu

1. **Lightmapy z Blendera (Cycles bake):** Combined (Direct+Indirect, Diffuse) lub Diffuse bez Color; wymaga UV i obrazu docelowego [F] docs.blender.org. three.js `lightMap` na `uv1` (`TEXCOORD_1`), `aoMap` czyta kanał R [F] MeshStandardMaterial.js. Bruno Simon „My Room in 3D” = całość wypieczona + `MeshBasicMaterial` [F].
2. **IBL/PMREM z HDRI:** wzorzec `webgl_loader_gltf` (DamagedHelmet + HDR) [F]. HDRI 1k–2k wystarczy.
3. **Tone mapping:** `AgXToneMapping` (impl. Filament/Blender), `ACESFilmic`, `Neutral`; koszt pomijalny [F].
4. **Kontaktowe cienie / AO:** wypiec AO do `aoMap`; blob-shadow lub ContactShadows [F]/[M].
5. **Kompresja tekstur:** ETC1S dla koloru, UASTC dla normal/roughness (Khronos) [F]; pamięć GPU 4–8 bpp zamiast 32. WebP/AVIF = mniejszy download, ale pełne 32 bpp w VRAM.
6. **Geometria:** meshopt dekoduje rzędy wielkości szybciej niż Draco (Sponza 262k tri: 1,9 ms vs 169 ms desktop) [F] gist zeux; Draco lepszy ratio 10–30%.
7. **LOD:** `THREE.LOD` lub `simplify` z gltf-transform.

## 4. Profilowanie na Androidzie

- **Remote DevTools:** USB debugging → `chrome://inspect#devices` [F].
- **`renderer.info`** — draw calls, trójkąty, pamięć [M].
- **stats-gl:** czas GPU przez `EXT_disjoint_timer_query_webgl2`; na Mali bywa zablokowane [F]/[M].
- **Spector.js:** rozszerzenie nie działa na mobile; wstrzyknięcie biblioteki do strony działa [S].
- **Android GPU Inspector / Arm Performance Studio / Snapdragon Profiler:** proces Chrome nie jest widoczny (sandbox) [F] gpuweb #5550.
- **Perfetto:** system trace z „Chrome probe”; GPU frequency, frame timeline [F].
- Praktyka [M]: testować po 5 min (throttling termiczny zbija 30–50%).

## 5. Reality check „fotorealizmu”

- Co działa na telefonach: `webgl_loader_gltf`, `<model-viewer>` (PMREM, KTX2, bez cieni real-time poza blobem), Sketchfab (SSAO/SSR wyłączane na mobile), Bruno Simon (bake), Lusion (pre-kalkulowane mapy, osobne lżejsze assety na mobile) [F]/[M].
- Wspólny mianownik: 1 bohater-model + HDRI + wypieczone oświetlenie, ACES/AgX, KTX2, jedno światło kierunkowe, brak GI/SSR/SSAO real-time.
- Szczera ocena [M]: „fotoreal” w WebGL2 na telefonie = **oświetlenie offline (Cycles) + PBR z IBL w czasie rzeczywistym**, 1–3 Mpx przy render-scale <1, MSAA 4×, jeden shadow map. Desktop RTX daje RT-GI, SSR, TAA, 8K tekstury, 10–50× fill-rate. Różnica jest w budżecie, nie w shaderach.

## Rekomendowany baseline (mid-range, three.js WebGLRenderer)

`setPixelRatio(min(dpr,1.5))`, `antialias:true`, ≤150 draw calls, ≤500k tri, KTX2 (ETC1S kolor / UASTC normal), tekstury ≤2048, lightMap+aoMap na UV2, `scene.environment` z PMREM (HDRI 1k), 1 DirectionalLight PCF 1024², AgX, bez EffectComposer; opcjonalnie tier „high” po pomiarze. GitHub Pages: gzip (bez Brotli), soft limit 100 GB/mies. — trzymać wejście poniżej ~20–30 MB [F] docs.github.com.

**Źródła:** web3dsurvey.com · developer.chrome.com/blog/new-in-webgpu-146 · blink-dev (Compat mode) · gpuweb Implementation-Status · KhronosGroup/3D-Formats-Guidelines KTXDeveloperGuide · three.js dev: KTX2Loader.js, MeshStandardMaterial.js, constants.js · threejs.org/manual webgpurenderer · developer.playcanvas.com · doc.babylonjs.com optimize_your_scene · developer.arm.com 101897 · docs.qualcomm.com 80-78185-2 · docs.blender.org cycles/baking · gltf-transform.dev/cli · gist zeux b48678a · N8python/n8ao · RenaudRohlinger/stats-gl · developer.chrome.com remote-debugging · perfetto.dev · gpuweb/gpuweb#5550 · docs.github.com pages limits.
