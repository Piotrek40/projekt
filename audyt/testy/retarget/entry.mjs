// Test przeniesienia mocapu na szkielet NPC. Bez przeglądarki, ok. 20 s.
// Uruchomienie: bash audyt/testy/retarget_test.sh   (bundluje esbuildem, bo engine/src nie ma node_modules)
//
// Każda asercja ma podany PRÓG i to, co go kalibruje — czyli liczbę zmierzoną na danych, na których oblewa.
// Asercja, której nie widziało się oblewającej, jest bezwartościowa; w tym projekcie napisałem już
// asercję-tautologię i próg jasności sześć jednostek obok celu, więc to nie jest teoretyczne zmartwienie.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import { przygotuj, przenies, MAPA_ACCAD_MPFB } from '../../../engine/src/retarget.js';

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

console.log(`\n${bledy === 0 ? 'OK' : 'FAIL'} — błędów: ${bledy}, uwag: ${ostrzezenia}`);
process.exit(bledy === 0 ? 0 : 1);
