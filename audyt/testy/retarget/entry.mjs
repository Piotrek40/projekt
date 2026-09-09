// Test przeniesienia mocapu na szkielet NPC. Bez przeglądarki, ok. 20 s.
// Uruchomienie: bash audyt/testy/retarget_test.sh   (bundluje esbuildem, bo engine/src nie ma node_modules)
//
// Każda asercja ma podany PRÓG i to, co go kalibruje — czyli liczbę zmierzoną na danych, na których oblewa.
// Asercja, której nie widziało się oblewającej, jest bezwartościowa; w tym projekcie napisałem już
// asercję-tautologię i próg jasności sześć jednostek obok celu, więc to nie jest teoretyczne zmartwienie.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import { przygotuj, przenies, wydzielRuchKorzenia, MAPA_ACCAD_MPFB } from '../../../engine/src/retarget.js';

const CIALO = '/home/user/projekt/rynek/assets/models/npc_body.glb';
const ANIM = '/home/user/projekt/rynek/assets/anim/';
let bledy = 0, ostrzezenia = 0;

const sprawdz = (ok, opis, dane) => {
  if (!ok) { bledy++; console.error(`FAIL  ${opis}`, dane === undefined ? '' : JSON.stringify(dane)); }
  else console.log(`ok    ${opis}` + (dane === undefined ? '' : `  ${JSON.stringify(dane)}`));
};
const uwaga = (opis, dane) => { ostrzezenia++; console.log(`uwaga ${opis}  ${JSON.stringify(dane)}`); };

const wczytaj = async p => { const b = fs.readFileSync(p); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const poz = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const kier = (root, a, b) => poz(root.getObjectByName(b)).sub(poz(root.getObjectByName(a))).normalize();
const kat = (u, v) => Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180 / Math.PI;

// Pary kości do porównania kierunków: po jednej z każdej kończyny plus kręgosłup.
const PARY_KIER = [
  ['udo L', 'LeftUpLeg', 'LeftLeg', 'thigh_l', 'calf_l'], ['podudzie L', 'LeftLeg', 'LeftFoot', 'calf_l', 'foot_l'],
  ['udo P', 'RightUpLeg', 'RightLeg', 'thigh_r', 'calf_r'], ['podudzie P', 'RightLeg', 'RightFoot', 'calf_r', 'foot_r'],
  ['ramię L', 'LeftArm', 'LeftForeArm', 'upperarm_l', 'lowerarm_l'], ['przedramię L', 'LeftForeArm', 'LeftHand', 'lowerarm_l', 'hand_l'],
  ['ramię P', 'RightArm', 'RightForeArm', 'upperarm_r', 'lowerarm_r'], ['kręgosłup', 'Spine', 'Spine1', 'spine_02', 'spine_03'],
];

console.log('=== A. Dopasowanie póz spoczynkowych (poza A ciała -> poza T mocapu) ===');
{
  const cialo = await wczytaj(CIALO), mocap = await wczytaj(ANIM + 'walk_cycle.glb');
  const P = przygotuj(mocap.scene, cialo.scene, MAPA_ACCAD_MPFB);
  const przed = Math.max(...P.diag.odchylkaPrzed.map(x => x[1]));
  const po = Math.max(...P.diag.odchylkaPo.map(x => x[1]));
  sprawdz(P.pary.length === 21, 'zmapowanych par kości = 21 z 22 (ToSpine nie ma odpowiednika w rigu MPFB)', { par: P.pary.length });
  // KALIBRACJA: ta sama miara PRZED dopasowaniem daje 130,4° (bark), więc próg 0,5° nie jest spełniony „z natury".
  sprawdz(przed > 60, 'kalibracja: przed dopasowaniem odchyłka jest duża (inaczej test niczego nie dowodzi)', { maxPrzed: +przed.toFixed(1) });
  sprawdz(po < 0.5, 'po dopasowaniu kierunki kości pokrywają się (próg 0,5°)', { maxPo: +po.toFixed(3) });
  sprawdz(P.skala > 0.9 && P.skala < 1.1, 'skala ruchu korzenia z wysokości bioder w granicach 0,9–1,1', { skala: +P.skala.toFixed(4) });
}

console.log('\n=== B. Przeniesienie rotacji (bez normalizacji korzenia) ===');
{
  const cialo = await wczytaj(CIALO), mocap = await wczytaj(ANIM + 'walk_cycle.glb');
  const P = przygotuj(mocap.scene, cialo.scene, MAPA_ACCAD_MPFB);
  const klip = przenies({ zrodloRoot: mocap.scene, klip: mocap.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30, normalizujKorzen: false });
  const mZ = new THREE.AnimationMixer(mocap.scene); mZ.clipAction(mocap.animations[0]).play();
  const mC = new THREE.AnimationMixer(cialo.scene); mC.clipAction(klip).play();
  let max = 0, gdzie = '';
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * (klip.duration - 1e-4);
    mZ.setTime(t); mocap.scene.updateMatrixWorld(true);
    mC.setTime(t); cialo.scene.updateMatrixWorld(true);
    for (const [n, za, zb, ca, cb] of PARY_KIER) {
      const d = kat(kier(mocap.scene, za, zb), kier(cialo.scene, ca, cb));
      if (d > max) { max = d; gdzie = `${n} @ t=${t.toFixed(2)}`; }
    }
  }
  sprawdz(max < 0.5, 'kości celu wskazują tam, gdzie kości źródła, przez cały klip (próg 0,5°)', { maxRoznica: +max.toFixed(3), gdzie });
  sprawdz(klip.tracks.length === P.pary.length + 1, 'klip ma po jednej ścieżce rotacji na kość plus pozycję korzenia', { sciezek: klip.tracks.length });
}

console.log('\n=== B2. Przygotowanie na JEDNYM klipie, przeniesienie INNEGO ===');
{
  // Regresja na realnym błędzie: przygotuj() zapamiętuje REFERENCJE do kości tej hierarchii, na której liczyło
  // dopasowanie. W npc.js przygotowanie idzie raz, na pierwszym klipie, a przenoszonych jest sześć — bez
  // przewiązania kości po nazwie zastosuj() czytałoby cały czas pierwszy, NIERUCHOMY szkielet i wynikowy klip
  // byłby zamrożony. Objawem było `vChodu: 0`. Ten test używa dwóch RÓŻNYCH plików, więc łapie to wprost.
  const cialo = await wczytaj(CIALO);
  const idle = await wczytaj(ANIM + 'idle_sway.glb');      // na tym liczymy dopasowanie
  const chod = await wczytaj(ANIM + 'walk_cycle.glb');     // ten przenosimy
  const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB);
  const k = przenies({ zrodloRoot: chod.scene, klip: chod.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
  const pelvis = P.pary.find(w => w.cs === 'pelvis').c;
  const rk = wydzielRuchKorzenia(k, pelvis);
  const v = rk.droga / k.duration;
  sprawdz(rk.droga > 1.0, 'klip przeniesiony z INNEJ hierarchii niż przygotowanie naprawdę się rusza (bez przewiązania kości wychodziło 0,000 m)', { droga_m: +rk.droga.toFixed(3) });
  sprawdz(v >= 1.10 && v <= 1.55, 'i ma tę samą prędkość co przy przygotowaniu na własnym klipie', { v: +v.toFixed(3) });
  // Pion miednicy MUSI zostać w klipie — wydzielamy tylko poziom. Pierwsza wersja zakładała, że pionem jest
  // lokalne +y, a w tym rigu jest nim lokalne +z (kość Root obrócona o −90°), więc wycinała dokładnie ten pion.
  const mix = new THREE.AnimationMixer(cialo.scene); mix.clipAction(k).play();
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i <= 60; i++) { mix.setTime((i / 60) * (k.duration - 1e-4)); cialo.scene.updateMatrixWorld(true); const y = poz(pelvis).y; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  sprawdz((ymax - ymin) * 1000 > 20, 'po wydzieleniu poziomu w klipie ZOSTAJE pion miednicy (inaczej chód jest sunięciem)', { pion_mm: +((ymax - ymin) * 1000).toFixed(1) });
}

console.log('\n=== C. Normalizacja korzenia — wszystkie klipy startują tak samo ===');
{
  const pliki = fs.readdirSync(ANIM).filter(x => x.endsWith('.glb')).sort();
  sprawdz(pliki.length >= 4, 'są klipy do sprawdzenia', { plikow: pliki.length });
  const starty = [];
  for (const f of pliki) {
    const cialo = await wczytaj(CIALO), mocap = await wczytaj(ANIM + f);
    const P = przygotuj(mocap.scene, cialo.scene, MAPA_ACCAD_MPFB);
    const klip = przenies({ zrodloRoot: mocap.scene, klip: mocap.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
    const mix = new THREE.AnimationMixer(cialo.scene); mix.clipAction(klip).play();
    const pel = cialo.scene.getObjectByName('pelvis');
    let ymin = Infinity, ymax = -Infinity, p0 = null, pk = null, k0 = 0;
    const N = Math.max(2, Math.round(klip.duration * 60));
    for (let i = 0; i <= N; i++) {
      mix.setTime(Math.min(klip.duration - 1e-4, i / 60)); cialo.scene.updateMatrixWorld(true);
      const p = poz(pel);
      if (i === 0) { p0 = p.clone(); k0 = new THREE.Euler().setFromQuaternion(pel.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y * 180 / Math.PI; }
      pk = p.clone(); if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y;
    }
    const d = pk.clone().sub(p0); d.y = 0;
    starty.push({ f: f.replace('.glb', ''), p0, k0, pion: (ymax - ymin) * 1000, droga: d.length(), v: d.length() / klip.duration });
  }
  const p0ref = starty[0].p0, k0ref = starty[0].k0;
  const maxDP = Math.max(...starty.map(s => s.p0.distanceTo(p0ref)));
  const maxDK = Math.max(...starty.map(s => Math.abs(s.k0 - k0ref)));
  // Bez normalizacji te same klipy startowały od (−2,472; 2,224) do (+1,939; −2,099), czyli rozjazd do 4,9 m,
  // i w kursach od −133° do +47°. To jest kalibracja tej asercji — liczby zmierzone na tych samych plikach.
  sprawdz(maxDP < 0.002, 'wszystkie klipy startują w tym samym punkcie (próg 2 mm; bez normalizacji rozjazd sięgał 4,9 m)', { maxRozjazd_mm: +(maxDP * 1000).toFixed(2) });
  sprawdz(maxDK < 0.5, 'wszystkie klipy startują w tym samym kursie (próg 0,5°; bez normalizacji zakres −133°…+47°)', { maxRoznicaKursu: +maxDK.toFixed(3) });

  console.log('\n  klip              pion miednicy   droga     prędkość');
  for (const s of starty) console.log(`  ${s.f.padEnd(17)} ${s.pion.toFixed(1).padStart(6)} mm   ${s.droga.toFixed(3)} m  ${s.v.toFixed(3)} m/s`);

  const chod = starty.find(s => s.f === 'walk_cycle');
  if (chod) {
    // Norma: pion środka masy 2,5–5,0 cm przy chodzie swobodnym. Postać z pionem poniżej ok. 1 cm „płynie"
    // zamiast iść — to jest ta wada, którą przepuszczała asercja K6 biblioteki pomiarowej (sprawdzała sam kształt).
    sprawdz(chod.pion >= 25 && chod.pion <= 50, 'cykl chodu: pion miednicy 25–50 mm peak-to-peak', { pion_mm: +chod.pion.toFixed(1) });
    sprawdz(chod.v >= 1.10 && chod.v <= 1.55, 'cykl chodu: prędkość 1,10–1,55 m/s (norma dla wzrostu 175–185 cm)', { v: +chod.v.toFixed(3) });
  } else uwaga('brak walk_cycle.glb — pominięto asercje chodu', {});

  for (const s of starty.filter(s => s.f.startsWith('idle'))) {
    sprawdz(s.droga < 0.05, `idle "${s.f}" nie przemieszcza postaci (próg 5 cm)`, { droga_m: +s.droga.toFixed(3) });
    if (s.pion < 0.5) uwaga(`idle "${s.f}" ma pion miednicy poniżej 0,5 mm — bezruch, do ożywienia warstwą proceduralną`, { pion_mm: +s.pion.toFixed(2) });
  }
}

console.log('\n=== D. Miary FUNKCJONALNE — to, czego zgodność kierunków NIE widzi ===');
{
  // Zgodność kierunków kości może wynosić 0,000°, a poza i tak być rozjechana: kierunek ma 2 stopnie
  // swobody, rotacja 3. Zły SKRĘT kości obraca pozycje wszystkich jej dzieci, nie zmieniając jej kierunku.
  // Tak właśnie przeszła wada widoczna gołym okiem na telefonie (zwinięty tułów, głowa wyrzucona w przód).
  // Te miary są odporne na różnicę długości kości i łapią skręt: zakres wymachu w płaszczyźnie marszu
  // oraz korelacja ramienia z udem TEJ SAMEJ strony (przeciwfaza — zmierzone −0,927).
  const cialo = await wczytaj(CIALO);
  const idle = await wczytaj(ANIM + 'idle_sway.glb');
  const chod = await wczytaj(ANIM + 'walk_cycle.glb');
  const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
  const k = przenies({ zrodloRoot: chod.scene, klip: chod.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });

  const serie = (root, mix, klip, pary, korzen) => {
    const N = 60, out = {}, px = [], pz = [], zapis = [];
    for (let i = 0; i < N; i++) {
      mix.setTime((i / N) * (klip.duration - 1e-4)); root.updateMatrixWorld(true);
      const p = poz(root.getObjectByName(korzen)); px.push(p.x); pz.push(p.z);
      zapis.push(pary.map(([, a, b]) => poz(root.getObjectByName(b)).sub(poz(root.getObjectByName(a)))));
    }
    const marsz = new THREE.Vector3(px[N - 1] - px[0], 0, pz[N - 1] - pz[0]).normalize();
    pary.forEach(([n], j) => { out[n] = zapis.map(r => Math.atan2(r[j].dot(marsz), -r[j].y) * 180 / Math.PI); });
    return out;
  };
  const kor = (a, b) => {
    const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
    let s = 0, sa = 0, sb = 0;
    for (let i = 0; i < a.length; i++) { const u = a[i] - ma, v = b[i] - mb; s += u * v; sa += u * u; sb += v * v; }
    return s / Math.sqrt(sa * sb);
  };
  const zakres = a => Math.max(...a) - Math.min(...a);

  const mixC = new THREE.AnimationMixer(cialo.scene); mixC.clipAction(k).play();
  const C = serie(cialo.scene, mixC, k, [['udoL', 'thigh_l', 'calf_l'], ['udoP', 'thigh_r', 'calf_r'],
    ['ramieL', 'upperarm_l', 'lowerarm_l'], ['ramieP', 'upperarm_r', 'lowerarm_r']], 'pelvis');
  const chod2 = await wczytaj(ANIM + 'walk_cycle.glb');
  const mixZ = new THREE.AnimationMixer(chod2.scene); mixZ.clipAction(chod2.animations[0]).play();
  const Z = serie(chod2.scene, mixZ, chod2.animations[0], [['udoL', 'LeftUpLeg', 'LeftLeg'],
    ['ramieL', 'LeftArm', 'LeftForeArm'], ['ramieP', 'RightArm', 'RightForeArm']], 'Hips');

  for (const n of ['udoL', 'ramieL', 'ramieP']) {
    const zc = zakres(C[n]), zz = zakres(Z[n]);
    sprawdz(Math.abs(zc - zz) < 1.5, `zakres wymachu "${n}" przeniesiony bez strat (próg 1,5°)`, { cel: +zc.toFixed(1), zrodlo: +zz.toFixed(1) });
  }
  const kL = kor(C.ramieL, C.udoL), kP = kor(C.ramieP, C.udoP);
  sprawdz(kL <= -0.80 && kP <= -0.80, 'ramię i udo TEJ SAMEJ strony w przeciwfazie (K7, próg −0,80)', { lewa: +kL.toFixed(3), prawa: +kP.toFixed(3) });
  sprawdz(zakres(C.ramieL) > 10 && zakres(C.ramieP) > 10, 'ręce naprawdę machają (próg 10°; asymetria 33/16° jest w SAMYM mocapie, nie jest wadą)', { L: +zakres(C.ramieL).toFixed(1), P: +zakres(C.ramieP).toFixed(1) });
}

console.log(`\n${bledy === 0 ? 'OK' : 'FAIL'} — błędów: ${bledy}, uwag: ${ostrzezenia}`);
process.exit(bledy === 0 ? 0 : 1);
