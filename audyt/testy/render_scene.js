// Renderuje dowolną scenę (katalog) w headless Chromium (SwiftShader = CPU) i zapisuje zrzuty + pomiary.
// Użycie: node render_scene.js <katalog_sceny> <plik_widoków.json> [nazwa_wyjscia]
// UWAGA: FPS to wydajność renderowania programowego na CPU serwera, NIE telefonu.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [,, sceneDir, viewsFile, outName] = process.argv;
const DIR = path.resolve(__dirname, '../..', sceneDir);
const OUT = path.resolve(__dirname, 'out/render', outName || path.basename(sceneDir));
fs.mkdirSync(OUT, { recursive: true });
const views = JSON.parse(fs.readFileSync(viewsFile, 'utf8'));
const PORT = process.env.PORT || '8126'; // osobny port na agenta, gdy renderuje kilka worktree naraz

(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', DIR, '-p', PORT, '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    const vp = { width: 412, height: 915, dpr: process.env.DPR ? +process.env.DPR : 2, quality: process.env.QUALITY || 'high' };
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
      await page.waitForTimeout(3000);
      const perf = await page.evaluate(() => window.__perf);
      await page.evaluate(() => { window.__pause(); window.__renderOnce(); });
      await page.screenshot({ path: `${OUT}/${v.name}.png`, timeout: 240000 });
      results.push({ view: v.name, calls: perf.calls, triangles: perf.triangles, fps: +perf.fps.toFixed(1) });
    }
    const transfer = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0));
    results.push({ loadMs, transferMB: +(transfer / 1e6).toFixed(1), width: vp.width * vp.dpr, height: vp.height * vp.dpr, quality: vp.quality, errors: errors.slice(0, 8) });
    await ctx.close();
  } finally { await browser.close(); server.kill(); }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})();
