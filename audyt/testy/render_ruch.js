// Zrzuty z podglądu ruchu NPC (npc_test/ruch.html) w headless Chromium (SwiftShader = CPU).
// Użycie: node render_ruch.js <nazwa_wyjscia> [klip] [tryb: miejsce|marsz] [kamera: sylwetka|stopy]
// Powód istnienia: liczby mówią, że stopa jest na wysokości 0,0 mm — nie mówią, czy chód WYGLĄDA jak chód.
// UWAGA: FPS tutaj to wydajność renderowania programowego na CPU serwera, NIE telefonu.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const [,, outName = 'ruch', klip = 'walk_cycle', tryb = 'marsz', kam = 'sylwetka'] = process.argv;
const DIR = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, 'out/render', outName);
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || '8131';
const HTTP_SERVER = '/opt/node22/lib/node_modules/http-server/bin/http-server';
const KAMERY = { sylwetka: [3.4, 1.05, 0.92], stopy: [1.9, 0.42, 0.18] };
const CZASY = (process.env.CZASY || '0,0.14,0.28,0.42,0.55,0.69,0.83,0.96').split(',').map(Number);
const YAWY = (process.env.YAWY || '1.571').split(',').map(Number);   // 1,571 rad = z boku

(async () => {
  const server = spawn('/opt/node22/bin/node', [HTTP_SERVER, DIR, '-p', PORT, '-s', '-c-1'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 640 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const bledy = [];
    page.on('pageerror', e => bledy.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') bledy.push(m.text().slice(0, 300)); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/npc_test/ruch.html`);
    await page.waitForFunction(() => window.__gotowe && window.__gotowe(), null, { timeout: 300000 });
    console.log(`ładowanie + bake: ${Date.now() - t0} ms`);
    console.log('info:', (await page.textContent('#info')).replace(/\s+/g, ' ').trim());
    await page.evaluate(([k, m, c]) => { window.__klip(k); window.__wMiejscu(m === 'miejsce'); window.__kamera(...c); }, [klip, tryb, KAMERY[kam]]);
    for (const yaw of YAWY) {
      await page.evaluate(y => window.__yaw(y), yaw);
      for (const t of CZASY) {
        await page.evaluate(x => window.__czas(x), t);
        await page.waitForTimeout(120);
        const plik = path.join(OUT, `${klip}_${kam}_y${yaw.toFixed(2)}_t${t.toFixed(2)}.png`);
        await page.screenshot({ path: plik });
      }
    }
    console.log('zapisano do', OUT, bledy.length ? `\nBŁĘDY: ${bledy.slice(0, 5).join(' | ')}` : '\nbez błędów konsoli');
  } finally { await browser.close(); server.kill(); }
})();
