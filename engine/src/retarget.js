// Przeniesienie klipu mocap z jednego szkieletu na drugi, w czasie ładowania sceny.
//
// DLACZEGO NIE SkeletonUtils.retargetClip: ustawia bezwzględne rotacje światowe kości docelowej na rotacje
// źródłowej, bez żadnej kompensacji różnicy póz spoczynkowych. Zmierzone na naszych plikach: mocap ACCAD stoi
// w pozie T (ramię 92,3° od pionu w dół), a ciało MPFB w pozie A (41,1°). Różnica 51° na barku wchodzi wprost
// do wyniku. Do tego klipy mocap nie mają siatki, więc nie mają `skin`, i retargetClip rzuca na nich TypeError.
//
// CO ROBIMY ZAMIAST TEGO — dwa kroki, oba mierzalne:
//
//  1. DOPASOWANIE (raz na parę szkieletów). Obracamy kości celu tak, żeby ich kierunki światowe pokryły się
//     z kierunkami kości źródła w POZIE SPOCZYNKOWEJ. To sprowadza oba szkielety do tej samej pozy fizycznej
//     (u nas: cel przechodzi z pozy A do pozy T źródła). Zapamiętujemy dla każdej kości poprawkę
//         C = qŹródłaSpoczynek⁻¹ · qCeluPoDopasowaniu
//     Kierunek kości liczymy jako wektor od kości do jej ZMAPOWANEGO dziecka — nie od kości do dowolnego
//     dziecka, bo hierarchie się różnią (ACCAD ma ToSpine, MPFB nie).
//
//  2. ODTWARZANIE (każda klatka). qCelu(t) = qŹródła(t) · C, potem zamiana na rotację lokalną przez odwrotność
//     rotacji światowej RODZICA. Kolejność obliczeń jest hierarchiczna (rodzic przed dzieckiem), bo rotacja
//     lokalna dziecka zależy od świata rodzica, który właśnie ustawiliśmy.
//
// Dlaczego to zachowuje skręt, a proste „dopasuj kierunek kości" nie: kierunek to tylko 2 stopnie swobody,
// rotacja ma 3. Skręt przedramienia i obrót klatki piersiowej giną przy dopasowywaniu samych kierunków.
//
// KORZEŃ: pozycja miednicy jest przeliczana przez stosunek wzrostów i przesuwana tak, żeby klip zaczynał się
// w początku układu i w kursie 0. Bez tego klipy ACCAD teleportują postać — zmierzone Hips w chwili 0:
// idle ok. (−0,03; −0,10), walk_cycle (−1,858; 1,734), walk_to_stand (+1,939; −2,099), a kursy od −133° do +47°.
import * as THREE from 'three';

// Mapa 22 stawów ACCAD na kości rigu game_engine z MPFB (konwencja Unreal).
// ToSpine nie ma odpowiednika w celu (MPFB ma 3 segmenty kręgosłupa, ACCAD 4 wraz z ToSpine) — pomijamy go,
// a Spine/Spine1 idą na spine_02/spine_03. spine_01 zostaje sterowany przez miednicę.
export const MAPA_ACCAD_MPFB = {
  Hips: 'pelvis', Spine: 'spine_02', Spine1: 'spine_03', Neck: 'neck_01', Head: 'head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
};

const qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion();
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

const swiatQ = o => o.getWorldQuaternion(new THREE.Quaternion());
const swiatP = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

// Kierunek światowy kości: od niej do jej zmapowanego dziecka. null, gdy kość jest liściem mapy.
function kierunek(obj, dziecko) {
  if (!dziecko) return null;
  return swiatP(dziecko).sub(swiatP(obj)).normalize();
}

/**
 * Przygotowuje przeniesienie: liczy dopasowanie póz spoczynkowych i poprawki C.
 * @param {THREE.Object3D} zrodloRoot korzeń hierarchii mocap (w pozie spoczynkowej)
 * @param {THREE.Object3D} celRoot korzeń hierarchii ciała (w pozie spoczynkowej)
 * @param {Object} mapa nazwa źródła -> nazwa celu
 * @returns {{pary: Array, wzrostZrodla: number, wzrostCelu: number, skala: number, diag: Object}}
 */
export function przygotuj(zrodloRoot, celRoot, mapa = MAPA_ACCAD_MPFB) {
  zrodloRoot.updateMatrixWorld(true); celRoot.updateMatrixWorld(true);

  // Pary w kolejności hierarchicznej celu (rodzic przed dzieckiem) — inaczej rotacja lokalna dziecka
  // liczyłaby się z nieaktualnego świata rodzica.
  const pary = [];
  const doOdwiedzenia = [];
  celRoot.traverse(o => { if (o.name) doOdwiedzenia.push(o); });
  const celPoNazwie = new Map(doOdwiedzenia.map(o => [o.name, o]));
  const zrodloPoNazwie = new Map();
  zrodloRoot.traverse(o => { if (o.name) zrodloPoNazwie.set(o.name, o); });

  const glebokosc = o => { let d = 0, p = o; while (p.parent) { d++; p = p.parent; } return d; };
  const wpisy = Object.entries(mapa)
    .map(([zs, cs]) => ({ zs, cs, z: zrodloPoNazwie.get(zs), c: celPoNazwie.get(cs) }))
    .filter(w => w.z && w.c)
    .sort((a, b) => glebokosc(a.c) - glebokosc(b.c));

  // Dla kości z WIELOMA zmapowanymi dziećmi „pierwsze dziecko" zależy od kolejności w pliku, a ta może się
  // różnić między szkieletami — miednica dostałaby raz kierunek do kręgosłupa, raz do uda. Dlatego dla tych
  // dwóch kości kierunek jest wskazany jawnie. Reszta ma dokładnie jedno zmapowane dziecko.
  const KIERUNEK_JAWNY = { Hips: 'Spine', Spine1: 'Neck' };
  // Dziecko zmapowane: pierwszy potomek źródła, który też jest w mapie (dla kierunku kości).
  const dzieckoZmapowane = (obj, poNazwie) => {
    for (const d of obj.children) { if (poNazwie.has(d.name)) return d; }
    for (const d of obj.children) { const g = dzieckoZmapowane(d, poNazwie); if (g) return g; }
    return null;
  };
  const zrodloWMapie = new Set(Object.keys(mapa)), celWMapie = new Set(Object.values(mapa));
  const maZ = new Map(), maC = new Map();
  zrodloRoot.traverse(o => { if (o.name) maZ.set(o.name, zrodloWMapie.has(o.name)); });
  celRoot.traverse(o => { if (o.name) maC.set(o.name, celWMapie.has(o.name)); });
  const dzZ = o => (KIERUNEK_JAWNY[o.name] ? zrodloPoNazwie.get(KIERUNEK_JAWNY[o.name]) : null)
    || dzieckoZmapowane(o, { has: n => maZ.get(n) === true });
  const dzC = o => {
    const zs = Object.keys(mapa).find(k => mapa[k] === o.name);
    const jawne = zs && KIERUNEK_JAWNY[zs] ? celPoNazwie.get(mapa[KIERUNEK_JAWNY[zs]]) : null;
    return jawne || dzieckoZmapowane(o, { has: n => maC.get(n) === true });
  };

  // ---- KROK 1: dopasowanie pozy spoczynkowej celu do pozy źródła ----
  const diag = { dopasowane: [], odchylkaPrzed: [], odchylkaPo: [] };
  for (const w of wpisy) {
    const dz = kierunek(w.z, dzZ(w.z));
    if (!dz) continue;                       // liść mapy — nie ma czego dopasować
    celRoot.updateMatrixWorld(true);
    const dc = kierunek(w.c, dzC(w.c));
    if (!dc) continue;
    diag.odchylkaPrzed.push([w.cs, Math.acos(Math.max(-1, Math.min(1, dc.dot(dz)))) * 180 / Math.PI]);
    // Obrót świata, który sprowadza kierunek celu na kierunek źródła; nakładamy go na rotację światową kości.
    const R = qTmp.setFromUnitVectors(dc, dz);
    const nowySwiat = R.clone().multiply(swiatQ(w.c));
    const rodzicSwiat = w.c.parent ? swiatQ(w.c.parent) : new THREE.Quaternion();
    w.c.quaternion.copy(rodzicSwiat.invert().multiply(nowySwiat));
    w.c.updateMatrixWorld(true);
    diag.dopasowane.push(w.cs);
  }
  celRoot.updateMatrixWorld(true);
  for (const w of wpisy) {
    const dz = kierunek(w.z, dzZ(w.z)), dc = kierunek(w.c, dzC(w.c));
    if (dz && dc) diag.odchylkaPo.push([w.cs, Math.acos(Math.max(-1, Math.min(1, dc.dot(dz)))) * 180 / Math.PI]);
  }

  // ---- Poprawki C, liczone na DOPASOWANEJ pozie celu ----
  for (const w of wpisy) {
    w.C = swiatQ(w.z).invert().multiply(swiatQ(w.c));
    w.qCeluDopasowany = swiatQ(w.c);
  }

  // Skala ruchu korzenia = stosunek WYSOKOŚCI BIODER, nie wzrostu. To długość nogi wyznacza długość kroku,
  // a wysokość bioder jest jej bezpośrednią miarą; wzrost liczony z kości i tak jest zaniżony po obu stronach
  // (czubek czaszki leży wyżej niż ostatnia kość — u ACCAD o 23 cm), więc byłby gorszym przybliżeniem.
  const wzrostZrodla = swiatP(wpisy.find(w => w.zs === 'Hips')?.z || zrodloRoot).y;
  const wzrostCelu = swiatP(wpisy.find(w => w.cs === 'pelvis')?.c || celRoot).y;
  const skala = wzrostCelu / wzrostZrodla;

  return { pary: wpisy, wzrostZrodla, wzrostCelu, skala, diag };
}

/**
 * Ustawia szkielet celu w pozie ze źródła. Wywoływane co klatkę po tym, jak mixer źródła ustawił jego pozę.
 * @param {Array} pary wynik przygotuj().pary
 */
export function zastosuj(pary, celRoot) {
  for (const w of pary) {
    const qc = swiatQ(w.z).multiply(w.C);
    const rodzicSwiat = w.c.parent ? swiatQ(w.c.parent) : new THREE.Quaternion();
    w.c.quaternion.copy(rodzicSwiat.invert().multiply(qc));
    w.c.updateMatrixWorld(false);
  }
}

/**
 * Buduje gotowy AnimationClip na kościach CELU, próbkując źródło co 1/fps.
 * Robimy to raz przy ładowaniu: 6 klipów × ok. 480 klatek × 21 kości to kilkadziesiąt tysięcy operacji
 * na kwaternionach, czyli pojedyncze milisekundy — a w zamian w pętli gry nie ma już żadnego przeliczania.
 *
 * @param {Object} opts
 * @param {THREE.Object3D} opts.zrodloRoot hierarchia mocap
 * @param {THREE.AnimationClip} opts.klip klip na hierarchii mocap
 * @param {Array} opts.pary wynik przygotuj().pary
 * @param {THREE.Object3D} opts.celRoot hierarchia ciała (zostanie ustawiona w pozie ostatniej klatki)
 * @param {string} opts.korzen nazwa kości korzenia celu, do której trafia pozycja
 * @param {number} opts.skala stosunek wzrostów
 * @param {number} opts.fps częstotliwość próbkowania
 * @param {boolean} opts.normalizujKorzen odjąć pozycję XZ i kurs z chwili 0
 */
export function przenies({ zrodloRoot, klip, pary, celRoot, korzen = 'pelvis', skala = 1, fps = 30, normalizujKorzen = true }) {
  const mieszacz = new THREE.AnimationMixer(zrodloRoot);
  const akcja = mieszacz.clipAction(klip);
  akcja.play();

  const N = Math.max(2, Math.round(klip.duration * fps) + 1);
  const czasy = new Float32Array(N);
  const kanaly = new Map();   // nazwa kości -> Float32Array kwaternionów
  for (const w of pary) kanaly.set(w.cs, new Float32Array(N * 4));
  const korzenPoz = new Float32Array(N * 3);
  const paraKorzenia = pary.find(w => w.cs === korzen);
  if (!paraKorzenia) throw new Error(`przenies: w mapie nie ma kości korzenia "${korzen}"`);

  // Normalizacja korzenia: pozycja XZ i kurs (obrót wokół pionu) z chwili 0 są odejmowane, więc każdy klip
  // zaczyna się w (0,0) i patrzy w tę samą stronę. Bez tego przejście między klipami teleportuje postać
  // o kilka metrów i obraca ją o ~180° — zmierzone na tych właśnie plikach.
  let p0 = null;
  const qOdwrotnyKurs = new THREE.Quaternion();
  if (normalizujKorzen) {
    mieszacz.setTime(0); zrodloRoot.updateMatrixWorld(true);
    p0 = swiatP(paraKorzenia.z);
    const e = new THREE.Euler().setFromQuaternion(swiatQ(paraKorzenia.z), 'YXZ');
    qOdwrotnyKurs.setFromAxisAngle(vA.set(0, 1, 0), -e.y);
  }
  // Pozycja spoczynkowa korzenia i rotacja jego RODZICA. Rodzicem miednicy jest kość Root, którą eksporter
  // glTF obraca o −90° wokół X (konwersja Z-up Blendera na Y-up glTF) — więc światowego przesunięcia źródła
  // NIE WOLNO dodawać wprost do pozycji lokalnej celu. Trzeba je najpierw przeliczyć do układu rodzica.
  const spocz = paraKorzenia.c.position.clone();
  const qRodzicOdwr = paraKorzenia.c.parent ? swiatQ(paraKorzenia.c.parent).invert() : new THREE.Quaternion();

  for (let i = 0; i < N; i++) {
    const t = Math.min(klip.duration, i / fps);
    czasy[i] = t;
    mieszacz.setTime(t);
    zrodloRoot.updateMatrixWorld(true);
    zastosuj(pary, celRoot);

    // Kurs początkowy zdejmujemy w ŚWIECIE, na korzeniu, PRZED odczytem kwaternionów: obrót korzenia
    // przenosi się na całą hierarchię, a rotacje lokalne dzieci zostają nietknięte i nadal poprawne.
    if (normalizujKorzen) {
      const qw = swiatQ(paraKorzenia.c).premultiply(qOdwrotnyKurs);
      const qp = paraKorzenia.c.parent ? swiatQ(paraKorzenia.c.parent) : new THREE.Quaternion();
      paraKorzenia.c.quaternion.copy(qp.invert().multiply(qw));
      paraKorzenia.c.updateMatrixWorld(true);
    }

    for (const w of pary) {
      const q = w.c.quaternion, a = kanaly.get(w.cs);
      a[i * 4] = q.x; a[i * 4 + 1] = q.y; a[i * 4 + 2] = q.z; a[i * 4 + 3] = q.w;
    }

    const p = swiatP(paraKorzenia.z);
    if (p0) { p.sub(p0); p.applyQuaternion(qOdwrotnyKurs); }
    p.multiplyScalar(skala).applyQuaternion(qRodzicOdwr);
    korzenPoz[i * 3] = spocz.x + p.x;
    korzenPoz[i * 3 + 1] = spocz.y + p.y;
    korzenPoz[i * 3 + 2] = spocz.z + p.z;
  }

  const sciezki = [new THREE.VectorKeyframeTrack(`${korzen}.position`, czasy, korzenPoz)];
  for (const [nazwa, dane] of kanaly) sciezki.push(new THREE.QuaternionKeyframeTrack(`${nazwa}.quaternion`, czasy, dane));
  const wynik = new THREE.AnimationClip(klip.name, klip.duration, sciezki);
  akcja.stop(); mieszacz.uncacheClip(klip);
  return wynik;
}
