// Warstwa UI sceny (motyw #15): ekran startowy z nazwą miejsca, pergaminowy HUD (joystick, przycisk jakości), podpisy miejsc (POI) i winieta.
// Flaga: ?noui=1 (engine/app.js chowa #vignette/#caption/#start, tu wczesny return — rendery pomiarowe bez UI). ?hud=1 pokazuje licznik fps/draw.
// Układ: współrzędne świata (x, z) jak layout.js, metry; odległość gracza liczona w płaszczyźnie xz. Teksty, kolory (ekranowe CSS) i rozmiary
// tylko z CONFIG.ui; POI z CONFIG.pois — pozycje NIE są wpisane, liczy je poiPlan(W) (funkcja czysta, test U w audyt/testy/test_geometria.mjs).
// Elementy DOM: rynek/index.html (#start, #caption, #vignette, #hud, #gpu, #q, #joy). Bez interakcji poza „Wejdź", bez wejść.
import { check } from '../../engine/src/check.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Pozycje POI z W/CONFIG → [{name, x, z, r, own}]; r = promień własny obiektu + margin z CONFIG.pois. Podpis w r, „podejdź bliżej…" w 2r.
export function poiPlan(W) {
  const { CONFIG, houses, stalls, sideTransform, ctx, half } = W;
  const F = CONFIG.fountain, U = CONFIG.ui, sw = CONFIG.plaza.streetWidth, tw = CONFIG.tower.size;
  const start = ctx.player?.start ?? { x: 0, z: 0 };
  const extent = CONFIG.skyline.groundExtent || half;
  const resolve = {
    fountain: () => ({ x: 0, z: 0, own: F.radius + F.step.outer }),                                     // basen + schodek (4.4 m)
    // kontrakt z torem „wieża" (motyw #2): W.tower = {x, z, r}; do tego czasu wzór z tower.js (tx = sw/2 + tw/2 + 0.5, tz = −half − tw/2 − 0.2), własny = róg kwadratu
    tower: () => W.tower ? { x: W.tower.x, z: W.tower.z, own: W.tower.r }
                         : { x: sw / 2 + tw / 2 + 0.5, z: -half - tw / 2 - 0.2, own: tw / 2 * Math.SQRT2 }, // = tower.js: (7, −25.7), róg 4.95 m (test U porównuje z addRect wieży)
    tavern: () => {                                                                                       // ten sam dom, co szyld (props.js buildBanners): pierwszy po prawej od ulicy S
      const h = W.tavern ?? houses.find(h => h.side === 2 && h.along > 0 && !h.setback) ?? houses[0];
      const t = sideTransform(h.side, h.along, -CONFIG.house.depth / 2);                                 // środek lica fasady (setback −depth/2 = lico na linii placu)
      return { x: t.x, z: t.z, own: h.w / 2 };
    },
    stall: () => {                                                                                        // sukiennik (kind z motywu #11) albo kram najbliżej startu
      const s = stalls.find(s => s.kind === 'sukiennik') ?? stalls.reduce((a, b) => (dist(b, start) < dist(a, start) ? b : a));
      return { x: s.x, z: s.z, own: U.stallCollide };
    },
  };
  const pois = CONFIG.pois.map(p => { const q = resolve[p.at](); return { name: p.name, at: p.at, x: q.x, z: q.z, own: q.own, r: q.own + p.margin }; });
  // asercje: nazwa, położenie w świecie, promień, start gracza poza r każdego POI (podpis nie wisi od pierwszej klatki), wieża osiągalna z placu
  for (const p of pois) {
    check(p.name.length > 0 && p.r > 0, 'POI bez nazwy lub promienia', p);
    check(Math.abs(p.x) <= extent && Math.abs(p.z) <= extent, 'POI poza światem', p);
    check(dist(p, start) > p.r, 'POI podpisany już na starcie (start w r)', { ...p, d: dist(p, start) });
  }
  const tower = pois.find(p => p.at === 'tower');
  if (tower) { // najbliższy punkt placu (±(half − 0.3), jak addWalkable w layout.js) musi leżeć w r — inaczej podpisu wieży nigdy nie widać
    const edge = { x: Math.max(-(half - 0.3), Math.min(half - 0.3, tower.x)), z: Math.max(-(half - 0.3), Math.min(half - 0.3, tower.z)) }; // 0.3 = margines addWalkable
    check(dist(edge, tower) <= tower.r, 'wieża nieosiągalna w promieniu podpisu', { edge, d: dist(edge, tower), r: tower.r });
  }
  return pois;
}

const el = id => document.getElementById(id);

// zmienne CSS --ui-* z CONFIG.ui (index.html ma fallbacki o tych samych wartościach)
function applyTheme(U) {
  const root = document.documentElement.style, C = U.colors;
  const vars = { gold: C.gold, 'gold-a': C.goldA, ink: C.ink, mood: C.mood, btn: C.button, hint: C.hint, bg0: C.bg0, bg1: C.bg1, vig: C.vignette,
                 'vig-blur': U.vignetteBlur + 'px', font: U.font, fade: U.fadeMs + 'ms', frame: U.frameInset + 'px', 'btn-w': U.buttonWidth + 'vw' }; // vw: 60 % EKRANU, nie kontenera #start (padding 24 px)
  for (const [k, v] of Object.entries(vars)) root.setProperty('--ui-' + k, v);
  for (const [k, v] of Object.entries(U.size)) root.setProperty('--ui-size-' + k, v + 'px');
  document.body.classList.add('ui');
}

// ekran startowy: teksty z CONFIG.ui, „Wejdź" → fade-out (CSS transition fadeMs) → hidden; window.__enter() dla testów
function initStart(U) {
  const s = el('start'); if (!s) return;
  el('title').textContent = U.title; el('subtitle').textContent = U.subtitle; el('mood').textContent = U.mood;
  el('enter').textContent = U.enter; el('hint').textContent = U.hint;
  const enter = () => { s.classList.add('out'); setTimeout(() => { s.hidden = true; }, U.fadeMs); };
  el('enter').addEventListener('click', enter, { once: true });
  window.__enter = enter;
  s.hidden = false;
}

// podpisy miejsc: co klatkę najbliższy POI względem swojego r; DOM zmieniany tylko przy zmianie stanu
function initCaption(W, U, pois) {
  const c = el('caption'); if (!c) return;
  let last = '';
  W.ctx.updaters.push((dt, t, p) => {
    let best = null, rel = Infinity;
    for (const q of pois) { const k = dist(p, q) / q.r; if (k < 2 && k < rel) { rel = k; best = q; } }
    const key = best ? (rel < 1 ? 'n:' : 'f:') + best.name : '';
    if (key === last) return; last = key;
    c.hidden = !best; c.classList.toggle('far', !!best && rel >= 1);
    c.textContent = best ? (rel < 1 ? best.name : U.near) : '';
  });
}

export function initUI(W) {
  if (W.ctx.flags.noui) return;
  const U = W.CONFIG.ui;
  applyTheme(U);
  if (!W.ctx.flags.hud) for (const id of ['hud', 'gpu']) { const e = el(id); if (e) e.hidden = true; }
  const pois = poiPlan(W);
  W.pois = pois; window.__pois = pois; // hook testowy (ui_shot.js → results.json)
  initCaption(W, U, pois);
  initStart(U);
}
