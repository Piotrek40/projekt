// Test sterownika pod NPC ze skinningiem (KROK 0 etapu 4). Rozstrzyga JEDNO pytanie: czy Xclipse 940 przez ANGLE
// poprawnie czyta teksturę kości. W three.js r185 macierze kości idą WYŁĄCZNIE przez `highp sampler2D boneTexture`
// (RGBAFormat + FloatType) czytaną przez texelFetch w VERTEX shaderze (skinning_pars_vertex.glsl.js:7-18,
// Skeleton.computeBoneTexture:243-263) — nie ma żadnego fallbacku na tablice uniformów. To samo urządzenie zepsuło
// już KTX2 (dekodowanie na czarno) i InstancedMesh, a ANGLE ma dla tagu GALAXYS24EXYNOS wyjątek na zepsute
// filtrowanie LINIOWE tekstur float. Dlatego nie zakładamy — mierzymy.
//
// T1/T2 są gołym WebGL2 bez three.js (izolacja: jeśli padnie T1, wina nie leży w silniku).
// T3/T4 idą prawdziwą ścieżką three.js, tą samą, którą pojedzie NPC.
import * as THREE from 'three';

const WYNIKI = [];
const el = id => document.getElementById(id);

// status: 'ok' | 'zle' | 'uwaga' — 'uwaga' nie blokuje etapu, 'zle' blokuje.
function wynik(nr, nazwa, status, detal) {
  WYNIKI.push({ nr, nazwa, status, detal });
  el('lista').innerHTML = WYNIKI.map(w =>
    `<div class="w ${w.status}"><b>${w.nr}</b> ${w.nazwa}<br><small>${w.detal}</small></div>`).join('');
}

// ---------- gołe WebGL2: czy RGBA32F przeżywa zapis i odczyt ----------
// Wartość 1 000 000 jest dobrana celowo: half float (16 bit) sięga 65 504, więc cicha degradacja do half
// zwróci Infinity albo 65 504 zamiast miliona i test to złapie. 0,5 sprawdza, że nie ma kwantyzacji do 8 bitów.
const PROBKA = new Float32Array([1000000, -1000000, 0.5, 1]);

function rawFloat(wVertexShaderze) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 4;
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return { ok: false, detal: 'brak kontekstu WebGL2' };
  const vtu = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
  if (wVertexShaderze && vtu < 1) return { ok: false, detal: `MAX_VERTEX_TEXTURE_IMAGE_UNITS = ${vtu} — vertex shader nie może czytać tekstur` };

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, PROBKA);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const errTex = gl.getError();
  if (errTex !== gl.NO_ERROR) return { ok: false, detal: `texImage2D(RGBA32F) zwrócił błąd GL 0x${errTex.toString(16)}` };

  // Trójkąt pełnoekranowy z gl_VertexID — bez bufora wierzchołków, żeby test nie zależał od niczego poza teksturą.
  const TEST = 'abs(v.r - 1000000.0) < 1.0 && abs(v.g + 1000000.0) < 1.0 && abs(v.b - 0.5) < 0.001';
  const vs = wVertexShaderze ? `#version 300 es
precision highp float;
uniform highp sampler2D t;
out float zgodne;
void main() {
  vec4 v = texelFetch(t, ivec2(0, 0), 0);
  zgodne = (${TEST}) ? 1.0 : 0.0;
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}` : `#version 300 es
precision highp float;
out float zgodne;
void main() {
  zgodne = 1.0;
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
  const fs = wVertexShaderze ? `#version 300 es
precision highp float;
in float zgodne;
out vec4 o;
void main() { o = vec4(zgodne, 0.0, 0.0, 1.0); }` : `#version 300 es
precision highp float;
uniform highp sampler2D t;
in float zgodne;
out vec4 o;
void main() {
  vec4 v = texelFetch(t, ivec2(0, 0), 0);
  o = vec4((${TEST}) ? 1.0 : 0.0, clamp(v.r / 2000000.0 + 0.5, 0.0, 1.0), 0.0, 1.0);
}`;

  const kompiluj = (typ, src) => {
    const s = gl.createShader(typ); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s).slice(0, 160));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, kompiluj(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, kompiluj(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog).slice(0, 160));
  } catch (e) { return { ok: false, detal: 'shader: ' + e.message }; }

  gl.useProgram(prog);
  gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.viewport(0, 0, 4, 4); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Uint8Array(4); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { ok: px[0] > 200, detal: `odczyt R=${px[0]} (255 = wartość przeżyła, 0 = zmieniona)`, vtu };
}

// ---------- three.js: siatka ze skinningiem, ta sama ścieżka co NPC ----------
// Wzorzec kości jak w oficjalnym przykładzie three (SkinnedMesh docs): korzeń na dole, po jednej kości na segment.
function zbudujSkinned(mat, segmenty, promienioweSeg, wysSeg) {
  const wys = segmenty * wysSeg;
  const geo = new THREE.CylinderGeometry(0.18, 0.18, wys, promienioweSeg, segmenty * 4, true);
  const poz = geo.attributes.position;
  const idx = [], wag = [];
  for (let i = 0; i < poz.count; i++) {
    const y = poz.getY(i) + wys / 2;                      // 0 na dole
    const k = Math.min(segmenty - 1, Math.floor(y / wysSeg));
    const t = Math.min(1, Math.max(0, y / wysSeg - k));
    idx.push(k, k + 1, 0, 0); wag.push(1 - t, t, 0, 0);   // 2 wpływy — limit glTF to i tak 4
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wag, 4));

  const kosci = [];
  let poprz = new THREE.Bone(); poprz.position.y = -wys / 2; kosci.push(poprz);
  for (let i = 0; i < segmenty; i++) {
    const b = new THREE.Bone(); b.position.y = wysSeg; kosci.push(b); poprz.add(b); poprz = b;
  }
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(kosci[0]); mesh.bind(new THREE.Skeleton(kosci));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;   // Skeleton liczy boundingSphere RAZ, w pozie spoczynkowej, i nigdy jej nie odświeża
  return { mesh, kosci, wys };
}

// Liczy piksele w pionowym pasie [x0, x1) (ułamki szerokości bufora), jaśniejsze albo ciemniejsze od progu.
// Zwraca liczbę bezwzględną — żadnego odejmowania od „sumy", bo przy pierwszym podejściu pomyliłem tę sumę
// (R*R*0.25 zamiast R*R*(x1−x0)) i asercja zwracała wartości ujemne, czyli mierzyła nic.
function policzPiksele(px, w, h, x0, x1, prog, ciemniejsze = false) {
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = Math.floor(x0 * w); x < Math.floor(x1 * w); x++) {
    const i = (y * w + x) * 4, suma = px[i] + px[i + 1] + px[i + 2];
    if (ciemniejsze ? suma < prog * 3 : suma > prog * 3) n++;
  }
  return n;
}

function testySkinningu(renderer) {
  const R = 96;
  const cel = new THREE.WebGLRenderTarget(R, R);
  const px = new Uint8Array(R * R * 4);
  const czytaj = () => { renderer.readRenderTargetPixels(cel, 0, 0, R, R, px); return px; };

  // --- T3: czy siatka w ogóle się odkształca ---
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const { mesh, kosci, wys } = zbudujSkinned(mat, 2, 8, 1);
  sc.add(mesh);
  const kam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  kam.position.set(0, 0, 4); kam.lookAt(0, 0, 0);

  renderer.setRenderTarget(cel);
  renderer.render(sc, kam);
  const spoczynekPrawa = policzPiksele(czytaj(), R, R, 0.62, 1.0, 40);

  kosci[1].rotation.z = -1.25;   // rot: rz=−1.25 rad → górna połowa (ważona kością 1) wychyla się w +x
  kosci[1].updateMatrixWorld(true);
  renderer.render(sc, kam);
  const zgietaPrawa = policzPiksele(czytaj(), R, R, 0.62, 1.0, 40);

  const t3 = zgietaPrawa > spoczynekPrawa + 60;
  wynik('T3', 'three.js SkinnedMesh — siatka się odkształca', t3 ? 'ok' : 'zle',
    t3 ? `jasnych pikseli w prawej strefie: spoczynek ${spoczynekPrawa} → po obrocie kości ${zgietaPrawa}`
       : `BRAK ODKSZTAŁCENIA: spoczynek ${spoczynekPrawa}, po obrocie kości ${zgietaPrawa}. Skinning nie działa — cała reszta etapu nie ma sensu w tej postaci.`);

  // --- T4: czy cień idzie za pozą (przebieg głębi też musi być oskinowany) ---
  // Światło z (1,−1,0): cień wysokiego elementu ląduje po stronie −x, poza rzutem samej siatki widzianej z góry.
  const sc2 = new THREE.Scene();
  const mat2 = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const { mesh: m2, kosci: k2 } = zbudujSkinned(mat2, 2, 8, 1);
  sc2.add(m2);
  const podloga = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshLambertMaterial({ color: 0xffffff }));   // 24 m, żeby krawędź podłogi nie weszła w kadr: tło jest ciemne i liczyłoby się jak cień
  podloga.rotation.x = -Math.PI / 2;   // rot: rx=−π/2 → normalna (0,0,1) → (0,1,0), płaszczyzna pozioma
  podloga.position.y = -1.05; podloga.receiveShadow = true;
  sc2.add(podloga);
  sc2.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(3, 3, 0); sun.target.position.set(0, 0, 0); sc2.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  sun.shadow.mapSize.set(512, 512);
  const kam2 = new THREE.OrthographicCamera(-3.2, 1.2, 1.6, -1.6, 0.1, 20);
  // Kamera patrzy PIONOWO w dół, a domyślne up = (0,1,0) jest wtedy równoległe do kierunku patrzenia — lookAt daje
  // wynik nieokreślony (pierwsza wersja tego testu miała przez to kadr z tłem zamiast podłogi i miara cienia stała).
  kam2.up.set(0, 0, -1);
  kam2.position.set(-1, 6, 0); kam2.lookAt(-1, 0, 0);

  // Strefa pomiaru wyliczona, nie zgadnięta. Kamera stoi w świecie na x = −1, a granice ortho są WZGLĘDEM NIEJ,
  // więc kadr pokrywa świat x od −4,2 do 0,2. Cień (światło pod 45°, wysokość 2,05 m) leży w świecie na x od
  // −2,25 do −0,2, czyli w ułamkach szerokości bufora 0,44–0,91; sama siatka widziana z góry zajmuje 0,91–1,0.
  // Pas [0,30; 0,82) łapie więc cień i NIE łapie siatki. Pierwsza wersja miała [0; 0,55) i liczyła wyłącznie
  // ciemne tło za krawędzią podłogi (dokładnie 4 kolumny × 96 wierszy = 384 piksele, stałe w każdym przebiegu).
  // Próg 160 leży w połowie między zmierzonymi wartościami: cień ma jasność 96, oświetlona podłoga 240
  // (histogram bufora, nie oszacowanie). Pierwsza wersja miała próg 90 — sześć jednostek PONIŻEJ cienia, więc
  // nie liczyła nic. Dobieranie progu „na oko" to dokładnie ten błąd, którego ten test ma pilnować.
  const ciemne = () => policzPiksele(czytaj(), R, R, 0.30, 0.82, 160, true);
  renderer.render(sc2, kam2);
  const cienSpoczynek = ciemne(); const bufSpoczynek = px.slice();
  k2[1].rotation.z = -1.25;   // rot: rz=−1.25 rad, jak w T3 — górna połowa w +x, więc cień się skraca
  k2[1].updateMatrixWorld(true);
  renderer.render(sc2, kam2);
  const cienZgieta = ciemne(); const bufZgieta = px.slice();
  // KALIBRACJA W DRUGĄ STRONĘ, w samym teście: bez rzucania cienia ta sama miara musi paść prawie do zera.
  // Bez tego „liczba się zmieniła" nie dowodzi, że w ogóle mierzę cień — a taki właśnie błąd zrobiłem tu za pierwszym razem.
  m2.castShadow = false;
  renderer.render(sc2, kam2);
  const cienWylaczony = ciemne(); const bufBez = px.slice();
  m2.castShadow = true;

  window.__t4dbg = { R, spoczynek: Array.from(bufSpoczynek), zgieta: Array.from(bufZgieta), bez: Array.from(bufBez) };   // zrzut do diagnostyki testu, nie do oceny GPU
  const mierzyCien = cienSpoczynek > 80 && cienWylaczony < cienSpoczynek / 4;
  const t4 = mierzyCien && Math.abs(cienZgieta - cienSpoczynek) > 40;
  wynik('T4', 'cień idzie za pozą (skinning w przebiegu głębi)', t4 ? 'ok' : 'zle',
    !mierzyCien ? `TEST NIE MIERZY CIENIA (miara nieskalibrowana): z cieniem ${cienSpoczynek}, bez cienia ${cienWylaczony}. Wynik T4 jest nierozstrzygający, nie traktuj go jako wady GPU.`
    : t4 ? `zacienionych pikseli: spoczynek ${cienSpoczynek} → po obrocie ${cienZgieta}; kontrola bez cienia ${cienWylaczony}`
       : `CIEŃ NIE ZMIENIŁ SIĘ: ${cienSpoczynek} → ${cienZgieta} (kontrola bez cienia ${cienWylaczony}, więc miara działa). Sylwetka nie zgodzi się z cieniem — NPC musi dostać castShadow=false i dekal kontaktowy jak w stalls.js.`);

  renderer.setRenderTarget(null);
  cel.dispose();
  return { t3, t4 };
}

// --- T5: filtrowanie LINIOWE tekstur float. three.js używa dla kości NearestFilter, więc to tylko ostrzeżenie,
// ale ANGLE ma dla GALAXYS24EXYNOS wyjątek dokładnie na to i warto wiedzieć, czy on tu obowiązuje.
function testLinear() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 4;
  const gl = cv.getContext('webgl2');
  if (!gl) return wynik('T5', 'filtrowanie liniowe tekstur float', 'uwaga', 'brak WebGL2');
  const ext = gl.getExtension('OES_texture_float_linear');
  wynik('T5', 'OES_texture_float_linear (informacyjnie)', ext ? 'ok' : 'uwaga',
    ext ? 'rozszerzenie zgłoszone — filtrowanie liniowe float dostępne' : 'BRAK rozszerzenia. Nie blokuje NPC (tekstura kości i tak jest NearestFilter), ale wyklucza inne użycia tekstur float z filtrowaniem.');
}

// ---------- podgląd na żywo + pomiar ----------
// Zginająca się rura ze skinningiem: jeśli skinning cicho nie działa, zobaczysz PROSTY słupek zamiast zgiętego.
function podglad(renderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x1b1a17);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8b9a6, roughness: 0.75, metalness: 0 });
  const KOSCI = 52;                                   // tyle ma rig game_engine z MPFB (53 z korzeniem)
  const { mesh, kosci, wys } = zbudujSkinned(mat, KOSCI, 32, 0.04);
  sc.add(mesh);   // walec jest wyśrodkowany na y=0, więc podłoga idzie na −wys/2, a kamera patrzy w środek
  const podloga = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6b6455, roughness: 1 }));
  podloga.rotation.x = -Math.PI / 2;   // rot: rx=−π/2 → normalna (0,0,1) → (0,1,0), podłoga pozioma
  podloga.position.y = -wys / 2 - 0.02; podloga.receiveShadow = true;
  sc.add(podloga);
  sc.add(new THREE.HemisphereLight(0xbcd3ff, 0x6b6455, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1e0, 2.2);
  sun.position.set(3, 5, 2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -3; sun.shadow.camera.right = 3; sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3;
  sc.add(sun);
  const kam = new THREE.PerspectiveCamera(45, 1, 0.1, 50);

  const tri = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
  el('geo').textContent = `${KOSCI + 1} kości · ${Math.round(tri / 1000)}k trójkątów w geometrii (licznik niżej pokazuje ok. 2× tyle: przebieg główny + cień) · 1 materiał`;

  renderer.compile(sc, kam);   // wygrzanie shaderów: NPC dokłada 2 programy (oskinowany standard + oskinowany depth)

  let last = performance.now(), acc = 0, klatki = 0;
  const czasy = [];
  function petla(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    const t = now / 1000;
    // Fala biegnąca po kościach — każda kość dostaje inny kąt, więc rura faluje. Prosty słupek = brak skinningu.
    for (let i = 1; i <= KOSCI; i++) kosci[i].rotation.z = 0.075 * Math.sin(t * 1.6 + i * 0.26);
    mesh.rotation.y = t * 0.5;   // rot: ry=t·0,5 rad/s → obrót wokół pionu, żeby było widać sylwetkę z każdej strony
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (renderer.domElement.width !== w * renderer.getPixelRatio()) { renderer.setSize(w, h, false); kam.aspect = w / h; kam.updateProjectionMatrix(); }
    kam.position.set(0, 0.15, 3.1); kam.lookAt(0, -0.05, 0);
    renderer.render(sc, kam);

    klatki++; acc += dt; czasy.push(dt * 1000);
    if (acc >= 1) {
      czasy.sort((a, b) => a - b);
      const p95 = czasy[Math.floor(czasy.length * 0.95)] || 0;
      const i = renderer.info.render;
      el('perf').textContent = `${Math.round(klatki / acc)} fps · p95 ${p95.toFixed(1)} ms · ${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri · DPR ${renderer.getPixelRatio().toFixed(2)}`;
      el('perf').className = p95 <= 16.7 ? 'ok' : (p95 <= 20 ? 'uwaga' : 'zle');
      klatki = 0; acc = 0; czasy.length = 0;
    }
    requestAnimationFrame(petla);
  }
  requestAnimationFrame(petla);
}

// ---------- start ----------
(function start() {
  const canvas = el('c');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    el('gpu').textContent = 'nie udało się utworzyć kontekstu: ' + e.message;
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;

  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  el('gpu').innerHTML = `<b>${gpu}</b><br><small>WebGL2 · maxTexture ${gl.getParameter(gl.MAX_TEXTURE_SIZE)} · vertex texture units ${gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)} · three r${THREE.REVISION}${/Xclipse/i.test(gpu) ? ' · <b>to jest Xclipse — ten test jest właśnie dla tego GPU</b>' : ''}</small>`;

  const t1 = rawFloat(false);
  wynik('T1', 'gołe WebGL2: RGBA32F przeżywa zapis i odczyt (fragment shader)', t1.ok ? 'ok' : 'zle',
    t1.ok ? t1.detal : `${t1.detal} — sterownik zmienia dane tekstury float. To by tłumaczyło wszystko, co jest niżej.`);

  const t2 = rawFloat(true);
  wynik('T2', 'gołe WebGL2: texelFetch z RGBA32F w VERTEX shaderze', t2.ok ? 'ok' : 'zle',
    t2.ok ? `${t2.detal}, vertex texture units ${t2.vtu}` : `${t2.detal} — to dokładnie ten mechanizm, którym three.js podaje macierze kości. Bez niego skinningu nie ma i silnik nie ma przełącznika, który to naprawi.`);

  try { testySkinningu(renderer); } catch (e) { wynik('T3/T4', 'skinning w three.js', 'zle', 'wyjątek: ' + e.message); }
  testLinear();

  const zle = WYNIKI.filter(w => w.status === 'zle');
  el('werdykt').textContent = zle.length === 0
    ? 'WSZYSTKO PRZESZŁO — skinning na tym GPU działa, można budować NPC.'
    : `OBLANE: ${zle.map(w => w.nr).join(', ')} — przyślij mi ten ekran, zmieniam plan.`;
  el('werdykt').className = zle.length === 0 ? 'ok' : 'zle';

  podglad(renderer);
})();
