// Renderuje scenę demo w headless Chromium (SwiftShader = CPU) i zapisuje zrzuty + pomiary.
// UWAGA: pomiar FPS tutaj to wydajność renderowania programowego na CPU serwera, NIE telefonu.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEMO = path.resolve(__dirname, '../../demo');
const OUT = path.resolve(__dirname, 'out/render');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', DEMO, '-p', '8123', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    const viewports = [
      { name: 'phone', width: 412, height: 915, dpr: 1, quality: 'medium' },
      { name: 'phone_high', width: 412, height: 915, dpr: 2, quality: 'high' },
    ];
    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
      await page.addInitScript(q => { try { localStorage.setItem('quality', q); } catch {} }, vp.quality);
      const t0 = Date.now();
      await page.goto('http://127.0.0.1:8123/index.html');
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
      const loadMs = Date.now() - t0;
      // rozgrzewka: pierwsze klatki kompilują shadery (na SwiftShader trwa to długo)
      await page.waitForFunction(() => !!window.__perf, null, { timeout: 300000 });
      // kilka punktów widzenia: start, zbliżenie na stół, zbliżenie na popiersie, mur
      const views = [
        { name: 'start', x: 3.0, z: 4.5, yaw: 0.25, pitch: 0.0 },
        { name: 'stol_zblizenie', x: -1.9, z: -3.5, yaw: 0.9, pitch: -0.35 },
        { name: 'popiersie_zblizenie', x: 1.0, z: -3.9, yaw: -0.35, pitch: -0.05 },
        { name: 'mur_podloze', x: -4.5, z: -4.0, yaw: 2.2, pitch: -0.3 },
        // pod słońce: cienie stołu i beczki padają w stronę kamery
        { name: 'cienie_pod_slonce', x: -1.0, z: -6.2, yaw: Math.PI * 0.85, pitch: -0.25 },
      ];
      for (const v of views) {
        await page.evaluate(v => { window.__resume(); window.__setView(v); }, v);
        await page.waitForTimeout(4000);
        const perf = await page.evaluate(() => window.__perf);
        await page.evaluate(() => { window.__pause(); window.__renderOnce(); });
        await page.screenshot({ path: `${OUT}/${vp.name}_${v.name}.png`, timeout: 180000 });
        results.push({ viewport: vp.name, view: v.name, ...perf });
      }
      // rzeczywisty rozmiar pobranych zasobów
      const transfer = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0));
      results.push({ viewport: vp.name, loadMs, transferBytes: transfer, errors: errors.slice(0, 10) });
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
