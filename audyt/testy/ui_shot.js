// Zrzuty warstwy UI rynku (motyw #15, rynek/src/ui.js): ekran startowy PRZED „Wejdź", HUD po tapnięciu (winieta, pergaminowy przycisk jakości),
// podpisy miejsc (POI) z 3 pozycji, joystick (syntetyczny touchstart). render_scene.js czeka na __ready i od razu renderuje scenę kamerą z widoku,
// więc ekran startowy trzeba złapać osobno (prompt §5.4). Użycie: PORT=8275 node ui_shot.js [nazwa_wyjscia=ui]; env: REPO, QUALITY (high), DPR (2), URLQUERY.
// Wyjście: out/render/<nazwa>/{start_screen,hud,hud_novig,hud_joy,caption,caption_far,caption_tower,noui}.png + results.json (errors, pozycje POI z W.pois,
// hudHiddenNoui/overlayHiddenNoui z drugiej strony ?noui=1 — SKIP_NOUI=1 pomija ją).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const outName = process.argv[2] || 'ui';
const DIR = path.resolve(process.env.REPO || path.join(__dirname, '../..'), 'rynek');
const OUT = path.resolve(__dirname, 'out/render', outName);
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || '8126';
const HTTP_SERVER = '/opt/node22/lib/node_modules/http-server/bin/http-server';
const serve = () => spawn('/opt/node22/bin/node', [HTTP_SERVER, DIR, '-p', PORT, '-s', '-c-1'], { stdio: 'ignore' });
// pozycje kamery do podpisów (policzone na kramach z ziarna 7): fontanna (0,0) r 6.9 → (0, 6.5) w r; (−8.6, −6.02) = punkt okręgu r 10.5 najdalej od kramów
// (5.5 m od najbliższego) → poza r, w 2r = 13.8 → „podejdź bliżej…", yaw na fontannę atan2(8.6, 6.02) = −2.182 (kamera: yaw = atan2(−(tx−x), −(tz−z)));
// wieża (7, −25.7) r 9.95 → (0, −19) d 9.70 (w r; z (4, −19) kamera 3 m od fasady widziała tylko mur), yaw atan2(−7, 6.7) = −0.807, pitch 0.55 na szczyt (21 m w 9.7 m = 1.1 rad)
const CAPTION_VIEWS = [
  { name: 'caption', x: 0, z: 6.5, yaw: 0, pitch: 0.05 },
  { name: 'caption_far', x: -8.6, z: -6.02, yaw: -2.182, pitch: 0.05 },
  { name: 'caption_tower', x: 0, z: -19, yaw: -0.807, pitch: 0.55 },
];

(async () => {
  const server = serve();
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = { errors: [] };
  try {
    const vp = { width: 412, height: 915, dpr: process.env.DPR ? +process.env.DPR : 2, quality: process.env.QUALITY || 'high' };
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => results.errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') results.errors.push(m.text().slice(0, 300)); });
    await page.addInitScript(q => { try { localStorage.setItem('quality', q); } catch {} }, vp.quality);
    await page.goto(`http://127.0.0.1:${PORT}/index.html` + (process.env.URLQUERY || ''));
    await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
    // pętla loop() na SwiftShader liczy klatkę sekundami i blokuje zrzut (timeout 30 s) → przed każdym zrzutem __pause(), zrzuty z timeout 240 s jak w render_scene.js
    const shot = name => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 240000 });
    await page.evaluate(() => window.__pause());
    await shot('start_screen');                                            // PRZED __setView i przed tapnięciem „Wejdź"
    results.startVisible = await page.evaluate(() => !document.getElementById('start').hidden);
    // co najmniej 2 klatki sceny pod nakładką (SwiftShader: sekundy na klatkę), potem „Wejdź" i 800 ms na fade-out (600 ms)
    const waitFrames = async (ms) => { const tw = await page.evaluate(() => performance.now()); await page.waitForFunction(([t0, lim]) => performance.now() - t0 > lim, [tw, ms], { polling: 'raf', timeout: 240000 }); };
    await page.evaluate(() => window.__resume()); await waitFrames(3000);
    await page.click('#enter'); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__pause(); window.__renderOnce(); });
    await shot('hud');
    results.startHiddenAfterEnter = await page.evaluate(() => document.getElementById('start').hidden);
    results.hudHidden = await page.evaluate(() => document.getElementById('hud').hidden && document.getElementById('gpu').hidden);
    results.captionAtStart = await page.evaluate(() => ({ hidden: document.getElementById('caption').hidden, text: document.getElementById('caption').textContent }));
    // ten sam kadr bez winiety (do img_diff/sondy rogów): winieta = jedyna różnica
    await page.evaluate(() => { document.getElementById('vignette').hidden = true; });
    await shot('hud_novig');
    await page.evaluate(() => { document.getElementById('vignette').hidden = false; });
    // joystick: syntetyczny touchstart (100, 700) + touchmove (130, 690) → pierścień w (100,700), gałka przesunięta o (30, −10)
    await page.evaluate(() => {
      const t = document.getElementById('touch');
      const mk = (x, y) => new Touch({ identifier: 7, target: t, clientX: x, clientY: y });
      const ev = (type, touch) => t.dispatchEvent(new TouchEvent(type, { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
      ev('touchstart', mk(100, 700)); ev('touchmove', mk(130, 690));
    });
    await page.waitForTimeout(200);
    await shot('hud_joy');
    results.joyVisible = await page.evaluate(() => !document.getElementById('joy').hidden);
    await page.evaluate(() => { const t = document.getElementById('touch'); const touch = new Touch({ identifier: 7, target: t, clientX: 130, clientY: 690 }); t.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch], bubbles: true, cancelable: true })); });
    // podpisy POI: __setView, kilka klatek pętli (updater podpisów działa w loop()), zrzut
    results.captions = [];
    for (const v of CAPTION_VIEWS) {
      await page.evaluate(v => { window.__resume(); window.__setView(v); }, v);
      await waitFrames(2500);
      await page.evaluate(() => { window.__pause(); window.__renderOnce(); });
      await shot(v.name);
      results.captions.push({ view: v.name, ...(await page.evaluate(() => ({ hidden: document.getElementById('caption').hidden, far: document.getElementById('caption').classList.contains('far'), text: document.getElementById('caption').textContent }))) });
    }
    results.pois = await page.evaluate(() => window.__pois ?? null);
    results.flags = await page.evaluate(() => window.__dbg?.ctx?.flags ?? null);
    await ctx.close();
    // druga strona z ?noui=1 (poprawka r1): render pomiarowy ma być BEZ nakładek — #hud/#gpu/#q (ui.js) i #vignette/#caption/#start (app.js) hidden; zrzut noui.png = kadr startu bez paska
    if (!process.env.SKIP_NOUI) {
      const ctx2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });
      const p2 = await ctx2.newPage();
      p2.on('pageerror', e => results.errors.push('noui: ' + String(e).slice(0, 300)));
      p2.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') results.errors.push('noui: ' + m.text().slice(0, 300)); });
      await p2.addInitScript(q => { try { localStorage.setItem('quality', q); } catch {} }, vp.quality);
      const q0 = process.env.URLQUERY || '';
      await p2.goto(`http://127.0.0.1:${PORT}/index.html` + (q0 ? q0 + '&noui=1' : '?noui=1'));
      await p2.waitForFunction(() => window.__ready, null, { timeout: 240000 });
      await p2.evaluate(() => { window.__pause(); window.__renderOnce(); });
      await p2.screenshot({ path: `${OUT}/noui.png`, timeout: 240000 });
      results.hudHiddenNoui = await p2.evaluate(() => ['hud', 'gpu', 'q'].every(id => document.getElementById(id)?.hidden === true));
      results.overlayHiddenNoui = await p2.evaluate(() => ['vignette', 'caption', 'start'].every(id => document.getElementById(id)?.hidden === true));
      await ctx2.close();
    }
  } finally { await browser.close(); server.kill(); }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})();
