// Renderuje dowolną scenę (katalog) w headless Chromium (SwiftShader = CPU) i zapisuje zrzuty + pomiary.
// Użycie: node render_scene.js <katalog_sceny> <plik_widoków.json> [nazwa_wyjscia]
// Env: PORT (osobny na agenta/worktree), QUALITY=high|medium|low, DPR, SHOTW/SHOTH (px CSS), URLQUERY='?boxes=1', VIEWS_INLINE='[{...}]' (wtedy plik widoków = '-'), REPO.
// Widok: {name, x, z, yaw, pitch} (kamera na 1.65 m, yaw 0 = -z) albo {name, x, z, yaw, ortho:{top:true,size}|{side:0..3,size,near}} (rzut z góry / elewacja).
// Widok może mieć też {frames: [t, …]} — wtedy po zwykłym zrzucie powstają dodatkowe, w podanych chwilach zegara sceny (window.__setTime).
// Pliki: <name>_k<indeks>_t<czas>.png. Do porównywania klatek animacji; wymaga sceny z __setTime (engine/src/app.js).
// UWAGA: FPS to wydajność renderowania programowego na CPU serwera, NIE telefonu.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [,, sceneDir, viewsFile, outName] = process.argv;
const DIR = path.resolve(process.env.REPO || path.join(__dirname, '../..'), sceneDir); // REPO: gdy skrypt leży poza repo (worktree)
const OUT = path.resolve(__dirname, 'out/render', outName || path.basename(sceneDir));
fs.mkdirSync(OUT, { recursive: true });
// VIEWS_INLINE='[{"name":...}]' zamiast pliku (wtedy 2. argument dowolny, np. '-')
const views = JSON.parse(process.env.VIEWS_INLINE || fs.readFileSync(viewsFile, 'utf8'));
const PORT = process.env.PORT || '8126'; // osobny port na agenta, gdy renderuje kilka worktree naraz

// http-server uruchamiany BEZPOŚREDNIO z binarki (nie przez npx): server.kill() zabija wtedy sam serwer, a nie npx (przez npx serwery
// zostawały osierocone i trzymały porty). Gdy globalnej binarki nie ma — npx jak dawniej.
const HTTP_SERVER = '/opt/node22/lib/node_modules/http-server/bin/http-server';
const serve = () => fs.existsSync(HTTP_SERVER) ? spawn('/opt/node22/bin/node', [HTTP_SERVER, DIR, '-p', PORT, '-s', '-c-1'], { stdio: 'ignore' })
                                                : spawn('/opt/node22/bin/npx', ['http-server', DIR, '-p', PORT, '-s', '-c-1'], { stdio: 'ignore' });
(async () => {
  const server = serve();
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    // SHOTW/SHOTH: rozmiar okna w CSS px (np. 1024x1024 dla rzutu z góry); domyślnie Galaxy S24 = 412x915
    const vp = { width: +(process.env.SHOTW || 412), height: +(process.env.SHOTH || 915), dpr: process.env.DPR ? +process.env.DPR : 2, quality: process.env.QUALITY || 'high' };
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 300)); });
    await page.addInitScript(q => { try { localStorage.setItem('quality', q); } catch {} }, vp.quality);
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/index.html` + (process.env.URLQUERY || ''));
    try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); }
    catch (e) { console.log('NIE GOTOWE:', await page.evaluate(() => document.getElementById('loading')?.textContent.slice(0, 200)), errors.slice(0, 5)); throw e; }
    const loadMs = Date.now() - t0;
    await page.waitForFunction(() => !!window.__perf, null, { timeout: 300000 });
    for (const v of views) {
      await page.evaluate(v => { window.__resume(); window.__setView(v); }, v);
      // Czekanie napędzane rAF (polling 'raf'), żeby pętla loop() i animacje na pewno posuwały się w headless. UWAGA: __perf (HUD) odświeża
      // się dopiero po ≥1 s ZSUMOWANEGO czasu klatek (dt obcięte do 0,1 s), a SwiftShader pod obciążeniem daje 2–6 klatek na 3 s — więc
      // __perf/HUD bywa z poprzedniego widoku (stare results: liczby powtarzały się grupami). Wiarygodne calls/triangles: z __stats (niżej).
      const tw = await page.evaluate(() => performance.now());
      await page.waitForFunction(t0 => performance.now() - t0 > 3000, tw, { polling: 'raf', timeout: 240000 });
      const perf = await page.evaluate(() => window.__perf);
      await page.evaluate(() => { window.__pause(); window.__renderOnce(); });
      await page.screenshot({ path: `${OUT}/${v.name}.png`, timeout: 240000 });
      // __stats(10): co renderer naprawdę narysował w TYM kadrze (po frustum culling) z rozbiciem na materiały/modele — „kto zjada budżet”.
      // calls/triangles bierzemy z tej klatki (dokładnie ta, którą widać na zrzucie); fps z pętli (SwiftShader — tylko orientacyjnie).
      const stats = await page.evaluate(() => window.__stats ? window.__stats(10) : null);
      results.push({ view: v.name, calls: stats?.total.calls ?? perf.calls, triangles: stats?.total.tris ?? perf.triangles, fps: +perf.fps.toFixed(1), stats });
      // v.frames = [t, …] (sekundy): dodatkowe zrzuty tego samego widoku w USTALONYCH chwilach zegara sceny.
      // Pętla jest już zatrzymana (__pause wyżej), a straż na wejściu loop() gwarantuje, że żadna zakolejkowana
      // klatka nie dołoży swojego dt — dopiero to czyni sekwencję powtarzalną. Bez straży pierwszy zrzut serii
      // wychodził z zegara ściennego (zmierzone: ta sama chwila t dawała dwa różne obrazy, maxDiff 84).
      // Nazwa pliku bierze INDEKS, nie samo t: przy frames [0, 0.5, 0] dwa zrzuty t=0 nadpisywałyby się
      // nawzajem i porównanie „ta sama chwila → maxDiff 0" porównywałoby plik sam ze sobą.
      if (Array.isArray(v.frames) && v.frames.length) {
        const maSetTime = await page.evaluate(() => typeof window.__setTime === 'function');
        if (!maSetTime) throw new Error('widok ma pole frames, ale scena nie udostępnia window.__setTime — bez zegara sceny sekwencja nie jest powtarzalna');
        for (let i = 0; i < v.frames.length; i++) {
          const t = v.frames[i];
          await page.evaluate(t => { window.__setTime(t); window.__renderOnce(); }, t);
          const nazwa = `${v.name}_k${i}_t${String(t).replace('.', '_')}`;
          await page.screenshot({ path: `${OUT}/${nazwa}.png`, timeout: 240000 });
          results.push({ view: nazwa, klatka: i, t, ofView: v.name });
        }
      }
    }
    const transfer = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0));
    // sunDir: kierunek słońca ze sky.js (do lineup_rects.mjs); lineup: kolejność kluczy W.mat, gdy render z ?lineup=
    const meta = await page.evaluate(() => ({ sunDir: window.__dbg?.scene?.userData?.sunDir?.toArray().map(v => +v.toFixed(4)) ?? null, lineup: window.__lineup ?? null }));
    results.push({ loadMs, transferMB: +(transfer / 1e6).toFixed(1), width: vp.width * vp.dpr, height: vp.height * vp.dpr, quality: vp.quality, ...meta, errors: errors.slice(0, 8) });
    await ctx.close();
  } finally { await browser.close(); server.kill(); }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})();
