const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--proxy-server=' + process.env.HTTPS_PROXY, '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto('https://piotrek40.github.io/projekt/demo/');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  const loadMs = Date.now() - t0;
  const transfer = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0));
  console.log(JSON.stringify({ loadMs, transferMB: +(transfer / 1e6).toFixed(1), errors: errors.slice(0, 5) }));
  await browser.close();
})();
