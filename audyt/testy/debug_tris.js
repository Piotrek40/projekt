const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const server = spawn('/opt/node22/bin/npx', ['http-server', '../../rynek', '-p', '8127', '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.goto('http://127.0.0.1:8127/index.html');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  const rows = await page.evaluate(() => {
    const out = [];
    window.__dbg.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const n = o.isInstancedMesh ? o.count : 1;
      out.push([o.name || o.material?.name || o.type, n, Math.round(tri), Math.round(tri * n)]);
    });
    const agg = {}; for (const [n, c, t, tot] of out) { agg[n] = agg[n] || [0, 0]; agg[n][0] += c; agg[n][1] += tot; }
    return Object.entries(agg).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25).map(([n, [c, tot]]) => `${n.padEnd(26)} inst=${c} tri=${tot}`);
  });
  console.log(rows.join('\n'));
  await browser.close(); server.kill();
})();
