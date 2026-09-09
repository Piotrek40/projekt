// Metryki chodu liczone ze śladu (pozycje światowe stawów) + JAWNEGO harmonogramu kontaktu.
// Nic tu nie wykrywa kontaktu progiem prędkości — kontakt przychodzi z pliku (patrz kontakt.mjs).
//
// KONWENCJA KĄTÓW (K5): kąty SEGMENTOWE liczone ze ŚRODKÓW STAWÓW rigu, w płaszczyźnie strzałkowej rozpiętej
// przez kierunek marszu d i pion. To NIE jest konwencja kliniczna (markery na skórze, kąt względem segmentu
// proksymalnego z osiami anatomicznymi) — dlatego K5 daje OSTRZEŻENIA, nie FAIL.
//   kolano  = 180° − ∠(biodro−kolano, kostka−kolano)          [0° = noga prosta, dodatnie = zgięcie]
//   biodro  = kąt uda (kolano−biodro) względem osi tułowia (miednica−klatka) w płaszczyźnie strzałkowej,
//             dodatni = udo do przodu (zgięcie)
//   kostka  = 90° − ∠(kolano−kostka, palec−kostka)             [dodatnie = zgięcie grzbietowe]
import * as S from './sygnal.mjs';

const DEG = 180 / Math.PI;
const wek = (s, r, i) => [s.p[r][3 * i], s.p[r][3 * i + 1], s.p[r][3 * i + 2]];
const odjm = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dl = a => Math.hypot(a[0], a[1], a[2]);
const kat = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (dl(u) * dl(v))))) * DEG;

// Kierunek marszu: przemieszczenie miednicy między pierwszą i ostatnią klatką (chód po prostej).
export function kierunek(s) {
  const n = s.n, mp = s.p.miednica;
  const dx = mp[3 * (n - 1)] - mp[0], dz = mp[3 * (n - 1) + 2] - mp[2], L = Math.hypot(dx, dz);
  if (L < 0.2) return null;                       // stanie/idle — kierunek nieokreślony
  return { dx: dx / L, dz: dz / L, droga: L };
}

// Średnia PRĘDKOŚĆ pozioma korzenia = średnia z chwilowych |dp/dt| miednicy.
// Świadomie NIE liczona jako droga/czas ani jako krok/T — K1 ma porównywać niezależne wielkości.
export function predkoscKorzenia(s) {
  const v = S.predkoscPozioma(s.p.miednica, s.n, s.dt);
  return { srednia: S.srednia(v), mediana: S.mediana(v), przebieg: v };
}

// Zdarzenia z harmonogramu → czasy cyklu (IC→IC tej samej stopy) w sekundach.
export function czasyCykli(h, stopa) {
  const ic = h.stopy[stopa].map(p => p.ic);
  const out = []; for (let i = 1; i < ic.length; i++) out.push((ic[i] - ic[i - 1]) / h.fps);
  return out;
}

// Środek pola podparcia stopy w danej podporze = średnia pozycja punktu w jego przedziale kontaktu.
export function srodkiPodparc(s, h, stopa, punkt) {
  return h.stopy[stopa].map(p => {
    const [a, b] = p[punkt === 'pieta' ? 'pieta' : 'palec'];
    const r = punkt === 'pieta' ? 'pieta' + stopa : 'palec' + stopa;
    let x = 0, y = 0, z = 0; for (let i = a; i <= b; i++) { x += s.p[r][3 * i]; y += s.p[r][3 * i + 1]; z += s.p[r][3 * i + 2]; }
    const m = b - a + 1; return { x: x / m, y: y / m, z: z / m, ic: p.ic, to: p.to };
  });
}

// DŁUGOŚĆ KROKU PODWÓJNEGO z ROZSTAWIENIA STÓP (nie z prędkości, nie z czasu): odległość między kolejnymi
// środkami podparcia tej samej stopy.
export function dlugoscKrokuPodwojnego(s, h) {
  const dl_ = [];
  for (const st of ['L', 'P']) {
    const c = srodkiPodparc(s, h, st, 'pieta');
    for (let i = 1; i < c.length; i++) dl_.push(Math.hypot(c[i].x - c[i - 1].x, c[i].z - c[i - 1].z));
  }
  return { srednia: S.srednia(dl_), lista: dl_ };
}

// SZEROKOŚĆ KROKU: odległość środków podparcia L i P w kierunku PROSTOPADŁYM do marszu (pary sąsiadujących podpór).
export function szerokoscKroku(s, h, k) {
  const lx = -k.dz, lz = k.dx;                                   // oś boczna
  const L = srodkiPodparc(s, h, 'L', 'pieta'), P = srodkiPodparc(s, h, 'P', 'pieta');
  const w = [];
  for (const a of L) { const b = P.reduce((best, q) => Math.abs(q.ic - a.ic) < Math.abs(best.ic - a.ic) ? q : best, P[0]); if (b) w.push(Math.abs((a.x - b.x) * lx + (a.z - b.z) * lz)); }
  return { srednia: S.srednia(w), lista: w };
}

// Maski podpory (IC…TO) z harmonogramu.
export function maskiPodpory(h, n) {
  const m = { L: new Uint8Array(n), P: new Uint8Array(n) };
  for (const st of ['L', 'P']) for (const p of h.stopy[st]) for (let i = Math.max(0, p.ic); i < Math.min(n, p.to); i++) m[st][i] = 1;
  return m;
}

// Fazy cyklu: podpora / wymach / lot / podwójne podparcie (POJEDYNCZY interwał i SUMA — źródła podają obie).
export function fazy(h, n, T) {
  const m = maskiPodpory(h, n);
  const ile = a => { let c = 0; for (const v of a) c += v; return c; };
  const oba = new Uint8Array(n); for (let i = 0; i < n; i++) oba[i] = m.L[i] && m.P[i] ? 1 : 0;
  const zaden = new Uint8Array(n); for (let i = 0; i < n; i++) zaden[i] = (!m.L[i] && !m.P[i]) ? 1 : 0;
  // pojedyncze interwały podwójnego podparcia
  const interwaly = []; let i = 0;
  while (i < n) { if (oba[i]) { let j = i; while (j < n && oba[j]) j++; if (j - i >= 2) interwaly.push(j - i); i = j; } else i++; }
  const cykl = T * h.fps;
  const podporaProc = {};
  for (const st of ['L', 'P']) {
    const p = h.stopy[st].map(x => (x.to - x.ic) / cykl * 100);
    podporaProc[st] = { lista: p, srednia: S.srednia(p) };
  }
  return {
    podporaProc, podporaSrednia: (podporaProc.L.srednia + podporaProc.P.srednia) / 2,
    wymachSrednia: 100 - (podporaProc.L.srednia + podporaProc.P.srednia) / 2,
    lotProc: ile(zaden) / n * 100,
    dsPojedynczyProc: interwaly.length ? S.srednia(interwaly.map(x => x / cykl * 100)) : 0,
    dsSumaProc: ile(oba) / n * 100,
    dsInterwalow: interwaly.length,
  };
}

// MTC — minimalny prześwit w WYMACHU, względem wysokości TEGO SAMEGO punktu w JEGO podporach.
// Punkt: 'czubek' (czubek buta, jeśli harmonogram go ma) — literaturowe 15 ± 4 mm dotyczy markera na przodzie
// buta. Fallback 'palec' = staw ToeBase, który leży kilka cm nad podeszwą i daje wartości zawyżone.
export function mtc(s, h, punkt = 'czubek') {
  const out = {};
  for (const st of ['L', 'P']) {
    const r = (s.p[punkt + st] ? punkt : 'palec') + st, kroki = h.stopy[st];
    const wart = [];
    for (let i = 0; i < kroki.length - 1; i++) {
      const a = kroki[i].to, b = kroki[i + 1].ic;
      if (b - a < 6) continue;
      // odniesienie: mediana wysokości palca w przedziałach kontaktu SĄSIADUJĄCYCH podpór
      const ref = [];
      for (const [x, y] of [kroki[i].palec, kroki[i + 1].palec]) for (let j = x; j <= y; j++) ref.push(s.p[r][3 * j + 1]);
      const r0 = S.mediana(ref);
      // MTC = lokalne minimum w ŚRODKOWEJ części wymachu (po uniesieniu, przed opadaniem na piętę)
      const a2 = a + Math.round(0.25 * (b - a)), b2 = a + Math.round(0.80 * (b - a));
      let mn = Infinity; for (let j = a2; j <= b2; j++) mn = Math.min(mn, s.p[r][3 * j + 1]);
      wart.push(mn - r0);
    }
    out[st] = { lista: wart, srednia: S.srednia(wart), min: wart.length ? Math.min(...wart) : NaN };
  }
  return out;
}

// Poślizg punktu kontaktu. Prędkość liczona TYLKO z par klatek LEŻĄCYCH W KONTAKCIE (różnica do przodu wewnątrz
// przedziału) — różnica centralna na brzegu przedziału sięgałaby klatki spoza kontaktu i dawała sztuczne szczyty.
export function poslizg(s, h) {
  const out = {};
  for (const st of ['L', 'P']) for (const [nazwaPkt, klucz] of [['pieta', 'pieta'], ['palec', 'palec']]) {
    const r = nazwaPkt + st, wszystkie = [], perPodpora = [];
    for (const p of h.stopy[st]) {
      const [a, b] = p[klucz]; if (b - a < 2) continue;
      const v = [];
      for (let i = a; i < b; i++) v.push(Math.hypot(s.p[r][3 * (i + 1)] - s.p[r][3 * i], s.p[r][3 * (i + 1) + 2] - s.p[r][3 * i + 2]) / s.dt);
      let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
      for (let i = a; i <= b; i++) { const x = s.p[r][3 * i], z = s.p[r][3 * i + 2]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); }
      perPodpora.push({ ic: p.ic, klatki: [a, b], dryf: Math.hypot(mxx - mnx, mxz - mnz), mediana: S.mediana(v), szczyt: Math.max(...v) });
      wszystkie.push(...v);
    }
    out[r] = { mediana: wszystkie.length ? S.mediana(wszystkie) : NaN, szczyt: wszystkie.length ? Math.max(...wszystkie) : NaN,
      dryfMax: perPodpora.length ? Math.max(...perPodpora.map(x => x.dryf)) : NaN, perPodpora };
  }
  return out;
}

// Kąty stawów (konwencja opisana w nagłówku pliku) — zakresy i wartości w wymachu.
export function katy(s, h, k) {
  const out = {};
  for (const st of ['L', 'P']) {
    const kol = new Float64Array(s.n), bio = new Float64Array(s.n), kos = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) {
      const B = wek(s, 'biodro' + st, i), K = wek(s, 'kolano' + st, i), A = wek(s, 'kostka' + st, i), T = wek(s, 'palec' + st, i);
      const M = wek(s, 'miednica', i), C = s.p.klatka ? wek(s, 'klatka', i) : [M[0], M[1] + 1, M[2]];
      kol[i] = 180 - kat(odjm(B, K), odjm(A, K));
      const udo = odjm(K, B), tul = odjm(C, M);
      // rzut na płaszczyznę strzałkową (d, pion): składowa wzdłuż d i w pionie
      const pu = [dot(udo, [k.dx, 0, k.dz]), udo[1]], pt = [dot(tul, [k.dx, 0, k.dz]), tul[1]];
      bio[i] = (Math.atan2(-pu[0], -pu[1]) - Math.atan2(pt[0], pt[1])) * DEG;
      kos[i] = 90 - kat(odjm(K, A), odjm(T, A));
    }
    // maksimum zgięcia kolana w WYMACHU (TO → następny IC)
    const kroki = h.stopy[st]; const wym = [];
    for (let i = 0; i < kroki.length - 1; i++) { let mx = -Infinity; for (let j = kroki[i].to; j < kroki[i + 1].ic; j++) mx = Math.max(mx, kol[j]); if (isFinite(mx)) wym.push(mx); }
    out[st] = { kolanoWymachMax: wym.length ? S.srednia(wym) : NaN, kolanoZakres: [S.min_(kol), S.maks(kol)],
      biodroZakres: [S.min_(bio), S.maks(bio)], kostkaZakres: [S.min_(kos), S.maks(kos)] };
  }
  return out;
}

// K6: amplitudy harmoniczne miednicy przy 1/T i 2/T, z JEDNĄ polityką detrendu dla obu kanałów.
export function oscylacjeMiednicy(s, k, T, polityka = 'wspolny') {
  const det = S.POLITYKI_DETRENDU[polityka];
  const pion = det(Float64Array.from({ length: s.n }, (_, i) => s.p.miednica[3 * i + 1]));
  const lx = -k.dz, lz = k.dx;
  const bok = det(Float64Array.from({ length: s.n }, (_, i) => s.p.miednica[3 * i] * lx + s.p.miednica[3 * i + 2] * lz));
  const f1 = 1 / T, f2 = 2 / T;
  const a = (sig, f) => S.dopasujSinus(sig, s.dt, f).A;
  return { polityka, f1, f2, pion: { A1: a(pion, f1), A2: a(pion, f2), ptp: S.ptp(pion) }, bok: { A1: a(bok, f1), A2: a(bok, f2), ptp: S.ptp(bok) } };
}

// K7: korelacja kąta ramienia z kątem PRZECIWNEGO uda (oba w płaszczyźnie strzałkowej, względem pionu).
export function korelacjaRamieUdo(s, k) {
  const sag = (rA, rB) => { const o = new Float64Array(s.n); for (let i = 0; i < s.n; i++) { const v = odjm(wek(s, rB, i), wek(s, rA, i)); o[i] = Math.atan2(-dot(v, [k.dx, 0, k.dz]), -v[1]) * DEG; } return o; };
  const rL = sag('barkL', 'lokiecL'), rP = sag('barkP', 'lokiecP'), uL = sag('biodroL', 'kolanoL'), uP = sag('biodroP', 'kolanoP');
  return { L_vs_udoP: S.korelacja(rL, uP), P_vs_udoL: S.korelacja(rP, uL), L_vs_udoL: S.korelacja(rL, uL), P_vs_udoP: S.korelacja(rP, uP),
    zakresRamieL: S.ptp(rL), zakresRamieP: S.ptp(rP) };
}

// K8: największa zmiana WEKTORA prędkości poziomej miednicy w oknie 100 ms.
// UWAGA — mierzymy RESZTĘ po odjęciu uśrednionego po cyklach profilu prędkości, nie surową miednicę.
// Powód (zmierzone na ACCAD Male1_B3_Walk): miednica w zdrowym chodzie zmienia prędkość wzdłuż marszu
// od 1,055 do 1,471 m/s w obrębie jednego kroku, a |Δv| w oknie 100 ms sięga 0,234 m/s przy medianie 0,064.
// Próg 0,10 m/s nałożony na surowy sygnał oblewa KAŻDY prawdziwy chód i nie mierzy tego, co widzi widz —
// widz widzi SZARPNIĘCIE, czyli odstępstwo od tego, co ten sam chód robi w każdym innym cyklu.
// Profil cykliczny: średnia prędkość w funkcji fazy cyklu (fazę bierzemy z IC lewej stopy z harmonogramu).
export function skokiPredkosci(s, h, { okno = 0.1, przedOdbiciem = 0.10, poOdbiciu = 0.05 } = {}) {
  const sur = S.wektorPredkosci(s.p.miednica, s.n, s.dt);
  const ic = h.stopy.L.map(p => p.ic);
  let vx = sur.vx, vz = sur.vz, surMax = 0;
  { const kO0 = Math.round(okno / s.dt); for (let i = 0; i + kO0 < s.n; i++) surMax = Math.max(surMax, Math.hypot(sur.vx[i + kO0] - sur.vx[i], sur.vz[i + kO0] - sur.vz[i])); }
  if (ic.length >= 3) {
    const T = (ic[ic.length - 1] - ic[0]) / (ic.length - 1);
    const kubelki = Math.max(8, Math.round(T));
    const sx = new Float64Array(kubelki), sz = new Float64Array(kubelki), cnt = new Float64Array(kubelki);
    const faza = i => { const u = ((i - ic[0]) % T + T) % T; return Math.min(kubelki - 1, Math.floor(u / T * kubelki)); };
    for (let i = ic[0]; i < Math.min(s.n, ic[ic.length - 1]); i++) { const b = faza(i); sx[b] += sur.vx[i]; sz[b] += sur.vz[i]; cnt[b]++; }
    for (let b = 0; b < kubelki; b++) if (cnt[b]) { sx[b] /= cnt[b]; sz[b] /= cnt[b]; }
    vx = new Float64Array(s.n); vz = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) { const b = faza(i); vx[i] = sur.vx[i] - sx[b]; vz[i] = sur.vz[i] - sz[b]; }
  }
  const kO = Math.round(okno / s.dt);
  // Skanujemy TYLKO zakres, w którym profil cyklu jest zdefiniowany (od pierwszego do ostatniego IC lewej stopy).
  // Poza nim faza jest ekstrapolowana, a surowy klip mocap ma na brzegach transjent: zmierzone na ACCAD
  // Male1_B3_Walk największe reszty to klatki 7–11 (0,17–0,235 m/s), wszystkie PRZED pierwszym IC = 27.
  const i0 = ic.length >= 3 ? ic[0] : 0, i1 = ic.length >= 3 ? Math.min(s.n - 1, ic[ic.length - 1]) : s.n - 1;
  const maskaOdbicia = new Uint8Array(s.n);
  for (const st of ['L', 'P']) for (const p of h.stopy[st]) {
    const a = Math.max(0, p.to - Math.round(przedOdbiciem / s.dt)), b = Math.min(s.n - 1, p.to + Math.round(poOdbiciu / s.dt));
    for (let i = a; i <= b; i++) maskaOdbicia[i] = 1;
  }
  let maxAll = 0, maxPoza = 0, gdzie = -1;
  for (let i = i0; i + kO <= i1; i++) {
    const d = Math.hypot(vx[i + kO] - vx[i], vz[i + kO] - vz[i]);
    if (d > maxAll) maxAll = d;
    if (!maskaOdbicia[i] && !maskaOdbicia[i + kO] && d > maxPoza) { maxPoza = d; gdzie = i; }
  }
  return { maxWszedzie: maxAll, maxPozaOdbiciem: maxPoza, klatka: gdzie, oknoKlatek: kO, surowaMiednicaMax: surMax, resztaCykliczna: ic.length >= 3, zakres: [i0, i1] };
}
