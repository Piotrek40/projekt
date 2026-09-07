// Jednorazowy test wersji jednoplikowej: ładuje się z data URI? zrzut + błędy konsoli.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto('file://' + path.resolve(__dirname, '../../demo_artifact/dziedziniec.html'));
  await page.waitForFunction(() => window.__perf, null, { timeout: 300000 });
  const loadMs = Date.now() - t0;
  await page.evaluate(() => { window.__setView({ x: -1.0, z: -6.2, yaw: Math.PI * 0.85, pitch: -0.25 }); window.__pause(); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/artifact_inline.png', timeout: 120000 });
  const perf = await page.evaluate(() => window.__perf);
  console.log(JSON.stringify({ loadMs, perf, errors: errors.slice(0, 5) }));
  await browser.close();
})();
