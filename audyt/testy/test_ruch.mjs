// BIBLIOTEKA POMIAROWA RUCHU — asercje K1–K12 na klipach GLB, bez przeglądarki.
// Wzorzec: audyt/testy/test_geometria.mjs (zbieramy porażki, na końcu wypis + exit 1) i engine/src/check.js
// (komunikat mówi WARTOŚĆ i PRÓG, nie samo „nie działa").
//
// Użycie:
//   node audyt/testy/test_ruch.mjs                 — asercje na klipach z manifestu
//   node audyt/testy/test_ruch.mjs --kalibracja    — dodatkowo: te same asercje na CELOWO ZEPSUTYCH klipach;
//                                                    asercja, której nie widziałeś oblewającej, jest bezwartościowa
//   RUCH_KLIPY=/ścieżka/do/klipow node audyt/testy/test_ruch.mjs
//
// Klipy testowe (GLB + <klip>.kontakt.json + manifest.json) NIE leżą w repo — powstają z BVH ACCAD (CC-BY 3.0)
// skryptem scratchpad/npc_build/pomiar/przygotuj.mjs. Bez nich test kończy się komunikatem, co uruchomić.

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// STAN NA 2026-09-09: TA BIBLIOTEKA NIE JEST JESZCZE GOTOWA DO ORZEKANIA O JAKOŚCI RUCHU.
// Weryfikator adwersaryjny znalazł SZEŚĆ FAŁSZYWYCH PRZEJŚĆ, każde pokazane mutacją. Fałszywe
// przejście jest groźniejsze niż fałszywe oblanie: mówi „ruch jest dobry" o ruchu, który dobry
// nie jest. Do naprawy, zanim ktokolwiek oprze na tych liczbach jakąkolwiek decyzję:
//
//  K1zSilnika — noga dodatnia jest TAUTOLOGIĄ. Kalibracja podstawia vKomendy = krok/T, więc
//               v×T − krok ≡ 0 algebraicznie. „Zgodne 0,00 %" wychodzi też dla krok = 999 m przy
//               T = 0,001 s. vKomendy musi przyjść Z ZEWNĄTRZ, z konfiguracji kontrolera.
//  K6         — sprawdza WYŁĄCZNIE kształt, nigdy amplitudy. Pion miednicy przeskalowany ×0,05
//               (36,4 mm → 1,8 mm) daje identyczny iloraz A2/A1 = 2,12 i przechodzi. Taka postać
//               „płynie" zamiast iść. Brakuje progu na amplitudę (ok. 20–40 mm przy 1,3 m/s).
//  K8         — FAŁSZYWE PRZEJŚCIE na wadzie OKRESOWEJ o okresie cyklu, czyli dokładnie na szwie
//               pętli animacji: odjęcie uśrednionego po cyklach profilu pochłania 85–90 % takiej
//               wady (surowe |Δv| 0,617 m/s → reszta poniżej progu). Potrzebny leave-one-out.
//  K9         — liczy tylko CV, które jest ŚLEPE NA KOLEJNOŚĆ. Log naprzemienny 1,098/1,142 s
//               (idealny wzór, ZERO losowości) daje CV 2,00 % → OK. Brakuje autokorelacji lag-1.
//  K10        — nie odróżnia kołysania od SUNIĘCIA. Klip całkowicie zamrożony plus czysty dryf
//               liniowy przechodzi w całym paśmie 0,6–1,5 cm/s. Brakuje detrendu okna.
//  K12        — ma tylko PODŁOGĘ na CV, bez sufitu i bez ograniczenia pojedynczych odstępów.
//               Odstępy naprzemienne 1,0/6,0 s dają CV 75,4 % → OK, a to nie jest „co 3–4 s".
//
// CO PRZETRWAŁO ATAK: mechanika pomiarowa (GLTFLoader.parse → AnimationMixer.setTime →
// matrixWorld), powtarzalność łańcucha bit w bit, K2 (jawny harmonogram kontaktu z kryterium
// wysokościowym — przetrwało nawet regenerację harmonogramu na już zepsutym klipie), oraz to,
// że runner naprawdę zwraca exit 1 (sprawdzone czterema podmianami).
//
// ZGŁOSZONE UCZCIWIE PRZEZ AUTORA, nie jest wadą kodu: K3 nie przechodzi na ŻADNYM klipie ACCAD
// (okno podpory [59;60] % to 1 pkt proc., a asymetria między nogami tego samego aktora wynosi
// 3,7–4,5 pkt proc.); K11 nie ma na czym przejść (mocap nie zawiera oddechu — 0,09 mm w paśmie);
// K12 nie ma danych z klipu (rig nie ma kanału mrugnięcia).
//
// NAPRAWIONE 2026-09-09: rig.mjs szukał aliasu DOSŁOWNIE, choć klucze są znormalizowane — 56 z 95
// aliasów było martwym kodem. Przed poprawką biblioteka mapowała 2 z 17 ról na ciele NPC i 17/17
// na mocapie ACCAD (nazwy ACCAD nie mają separatorów, więc błąd był tam niewidoczny — dlatego
// przeżył). Po poprawce: 17/17 na obu.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { zaladujGLB, probkuj } from './ruch/probka.mjs';
import { wczytajHarmonogram } from './ruch/kontakt.mjs';
import { wymagaj, WYMAGANE_CHOD, WYMAGANE_IDLE } from './ruch/rig.mjs';
import * as A from './ruch/asercje.mjs';
import * as C from './ruch/chod.mjs';
import * as S from './ruch/sygnal.mjs';
import * as M from './ruch/mutacje.mjs';

const KAT = process.env.RUCH_KLIPY || '/tmp/claude-0/-home-user-projekt/51bf51f1-3a2c-5752-acdf-ae27d700e1e0/scratchpad/npc_build/pomiar/klipy';
const KALIBRACJA = process.argv.includes('--kalibracja');
const fails = [], notes = [];
const ZN = { fail: 'FAIL', ok: 'OK  ', ostrzezenie: 'UWAGA', info: 'info' };

// ZNANE ODSTĘPSTWA — jak KNOWN_B6 w test_geometria.mjs: manifest deklaruje przy każdym klipie, które asercje MAJĄ
// oblać i DLACZEGO. Rozjazd w OBIE strony jest błędem testu: nieoczekiwany FAIL = wada klipu, a brak
// oczekiwanego FAIL = asercja przestała wykrywać znaną wadę (albo klip cicho się zmienił).
function pokaz(przedrostek, r, znane = {}) {
  const oczekiwane = Object.prototype.hasOwnProperty.call(znane, r.id);
  const et = r.poziom === 'info' ? ZN.info : r.ok ? ZN.ok : (r.poziom === 'ostrzezenie' ? ZN.ostrzezenie : (oczekiwane ? 'ZNANE' : ZN.fail));
  console.log(`  [${et}] ${r.id}: ${r.opis}` + (oczekiwane && !r.ok ? `\n         └ znane: ${znane[r.id]}` : ''));
  if (!r.ok && r.poziom === 'fail' && !oczekiwane) fails.push(`${przedrostek} ${r.id}: ${r.opis}`);
  if (!r.ok && r.poziom === 'ostrzezenie') notes.push(`${przedrostek} ${r.id}: ${r.opis}`);
  if (r.ok && oczekiwane) fails.push(`${przedrostek} ${r.id}: PRZESZŁO, a miało oblać („${znane[r.id]}") — asercja przestała wykrywać znaną wadę albo klip się zmienił`);
  return r;
}

// Ślad + harmonogram dla przypadku chodu (punkty pięt bierzemy Z HARMONOGRAMU, nie liczymy ich tu ponownie)
async function sladChodu(glb, kontakt, klipNadpisz) {
  const g = await zaladujGLB(glb);
  const h = wczytajHarmonogram(kontakt);
  const klip = klipNadpisz ?? g.klipy[0];
  const s = probkuj(g.scena, klip, { fps: h.fps, punkty: h.punkty });   // pięty i czubki butów prosto z harmonogramu
  wymagaj(s.mapa, WYMAGANE_CHOD, path.basename(glb));
  return { g, h, s };
}

function asercjeChodu(przedrostek, s, h, znane = {}) {
  const wyn = [];
  wyn.push(pokaz(przedrostek, A.sprawdzHarmonogram(h, s.n), znane));
  const k = C.kierunek(s);
  if (!k) { pokaz(przedrostek, { id: 'KIER', poziom: 'fail', ok: false, opis: 'brak kierunku marszu (przemieszczenie miednicy < 0,2 m) — to nie jest klip chodu' }, znane); return wyn; }
  const T = S.srednia([...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')]);
  wyn.push(pokaz(przedrostek, A.K1(s, h), znane));
  wyn.push(pokaz(przedrostek, A.K2(s, h), znane));
  wyn.push(pokaz(przedrostek, A.K3(s, h), znane));
  wyn.push(pokaz(przedrostek, A.K4(s, h, k), znane));
  wyn.push(pokaz(przedrostek, A.K4mtc(s, h), znane));
  wyn.push(pokaz(przedrostek, A.K5(s, h, k), znane));
  wyn.push(pokaz(przedrostek, A.K6(s, k, T), znane));
  wyn.push(pokaz(przedrostek, A.K7(s, k), znane));
  wyn.push(pokaz(przedrostek, A.K8(s, h), znane));
  wyn.push(pokaz(przedrostek, A.K9naKlipie(h), znane));
  return wyn;
}

// ---------------------------------------------------------------------------------------------------------------
const manifestPath = path.join(KAT, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`test_ruch: brak ${manifestPath}.\nKlipy pomiarowe robi: node audyt/testy/ruch/przygotuj_klipy.mjs <katalog BVH ACCAD> ${KAT} + skopiuj audyt/testy/ruch/manifest.wzor.json jako ${KAT}/manifest.json\nAlbo wskaż własny katalog: RUCH_KLIPY=… node audyt/testy/test_ruch.mjs`);
  process.exit(1);
}
const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`test_ruch: klipy z ${KAT}${KALIBRACJA ? '  [+ KALIBRACJA]' : ''}`);

// === CHÓD =======================================================================================================
for (const c of [...(man.chod ?? []), ...(man.chod_negatywne ?? [])]) {
  console.log(`\n=== CHÓD ${c.nazwa} (${c.opis}) ===`);
  const { s, h } = await sladChodu(path.join(KAT, c.glb), path.join(KAT, c.kontakt));
  console.log(`  klip ${s.czas.toFixed(2)} s, ${s.n} klatek @ ${s.fps} Hz, kości ${s.mapa.liczbaKosci}, podpór L/P ${h.stopy.L.length}/${h.stopy.P.length}`);
  asercjeChodu(c.nazwa, s, h, c.oczekiwaneFail ?? {});
}

// === IDLE =======================================================================================================
for (const c of [...(man.idle ?? []), ...(man.idle_negatywne ?? [])]) {
  console.log(`\n=== IDLE ${c.nazwa} (${c.opis}) ===`);
  const g = await zaladujGLB(path.join(KAT, c.glb));
  const s = probkuj(g.scena, g.klipy[0], { fps: 60 });
  wymagaj(s.mapa, WYMAGANE_IDLE, c.glb);
  console.log(`  klip ${s.czas.toFixed(2)} s, ${s.n} klatek`);
  const zn = c.oczekiwaneFail ?? {};
  pokaz(c.nazwa, A.K10(s), zn);
  pokaz(c.nazwa, A.K11(s), zn);
}

// === K9 (log odtwarzania silnika) i K12 (harmonogram mrugnięć) ===================================================
for (const c of man.logi ?? []) {
  console.log(`\n=== K9 LOG SILNIKA ${c.nazwa} (${c.opis}) ===`);
  const d = JSON.parse(fs.readFileSync(path.join(KAT, c.plik), 'utf8'));
  pokaz(c.nazwa, A.K9zLogu(d.czasyCykli, { podlogaHz: d.hz ?? 60 }), c.oczekiwaneFail ?? {});
}
for (const c of man.mrugniecia ?? []) {
  console.log(`\n=== K12 MRUGNIĘCIA ${c.nazwa} (${c.opis}) ===`);
  const d = JSON.parse(fs.readFileSync(path.join(KAT, c.plik), 'utf8'));
  pokaz(c.nazwa, A.K12(d.mrugniecia, { fps: d.fps ?? 60, czasS: d.czasS }), c.oczekiwaneFail ?? {});
}

// === KALIBRACJA =================================================================================================
// Dla każdej asercji pokazujemy DANE, NA KTÓRYCH OBLEWA. Wynik odwrotny do oczekiwanego = FAIL testu:
// asercja, która nie potrafi oblać, jest bezwartościowa i ma o tym krzyczeć tak samo, jak realna wada klipu.
if (KALIBRACJA) {
  const c = (man.chod ?? [])[0];
  if (!c) { console.error('kalibracja: manifest nie ma ani jednego przypadku chodu'); process.exit(1); }
  const { g, h, s } = await sladChodu(path.join(KAT, c.glb), path.join(KAT, c.kontakt));
  const kor = s.mapa.role.miednica, k0 = C.kierunek(s);
  const T0 = S.srednia([...C.czasyCykli(h, 'L'), ...C.czasyCykli(h, 'P')]);
  const bazowy = g.klipy[0];
  // Punkt odniesienia: KTÓRE asercje oblewają na nietkniętym klipie (chod_M1 ma znane K2 i K3).
  // Bez tego „oblało" po mutacji niczego nie dowodzi — mogło oblewać już przedtem.
  const cisza = () => { const p = console.log; console.log = () => {}; return () => { console.log = p; }; };
  const uruchom = async (klip) => { const r = await sladChodu(path.join(KAT, c.glb), path.join(KAT, c.kontakt), klip);
    const wroc = cisza(); const przed = fails.length, przedN = notes.length;
    const w = asercjeChodu('kal', r.s, r.h); fails.length = przed; notes.length = przedN; wroc();
    return Object.fromEntries(w.filter(Boolean).map(x => [x.id, x])); };
  const baza = await uruchom(bazowy);
  const bazaFail = Object.values(baza).filter(x => !x.ok && x.poziom === 'fail').map(x => x.id);
  console.log(`\n=== KALIBRACJA — punkt odniesienia (klip nietknięty): oblewają ${bazaFail.join(', ') || '(żadna)'} ===`);
  // Oczekiwanie: 'przewroc' = z OK na FAIL; { id, metryka, razy } = liczba ma urosnąć ≥ razy (dla asercji,
  // które oblewają już w punkcie odniesienia — samo „dalej oblewa" nic nie dowodzi).
  const dryf = r => Math.max(...Object.values(r.liczby.punkty).map(p => p.dryfMax));
  const bladK1 = r => r.liczby.blad;
  const przypadki = [
    // WYNIK NEGATYWNY, przypięty na stałe: K1 na klipie z wpieczonym korzeniem jest ślepe na skrócenie kroków.
    // Zostawiamy ten przypadek w kalibracji, żeby nikt nie wpisał K1 z powrotem jako „wykrywacza poślizgu".
    ['krótsze kroki (uda/kolana ×0,6), korzeń bez zmian — K1 MA tego NIE wykryć', () => M.skrocKroki(g.scena, bazowy, s.mapa, 0.6),
      [{ id: 'K1', tryb: 'zostaje_ok' }]],
    ['dryf korzenia +0,35 m/s', () => M.dryfKorzenia(g.scena, bazowy, kor, [0.35 * k0.dx, 0.35 * k0.dz]),
      [{ id: 'K2', metryka: dryf, razy: 5 }, { id: 'K4', tryb: 'przewroc' }]],
    ['korzeń × 1,30 drogi', () => M.skalujKorzen(g.scena, bazowy, kor, 1.30),
      [{ id: 'K2', metryka: dryf, razy: 5 }, { id: 'K4', tryb: 'przewroc' }]],
    ['korzeń × 0,70 drogi', () => M.skalujKorzen(g.scena, bazowy, kor, 0.70),
      [{ id: 'K2', metryka: dryf, razy: 5 }, { id: 'K4', tryb: 'przewroc' }]],
    ['skok prędkości +0,6 m/s w 6 klatek', () => M.skokPredkosci(g.scena, bazowy, kor, { odKlatki: 150, wKlatkach: 6, dv: 0.6, fps: h.fps }),
      [{ id: 'K8', tryb: 'przewroc' }]],
    ['pion miednicy = 1 cykl na krok podwójny', () => M.pionMiednicyJedenCykl(g.scena, bazowy, kor, { T: T0, A: 0.02 }),
      [{ id: 'K6', tryb: 'przewroc' }]],
    ['ramiona zamienione stronami', () => M.zamienRamiona(g.scena, bazowy, s.mapa),
      [{ id: 'K7', tryb: 'przewroc' }]],
    ['KONTROLA: sztywne przesunięcie korzenia o (2 m, 0, 3 m)', () => M.przesunKorzenStale(g.scena, bazowy, kor, [2, 0, 3]), []],
  ];
  for (const [nazwa, zrob, oczekiwania] of przypadki) {
    const wyn = await uruchom(zrob());
    const oblaly = Object.values(wyn).filter(x => !x.ok && x.poziom === 'fail').map(x => x.id);
    const nowe = oblaly.filter(id => !bazaFail.includes(id));
    const linie = [];
    for (const o of oczekiwania) {
      if (o.tryb === 'zostaje_ok') {
        const dobrze = wyn[o.id].ok && baza[o.id].ok;
        linie.push(`${o.id}: ${baza[o.id].ok ? 'OK' : 'FAIL'} → ${wyn[o.id].ok ? 'OK' : 'FAIL'} (oczekiwane: BEZ ZMIANY — udokumentowana ślepota) ${dobrze ? '✓' : '✗'}`);
        if (!dobrze) fails.push(`KALIBRACJA „${nazwa}": ${o.id} miało zostać OK (udokumentowany wynik negatywny), a jest ${wyn[o.id].ok ? 'OK' : 'FAIL'}`);
      } else if (o.tryb === 'przewroc') {
        const dobrze = !wyn[o.id].ok && baza[o.id].ok;
        linie.push(`${o.id}: ${baza[o.id].ok ? 'OK' : 'FAIL'} → ${wyn[o.id].ok ? 'OK' : 'FAIL'} ${dobrze ? '✓' : '✗'}`);
        if (!dobrze) fails.push(`KALIBRACJA „${nazwa}": ${o.id} miało przejść z OK na FAIL, a jest ${baza[o.id].ok ? 'OK' : 'FAIL'} → ${wyn[o.id].ok ? 'OK' : 'FAIL'} — asercja nie wykrywa tej wady`);
      } else {
        const a = o.metryka(baza[o.id]), b = o.metryka(wyn[o.id]), k = b / a, dobrze = k >= o.razy && !wyn[o.id].ok;
        linie.push(`${o.id}: metryka ${a.toFixed(4)} → ${b.toFixed(4)} (×${k.toFixed(1)}, wymagane ×${o.razy}) ${dobrze ? '✓' : '✗'}`);
        if (!dobrze) fails.push(`KALIBRACJA „${nazwa}": ${o.id} — metryka urosła tylko ×${k.toFixed(1)} (wymagane ×${o.razy})`);
      }
    }
    if (oczekiwania.length === 0 && nowe.length) { linie.push(`NOWE oblane: ${nowe.join(',')} ✗`); fails.push(`KALIBRACJA „${nazwa}" (kontrola negatywna): doszły FAIL ${nowe.join(',')} — asercja reaguje na coś, co NIE jest wadą`); }
    if (oczekiwania.length === 0 && !nowe.length) linie.push('brak nowych FAIL względem punktu odniesienia ✓');
    console.log(`\n=== KALIBRACJA: ${nazwa} ===`);
    console.log(`  oblewają: ${oblaly.join(', ') || '(żadna)'} | nowe względem odniesienia: ${nowe.join(', ') || '(żadne)'}`);
    for (const l of linie) console.log('  ' + l);
    for (const o of oczekiwania) console.log(`  [${wyn[o.id].ok ? 'OK  ' : 'FAIL'}] ${o.id}: ${wyn[o.id].opis}`);
  }
  // K1 — kalibracja tam, gdzie K1 naprawdę działa.
  // (a) na klipie: harmonogram z CO DRUGIM zdarzeniem IC (czas cyklu ×2, geometria kroku bez zmian);
  // (b) w silniku: prędkość komendy rozjechana z długością kroku assetu.
  {
    console.log(`\n=== KALIBRACJA: K1 ===`);
    const bazaK1 = baza.K1.liczby;
    // (a1) co drugie IC: T ×2, ale odstęp środków podparcia też ×2 → K1 tego NIE łapie (wynik negatywny, przypięty).
    const hPolowa = JSON.parse(JSON.stringify(h));
    for (const st of ['L', 'P']) hPolowa.stopy[st] = hPolowa.stopy[st].filter((_, i) => i % 2 === 0);
    const rPol = A.K1(s, hPolowa);
    console.log(`  [${rPol.ok ? 'OK  ' : 'FAIL'}] K1, harmonogram z co drugim IC (T ×2 i krok ×2 naraz) — MA zostać OK: ${rPol.opis}`);
    if (!rPol.ok) fails.push('KALIBRACJA K1: przypięty wynik negatywny (co drugie IC) przestał być OK — zmieniła się definicja K1');
    // (a2) rozjazd CZASU z GEOMETRIĄ: same znaczniki ic/to rozciągnięte ×1,2, przedziały kontaktu (a więc środki
    //      podparcia i długość kroku) nietknięte. To jedyna wada, którą K1 na samym klipie faktycznie widzi.
    const hRozjazd = JSON.parse(JSON.stringify(h));
    for (const st of ['L', 'P']) { const l = hRozjazd.stopy[st], i0 = l[0].ic;
      for (const p of l) { const d = p.to - p.ic; p.ic = Math.round(i0 + 1.2 * (p.ic - i0)); p.to = p.ic + d; } }
    const rK1 = A.K1(s, hRozjazd);
    console.log(`  [${rK1.ok ? 'OK  ' : 'FAIL'}] K1, znaczniki IC rozciągnięte ×1,2 przy nietkniętych przedziałach kontaktu: ${rK1.opis}`);
    if (rK1.ok) fails.push('KALIBRACJA K1: rozjazd czasu cyklu z geometrią kroku (IC ×1,2) NIE OBLAŁ — K1 nie sprawdza nawet tego');
    for (const [op, arg, maPrzejsc] of [
      ['zgodne: v = 1,29 m/s, tempo 1,0', { vKomendy: bazaK1.krok / bazaK1.T, tempoOdtwarzania: 1, tKlipu: bazaK1.T, krokKlipu: bazaK1.krok }, true],
      ['kontroler o 20 % za szybki', { vKomendy: 1.2 * bazaK1.krok / bazaK1.T, tempoOdtwarzania: 1, tKlipu: bazaK1.T, krokKlipu: bazaK1.krok }, false],
      ['klip odtwarzany 5× za wolno (pułapka BVH bez update_scene_fps)', { vKomendy: bazaK1.krok / bazaK1.T, tempoOdtwarzania: 0.2, tKlipu: bazaK1.T, krokKlipu: bazaK1.krok }, false],
      ['rozjazd 2,5 % (w tolerancji)', { vKomendy: 1.025 * bazaK1.krok / bazaK1.T, tempoOdtwarzania: 1, tKlipu: bazaK1.T, krokKlipu: bazaK1.krok }, true],
    ]) { const r = A.K1zSilnika(arg); console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] K1-silnik ${op}: ${r.opis}`);
      if (r.ok !== maPrzejsc) fails.push(`KALIBRACJA K1-silnik „${op}": wynik ${r.ok ? 'OK' : 'FAIL'}, oczekiwano ${maPrzejsc ? 'OK' : 'FAIL'}`); }
  }
  // K10: bezruch
  const ic = (man.idle ?? [])[0];
  if (ic) {
    console.log(`\n=== KALIBRACJA: idle zamrożone (bezruch) ===`);
    const gi = await zaladujGLB(path.join(KAT, ic.glb));
    const s3 = probkuj(gi.scena, M.zamroz(gi.klipy[0]), { fps: 60 });
    const r = A.K10(s3); console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] K10: ${r.opis}`);
    if (r.ok) fails.push('KALIBRACJA „idle zamrożone": K10 NIE OBLAŁO na bezruchu — asercja bezwartościowa');
    console.log(`\n=== KALIBRACJA: idle + wstrzyknięty oddech 0,25 Hz / 5 mm ===`);
    const gi2 = await zaladujGLB(path.join(KAT, ic.glb));
    const s4 = probkuj(gi2.scena, gi2.klipy[0], { fps: 60 });
    const rBez = A.K11(s4);
    const kl = M.dodajOddech(gi2.scena, gi2.klipy[0], s4.mapa.role.klatka, { f: 0.25, A: 0.005 });
    const s5 = probkuj(gi2.scena, kl, { fps: 60 });
    const r2 = A.K11(s5);
    console.log(`  bez oddechu: [${rBez.ok ? 'OK  ' : 'FAIL'}] ${rBez.opis}`);
    console.log(`  z oddechem:  [${r2.ok ? 'OK  ' : 'FAIL'}] ${r2.opis}`);
    if (rBez.ok) fails.push('KALIBRACJA K11: klip BEZ oddechu przeszedł — asercja nie odróżnia oddechu od jego braku');
    if (!r2.ok) fails.push('KALIBRACJA K11: klip Z wstrzykniętym oddechem 0,25 Hz / 5 mm NIE przeszedł');
  }
  // K9 / K12 — kalibracja na ciągach syntetycznych (silnik, nie klip)
  console.log(`\n=== KALIBRACJA: K9 (log silnika) i K12 (mrugnięcia) ===`);
  let ziarno = 12345;
  const los = () => { ziarno = (ziarno * 1103515245 + 12345) % 2147483648; return ziarno / 2147483648; };
  const gauss = () => Math.sqrt(-2 * Math.log(los() + 1e-12)) * Math.cos(2 * Math.PI * los());
  const seria = (n, T, cv) => Array.from({ length: n }, () => T * (1 + cv * gauss()));
  for (const [op, dane, maPrzejsc] of [
    ['CV ≈ 2 % (cel)', seria(30, 1.1, 0.02), true],
    ['CV ≈ 0,2 % (metronom)', seria(30, 1.1, 0.002), false],
    ['CV ≈ 8 % (rozjazd)', seria(30, 1.1, 0.08), false],
  ]) { const r = A.K9zLogu(dane); console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] K9 ${op}: ${r.opis}`); if (r.ok !== maPrzejsc) fails.push(`KALIBRACJA K9 „${op}": wynik ${r.ok ? 'OK' : 'FAIL'}, oczekiwano ${maPrzejsc ? 'OK' : 'FAIL'}`); }
  const mrug = (n, sr, jitter, czas) => { let t = 30, out = []; for (let i = 0; i < n; i++) { t += Math.round((sr + jitter * (los() - 0.5)) * 60); out.push({ start: t, koniec: t + czas }); } return out; };
  for (const [op, dane, maPrzejsc] of [
    ['3,5 s ± 1,4 s, 10 klatek (cel)', mrug(12, 3.5, 2.8, 10), true],
    ['co 3,5 s co do klatki (metronom)', mrug(12, 3.5, 0, 10), false],
    ['3,5 s ± 1,4 s, ale 30 klatek (mrugnięcie za wolne)', mrug(12, 3.5, 2.8, 30), false],
    ['co 8 s (za rzadko)', mrug(12, 8, 2.8, 10), false],
    ['co 1,5 s (za często)', mrug(12, 1.5, 1.0, 10), false],
  ]) { const r = A.K12(dane, { fps: 60 }); console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] K12 ${op}: ${r.opis}`); if (r.ok !== maPrzejsc) fails.push(`KALIBRACJA K12 „${op}": wynik ${r.ok ? 'OK' : 'FAIL'}, oczekiwano ${maPrzejsc ? 'OK' : 'FAIL'}`); }
}

console.log('');
notes.forEach(n => console.log('uwaga:', n));
console.log(fails.length ? `FAIL (${fails.length}):\n` + fails.map(f => ' - ' + f).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
