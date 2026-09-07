const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../rynek', '-p', '8127', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('pageerror', e => console.log('pageerror:', String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8127/index.html');
  await page.waitForFunction(() => window.__perf, null, { timeout: 300000 });
  console.log(JSON.stringify(await page.evaluate(() => {
    const { scene } = window.__dbg; const sun = scene.userData.sun;
    return { intensity: sun.intensity, pos: sun.position.toArray().map(v => +v.toFixed(1)), target: sun.target.position.toArray().map(v => +v.toFixed(1)), dir: scene.userData.sunDir.toArray().map(v => +v.toFixed(2)), elev: +(Math.asin(scene.userData.sunDir.y) * 180 / Math.PI).toFixed(1), cast: sun.castShadow, hasMap: !!sun.shadow.map, mapSize: sun.shadow.mapSize.toArray(), cam: [sun.shadow.camera.left, sun.shadow.camera.right, sun.shadow.camera.near, sun.shadow.camera.far], env: scene.environmentIntensity, parent: sun.parent === scene, tparent: sun.target.parent === scene };
  })));
  await page.evaluate(() => { const { scene } = window.__dbg; scene.environment = null; scene.background = null; window.__setView({ x: 4, z: 19, yaw: 0.15, pitch: 0.02 }); window.__pause(); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/rynek_debug_noenv.png', timeout: 120000 });
  await browser.close(); server.kill();
})();
