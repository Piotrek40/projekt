// Asercje ruchu K1–K12. Każda zwraca { id, poziom, ok, opis, liczby } — nic nie drukuje i nic nie rzuca;
// zbieraniem i kodem wyjścia zajmuje się audyt/testy/test_ruch.mjs (wzorzec z test_geometria.mjs).
// poziom: 'fail' = czerwone światło, 'ostrzezenie' = tylko wypisz (K5, patrz niżej).
import * as S from './sygnal.mjs';
import * as C from './chod.mjs';

export const PROGI = {
  K1_tolerancja: 0.03,                      // v_korzenia × T = długość kroku podwójnego, ±3 %
  K2_mediana_ms: 0.05, K2_szczyt_ms: 0.20, K2_dryf_m: 0.025,
  K3_podpora: [59, 60], K3_wymach: [40, 41], K3_lot_max: 0.0,
  K3_ds_pojedynczy: [8.5, 10.5],            // JEDEN interwał podwójnego podparcia ≈ 9,6 %
  K3_ds_suma: [18, 20],                     // SUMA obu interwałów ≈ 19 % — źródła podają obie liczby, różnica 2×
  K4_predkosc: [1.10, 1.55], K4_szerokosc: [0.10, 0.15], K4_mtc: [0.007, 0.025],
  K5_kolano_wymach: [55, 78], K5_biodro_max: 38, K5_kostka_dorsi: 20,
  K6_dominacja: 2.0,                        // amplituda harmonicznej właściwej ≥ 2× amplituda drugiej
  K7_korelacja_max: -0.80,
  K8_delta_v: 0.10, K8_okno_s: 0.1,
  K9_cv: [0.01, 0.03],
  K10_rms: [0.004, 0.015], K10_predkosc: [0.005, 0.030], K10_okno_s: 3,
  K11_pasmo: [0.20, 0.33], K11_amplituda: [0.003, 0.008], K11_min_okresow: 3,
  K12_odstep: [3.0, 4.0], K12_czas_klatek: [6, 18], K12_min_losowosc: 0.10,
};
const w = (id, poziom, ok, opis, liczby) => ({ id, poziom, ok, opis, liczby });
const wZakr = (v, [lo, hi]) => v >= lo && v <= hi;
const f2 = v => Number.isFinite(v) ? v.toFixed(2) : String(v);
const f3 = v => Number.isFinite(v) ? v.toFixed(3) : String(v);

// --- Walidacja samego harmonogramu (warunek wstępny K2/K3) ---------------------------------------------------
export function sprawdzHarmonogram(h, n) {
  const bledy = [];
  for (const st of ['L', 'P']) {
    const lista = h.stopy[st];
    if (!lista || lista.length < 2) { bledy.push(`stopa ${st}: ${lista ? lista.length : 0} podpór (potrzeba ≥ 2)`); continue; }
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (!(p.ic < p.to)) bledy.push(`${st}#${i}: ic ${p.ic} ≥ to ${p.to}`);
      if (p.to > n) bledy.push(`${st}#${i}: to ${p.to} > liczby klatek ${n}`);
      for (const k of ['pieta', 'palec']) {
        const [a, b] = p[k];
        if (a < p.ic - 1 || b > p.to) bledy.push(`${st}#${i}: ${k} [${a},${b}] wychodzi poza podporę [${p.ic},${p.to}]`);
        if ((b - a) / h.fps < 0.15) bledy.push(`${st}#${i}: kontakt ${k} trwa ${((b - a) / h.fps).toFixed(3)} s (< 0,15 s) — harmonogram niewiarygodny`);
      }
      if (i && lista[i - 1].to > p.ic) bledy.push(`${st}#${i}: podpora [${p.ic},${p.to}] zachodzi na poprzednią [${lista[i - 1].ic},${lista[i - 1].to}]`);
    }
  }
  return w('H', 'fail', bledy.length === 0, bledy.length ? `harmonogram kontaktu niespójny: ${bledy.join('; ')}` : `harmonogram spójny (${h.stopy.L.length} podpór L, ${h.stopy.P.length} P)`, { bledy });
}

// --- K1 -------------------------------------------------------------------------------------------------------
// v_korzenia: średnia z chwilowej |dp/dt| miednicy (długość toru / czas).
// T: średni odstęp IC→IC tej samej stopy (tylko czasy zdarzeń).
// krok podwójny: średni odstęp kolejnych ŚRODKÓW PODPARCIA tej samej stopy (tylko rozstawienie stóp).
// Trzy niezależne źródła — dlatego to nie jest tautologia.
export function K1(s, h) {
  const v = C.predkoscKorzenia(s).srednia;
  const T = S.srednia([...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')]);
  const krok = C.dlugoscKrokuPodwojnego(s, h).srednia;
  const wyliczony = v * T, blad = Math.abs(wyliczony - krok) / krok;
  return w('K1', 'fail', blad <= PROGI.K1_tolerancja,
    `v_korzenia ${f3(v)} m/s × T ${f3(T)} s = ${f3(wyliczony)} m vs krok podwójny ze stóp ${f3(krok)} m → błąd ${(blad * 100).toFixed(2)} % (próg ${PROGI.K1_tolerancja * 100} %)`,
    { v, T, krok, wyliczony, blad });
}

// --- K2 -------------------------------------------------------------------------------------------------------
export function K2(s, h) {
  const p = C.poslizg(s, h);
  const zle = [];
  for (const [r, x] of Object.entries(p)) {
    if (x.mediana > PROGI.K2_mediana_ms) zle.push(`${r}: mediana ${(x.mediana * 100).toFixed(1)} cm/s > ${PROGI.K2_mediana_ms * 100}`);
    if (x.szczyt > PROGI.K2_szczyt_ms) zle.push(`${r}: szczyt ${(x.szczyt * 100).toFixed(1)} cm/s > ${PROGI.K2_szczyt_ms * 100}`);
    if (x.dryfMax > PROGI.K2_dryf_m) zle.push(`${r}: dryf ${(x.dryfMax * 100).toFixed(1)} cm > ${PROGI.K2_dryf_m * 100}`);
  }
  const opis = Object.entries(p).map(([r, x]) => `${r} med ${(x.mediana * 100).toFixed(1)} / szczyt ${(x.szczyt * 100).toFixed(0)} cm/s / dryf ${(x.dryfMax * 100).toFixed(1)} cm`).join(' | ');
  return w('K2', 'fail', zle.length === 0, zle.length ? `poślizg stopy: ${zle.join('; ')}` : `bez poślizgu — ${opis}`, { punkty: p, zle });
}

// --- K3 -------------------------------------------------------------------------------------------------------
// TESTUJEMY OBIE liczby podwójnego podparcia i mówimy to wprost: K3_ds_pojedynczy dotyczy JEDNEGO interwału
// (≈ 9,6 % cyklu), K3_ds_suma — SUMY obu interwałów w cyklu (≈ 19 %). Rozjazd między źródłami jest 2×,
// więc podanie samej liczby bez konwencji jest bezwartościowe.
export function K3(s, h) {
  const T = S.srednia([...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')]);
  const f = C.fazy(h, s.n, T);
  const zle = [];
  if (!wZakr(f.podporaSrednia, PROGI.K3_podpora)) zle.push(`podpora ${f2(f.podporaSrednia)} % poza [${PROGI.K3_podpora}]`);
  if (!wZakr(f.wymachSrednia, PROGI.K3_wymach)) zle.push(`wymach ${f2(f.wymachSrednia)} % poza [${PROGI.K3_wymach}]`);
  if (f.lotProc > PROGI.K3_lot_max) zle.push(`faza lotu ${f2(f.lotProc)} % (chód: 0 %)`);
  if (!wZakr(f.dsPojedynczyProc, PROGI.K3_ds_pojedynczy)) zle.push(`podwójne podparcie POJEDYNCZY interwał ${f2(f.dsPojedynczyProc)} % poza [${PROGI.K3_ds_pojedynczy}]`);
  if (!wZakr(f.dsSumaProc, PROGI.K3_ds_suma)) zle.push(`podwójne podparcie SUMA obu interwałów ${f2(f.dsSumaProc)} % poza [${PROGI.K3_ds_suma}]`);
  return w('K3', 'fail', zle.length === 0,
    `podpora ${f2(f.podporaSrednia)} % (L ${f2(f.podporaProc.L.srednia)} / P ${f2(f.podporaProc.P.srednia)}), wymach ${f2(f.wymachSrednia)} %, lot ${f2(f.lotProc)} %, DS pojedynczy ${f2(f.dsPojedynczyProc)} % / suma ${f2(f.dsSumaProc)} % (${f.dsInterwalow} interwałów)` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { ...f, T });
}

// --- K4 -------------------------------------------------------------------------------------------------------
export function K4(s, h, k) {
  const v = C.predkoscKorzenia(s).srednia;
  const sz = C.szerokoscKroku(s, h, k).srednia;
  const m = C.mtc(s, h);
  const mtcWartosci = [...m.L.lista, ...m.P.lista];
  const mtcMin = mtcWartosci.length ? Math.min(...mtcWartosci) : NaN, mtcSr = S.srednia(mtcWartosci);
  const zle = [];
  if (!wZakr(v, PROGI.K4_predkosc)) zle.push(`prędkość ${f3(v)} m/s poza [${PROGI.K4_predkosc}]`);
  if (!wZakr(sz, PROGI.K4_szerokosc)) zle.push(`szerokość kroku ${(sz * 100).toFixed(1)} cm poza [${PROGI.K4_szerokosc.map(x => x * 100)}]`);
  if (!wZakr(mtcSr, PROGI.K4_mtc)) zle.push(`MTC średnie ${(mtcSr * 1000).toFixed(1)} mm poza [${PROGI.K4_mtc.map(x => x * 1000)}]`);
  return w('K4', 'fail', zle.length === 0,
    `v ${f3(v)} m/s, szerokość kroku ${(sz * 100).toFixed(1)} cm, MTC śr ${(mtcSr * 1000).toFixed(1)} mm (min ${(mtcMin * 1000).toFixed(1)}, n=${mtcWartosci.length})` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { v, szerokosc: sz, mtcSr, mtcMin, mtc: m });
}

// --- K5 (OSTRZEŻENIA) -----------------------------------------------------------------------------------------
export function K5(s, h, k) {
  const a = C.katy(s, h, k);
  const uw = [];
  for (const st of ['L', 'P']) {
    if (!wZakr(a[st].kolanoWymachMax, PROGI.K5_kolano_wymach)) uw.push(`kolano ${st} w wymachu ${f2(a[st].kolanoWymachMax)}° poza [${PROGI.K5_kolano_wymach}]`);
    if (a[st].biodroZakres[1] > PROGI.K5_biodro_max) uw.push(`biodro ${st} max ${f2(a[st].biodroZakres[1])}° > ${PROGI.K5_biodro_max}`);
    if (a[st].kostkaZakres[1] > PROGI.K5_kostka_dorsi) uw.push(`kostka ${st} dorsiflexion ${f2(a[st].kostkaZakres[1])}° > ${PROGI.K5_kostka_dorsi}`);
  }
  return w('K5', 'ostrzezenie', uw.length === 0,
    `[konwencja SEGMENTOWA ze środków stawów — nie kliniczna markerowa] kolano wymach L ${f2(a.L.kolanoWymachMax)}° P ${f2(a.P.kolanoWymachMax)}°, biodro L ${a.L.biodroZakres.map(f2)}° P ${a.P.biodroZakres.map(f2)}°, kostka L ${a.L.kostkaZakres.map(f2)}° P ${a.P.kostkaZakres.map(f2)}°` + (uw.length ? ' → ' + uw.join('; ') : ''),
    { katy: a, uwagi: uw });
}

// --- K6 -------------------------------------------------------------------------------------------------------
// Liczymy amplitudy harmoniczne przy 1/T i 2/T dopasowaniem najmniejszych kwadratów z trendem liniowym W MODELU,
// więc wynik jest ten sam dla polityki 'wspolny' i 'brak' (sprawdzane i raportowane) — to zamyka pułapkę
// „retarget wnosi kilka cm dryfu liniowego i mieszane podejście przerzuca wynik".
export function K6(s, k, T) {
  const a = C.oscylacjeMiednicy(s, k, T, 'wspolny'), b = C.oscylacjeMiednicy(s, k, T, 'brak');
  const rPion = a.pion.A2 / a.pion.A1, rBok = a.bok.A1 / a.bok.A2;
  const rPionB = b.pion.A2 / b.pion.A1, rBokB = b.bok.A1 / b.bok.A2;
  const zle = [];
  if (!(rPion >= PROGI.K6_dominacja)) zle.push(`pion: A(2/T)/A(1/T) = ${f2(rPion)} < ${PROGI.K6_dominacja} — pion NIE robi 2 cykli na krok podwójny`);
  if (!(rBok >= PROGI.K6_dominacja)) zle.push(`bok: A(1/T)/A(2/T) = ${f2(rBok)} < ${PROGI.K6_dominacja} — bok NIE robi 1 cyklu na krok podwójny`);
  const rozjazd = Math.abs(rPion - rPionB) > 0.05 * rPion || Math.abs(rBok - rBokB) > 0.05 * rBok;
  return w('K6', 'fail', zle.length === 0,
    `miednica pion A1 ${(a.pion.A1 * 1000).toFixed(1)} mm / A2 ${(a.pion.A2 * 1000).toFixed(1)} mm (iloraz ${f2(rPion)}), bok A1 ${(a.bok.A1 * 1000).toFixed(1)} mm / A2 ${(a.bok.A2 * 1000).toFixed(1)} mm (iloraz ${f2(rBok)}); detrend wspólny vs brak: ${rozjazd ? 'ROZJAZD > 5 %' : 'bez różnicy'}` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { wspolny: a, brak: b, rPion, rBok, rozjazd });
}

// --- K7 -------------------------------------------------------------------------------------------------------
export function K7(s, k) {
  const r = C.korelacjaRamieUdo(s, k);
  const najgorsza = Math.max(r.L_vs_udoP, r.P_vs_udoL);
  return w('K7', 'fail', najgorsza <= PROGI.K7_korelacja_max,
    `korelacja ramię↔przeciwne udo: L↔udoP ${f3(r.L_vs_udoP)}, P↔udoL ${f3(r.P_vs_udoL)} (próg ≤ ${PROGI.K7_korelacja_max}); zgodnostronne dla porównania L↔udoL ${f3(r.L_vs_udoL)}, P↔udoP ${f3(r.P_vs_udoP)}; ROM ramion ${f2(r.zakresRamieL)}° / ${f2(r.zakresRamieP)}°`,
    r);
}

// --- K8 -------------------------------------------------------------------------------------------------------
export function K8(s, h) {
  const r = C.skokiPredkosci(s, h, { okno: PROGI.K8_okno_s });
  return w('K8', 'fail', r.maxPozaOdbiciem < PROGI.K8_delta_v,
    `|Δv poziome| w oknie ${PROGI.K8_okno_s * 1000} ms: poza odbiciem ${f3(r.maxPozaOdbiciem)} m/s (klatka ${r.klatka}), łącznie z odbiciem ${f3(r.maxWszedzie)} m/s (próg ${PROGI.K8_delta_v})`,
    r);
}

// --- K9 -------------------------------------------------------------------------------------------------------
// CV czasu cyklu MA być liczone na LOGU ODTWARZANIA SILNIKA. Wewnątrz klipu (pętla) CV jest strukturalnie ~0
// i to NIE jest błąd — dlatego są dwie funkcje i dwa poziomy.
export function K9zLogu(czasyCykli, { podlogaHz = 60 } = {}) {
  const a = Float64Array.from(czasyCykli);
  if (a.length < 4) return w('K9', 'fail', false, `log odtwarzania ma ${a.length} cykli (potrzeba ≥ 4)`, { n: a.length });
  const cv = S.wspolczynnikZmiennosci(a), sr = S.srednia(a);
  const podloga = (1 / podlogaHz) / Math.sqrt(12) / sr;   // kwantyzacja do klatki: sd = krok/√12
  const ok = wZakr(cv, PROGI.K9_cv);
  return w('K9', 'fail', ok,
    `CV czasu cyklu z logu silnika ${(cv * 100).toFixed(2)} % (n=${a.length}, T̄ ${f3(sr)} s), zakres [${PROGI.K9_cv.map(x => x * 100).join(', ')}] %; podłoga pomiarowa przy ${podlogaHz} Hz = ${(podloga * 100).toFixed(2)} %` +
    (podloga > PROGI.K9_cv[0] ? ' — UWAGA: podłoga pomiarowa wyżej niż dolny próg, przy tym fps testu nie da się odróżnić „za regularnie" od kwantyzacji' : ''),
    { cv, sr, n: a.length, podloga });
}
export function K9naKlipie(h) {
  const t = [...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')];
  const cv = S.wspolczynnikZmiennosci(Float64Array.from(t));
  return w('K9-klip', 'info', true,
    `CV czasu cyklu WEWNĄTRZ klipu ${(cv * 100).toFixed(2)} % (n=${t.length}) — wartość bliska 0 jest OCZEKIWANA (klip jest zapętlony), K9 rozstrzyga się na logu silnika`,
    { cv, n: t.length, czasy: t });
}

// --- K10 / K11 (idle) -----------------------------------------------------------------------------------------
export function K10(s) {
  const W = Math.round(PROGI.K10_okno_s / s.dt);
  if (s.n < W) return w('K10', 'fail', false, `klip ${f2(s.czas)} s krótszy niż okno ${PROGI.K10_okno_s} s`, {});
  const gx = new Float64Array(s.n), gz = new Float64Array(s.n);
  for (let i = 0; i < s.n; i++) { gx[i] = s.p.glowa[3 * i]; gz[i] = s.p.glowa[3 * i + 2]; }
  const rmsy = [];
  for (let a = 0; a + W <= s.n; a += Math.max(1, Math.round(0.25 / s.dt))) {
    const mx = S.srednia(gx.subarray(a, a + W)), mz = S.srednia(gz.subarray(a, a + W));
    let sum = 0; for (let i = a; i < a + W; i++) sum += (gx[i] - mx) ** 2 + (gz[i] - mz) ** 2;
    rmsy.push(Math.sqrt(sum / W));
  }
  const v = S.predkoscPozioma(s.p.glowa, s.n, s.dt), vMed = S.mediana(v);
  const rmsMin = Math.min(...rmsy), rmsMax = Math.max(...rmsy), rmsMed = S.mediana(rmsy);
  const zle = [];
  if (!wZakr(rmsMed, PROGI.K10_rms)) zle.push(`RMS (mediana okien 3 s) ${(rmsMed * 1000).toFixed(1)} mm poza [${PROGI.K10_rms.map(x => x * 1000)}] — BEZRUCH TEŻ JEST BŁĘDEM`);
  if (!wZakr(vMed, PROGI.K10_predkosc)) zle.push(`mediana prędkości głowy ${(vMed * 100).toFixed(2)} cm/s poza [${PROGI.K10_predkosc.map(x => x * 100)}]`);
  return w('K10', 'fail', zle.length === 0,
    `idle: RMS poziomy głowy w oknie 3 s med ${(rmsMed * 1000).toFixed(1)} mm (min ${(rmsMin * 1000).toFixed(1)}, max ${(rmsMax * 1000).toFixed(1)}, okien ${rmsy.length}), v_głowy med ${(vMed * 100).toFixed(2)} cm/s` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { rmsMed, rmsMin, rmsMax, vMed });
}
export function K11(s, { rola = 'klatka' } = {}) {
  const okresow = s.czas * PROGI.K11_pasmo[0];
  const y = new Float64Array(s.n); for (let i = 0; i < s.n; i++) y[i] = s.p[rola][3 * i + 1];
  const wPasmie = S.skanPasma(y, s.dt, PROGI.K11_pasmo[0], PROGI.K11_pasmo[1], 0.002);
  const poza = S.skanPasma(y, s.dt, 0.60, 2.00, 0.02);
  if (okresow < PROGI.K11_min_okresow) return w('K11', 'fail', false,
    `klip ${f2(s.czas)} s = ${f2(okresow)} okresu przy ${PROGI.K11_pasmo[0]} Hz (potrzeba ≥ ${PROGI.K11_min_okresow}) — składowej oddechowej NIE DA SIĘ zmierzyć na tym klipie`,
    { okresow, wPasmie });
  const ok = wZakr(wPasmie.A, PROGI.K11_amplituda);
  return w('K11', 'fail', ok,
    `oddech (${rola}, pion): A ${(wPasmie.A * 1000).toFixed(2)} mm przy ${f3(wPasmie.f)} Hz, zakres [${PROGI.K11_amplituda.map(x => x * 1000)}] mm w paśmie ${PROGI.K11_pasmo} Hz; poza pasmem (0,6–2 Hz) A ${(poza.A * 1000).toFixed(2)} mm`,
    { wPasmie, poza, okresow });
}

// --- K12 ------------------------------------------------------------------------------------------------------
// Rig NPC nie ma kanału mrugnięcia (morph targets odpadły: 8 celów na 38645 wierzchołków = 9,5–10 MB VRAM),
// więc K12 ocenia HARMONOGRAM MRUGNIĘĆ, który generuje silnik: lista [{start, koniec}] w klatkach.
export function K12(mrugniecia, { fps = 60, czasS } = {}) {
  if (!Array.isArray(mrugniecia) || mrugniecia.length < 3) return w('K12', 'fail', false, `harmonogram mrugnięć ma ${mrugniecia?.length ?? 0} pozycji (potrzeba ≥ 3)`, {});
  const czasy = mrugniecia.map(m => m.koniec - m.start);
  const odstepy = []; for (let i = 1; i < mrugniecia.length; i++) odstepy.push((mrugniecia[i].start - mrugniecia[i - 1].start) / fps);
  const zle = [];
  const zaKrotkie = czasy.filter(c => c < PROGI.K12_czas_klatek[0]), zaDlugie = czasy.filter(c => c > PROGI.K12_czas_klatek[1]);
  if (zaKrotkie.length || zaDlugie.length) zle.push(`czas mrugnięcia poza [${PROGI.K12_czas_klatek}] klatek: ${zaKrotkie.length} za krótkich, ${zaDlugie.length} za długich`);
  const sr = S.srednia(odstepy);
  if (!wZakr(sr, PROGI.K12_odstep)) zle.push(`średni odstęp ${f2(sr)} s poza [${PROGI.K12_odstep}] s`);
  const cvOdstepow = S.wspolczynnikZmiennosci(Float64Array.from(odstepy));
  if (!(cvOdstepow >= PROGI.K12_min_losowosc)) zle.push(`odstępy zbyt regularne: CV ${(cvOdstepow * 100).toFixed(1)} % < ${PROGI.K12_min_losowosc * 100} % — „co 3–4 s ± LOSOWO", nie metronom`);
  if (czasS !== undefined) { const oczek = czasS / sr; if (Math.abs(mrugniecia.length - oczek) > 0.5 * oczek) zle.push(`${mrugniecia.length} mrugnięć na ${f2(czasS)} s`); }
  return w('K12', 'fail', zle.length === 0,
    `mrugnięcia: n=${mrugniecia.length}, odstęp ${f2(sr)} s (CV ${(cvOdstepow * 100).toFixed(1)} %, min ${f2(Math.min(...odstepy))}, max ${f2(Math.max(...odstepy))}), czas ${Math.min(...czasy)}–${Math.max(...czasy)} klatek` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { n: mrugniecia.length, sr, cvOdstepow, czasy });
}
