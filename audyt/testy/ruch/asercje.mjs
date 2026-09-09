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
// T: średni odstęp IC→IC tej samej stopy (tylko czasy zdarzeń z harmonogramu).
// krok podwójny: średni odstęp kolejnych ŚRODKÓW PODPARCIA tej samej stopy (tylko rozstawienie stóp).
//
// CZEGO K1 NA KLIPIE Z WPIECZONYM RUCHEM KORZENIA NIE WYKRYJE — zmierzone, nie domyślane:
//   • dryf korzenia +0,35 m/s  → błąd K1 1,46 % (bez zmian), bo stopy są dziećmi korzenia i jadą razem z nim;
//   • korzeń × 1,30 / × 0,70 drogi → błąd 1,54 % / 1,84 % (bez zmian), z tego samego powodu;
//   • skrócenie wymachu ud i kolan ×0,6 przy nietkniętym korzeniu → 1,50 % (bez zmian), bo stopa wraca do tego
//     samego położenia względem miednicy co cykl, więc odstęp środków podparcia = droga miednicy na cykl.
//   • harmonogram z co drugim zdarzeniem IC → błąd 2,90 % (nadal w tolerancji), bo razem z T ×2 rośnie ×2
//     także odstęp środków podparcia.
// Dla KAŻDEGO ruchu okresowego z wpieczonym korzeniem droga miednicy na cykl RÓWNA SIĘ długości kroku — K1 na
// samym klipie jest więc niemal tożsamością. JEDYNE, co na klipie realnie sprawdza, to zgodność CZASU cyklu
// z GEOMETRIĄ kroku: przy znacznikach IC rozciągniętych ×1,2 przy nietkniętych przedziałach kontaktu oblewa.
// Poślizg wykrywa K2, nie K1.
// PRAWDZIWE miejsce K1 to SILNIK — funkcja K1zSilnika niżej: prędkość, którą kontroler przesuwa postać, NIE
// pochodzi z klipu, więc porównanie v_komendy × T z długością kroku klipu tautologią nie jest.
export function K1(s, h) {
  const v = C.predkoscKorzenia(s).srednia;
  const T = S.srednia([...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')]);
  const krok = C.dlugoscKrokuPodwojnego(s, h).srednia;
  const wyliczony = v * T, blad = Math.abs(wyliczony - krok) / krok;
  if (!Number.isFinite(blad)) return w('K1', 'fail', false, `nie da się policzyć: v ${f3(v)} m/s, T ${f3(T)} s, krok ${f3(krok)} m (harmonogram nie daje pełnych cykli)`, { v, T, krok });
  return w('K1', 'fail', blad <= PROGI.K1_tolerancja,
    `v_korzenia ${f3(v)} m/s × T ${f3(T)} s = ${f3(wyliczony)} m vs krok podwójny ze stóp ${f3(krok)} m → błąd ${(blad * 100).toFixed(2)} % (próg ${PROGI.K1_tolerancja * 100} %)`,
    { v, T, krok, wyliczony, blad });
}

// K1 w wersji SILNIKOWEJ: v_komendy (z kodu gry / logu odtwarzania) × T_odtwarzania vs długość kroku klipu.
// Tu żadna z trzech liczb nie wynika z pozostałych: prędkość ustawia kontroler, T zależy od tempa odtwarzania,
// długość kroku jest stałą zmierzoną raz na assecie (K1(...).liczby.krok).
export function K1zSilnika({ vKomendy, tempoOdtwarzania = 1, tKlipu, krokKlipu }) {
  const T = tKlipu / tempoOdtwarzania, wyliczony = vKomendy * T, blad = Math.abs(wyliczony - krokKlipu) / krokKlipu;
  return w('K1-silnik', 'fail', blad <= PROGI.K1_tolerancja,
    `v_komendy ${f3(vKomendy)} m/s × T ${f3(T)} s (klip ${f3(tKlipu)} s / tempo ${f2(tempoOdtwarzania)}) = ${f3(wyliczony)} m vs krok podwójny klipu ${f3(krokKlipu)} m → błąd ${(blad * 100).toFixed(2)} % (próg ${PROGI.K1_tolerancja * 100} %); przy błędzie ${(blad * 100).toFixed(1)} % stopa jedzie ${(Math.abs(wyliczony - krokKlipu) * 100).toFixed(1)} cm na krok podwójny`,
    { vKomendy, T, krokKlipu, blad });
}

// --- K2 -------------------------------------------------------------------------------------------------------
export function K2(s, h) {
  const p = C.poslizg(s, h);
  const zle = [];
  for (const [r, x] of Object.entries(p)) {
    if (!Number.isFinite(x.mediana)) { zle.push(`${r}: ZERO klatek kontaktu w harmonogramie — nie ma czego mierzyć`); continue; }
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
  const m = C.mtc(s, h, 'czubek');
  const mStaw = C.mtc(s, h, 'palec');
  const mtcWartosci = [...m.L.lista, ...m.P.lista];
  const mtcMin = mtcWartosci.length ? Math.min(...mtcWartosci) : NaN, mtcSr = S.srednia(mtcWartosci);
  const zle = [];
  if (!wZakr(v, PROGI.K4_predkosc)) zle.push(`prędkość ${f3(v)} m/s poza [${PROGI.K4_predkosc}]`);
  if (!wZakr(sz, PROGI.K4_szerokosc)) zle.push(`szerokość kroku ${(sz * 100).toFixed(1)} cm poza [${PROGI.K4_szerokosc.map(x => x * 100)}]`);
  return w('K4', 'fail', zle.length === 0,
    `v ${f3(v)} m/s, szerokość kroku ${(sz * 100).toFixed(1)} cm, MTC śr ${(mtcSr * 1000).toFixed(1)} mm na CZUBKU BUTA (min ${(mtcMin * 1000).toFixed(1)}, n=${mtcWartosci.length}); dla porównania na stawie ToeBase ${(S.srednia([...mStaw.L.lista, ...mStaw.P.lista]) * 1000).toFixed(1)} mm` + (zle.length ? ' → ' + zle.join('; ') : ''),
    { v, szerokosc: sz, mtcSr, mtcMin, mtc: m, mtcStaw: mStaw });
}
// MTC osobno i jako OSTRZEŻENIE: liczba zależy od tego, GDZIE na stopie leży mierzony punkt. Literaturowe
// 15,0 ± 4,0 mm (n=121) dotyczy markera na przodzie buta; rig ma tylko staw ToeBase kilka cm nad podeszwą
// (daje 32,0 mm na zdrowym chodzie ACCAD), a czubek buta jest KONSTRUOWANY ze stałą C_CZUBEK, na którą wynik
// jest czuły (0,25 → 30 mm, 0,5 → 21 mm, 0,75 → 0 mm). Twardy FAIL na takiej liczbie byłby fikcją.
export function K4mtc(s, h) {
  const m = C.mtc(s, h, 'czubek'), mStaw = C.mtc(s, h, 'palec');
  const lista = [...m.L.lista, ...m.P.lista], sr = S.srednia(lista), mn = lista.length ? Math.min(...lista) : NaN;
  const srStaw = S.srednia([...mStaw.L.lista, ...mStaw.P.lista]);
  if (!Number.isFinite(sr)) return w('K4-MTC', 'info', true, `MTC nie do policzenia: harmonogram nie daje ani jednej pary podpora→wymach→podpora`, {});
  return w('K4-MTC', 'ostrzezenie', wZakr(sr, PROGI.K4_mtc),
    `MTC na CZUBKU BUTA (punkt konstruowany, C_CZUBEK): śr ${(sr * 1000).toFixed(1)} mm, min ${(mn * 1000).toFixed(1)} mm, n=${lista.length}; na stawie ToeBase ${(srStaw * 1000).toFixed(1)} mm; zakres celu [${PROGI.K4_mtc.map(x => x * 1000)}] mm (źródło 15,0 ± 4,0 mm, n=121, marker na przodzie buta)`,
    { sr, mn, srStaw, lista });
}

// --- K5 (OSTRZEŻENIA) -----------------------------------------------------------------------------------------
export function K5(s, h, k) {
  const a = C.katy(s, h, k);
  const uw = [];
  for (const st of ['L', 'P']) {
    if (!Number.isFinite(a[st].kolanoWymachMax)) uw.push(`kolano ${st}: brak wymachów w harmonogramie`);
    else if (!wZakr(a[st].kolanoWymachMax, PROGI.K5_kolano_wymach)) uw.push(`kolano ${st} w wymachu ${f2(a[st].kolanoWymachMax)}° poza [${PROGI.K5_kolano_wymach}]`);
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
// PARA W PRZECIWFAZIE TO RAMIĘ I UDO TEJ SAMEJ STRONY, nie przeciwnej. Lewa ręka wychodzi do przodu RAZEM
// z prawą nogą, więc przy jednej konwencji kąta (dodatnie = segment do przodu, w płaszczyźnie strzałkowej)
// korelacja ramię_L ↔ udo_P jest DODATNIA, a ramię_L ↔ udo_L UJEMNA.
// Zmierzone na ACCAD Male1_B3_Walk (zdrowy chód 1,29 m/s): ta sama strona −0,909 / −0,897, przeciwna +0,921 / +0,926.
// Dlatego próg ≤ −0,80 nakładamy na parę Z TEJ SAMEJ STRONY (to jest para „ramię przeciwne do nogi", o którą
// chodzi w K7), a parę przeciwstronną sprawdzamy symetrycznie: ≥ +0,80. Test w obie strony, bez dowolności znaku.
export function K7(s, k) {
  const r = C.korelacjaRamieUdo(s, k);
  const przeciwfaza = Math.max(r.L_vs_udoL, r.P_vs_udoP);      // ma być ≤ −0,80
  const wfazie = Math.min(r.L_vs_udoP, r.P_vs_udoL);           // ma być ≥ +0,80
  const zle = [];
  if (!(przeciwfaza <= PROGI.K7_korelacja_max)) zle.push(`ramię↔udo TEJ SAMEJ strony ${f3(przeciwfaza)} > ${PROGI.K7_korelacja_max} — ręce nie chodzą w przeciwfazie z nogą`);
  if (!(wfazie >= -PROGI.K7_korelacja_max)) zle.push(`ramię↔udo strony PRZECIWNEJ ${f3(wfazie)} < ${-PROGI.K7_korelacja_max} — ręka nie idzie w parze z przeciwną nogą`);
  return w('K7', 'fail', zle.length === 0,
    `ta sama strona L↔udoL ${f3(r.L_vs_udoL)}, P↔udoP ${f3(r.P_vs_udoP)} (ma być ≤ ${PROGI.K7_korelacja_max}); przeciwna L↔udoP ${f3(r.L_vs_udoP)}, P↔udoL ${f3(r.P_vs_udoL)} (ma być ≥ ${-PROGI.K7_korelacja_max}); ROM ramion ${f2(r.zakresRamieL)}° / ${f2(r.zakresRamieP)}°` + (zle.length ? ' → ' + zle.join('; ') : ''),
    r);
}

// --- K8 -------------------------------------------------------------------------------------------------------
export function K8(s, h) {
  const r = C.skokiPredkosci(s, h, { okno: PROGI.K8_okno_s });
  return w('K8', 'fail', r.maxPozaOdbiciem < PROGI.K8_delta_v,
    `|Δv poziome| w oknie ${PROGI.K8_okno_s * 1000} ms na RESZCIE po odjęciu profilu cyklu: poza odbiciem ${f3(r.maxPozaOdbiciem)} m/s (klatka ${r.klatka}), z odbiciem ${f3(r.maxWszedzie)} m/s w zakresie klatek [${r.zakres}] (próg ${PROGI.K8_delta_v}); SUROWA miednica ${f3(r.surowaMiednicaMax)} m/s — na surowym sygnale próg 0,10 oblewa każdy zdrowy chód${r.resztaCykliczna ? '' : ' [UWAGA: za mało cykli na profil, mierzone na surowej miednicy]'}`,
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
    `CV czasu cyklu WEWNĄTRZ klipu ${(cv * 100).toFixed(2)} % (n=${t.length}); dla klipu ZAPĘTLONEGO wartość ~0 jest OCZEKIWANA i NIE jest błędem (K9 rozstrzyga się na logu silnika), tu klip to surowe mocap, więc CV odbija zmienność aktora`,
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
// Idle w grze jest ZAPĘTLONY, więc jeśli klip jest krótszy niż K11_min_okresow okresów najwolniejszego oddechu,
// analizujemy sygnał POWIELONY tyle razy, ile trzeba — dokładnie to widzi gracz. Powielenie klipu, który nie
// domyka się w pętli, wprowadza skok na szwie; dlatego raportujemy też nieciągłość szwu.
export function K11(s, { rola = 'klatka' } = {}) {
  const potrzeba = PROGI.K11_min_okresow / PROGI.K11_pasmo[0];
  const powtorzen = Math.max(1, Math.ceil(potrzeba / s.czas));
  const y0 = new Float64Array(s.n); for (let i = 0; i < s.n; i++) y0[i] = s.p[rola][3 * i + 1];
  const szew = Math.abs(y0[s.n - 1] - y0[0]);
  const y = new Float64Array(s.n * powtorzen);
  for (let r = 0; r < powtorzen; r++) y.set(y0, r * s.n);
  const okresow = s.czas * powtorzen * PROGI.K11_pasmo[0];
  const wPasmie = S.skanPasma(y, s.dt, PROGI.K11_pasmo[0], PROGI.K11_pasmo[1], 0.002);
  const poza = S.skanPasma(y, s.dt, 0.60, 2.00, 0.02);
  if (powtorzen > 1 && szew > 0.005) return w('K11', 'fail', false,
    `klip ${f2(s.czas)} s trzeba powielić ×${powtorzen}, żeby zmierzyć ${PROGI.K11_pasmo[0]} Hz, ale szew pętli ma ${(szew * 1000).toFixed(1)} mm skoku pionu (${rola}) — powielony sygnał to artefakt, nie oddech`,
    { okresow, szew, powtorzen, wPasmie });
  const ok = wZakr(wPasmie.A, PROGI.K11_amplituda);
  return w('K11', 'fail', ok,
    `oddech (${rola}, pion, sygnał ×${powtorzen} = ${f2(s.czas * powtorzen)} s): A ${(wPasmie.A * 1000).toFixed(2)} mm przy ${f3(wPasmie.f)} Hz, zakres [${PROGI.K11_amplituda.map(x => x * 1000)}] mm w paśmie ${PROGI.K11_pasmo} Hz; poza pasmem (0,6–2 Hz) A ${(poza.A * 1000).toFixed(2)} mm; UWAGA: ta metoda NIE odróżnia oddechu od powolnego kołysania postawy o tej samej częstotliwości — na ACCAD Female1_A02_Sway daje 7,07 mm przy 0,232 Hz, a to kołysanie, nie oddech`,
    { wPasmie, poza, okresow, powtorzen, szew });
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
