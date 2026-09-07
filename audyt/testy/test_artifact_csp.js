// Test wersji jednoplikowej pod restrykcyjnym CSP (symulacja piaskownicy Artifactu): bez fetch do data:/blob:, bez img z data:.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '../../demo_artifact/' + (process.env.PAGE || 'demo') + '.html'));
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; media-src 'none'; object-src 'none'" });
  res.end(html);
}).listen(8125);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8125/');
  try { await page.waitForFunction(() => window.__perf, null, { timeout: 300000 }); } catch (e) { console.log('NIE GOTOWE:', await page.evaluate(() => document.getElementById('loading').textContent.slice(0, 120))); }
  console.log(JSON.stringify({ loadMs: Date.now() - t0, perf: await page.evaluate(() => window.__perf), errors: errors.slice(0, 6) }));
  const view = JSON.parse(process.env.VIEW || '{"x":-1.9,"z":-3.5,"yaw":0.9,"pitch":-0.35}');
  await page.evaluate(v => { window.__setView && window.__setView(v); window.__pause && window.__pause(); window.__renderOnce && window.__renderOnce(); }, view);
  await page.screenshot({ path: 'out/render/artifact_csp_' + (process.env.PAGE || 'demo') + '.png', timeout: 120000 });
  await browser.close(); server.close();
})();
