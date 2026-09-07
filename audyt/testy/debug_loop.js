const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../rynek', '-p', '8127', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('pageerror', e => console.log('pageerror:', (e.stack || String(e)).slice(0, 900)));
  page.on('console', m => { if (m.type() !== 'log') console.log('console', m.type(), m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8127/index.html');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  console.log('ready after', Date.now() - t0, 'ms');
  for (let i = 0; i < 2; i++) { await page.waitForTimeout(10000); console.log(i, JSON.stringify(await page.evaluate(() => ({ perf: window.__perf, paused: window.__paused, calls: window.__dbg.renderer.info.render.calls, frame: window.__dbg.renderer.info.render.frame })))); }
  await browser.close(); server.kill();
})();
