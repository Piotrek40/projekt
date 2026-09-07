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
  const info = await page.evaluate(() => {
    const d = window.__dbg.scene.userData.sunDir; const el = Math.asin(d.y) * 180 / Math.PI, az = Math.atan2(d.x, d.z) * 180 / Math.PI;
    // spójrz prosto w słońce: kamera patrzy wzdłuż (-sin yaw, 0, -cos yaw)
    const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(d.y);
    window.__setView({ x: 0, z: 0, yaw, pitch }); window.__pause(); window.__renderOnce();
    return { dir: d.toArray().map(v => +v.toFixed(3)), elevationDeg: +el.toFixed(1), azimuthDeg: +az.toFixed(1) };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: 'out/render/debug_look_at_sun.png', timeout: 120000 });
  await page.evaluate(() => { window.__setView({ x: 1.0, z: -3.9, yaw: -0.35, pitch: -0.05 }); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_bust_env035.png', timeout: 120000 });
  await page.evaluate(() => { window.__setView({ x: 3.0, z: 4.5, yaw: 0.25, pitch: -0.15 }); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_start_env035.png', timeout: 120000 });
  await browser.close(); server.kill();
})();
