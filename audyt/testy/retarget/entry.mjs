// Test przeniesienia mocapu na szkielet NPC. Bez przeglądarki, ok. 20 s.
// Uruchomienie: bash audyt/testy/retarget_test.sh   (bundluje esbuildem, bo engine/src nie ma node_modules)
//
// Każda asercja ma podany PRÓG i to, co go kalibruje — czyli liczbę zmierzoną na danych, na których oblewa.
// Asercja, której nie widziało się oblewającej, jest bezwartościowa; w tym projekcie napisałem już
// asercję-tautologię i próg jasności sześć jednostek obok celu, więc to nie jest teoretyczne zmartwienie.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import { przygotuj, przenies, przyziem, zapetlij, zablokujStopy, odsunRece, wydzielRuchKorzenia, ruchKorzeniaW, MAPA_ACCAD_MPFB } from '../../../engine/src/retarget.js';

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
  const P = przygotuj(mocap.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: mocap.animations[0], czasOdniesienia: 0 });
  const dop = new Set(P.diag.dopasowane);
  const przed = Math.max(...P.diag.odchylkaPrzed.filter(x => dop.has(x[0])).map(x => x[1]));
  const po = Math.max(...P.diag.odchylkaPo.filter(x => dop.has(x[0])).map(x => x[1]));
  sprawdz(P.pary.length === 21, 'zmapowanych par kości = 21 z 22 (ToSpine celowo bez odpowiednika — patrz komentarz przy mapie)', { par: P.pary.length });
  // DOPASOWUJEMY TYLKO RĘCE. Reszta kości dostaje przeniesienie ZMIANY względem pozy odniesienia, przy
  // zachowaniu własnej geometrii — inaczej do torsu naszej postaci wchodzi 45,4° załamania z rozstawu
  // stawów szkieletu ACCAD. Ta asercja sprawdza więc tylko kości faktycznie dopasowywane.
  sprawdz(dop.size >= 6 && [...dop].every(n => /clavicle|upperarm|lowerarm|hand/i.test(n)), 'dopasowywane są wyłącznie kości rąk', { dopasowane: [...dop] });
  sprawdz(przed > 60, 'kalibracja: przed dopasowaniem odchyłka rąk jest duża (inaczej test niczego nie dowodzi)', { maxPrzed: +przed.toFixed(1) });
  sprawdz(po < 0.5, 'po dopasowaniu kierunki kości RĄK pokrywają się (próg 0,5°)', { maxPo: +po.toFixed(3) });
  sprawdz(P.skala > 0.9 && P.skala < 1.1, 'skala ruchu korzenia z wysokości bioder w granicach 0,9–1,1', { skala: +P.skala.toFixed(4) });
}

console.log('\n=== B. Przeniesienie rotacji (bez normalizacji korzenia) ===');
{
  const cialo = await wczytaj(CIALO), mocap = await wczytaj(ANIM + 'walk_cycle.glb');
  const P = przygotuj(mocap.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: mocap.animations[0], czasOdniesienia: 0 });
  const klip = przenies({ zrodloRoot: mocap.scene, klip: mocap.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30, normalizujKorzen: false });
  const mZ = new THREE.AnimationMixer(mocap.scene); mZ.clipAction(mocap.animations[0]).play();
  const mC = new THREE.AnimationMixer(cialo.scene); mC.clipAction(klip).play();
  let max = 0, gdzie = '';
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * (klip.duration - 1e-4);
    mZ.setTime(t); mocap.scene.updateMatrixWorld(true);
    mC.setTime(t); cialo.scene.updateMatrixWorld(true);
    for (const [n, za, zb, ca, cb] of PARY_KIER) {
      if (!/ramię|przedramię/.test(n)) continue;   // tylko kości dopasowywane; reszta ma ZACHOWAĆ własną geometrię
      const d = kat(kier(mocap.scene, za, zb), kier(cialo.scene, ca, cb));
      if (d > max) { max = d; gdzie = `${n} @ t=${t.toFixed(2)}`; }
    }
  }
  sprawdz(max < 0.5, 'kości RĄK wskazują tam, gdzie kości źródła, przez cały klip (próg 0,5°)', { maxRoznica: +max.toFixed(3), gdzie });
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
  const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
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
    // Poza odniesienia MUSI być ta sama dla wszystkich klipów — tak robi produkcja (rynek/src/npc.js liczy
    // przygotowanie raz, na idle_sway). Wersja z „własną pierwszą klatką każdego klipu" dawała 131,6° rozjazdu
    // kursu, bo każdy klip zaczyna się w innej orientacji, więc dostawał inną poprawkę.
    const cialo = await wczytaj(CIALO), odn = await wczytaj(ANIM + 'idle_sway.glb'), mocap = await wczytaj(ANIM + f);
    const P = przygotuj(odn.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: odn.animations[0], czasOdniesienia: 0 });
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
  // Próg 2°, nie 0,5. Zmierzone 0,51° to resztka po tym, że miednica nie jest już dopasowywana do źródła
  // i jej orientacja spoczynkowa wchodzi do wyniku w minimalnie różnym stopniu w każdym klipie. Pół stopnia
  // przy przejściu jest niewidoczne; kalibracją jest zakres BEZ normalizacji, czyli 180°.
  sprawdz(maxDK < 2, 'wszystkie klipy startują w tym samym kursie (próg 2°; bez normalizacji zakres −133°…+47°)', { maxRoznicaKursu: +maxDK.toFixed(3) });

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

console.log('\n=== C2. Przyziemienie i wysokość tułowia ===');
{
  // Dwie wady zgłoszone przez Piotra ze zrzutu, obie zmierzone: postać unosiła się nad bruk, a tułów wyglądał
  // na przygarbiony. Pierwsza była prawdziwa (3,5 mm w chodzie, −10…−52 mm w pozostałych klipach — czyli raz
  // nad, raz pod), druga okazała się WŁASNOŚCIĄ MOCAPU (odchylenie tułowia w źródle 2,6°, u nas 1,3°).
  const pliki = fs.readdirSync(ANIM).filter(x => x.endsWith('.glb')).sort();
  const cialoR = await wczytaj(CIALO); cialoR.scene.updateMatrixWorld(true);
  const mR = poz(cialoR.scene.getObjectByName('pelvis'));
  const bR = poz(cialoR.scene.getObjectByName('clavicle_l')).add(poz(cialoR.scene.getObjectByName('clavicle_r'))).multiplyScalar(0.5);
  const tulowSpoczynek = (bR.y - mR.y) * 1000;

  for (const f of pliki) {
    const cialo = await wczytaj(CIALO), idle = await wczytaj(ANIM + 'idle_sway.glb'), src = await wczytaj(ANIM + f);
    let skin = null; cialo.scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
    const pelvis = P.pary.find(w => w.cs === 'pelvis').c;
    const k = przenies({ zrodloRoot: src.scene, klip: src.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
    const r1 = przyziem(k, skin, pelvis, { fps: 30 });
    const r2 = przyziem(k, skin, pelvis, { fps: 30 });   // po korekcie musi wyjść zero
    // KALIBRACJA: pierwszy pomiar pokazuje, ile brakowało (od −51,6 do +3,5 mm) — gdyby był zerowy,
    // asercja niczego by nie dowodziła.
    sprawdz(Math.abs(r2.przed * 1000) < 1, `"${f.replace('.glb', '')}": po przyziemieniu najniższy wierzchołek stopy na podłodze (próg 1 mm)`, { przed_mm: +(r1.przed * 1000).toFixed(1), po_mm: +(r2.przed * 1000).toFixed(2) });
  }

  // Wysokość tułowia: animacja nie może go ściskać ani rozciągać względem tego, jak wyrzeźbiono model.
  // KALIBRACJA na realnym błędzie: dopisanie ToSpine → spine_01 do mapy dawało 394 mm zamiast 501 mm.
  const cialo = await wczytaj(CIALO), idle = await wczytaj(ANIM + 'idle_sway.glb'), chod = await wczytaj(ANIM + 'walk_cycle.glb');
  const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
  const k = przenies({ zrodloRoot: chod.scene, klip: chod.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
  const mix = new THREE.AnimationMixer(cialo.scene); mix.clipAction(k).play();
  let suma = 0; const N = 40;
  for (let i = 0; i < N; i++) {
    mix.setTime((i / N) * (k.duration - 1e-4)); cialo.scene.updateMatrixWorld(true);
    const m = poz(cialo.scene.getObjectByName('pelvis'));
    const b = poz(cialo.scene.getObjectByName('clavicle_l')).add(poz(cialo.scene.getObjectByName('clavicle_r'))).multiplyScalar(0.5);
    suma += (b.y - m.y) * 1000;
  }
  const tulowAnim = suma / N;
  // Próg 60 mm, nie 25. Zmierzone: poza spoczynkowa 503 mm, animacja 465 mm — różnica 38 mm bierze się
  // z krzywizny kręgosłupa aktora przeniesionej na KRÓTSZE segmenty celu (łańcuch zgina się tak samo w stopniach,
  // ale traci więcej wysokości), a nie z błędu. Odgradzamy grube ściśnięcie: wariant z ToSpine → spine_01
  // dawał 394 mm, czyli 109 mm. Próg 25 mm oblewałby na poprawnym wyniku, a to jest fałszywe oblanie.
  // ZAŁAMANIE W PASIE — wada zgłoszona przez Piotra („dolna połowa przyszyta nierówno do górnej").
  // Kręgosłup MPFB jest prosty: kąt pelvis–spine_02–spine_03 w pozie spoczynkowej to 0,8°. Szkielet ACCAD
  // ma w rozstawie stawów 45,4° i dopasowywanie kierunków wtłaczało je w tors. Po ograniczeniu dopasowania
  // do rąk zostaje 12,1°, czyli realny ruch kręgosłupa w chodzie.
  let zal = 0;
  for (let i = 0; i < N; i++) {
    mix.setTime((i / N) * (k.duration - 1e-4)); cialo.scene.updateMatrixWorld(true);
    const a = poz(cialo.scene.getObjectByName('pelvis')), b = poz(cialo.scene.getObjectByName('spine_02')), c = poz(cialo.scene.getObjectByName('spine_03'));
    const u = b.clone().sub(a).normalize(), v = c.clone().sub(b).normalize();
    zal += Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180 / Math.PI;
  }
  sprawdz(zal / N < 25, 'kręgosłup nie dostaje załamania z rozstawu stawów źródła (próg 25°; przy dopasowywaniu wszystkich kości wychodziło 45,4°, a poza spoczynkowa ciała ma 0,8°)', { srednie_zalamanie: +(zal / N).toFixed(1) });

  sprawdz(Math.abs(tulowAnim - tulowSpoczynek) < 60, 'animacja nie ściska tułowia (próg 60 mm; z ToSpine w mapie wychodziło 394 mm przy 503 mm w spoczynku)',
    { spoczynek_mm: +tulowSpoczynek.toFixed(0), animacja_mm: +tulowAnim.toFixed(0), roznica_mm: +(tulowAnim - tulowSpoczynek).toFixed(0) });
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

  // TE SAME MIARY PO PEŁNYM POTOKU. Blokada stóp przepisuje rotacje ud, goleni i stóp, a odsunięcie rąk —
  // rotacje ramion. Obie mogłyby po cichu zjeść wymach albo rozbić przeciwfazę, a asercje wyżej by tego
  // nie zobaczyły, bo mierzą klip SPRZED tych kroków. Ta wada — „test mierzy nie to, co jedzie na telefon" —
  // wystąpiła w tym projekcie już dwa razy, więc nie jest teoretyczna.
  let skinD = null; cialo.scene.traverse(o => { if (o.isSkinnedMesh) skinD = o; });
  const chodP = await wczytaj(ANIM + 'walk_cycle.glb');
  const klipPelny = przenies({ zrodloRoot: chodP.scene, klip: chodP.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
  klipPelny.name = 'walk_cycle';
  const pelvisD = P.pary.find(w => w.cs === 'pelvis').c;
  zapetlij(klipPelny, { korzen: 'pion' });
  przyziem(klipPelny, skinD, pelvisD, { fps: 30 });
  zablokujStopy(klipPelny, skinD, pelvisD);
  odsunRece(klipPelny, skinD, pelvisD);
  const mixP = new THREE.AnimationMixer(cialo.scene); mixP.clipAction(klipPelny).play();
  const F = serie(cialo.scene, mixP, klipPelny, [['udoL', 'thigh_l', 'calf_l'], ['udoP', 'thigh_r', 'calf_r'],
    ['ramieL', 'upperarm_l', 'lowerarm_l'], ['ramieP', 'upperarm_r', 'lowerarm_r']], 'pelvis');
  for (const n of ['udoL', 'udoP', 'ramieL', 'ramieP']) {
    // Próg 6°: blokada stóp MA prawo zmienić wymach uda, bo po to jest — dokłada tyle zgięcia, ile trzeba,
    // żeby stopa dosięgła bruku. Odgradzamy zjedzenie wymachu, nie jego korektę. Zmierzone różnice poniżej.
    sprawdz(Math.abs(zakres(F[n]) - zakres(C[n])) < 6, `pełny potok nie zjada wymachu "${n}" (próg 6°)`, { przed: +zakres(C[n]).toFixed(1), po: +zakres(F[n]).toFixed(1) });
  }
  const fL = kor(F.ramieL, F.udoL), fP = kor(F.ramieP, F.udoP);
  sprawdz(fL <= -0.80 && fP <= -0.80, 'po pełnym potoku ramię i udo nadal w przeciwfazie (próg −0,80)', { lewa: +fL.toFixed(3), prawa: +fP.toFixed(3) });
}

console.log('\n=== E. Blokada stóp: lewitacja, ślizg, prześwit (wady zgłoszone przez Piotra) ===');
{
  // Trzy wady z jednego zgłoszenia — „ślizgawica stóp", „lewitująca postać" — mają wspólną przyczynę
  // geometryczną: nasze ciało ma biodro 973,0 mm, a nogę plus kostkę nad podeszwą 972,8 mm, czyli ZAPAS 0,3 mm.
  // Przy kroku 0,66 m biodro musi opaść o ok. 48 mm, żeby stopa sięgnęła ziemi; stały offset tego nie robi.
  const cialo = await wczytaj(CIALO);
  let skin = null; cialo.scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
  const idle = await wczytaj(ANIM + 'idle_sway.glb');
  const P = przygotuj(idle.scene, cialo.scene, MAPA_ACCAD_MPFB, { klipOdniesienia: idle.animations[0], czasOdniesienia: 0 });
  const pelvis = P.pary.find(w => w.cs === 'pelvis').c;
  let szczyt = pelvis; while (szczyt.parent) szczyt = szczyt.parent;

  const grupa = re => {
    const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const ids = new Set(skin.skeleton.bones.map((b, j) => re.test(b.name) ? j : -1).filter(j => j >= 0));
    const out = [];
    for (let v = 0; v < geo.attributes.position.count; v++) {
      let w = 0;
      for (const k of ['X', 'Y', 'Z', 'W']) if (ids.has(si[`get${k}`](v))) w += sw[`get${k}`](v);
      if (w > 0.5) out.push(v);
    }
    return out;
  };
  const STOPY = [grupa(/^(foot_l|ball_l)$/), grupa(/^(foot_r|ball_r)$/)];
  const RECE = [grupa(/^(hand_l|lowerarm_l)$/), grupa(/^(hand_r|lowerarm_r)$/)];
  const TULOW = grupa(/^(pelvis|spine_0[123]|thigh_[lr])$/);
  const wp = new THREE.Vector3();
  const pkt = idx => { const a = []; for (const v of idx) { wp.fromBufferAttribute(skin.geometry.attributes.position, v); skin.applyBoneTransform(v, wp); wp.applyMatrix4(skin.matrixWorld); a.push(wp.clone()); } return a; };
  // Otoczka wypukła przekroju tułowia — miara NIEZALEŻNA od modelu elips, którego używa odsunRece().
  // Gdyby test mierzył tym samym modelem co poprawka, sprawdzałby wyłącznie sam siebie.
  const otoczka = pts => {
    const p = pts.map(v => [v.x, v.z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return null;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const d = [], g = [];
    for (const q of p) { while (d.length >= 2 && cr(d[d.length - 2], d[d.length - 1], q) <= 0) d.pop(); d.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (g.length >= 2 && cr(g[g.length - 2], g[g.length - 1], q) <= 0) g.pop(); g.push(q); }
    d.pop(); g.pop(); return d.concat(g);
  };
  const zanurzenie = (h, x, z) => {
    if (!h) return -Infinity;
    let m = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length], ex = b[0] - a[0], ez = b[1] - a[1];
      const dd = (ex * (z - a[1]) - ez * (x - a[0])) / Math.hypot(ex, ez);
      if (dd < m) m = dd;
    }
    return m;
  };

  const pliki = fs.readdirSync(ANIM).filter(x => x.endsWith('.glb')).sort();
  console.log('  klip              podeszwa min/mediana [mm]  ślizg w podparciu [m/s]  prześwit machającej [mm]  ręka w tułowiu [mm]');
  for (const f of pliki) {
    const nazwa = f.replace('.glb', '');
    const src = await wczytaj(ANIM + f);
    const k = przenies({ zrodloRoot: src.scene, klip: src.animations[0], pary: P.pary, celRoot: cialo.scene, skala: P.skala, fps: 30 });
    k.name = nazwa;
    const petlowy = nazwa.startsWith('idle') || nazwa === 'walk_cycle';
    let szewPrzed = 0;
    for (const t of k.tracks) {
      if (!t.name.endsWith('.quaternion')) continue;
      const v = t.values, n = v.length / 4;
      const a = new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
      const b = new THREE.Quaternion(v[(n - 1) * 4], v[(n - 1) * 4 + 1], v[(n - 1) * 4 + 2], v[(n - 1) * 4 + 3]).normalize();
      szewPrzed = Math.max(szewPrzed, a.angleTo(b) * 180 / Math.PI);
    }
    if (petlowy) zapetlij(k, { korzen: nazwa === 'walk_cycle' ? 'pion' : 'pelna' });
    przyziem(k, skin, pelvis, { fps: 30 });
    const ds = zablokujStopy(k, skin, pelvis, { przebiegi: true });
    const dr = odsunRece(k, skin, pelvis);
    const rk = wydzielRuchKorzenia(k, pelvis);

    const czasy = k.tracks.find(t => t.name === 'pelvis.position').times, N = czasy.length;
    const mix = new THREE.AnimationMixer(szczyt), akcja = mix.clipAction(k); akcja.play();
    const off = new THREE.Vector3();
    const wysoko = [], mied = [], poprz = [null, null];
    let maxSlizg = 0, minPrzeswit = Infinity, najglebiej = 0, klatekWTulowiu = 0, najnizej = 0;
    // idle_lookaround ma 479 klatek; kolizję rąk (otoczka na 2171 wierzchołkach) liczymy co czwartą,
    // bo test ma się mieścić w kilkudziesięciu sekundach, a ręka nie wskakuje w biodro na jedną klatkę.
    const coIle = N > 200 ? 4 : 1;
    for (let i = 0; i < N; i++) {
      mix.setTime(Math.min(k.duration - 1e-4, czasy[i]));
      szczyt.updateMatrixWorld(true);
      ruchKorzeniaW(rk, czasy[i], off);
      mied.push(poz(pelvis).y * 1000);
      let mn = Infinity;
      for (let n = 0; n < 2; n++) {
        const p = pkt(STOPY[n]);
        let m = Infinity;
        for (const v of p) if (v.y < m) m = v.y;
        mn = Math.min(mn, m); najnizej = Math.min(najnizej, m * 1000);
        const teraz = new Map();
        p.forEach((v, j) => { if (v.y < m + 0.012) teraz.set(STOPY[n][j], [v.x + off.x, v.z + off.z]); });
        if (poprz[n] && i > 0) {
          let sx = 0, sz = 0, c = 0;
          for (const [v, q] of teraz) { const r = poprz[n].get(v); if (r) { sx += q[0] - r[0]; sz += q[1] - r[1]; c++; } }
          const vv = c ? Math.hypot(sx / c, sz / c) * 30 : 0;
          if (ds.przebiegi.wagi[n][i] > 0.5) maxSlizg = Math.max(maxSlizg, vv);
          else if (vv > 1.0) minPrzeswit = Math.min(minPrzeswit, m * 1000);
        }
        poprz[n] = teraz;
      }
      wysoko.push(mn * 1000);
      if (i % coIle === 0) {
        const tu = pkt(TULOW);
        for (const g of RECE) {
          let mx = -Infinity;
          for (const v of pkt(g)) {
            const pas = tu.filter(u => Math.abs(u.y - v.y) < 0.015);
            const d = zanurzenie(otoczka(pas), v.x, v.z);
            if (d > mx) mx = d;
          }
          najglebiej = Math.max(najglebiej, mx * 1000);
          if (mx > 0) klatekWTulowiu++;
        }
      }
    }
    akcja.stop(); mix.uncacheClip(k);
    const sort = wysoko.slice().sort((a, b) => a - b);
    const mediana = sort[Math.floor(sort.length / 2)];
    let szarp = 0;
    for (let i = 2; i < N; i++) szarp = Math.max(szarp, Math.abs(mied[i] - 2 * mied[i - 1] + mied[i - 2]));
    const kol = Math.max(...mied) - Math.min(...mied);
    console.log(`  ${nazwa.padEnd(17)} ${najnizej.toFixed(1).padStart(6)} / ${mediana.toFixed(1).padStart(5)}          ${maxSlizg.toFixed(2).padStart(6)}                 ${(Number.isFinite(minPrzeswit) ? minPrzeswit.toFixed(1) : '—').padStart(6)}              ${najglebiej.toFixed(1).padStart(6)}`);

    // Progi z pomiaru na TYCH plikach. Kalibracja każdej asercji to liczba, na której oblewa.
    sprawdz(mediana < 3, `"${nazwa}": stopa stoi na ziemi (mediana podeszwy < 3 mm; bez korekty pionu per klatka było 0,7–36,7 mm, w chodzie 12,3)`, { mediana_mm: +mediana.toFixed(1) });
    sprawdz(najnizej > -3, `"${nazwa}": stopa nie wchodzi pod bruk (próg −3 mm; bez ogranicznika przenikania wychodziło −7,9 mm)`, { najnizej_mm: +najnizej.toFixed(1) });
    sprawdz(maxSlizg < 0.35, `"${nazwa}": stopa w podparciu nie ślizga się (próg 0,35 m/s; pierwsza wersja blokady dawała 3,04 m/s przy chodzie 1,20 m/s)`, { szczyt_ms: +maxSlizg.toFixed(2) });
    if (Number.isFinite(minPrzeswit)) sprawdz(minPrzeswit > 8, `"${nazwa}": stopa machająca nie szoruje po ziemi (próg 8 mm; bez wymuszonego prześwitu spadało do 0,0 mm)`, { przeswit_mm: +minPrzeswit.toFixed(1) });
    sprawdz(klatekWTulowiu === 0, `"${nazwa}": ręka nie wchodzi w tułów ani w udo (0 klatek; przed poprawką idle_sway miał 282 z 282, zanurzenie 48,3 mm)`, { klatek: klatekWTulowiu, najglebiej_mm: +najglebiej.toFixed(1) });
    sprawdz(szarp < 8, `"${nazwa}": miednica nie szarpie w pionie (próg 8 mm/klatkę²; korekta bez wygładzania dawała 19,67)`, { szarpniecie: +szarp.toFixed(2), kolysanie_mm: +kol.toFixed(1) });
    sprawdz(dr.maxKat.every(x => x < 12), `"${nazwa}": odsunięcie ręki jest małą poprawką (próg 12°; zmierzone maksimum 10,05° w idle_sway)`, { kat_st: dr.maxKat });
    if (petlowy) {
      // Klipy ACCAD to wycinki nagrania, nie zaprojektowane pętle. Zmierzone skoki na szwie PRZED domknięciem:
      // idle_sway 11,75° (dłoń prawa), idle_arms 5,05°, idle_lookaround 3,54° — przy LoopRepeat postać
      // co kilka sekund szarpie ręką.
      let szewPo = 0;
      for (const t of k.tracks) {
        if (!t.name.endsWith('.quaternion')) continue;
        const v = t.values, n = v.length / 4;
        const a = new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
        const b = new THREE.Quaternion(v[(n - 1) * 4], v[(n - 1) * 4 + 1], v[(n - 1) * 4 + 2], v[(n - 1) * 4 + 3]).normalize();
        szewPo = Math.max(szewPo, a.angleTo(b) * 180 / Math.PI);
      }
      sprawdz(szewPo < 0.5, `"${nazwa}": klip grany w pętli domyka się (próg 0,5°; przed domknięciem idle_sway skakał o 11,75°)`, { przed_st: +szewPrzed.toFixed(2), po_st: +szewPo.toFixed(3) });
    }
    if (ds.cykliczny) {
      // Klip zapętlony musi zamykać się co do bitu, inaczej blokada zostawia na szwie skok o tyle poślizgu,
      // ile uzbierała faza podparcia przechodząca przez koniec klipu.
      // Porównujemy SKŁADOWE, nie Quaternion.angleTo — ta liczy 2·acos(|dot|), a dla kwaternionu zapisanego
      // we float32 |q|² odbiega od 1 o ~1e−7, co daje 0,04° na DWÓCH IDENTYCZNYCH wartościach. Pierwsza wersja
      // tej asercji oblewała właśnie na tym artefakcie, nie na wadzie klipu.
      let szew = 0;
      for (const nazwaK of ['thigh_r', 'calf_r', 'foot_r']) {
        const t = k.tracks.find(x => x.name === nazwaK + '.quaternion').values, n = t.length / 4;
        for (let c = 0; c < 4; c++) szew = Math.max(szew, Math.abs(t[(n - 1) * 4 + c] - t[c]));
      }
      sprawdz(szew < 1e-6, `"${nazwa}": klip zapętlony zamyka się co do bitu na kościach nóg (próg 1e−6 na składowej kwaternionu)`, { szew });
    }
    if (nazwa === 'walk_cycle') {
      sprawdz(kol >= 25 && kol <= 60, 'cykl chodu: po korekcie pion miednicy nadal 25–60 mm (geometria wymusza opad ok. 48 mm przy kroku 0,66 m)', { kolysanie_mm: +kol.toFixed(1) });
      // KULAWIZNA. Pion miednicy ma w cyklu DWA szczyty, po jednym na krok, i powinny być równe. Prawa podeszwa
      // siedzi w retargecie 4,3 mm wyżej niż lewa, więc pion prowadzony raz jedną, raz drugą stopą modulował się
      // z częstotliwością kroku: rozrzut szczytów rósł z 15,2 mm (sam mocap) do 27,3 mm. Po wyrównaniu stóp 17,3.
      const okres = N - 1, gm = x => mied[((x % okres) + okres) % okres];
      const szczyty = [];
      for (let x = 0; x < okres; x++) if (gm(x) > gm(x - 1) && gm(x) >= gm(x + 1)) szczyty.push(gm(x));
      const rozrzut = szczyty.length > 1 ? Math.max(...szczyty) - Math.min(...szczyty) : 0;
      sprawdz(szczyty.length === 2, 'cykl chodu: pion miednicy ma dokładnie dwa szczyty, po jednym na krok', { szczytow: szczyty.length });
      sprawdz(rozrzut < 20, 'cykl chodu: postać nie utyka (rozrzut szczytów pionu < 20 mm; bez wyrównania stóp wychodziło 27,3, sam mocap ma 15,2)', { rozrzut_mm: +rozrzut.toFixed(1) });
    }
  }
}

console.log(`\n${bledy === 0 ? 'OK' : 'FAIL'} — błędów: ${bledy}, uwag: ${ostrzezenia}`);
process.exit(bledy === 0 ? 0 : 1);
