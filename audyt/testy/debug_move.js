const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../rynek', '-p', '8127', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror:', String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8127/index.html');
  await page.waitForFunction(() => window.__perf, null, { timeout: 300000 });
  const st = () => page.evaluate(() => { const c = window.__dbg.camera; const s = window.__dbg.scene.userData.sun; return { cam: c.position.toArray().map(v => +v.toFixed(2)), rot: [c.rotation.x, c.rotation.y].map(v => +v.toFixed(2)), sun: s.position.toArray().map(v => +v.toFixed(1)), target: s.target.position.toArray().map(v => +v.toFixed(1)) }; });
  console.log('start', JSON.stringify(await st()));
  // emulacja dotyku: joystick (lewa strona) — przesunięcie w górę
  const cdp = await ctx.newCDPSession(page);
  const tp = (x, y) => ({ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(100, 700)] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(100, 700 - i * 10)] });
  await page.waitForTimeout(2500);
  console.log('po dotyku', JSON.stringify(await st()));
  await page.screenshot({ path: 'out/render/debug_move_touch.png', timeout: 120000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  console.log('po W', JSON.stringify(await st()));
  await browser.close(); server.kill();
})();
