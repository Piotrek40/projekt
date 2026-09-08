// Warstwa UI sceny (motyw #15): ekran startowy z nazwą miejsca, pergaminowy HUD (joystick, przycisk jakości), podpisy miejsc (POI) i winieta.
// Flaga: ?noui=1 (engine/app.js chowa #vignette/#caption/#start; tu chowa #hud/#gpu/#q i wczesny return — rendery pomiarowe bez żadnej nakładki). ?hud=1 pokazuje licznik fps/draw i GPU.
// Układ: współrzędne świata (x, z) jak layout.js, metry; odległość gracza liczona w płaszczyźnie xz. Teksty, kolory (ekranowe CSS) i rozmiary
// tylko z CONFIG.ui; POI z CONFIG.pois — pozycje NIE są wpisane, liczy je poiPlan(W) (funkcja czysta, test U); widoczność w kadrze: poiInView (test U2).
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

// Połowa POZIOMEGO fov kamery: three.js `fov` jest pionowe, a telefon w pionie ma aspect ≈ 0,45 —
// przy fov 70° i 412×915 poziome pole widzenia to zaledwie ≈ 36° (połowa ≈ 18°). Liczone co klatkę, bo aspect zmienia się przy obrocie ekranu.
const halfHFov = cam => Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect);

// Czy POI mieści się w poziomym kadrze. Kierunek patrzenia jak engine/src/app.js:146 — f = (−sin yaw, −cos yaw).
// Obiekt nie jest punktem: dopuszczamy kąt do połowy kadru + kąt bryłowy własnego promienia (asin(own/d)) + luz CONFIG.ui.captionSlack.
// Pion (pitch) świadomie pomijany: gracz patrzący pod nogi wciąż stoi przy miejscu, o którym mowa.
export function poiInView(p, q, half, slack) {
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
  if (d <= q.own) return true;                                    // gracz wewnątrz obrysu obiektu — obiekt jest dokoła niego
  const cos = (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / d; // f · (kierunek do POI), oba jednostkowe
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= half + Math.asin(Math.min(1, q.own / d)) + slack;
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

// podpisy miejsc: co klatkę najbliższy POI względem swojego r, ale TYLKO taki, który widać w kadrze (poiInView);
// bez tego warunku podpis „Kram sukiennika" wisiał, gdy gracz stał przy kramie tyłem do niego (zrzuty z S24). DOM zmieniany tylko przy zmianie stanu.
function initCaption(W, U, pois) {
  const c = el('caption'); if (!c) return;
  const cam = W.ctx.camera, slack = (U.captionSlack ?? 0) * Math.PI / 180;
  let last = '';
  W.ctx.updaters.push((dt, t, p) => {
    const half = halfHFov(cam);
    let best = null, rel = Infinity;
    for (const q of pois) { const k = dist(p, q) / q.r; if (k < 2 && k < rel && poiInView(p, q, half, slack)) { rel = k; best = q; } }
    const key = best ? (rel < 1 ? 'n:' : 'f:') + best.name : '';
    if (key === last) return; last = key;
    c.hidden = !best; c.classList.toggle('far', !!best && rel >= 1);
    c.textContent = best ? (rel < 1 ? best.name : U.near) : '';
  });
}

// Ukrywa elementy DOM po id (atrybut hidden → display:none z arkusza UA; #hud/#gpu/#q nie mają własnego display)
const hide = ids => { for (const id of ids) { const e = el(id); if (e) e.hidden = true; } };

export function initUI(W) {
  const f = W.ctx.flags;
  // licznik fps/draw (#hud) i nazwa GPU (#gpu) ukryte domyślnie (§5.4), ?hud=1 pokazuje — PRZED wczesnym return na ?noui=1 (poprawka r1, krytyk geometrii):
  // rendery pomiarowe idą z noui=1 i miały pasek u góry (zasłaniał iglicę wieży w start_plac, fałszował sondy nieba) oraz tekst ANGLE i przycisk „high" na dole
  if (!f.hud) hide(['hud', 'gpu']);
  if (f.noui) { hide(['q']); return; }   // bez UI = bez żadnej nakładki: także przycisk jakości #q (winietę/podpis/ekran startowy chowa engine/app.js)
  const U = W.CONFIG.ui;
  applyTheme(U);
  const pois = poiPlan(W);
  W.pois = pois; window.__pois = pois; // hook testowy (ui_shot.js → results.json)
  initCaption(W, U, pois);
  initStart(U);
}
