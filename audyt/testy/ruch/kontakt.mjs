// HARMONOGRAM KONTAKTU — jawne dane obok klipu, NIE heurystyka w teście.
//
// Dlaczego: progowanie prędkości ("stopa stoi, gdy v < X") gubi fazę przetaczania (pięta już na ziemi, a staw
// skokowy jedzie do przodu 50 cm/s, bo stopa obraca się wokół pięty) i pokazuje 10–14 % „lotu" na zwykłym chodzie.
// Dlatego klatki wejścia/wyjścia pięty i palca są WYZNACZANE RAZ, offline (funkcja wyznaczHarmonogram poniżej),
// zapisywane do <klip>.kontakt.json i to plik jest prawdą dla testu. Test NIE wywołuje wyznaczHarmonogram.
//
// KRYTERIUM WYZNACZANIA (jedno, wysokościowe — celowo NIEZALEŻNE od wielkości, które mierzy K2, czyli od poziomego
// dryfu i prędkości): punkt jest w kontakcie, gdy jego wysokość ≤ PODŁOGA BIEGNĄCA + TOL.
// Podłoga biegnąca = minimum wysokości TEGO punktu w oknie ±OKNO_PODLOGI_S wokół klatki, nie minimum całego klipu:
// zmierzone na ACCAD Male1_B3_Walk wysokości kolejnych podpór lewego palca to 0, 1, 3, 4, 5 cm (dryf pionowy
// ok. 1 cm na krok — nierówna objętość pomiarowa / dryf korzenia BVH). Przy stałej podłodze z całego klipu
// wykrywa się TYLKO PIERWSZĄ podporę każdej stopy (sprawdzone: 1 przebieg zamiast 5). To ta sama zasada,
// co w K2 „wysokość względem WŁASNEGO minimum stawu w podporze, nie minimum sceny".
// Drugi warunek (też pionowy, więc dalej niezależny od tego, co mierzy K2): |dy/dt| ≤ MAX_VY. Sama wysokość nie
// wystarcza — pięta w ostatniej fazie wymachu leci tuż nad podłogą z prędkością 3,8 m/s i wpada do maski;
// bez bramki pionowej prawa pięta ACCAD Male1_B3_Walk dostawała podpory z dryfem 24–28 cm (zmierzone).
//
// PIĘTA: rig BVH/ACCAD/Rigify nie ma stawu pięty. Konstruujemy punkt wirtualny sztywno przyczepiony do kości kostki:
//   poziomo  — o C_PIETA·|(palec − kostka)_poziomo| ZA kostką (wzdłuż osi stopy),
//   pionowo  — tak, żeby minimum wysokości pięty w całym klipie = podłoga (1 parametr, kalibracja pionu).
// Offset jest zapisany w pliku harmonogramu w LOKALNYM układzie kości kostki, więc test odtwarza ten sam punkt
// bez powtarzania konstrukcji.
import fs from 'node:fs';
import { THREE } from './three.mjs';
import { probkuj } from './probka.mjs';
import { mapujRig } from './rig.mjs';
import * as S from './sygnal.mjs';

export const C_PIETA = 0.5;          // pięta za kostką o pół poziomej długości stopy
// Czubek buta przed stawem palca o cCzubek × poziomą długość stopy (kostka→palec ≈ 11 cm na ACCAD).
// WYNIK MTC JEST NA TĘ STAŁĄ CZUŁY — zmierzone na ACCAD Male1_B3_Walk: 0,25 → 30,1 mm; 0,4 → 26,1;
// 0,5 → 20,7; 0,75 → −0,3; 1,0 → −23,4 (przy 0,75+ czubek wchodzi pod podłogę zaraz po odbiciu, bo stopa
// zgina się podeszwowo). Dlatego MTC jest raportowane jako OSTRZEŻENIE, nie twardy FAIL.
export const C_CZUBEK = 0.5;
export const TOL_PODLOGA = 0.015;    // m — kontakt, gdy punkt jest nie wyżej niż 1,5 cm nad podłogą
export const MIN_KONTAKT_S = 0.10;   // krótsze przebiegi maski to szum, nie kontakt
export const MAX_VY = 0.15;          // m/s — punkt, który jeszcze opada/wznosi się szybciej, NIE stoi na ziemi
export const OKNO_PODLOGI_S = 0.5;   // pół okna podłogi biegnącej — musi objąć co najmniej jedną podporę (podpora ≈ 0,6 s)

const bok = { L: 'L', P: 'P' };

// Podłoga biegnąca: minimum sygnału w oknie ±w klatek.
export function podlogaBiegnaca(y, w) {
  const n = y.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let m = Infinity; for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) if (y[j] < m) m = y[j]; out[i] = m; }
  return out;
}

// Ciągłe przebiegi wartości true, dłuższe niż minLen klatek → [[a,b], …] (b włącznie)
export function przebiegi(maska, minLen) {
  const out = []; let i = 0;
  while (i < maska.length) {
    if (maska[i]) { let j = i; while (j < maska.length && maska[j]) j++; if (j - i >= minLen) out.push([i, j - 1]); i = j; }
    else i++;
  }
  return out;
}

// Konstrukcja offsetów PIĘTY (na kości kostki) i CZUBKA BUTA (na kości palca) — offsety w jednostkach LOKALNYCH
// tych kości. Czubek jest potrzebny do MTC (K4): literaturowe 15 ± 4 mm dotyczy markera na przodzie buta, a nie
// stawu ToeBase, który siedzi kilka cm nad podeszwą — na samym stawie ToeBase wychodzi ok. 32 mm (zmierzone).
export function offsetPiety(scena, klip, { fps = 60, c = C_PIETA, cCzubek = C_CZUBEK } = {}) {
  const s0 = probkuj(scena, klip, { fps });
  const mapa = mapujRig(scena);
  const mixer = new THREE.AnimationMixer(scena); mixer.clipAction(klip).play();
  const out = {};
  for (const b of Object.values(bok)) {
    const tY = [], n = s0.n;
    for (let i = 0; i < n; i++) tY.push(s0.p['palec' + b][3 * i + 1]);
    const podloga = Math.min(...tY), ref = tY.indexOf(podloga);
    mixer.setTime(ref / fps); scena.updateMatrixWorld(true);
    const kost = mapa.role['kostka' + b], pal = mapa.role['palec' + b];
    const a = new THREE.Vector3().setFromMatrixPosition(kost.matrixWorld);
    const t = new THREE.Vector3().setFromMatrixPosition(pal.matrixWorld);
    const fx = t.x - a.x, fz = t.z - a.z;
    const swiat = new THREE.Vector3(a.x - c * fx, podloga, a.z - c * fz);
    const loc = kost.worldToLocal(swiat.clone());
    // czubek buta: przed stawem palca o cCzubek × poziomą długość stopy, na wysokości podłogi
    const czubW = new THREE.Vector3(t.x + cCzubek * fx, podloga, t.z + cCzubek * fz);
    const czubLoc = pal.worldToLocal(czubW.clone());
    // korekta pionu: minimum wysokości pięty w klipie ma wynieść dokładnie `podloga`
    const s1 = probkuj(scena, klip, { fps, punkty: { pieta: { kosc: 'kostka' + b, offset: loc.toArray() } } });
    let hmin = Infinity; for (let i = 0; i < s1.n; i++) hmin = Math.min(hmin, s1.p.pieta[3 * i + 1]);
    // przesunięcie o (podloga − hmin) w PIONIE świata; przeliczamy przez kość w klatce ref
    mixer.setTime(ref / fps); scena.updateMatrixWorld(true);
    const w2 = kost.localToWorld(loc.clone()); w2.y += (podloga - hmin);
    const loc2 = kost.worldToLocal(w2);
    out['pieta' + b] = { kosc: 'kostka' + b, offset: [loc2.x, loc2.y, loc2.z], podloga, klatkaRef: ref, korektaPionu: podloga - hmin };
    out['czubek' + b] = { kosc: 'palec' + b, offset: [czubLoc.x, czubLoc.y, czubLoc.z], podloga, klatkaRef: ref };
  }
  mixer.stopAllAction();
  return out;
}

// Wyznaczenie harmonogramu — OFFLINE. Zwraca obiekt do zapisania w JSON.
export function wyznaczHarmonogram(scena, klip, { fps = 60, tol = TOL_PODLOGA, c = C_PIETA, cCzubek = C_CZUBEK, nazwa } = {}) {
  const punkty = offsetPiety(scena, klip, { fps, c, cCzubek });
  const s = probkuj(scena, klip, { fps, punkty: { pietaL: punkty.pietaL, pietaP: punkty.pietaP } });
  const minLen = Math.max(2, Math.round(MIN_KONTAKT_S * fps));
  const stopy = {};
  for (const b of Object.values(bok)) {
    const hi = (r, i) => s.p[r][3 * i + 1];
    const yP = Float64Array.from({ length: s.n }, (_, i) => hi('pieta' + b, i));
    const yT = Float64Array.from({ length: s.n }, (_, i) => hi('palec' + b, i));
    const w = Math.round(OKNO_PODLOGI_S * fps);
    const fP = podlogaBiegnaca(yP, w), fT = podlogaBiegnaca(yT, w);
    const vy = y => { const o = new Float64Array(s.n); for (let i = 0; i < s.n; i++) { const a = Math.max(0, i - 1), z = Math.min(s.n - 1, i + 1); o[i] = Math.abs((y[z] - y[a]) / ((z - a) / fps)); } return o; };
    const vP = vy(yP), vT = vy(yT);
    // Dwie maski. WĄSKA (wysokość + bramka pionowa) wyznacza przedziały, w których punkt STOI — to one idą do K2.
    // SZEROKA (sama wysokość) wyznacza granice podpory IC/TO — kontakt zaczyna się w chwili dotknięcia, kiedy pięta
    // jeszcze hamuje, i kończy, gdy palec odrywa się od podłoża. Mieszanie tych dwóch to błąd: wąska maska zaniża
    // podporę o ok. 6 pkt proc. (zmierzone: 0,55 s zamiast 0,63 s na ACCAD Male1_B3_Walk).
    const mP = Array.from({ length: s.n }, (_, i) => yP[i] <= fP[i] + tol && vP[i] <= MAX_VY);
    const mT = Array.from({ length: s.n }, (_, i) => yT[i] <= fT[i] + tol && vT[i] <= MAX_VY);
    const szP = Array.from({ length: s.n }, (_, i) => yP[i] <= fP[i] + tol);
    const szT = Array.from({ length: s.n }, (_, i) => yT[i] <= fT[i] + tol);
    const rP = przebiegi(mP, minLen), rT = przebiegi(mT, minLen);
    const sP = przebiegi(szP, minLen), sT = przebiegi(szT, minLen);
    const obejmuje = (biegi, a, b) => biegi.find(([x, y]) => x <= a && y >= b) ?? [a, b];
    // podpora = od początku kontaktu pięty do końca pierwszego kontaktu palca, który się z nim zazębia
    const podpory = [];
    for (const [a1, b1] of rP) {
      const t = rT.find(([a2, b2]) => b2 >= b1 - 1 && a2 <= b1 + Math.round(0.15 * fps));
      if (!t) continue;
      const ic = obejmuje(sP, a1, b1)[0], to = obejmuje(sT, t[0], t[1])[1] + 1;
      podpory.push({ ic, to, pieta: [a1, b1], palec: [t[0], t[1]] });
    }
    stopy[b] = podpory;
  }
  return {
    klip: nazwa ?? klip.name, fps, tol_podlogi_m: tol, max_vy_ms: MAX_VY, c_piety: c, min_kontakt_s: MIN_KONTAKT_S,
    kryterium: 'wysokosc <= podloga_biegnaca(+-okno) + tol ORAZ |dy/dt| <= max_vy; oba warunki PIONOWE, niezalezne od poziomego dryfu mierzonego przez K2',
    punkty: { pietaL: punkty.pietaL, pietaP: punkty.pietaP, czubekL: punkty.czubekL, czubekP: punkty.czubekP },
    stopy,
  };
}

export function zapiszHarmonogram(sciezka, h) { fs.writeFileSync(sciezka, JSON.stringify(h, null, 1) + '\n'); }
export function wczytajHarmonogram(sciezka) {
  const h = JSON.parse(fs.readFileSync(sciezka, 'utf8'));
  if (!h.stopy || !h.punkty) throw new Error(`harmonogram ${sciezka}: brak pól stopy/punkty`);
  return h;
}
