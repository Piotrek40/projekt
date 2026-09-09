// MUTACJE KLIPU — dane ZŁE, na których asercje mają OBLEWAĆ. Bez nich zielony test niczego nie dowodzi.
// Wszystko działa na wczytanym GLB (scena + AnimationClip), na poziomie ŚCIEŻEK, więc mutant przechodzi
// dokładnie tę samą drogę pomiarową co oryginał (GLTFLoader → AnimationMixer → matrixWorld).
//
// UWAGA na jednostki: ścieżka .position kości jest w jej układzie LOKALNYM. Klipy testowe mają rodzica ze skalą
// 0,01 (BVH w cm), więc przesunięcie o 1 m w świecie to 100 jednostek ścieżki. Funkcje przyjmują METRY i same
// dzielą przez skalę świata rodzica kości — inaczej mutacja „o 3 cm" byłaby w rzeczywistości o 3 m.
import { THREE } from './three.mjs';

export function klonKlipu(klip) { return klip.clone(); }

const sanit = n => THREE.PropertyBinding.sanitizeNodeName(n);
export function sciezka(klip, kosc, wlasciwosc) {
  const n = sanit(kosc.name);
  return klip.tracks.find(t => t.name === `${n}.${wlasciwosc}`) ?? klip.tracks.find(t => t.name.endsWith(`.${wlasciwosc}`) && t.name.slice(0, -wlasciwosc.length - 1) === n);
}
export function skalaSwiataKosci(scena, kosc) {
  scena.updateMatrixWorld(true);
  const s = new THREE.Vector3(); (kosc.parent ?? kosc).matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  return s.x;
}

// 1) Sztywne przesunięcie korzenia o STAŁY wektor. To NIE jest poślizg — cały klip jedzie razem z podłożem.
//    Trzymamy tę mutację właśnie po to, żeby pokazać, że K2 nie reaguje na nią (kontrola negatywna kalibracji).
export function przesunKorzenStale(scena, klip, kosc, [dx, dy, dz]) {
  const k = klonKlipu(klip), t = sciezka(k, kosc, 'position'); if (!t) throw new Error('brak ścieżki position korzenia');
  const s = skalaSwiataKosci(scena, kosc), v = t.values;
  for (let i = 0; i < v.length; i += 3) { v[i] += dx / s; v[i + 1] += dy / s; v[i + 2] += dz / s; }
  k.name = klip.name + '+przesuniecie'; return k;
}

// 2) Dryf liniowy korzenia: dodatkowa stała prędkość [m/s]. Stopy zostają tam, gdzie były w rotacjach,
//    więc punkt kontaktu jedzie po ziemi — klasyczny poślizg z retargetu.
export function dryfKorzenia(scena, klip, kosc, [vx, vz]) {
  const k = klonKlipu(klip), t = sciezka(k, kosc, 'position'); if (!t) throw new Error('brak ścieżki position korzenia');
  const s = skalaSwiataKosci(scena, kosc), v = t.values, cz = t.times;
  for (let i = 0; i < cz.length; i++) { v[3 * i] += vx * cz[i] / s; v[3 * i + 2] += vz * cz[i] / s; }
  k.name = klip.name + '+dryf'; return k;
}

// 3) Skalowanie drogi korzenia względem klatki 0 (mnożnik k): tyle samo kroków, dłuższa/krótsza droga —
//    rozjeżdża prędkość z długością kroku (K1) i wprowadza poślizg (K2).
export function skalujKorzen(scena, klip, kosc, mn) {
  const k = klonKlipu(klip), t = sciezka(k, kosc, 'position'); if (!t) throw new Error('brak ścieżki position korzenia');
  const v = t.values, x0 = v[0], z0 = v[2];
  for (let i = 0; i < v.length; i += 3) { v[i] = x0 + (v[i] - x0) * mn; v[i + 2] = z0 + (v[i + 2] - z0) * mn; }
  k.name = klip.name + `+skala${mn}`; return k;
}

// 4) Zamrożenie: wszystkie ścieżki dostają wartość z klatki 0 → całkowity bezruch (K10 ma to OBLAĆ).
export function zamroz(klip) {
  const k = klonKlipu(klip);
  for (const t of k.tracks) { const w = t.getValueSize(); for (let i = w; i < t.values.length; i += w) for (let j = 0; j < w; j++) t.values[i + j] = t.values[j]; }
  k.name = klip.name + '+zamrozone'; return k;
}

// 5) Dodanie składowej oddechowej do PIONU wybranej kości (A w metrach, f w Hz).
export function dodajOddech(scena, klip, kosc, { f = 0.25, A = 0.005 } = {}) {
  const k = klonKlipu(klip); let t = sciezka(k, kosc, 'position');
  const s = skalaSwiataKosci(scena, kosc);
  if (!t) {  // kość bez ścieżki position — dorabiamy ją wokół pozycji spoczynkowej
    const czasy = k.tracks[0].times, val = new Float32Array(czasy.length * 3);
    for (let i = 0; i < czasy.length; i++) { val[3 * i] = kosc.position.x; val[3 * i + 1] = kosc.position.y; val[3 * i + 2] = kosc.position.z; }
    t = new THREE.VectorKeyframeTrack(`${sanit(kosc.name)}.position`, Array.from(czasy), Array.from(val));
    k.tracks.push(t);
  }
  for (let i = 0; i < t.times.length; i++) t.values[3 * i + 1] += A * Math.sin(2 * Math.PI * f * t.times[i]) / s;
  k.name = klip.name + `+oddech${f}`; return k;
}

// 6) Zamiana ścieżek lewego i prawego ramienia — wymach rąk zgodny ze stroną, nie przeciwny (K7 ma OBLAĆ).
export function zamienRamiona(scena, klip, mapa) {
  const k = klonKlipu(klip);
  for (const [a, b] of [['barkL', 'barkP'], ['lokiecL', 'lokiecP'], ['nadgarstekL', 'nadgarstekP']]) {
    if (!mapa.role[a] || !mapa.role[b]) continue;
    for (const wl of ['quaternion', 'position']) {
      const ta = sciezka(k, mapa.role[a], wl), tb = sciezka(k, mapa.role[b], wl);
      if (!ta || !tb) continue;
      const tmp = ta.values.slice(); ta.values.set(tb.values); tb.values.set(tmp);
    }
  }
  k.name = klip.name + '+ramiona_zamienione'; return k;
}

// 7) Skok prędkości: od klatki `odKlatki` korzeń dostaje dodatkowe przesunięcie narastające przez `wKlatkach`
//    o `dv` m/s — szew pętli / teleport, który widz zauważa (K8 ma OBLAĆ).
export function skokPredkosci(scena, klip, kosc, { odKlatki = 60, wKlatkach = 6, dv = 0.5, fps = 60 } = {}) {
  const k = klonKlipu(klip), t = sciezka(k, kosc, 'position'); if (!t) throw new Error('brak ścieżki position korzenia');
  const s = skalaSwiataKosci(scena, kosc), t0 = odKlatki / fps, t1 = (odKlatki + wKlatkach) / fps, skok = dv * (t1 - t0);
  for (let i = 0; i < t.times.length; i++) {
    const c = t.times[i]; const u = c <= t0 ? 0 : c >= t1 ? 1 : (c - t0) / (t1 - t0);
    t.values[3 * i] += u * skok / s;
  }
  k.name = klip.name + '+skok'; return k;
}

// 8) Podmiana pionu miednicy na sinusoidę o okresie CAŁEGO kroku podwójnego (1 cykl zamiast 2) — K6 ma OBLAĆ.
export function pionMiednicyJedenCykl(scena, klip, kosc, { T, A = 0.02 } = {}) {
  const k = klonKlipu(klip), t = sciezka(k, kosc, 'position'); if (!t) throw new Error('brak ścieżki position korzenia');
  const s = skalaSwiataKosci(scena, kosc);
  let sr = 0; for (let i = 0; i < t.times.length; i++) sr += t.values[3 * i + 1]; sr /= t.times.length;
  for (let i = 0; i < t.times.length; i++) t.values[3 * i + 1] = sr + (A / s) * Math.sin(2 * Math.PI * t.times[i] / T);
  k.name = klip.name + '+pion1cykl'; return k;
}
