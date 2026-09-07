const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../demo', '-p', '8124', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', m => console.log('console:', m.text().slice(0, 200)));
  await page.goto('http://127.0.0.1:8124/index.html');
  await page.waitForFunction(() => window.__perf, null, { timeout: 300000 });
  const info = await page.evaluate(() => {
    const { scene, renderer } = window.__dbg; const sun = scene.userData.sun;
    const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push([o.name || o.geometry.type, o.castShadow, o.receiveShadow, o.material.type]); });
    return { shadowEnabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type, sunIntensity: sun.intensity, sunPos: sun.position.toArray(), castShadow: sun.castShadow, mapSize: sun.shadow.mapSize.toArray(), hasMap: !!sun.shadow.map, radius: sun.shadow.radius, sunParent: sun.parent === scene, targetParent: sun.target.parent === scene, env: !!scene.environment, envIntensity: scene.environmentIntensity, meshes: meshes.slice(0, 12), nMeshes: meshes.length };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.evaluate(() => { const { scene } = window.__dbg; scene.environment = null; scene.background = null; window.__setView({ x: 1.0, z: -3.9, yaw: -0.35, pitch: -0.05 }); window.__pause(); window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_noenv.png', timeout: 120000 });
  await page.evaluate(() => { const { scene } = window.__dbg; scene.userData.sun.intensity = 30; window.__renderOnce(); });
  await page.screenshot({ path: 'out/render/debug_noenv_sun30.png', timeout: 120000 });
  await browser.close(); server.kill();
})();
