const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../demo', '-p', '8124', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('pageerror', e => console.log('pageerror:', String(e)));
  await page.goto('http://127.0.0.1:8124/index.html');
  await page.waitForFunction(() => window.__perf, null, { timeout: 300000 });
  await page.evaluate(() => { window.__setView({ x: -2.6, z: -2.6, yaw: 0, pitch: -0.9 }); window.__pause(); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_table_top.png', timeout: 120000 });
  await page.evaluate(() => { window.__setView({ x: -1.0, z: -6.2, yaw: Math.PI * 0.85, pitch: -0.25 }); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_sun_walls.png', timeout: 120000 });
  await browser.close(); server.kill();
})();
