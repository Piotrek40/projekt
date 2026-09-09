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
// ToSpine ZOSTAJE NIEZMAPOWANE, i to jest decyzja podparta pomiarem, nie przeoczenie. Poza spoczynkowa ciała
// ma barki 503 mm nad miednicą. Bez ToSpine animacja daje 501 mm — tułów zachowany co do 2 mm. Po dopisaniu
// ToSpine → spine_01 wychodzi 394 mm, czyli tułów zgnieciony o 109 mm: trzy stawy celu dostają wtedy krzywiznę
// czterech stawów źródła o innych długościach i kręgosłup zwija się w literę S. spine_01 zostaje w pozie
// spoczynkowej i niesie go miednica.
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
export function przygotuj(zrodloRoot, celRoot, mapa = MAPA_ACCAD_MPFB, opcje = {}) {
  // POZA ODNIESIENIA. Nie wolno dopasowywać do pozy spoczynkowej BVH — w plikach ACCAD jest ona ŚMIECIEM.
  // Zmierzone na walk_cycle.glb: w pozie spoczynkowej Spine→Spine1 idzie (+0,199; +0,039) czyli W BOK,
  // Neck→Head (+0,095; +0,002) też w bok, a ramię (+0,286; +0,012) w bok. W pierwszej klatce klipu te same
  // kości idą odpowiednio (+0,028; +0,201) w górę, (+0,038; +0,081) w górę i (−0,085; −0,275) w dół — czyli
  // normalnie. Blender buduje armaturę z OFFSET-ów BVH, a w tych plikach cała orientacja siedzi w klatkach,
  // nie w hierarchii. Dopasowanie do pozy spoczynkowej dawało 87° obrotu na kręgosłupie i zwinięty tułów
  // (widoczne na zrzucie z telefonu; test tego NIE złapał, bo mierzył tylko kierunki kości).
  // Pominięcie pozy odniesienia daje wynik CICHO ZŁY, nie błąd — dlatego jest tu twardy wymóg. Cztery
  // z siedmiu sekcji testu przez chwilę wołały przygotuj() bez niej i sprawdzały konfigurację, której
  // produkcja nigdy nie używa. Kto naprawdę chce pozy spoczynkowej, musi to napisać wprost.
  if (!opcje.klipOdniesienia && !opcje.pozaSpoczynkowa) {
    throw new Error('przygotuj: podaj klipOdniesienia (pierwsza klatka klipu stojącego) albo jawnie pozaSpoczynkowa: true. '
      + 'Poza spoczynkowa BVH bywa śmieciem — w plikach ACCAD wszystko powyżej bioder wskazuje w bok.');
  }
  let mieszaczOdn = null;
  if (opcje.klipOdniesienia) {
    mieszaczOdn = new THREE.AnimationMixer(zrodloRoot);
    mieszaczOdn.clipAction(opcje.klipOdniesienia).play();
    mieszaczOdn.setTime(opcje.czasOdniesienia ?? 0);
  }
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
  const KIERUNEK_JAWNY = { Hips: opcje.kierunekMiednicy || 'Spine', Spine1: 'Neck' };
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

  // KTÓRE KOŚCI DOPASOWUJEMY. To nie jest szczegół — to sedno.
  //
  // Dopasowanie zrównuje KIERUNKI kości celu z kierunkami źródła, czyli przenosi na cel także GEOMETRIĘ
  // cudzego szkieletu, nie sam ruch. Dla kręgosłupa to katastrofa: kręgosłup MPFB jest prosty (kąt
  // pelvis–spine_02–spine_03 w pozie spoczynkowej wynosi 0,8°), a szkielet ACCAD ma w rozstawie stawów
  // 45,4° załamania. Dopasowanie wtłaczało te 45° w tors naszej postaci — to jest ta wada, którą Piotr
  // opisał jako „dolna połowa przyszyta nierówno do górnej".
  //
  // Dla kości NIEDOPASOWANYCH poprawka wychodzi C = qŹródła(odniesienie)⁻¹ · qCelu(spoczynek), czyli
  // qCelu(t) = (qŹródła(t) · qŹródła(odniesienie)⁻¹) · qCelu(spoczynek) — przeniesienie ZMIANY względem pozy
  // odniesienia przy zachowaniu własnej geometrii celu. To jest właściwe wszędzie tam, gdzie oba szkielety
  // stoją podobnie: tułów, szyja, nogi.
  //
  // Ręce są wyjątkiem i dlatego domyślnie JE dopasowujemy: ciało MPFB ma pozę A (ramię 41,1° od pionu),
  // a mocap w pozie odniesienia trzyma ręce opuszczone. Bez dopasowania NPC chodziłby z rękami odstawionymi
  // o te ~40° na boki. Tam różnica jest różnicą POZY, a nie budowy szkieletu — i tylko wtedy dopasowanie pomaga.
  const DOPASUJ = opcje.dopasuj ?? /clavicle|upperarm|lowerarm|hand/i;

  // ---- KROK 1: dopasowanie pozy celu do POZY ODNIESIENIA źródła ----
  // Nie wystarczy zrównać KIERUNKÓW kości: kierunek ma 2 stopnie swobody, rotacja 3, a setFromUnitVectors
  // daje obrót minimalny, czyli o niekontrolowanym SKRĘCIE wokół osi kości. Ten skręt wchodził potem do
  // poprawki C i wykręcał tułów — przy zgodności kierunków 0,000°, więc test tego nie widział.
  // Dlatego budujemy dla każdej kości pełną ramkę ortonormalną: oś kości + oś odniesienia wzięta ze ŚWIATA
  // (ta sama po obu stronach), więc skręt przestaje być dowolny.
  const ramka = (d, ref) => {
    const u = ref.clone().addScaledVector(d, -ref.dot(d));
    if (u.lengthSq() < 1e-8) return null;
    u.normalize();
    return new THREE.Matrix4().makeBasis(d, u, new THREE.Vector3().crossVectors(d, u));
  };
  const OS_GORA = new THREE.Vector3(0, 1, 0), OS_PRZOD = new THREE.Vector3(0, 0, 1);
  const diag = { dopasowane: [], bezDopasowania: [], odchylkaPrzed: [], odchylkaPo: [] };
  for (const w of wpisy) {
    const dz = kierunek(w.z, dzZ(w.z));
    if (!dz) continue;                       // liść mapy — nie ma czego dopasować
    celRoot.updateMatrixWorld(true);
    const dc = kierunek(w.c, dzC(w.c));
    if (!dc) continue;
    diag.odchylkaPrzed.push([w.cs, Math.acos(Math.max(-1, Math.min(1, dc.dot(dz)))) * 180 / Math.PI]);
    if (!DOPASUJ.test(w.cs)) { diag.bezDopasowania.push(w.cs); continue; }
    // Oś odniesienia wybrana po ŹRÓDLE i użyta po obu stronach: dla kości pionowych (nogi, zwisające ręce,
    // kręgosłup) rzut światowego „w górę" degeneruje się do zera, więc bierzemy wtedy „w przód".
    const ref = Math.abs(dz.dot(OS_GORA)) > 0.9 ? OS_PRZOD : OS_GORA;
    const Fz = ramka(dz, ref), Fc = ramka(dc, ref);
    let nowySwiat;
    if (Fz && Fc) {
      const qz = new THREE.Quaternion().setFromRotationMatrix(Fz), qc = new THREE.Quaternion().setFromRotationMatrix(Fc);
      nowySwiat = qz.multiply(qc.invert()).multiply(swiatQ(w.c));   // obrót świata: ramka celu -> ramka źródła
    } else {
      nowySwiat = qTmp.setFromUnitVectors(dc, dz).clone().multiply(swiatQ(w.c));   // awaryjnie: sam kierunek
    }
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

  if (mieszaczOdn) { mieszaczOdn.stopAllAction(); mieszaczOdn.uncacheRoot(zrodloRoot); }
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
  // Pary z przygotuj() trzymają REFERENCJE do kości tej hierarchii źródła, na której liczono dopasowanie.
  // Każdy kolejny klip to osobny plik i osobna hierarchia, więc kości trzeba przewiązać po nazwie — inaczej
  // zastosuj() czytałoby cały czas pierwszy, nieruchomy szkielet, a wynikowy klip byłby zamrożony.
  // Objawem był `vChodu: 0` z asercji w npc.js: postać stała, choć klip „się odtwarzał".
  const zrodloPoNazwie = new Map();
  zrodloRoot.traverse(o => { if (o.name) zrodloPoNazwie.set(o.name, o); });
  const brakujace = pary.filter(w => !zrodloPoNazwie.has(w.zs)).map(w => w.zs);
  if (brakujace.length) throw new Error(`przenies: hierarchia klipu "${klip.name}" nie ma kości ${brakujace.join(', ')}`);
  pary = pary.map(w => ({ ...w, z: zrodloPoNazwie.get(w.zs) }));

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

/**
 * Wydziela POZIOMY ruch korzenia z klipu. Po tym zabiegu klip animuje postać „w miejscu", a przemieszczenie
 * dostaje kontroler, który przesuwa cały obiekt NPC — dzięki temu da się skręcać i zatrzymywać, nie psując
 * tempa kroku. PION miednicy zostaje w klipie: bez niego chód wygląda jak sunięcie (zmierzone: 37,0 mm
 * peak-to-peak przy 1,29 m/s, norma 25–50 mm).
 *
 * Kierunku pionu NIE WOLNO zgadywać z osi lokalnych. Kość Root tego rigu jest obrócona o −90° wokół X
 * (konwersja Z-up Blendera na Y-up glTF), więc pionem jest tam lokalne +z, a nie +y; pierwsza wersja tej
 * funkcji zakładała +y i wycinała z klipu dokładnie ten pion, który miała zachować. Dlatego rozkład liczymy
 * względem światowego „w górę" przeniesionego do układu RODZICA kości korzenia.
 *
 * NIE WOLNO robić obu naraz: albo klip niesie ruch, albo kontroler. Jednocześnie — podwojona prędkość
 * i poślizg stóp, którego żaden foot-lock nie naprawi.
 *
 * @param {THREE.AnimationClip} klip klip po przeniesieniu
 * @param {THREE.Object3D} korzenObj kość korzenia CELU (potrzebna dla rotacji jej rodzica)
 * @returns {{czasy: Float32Array, xz: Float32Array, droga: number}} przemieszczenie w ŚWIECIE, względem chwili 0
 */
export function wydzielRuchKorzenia(klip, korzenObj) {
  const i = klip.tracks.findIndex(t => t.name === `${korzenObj.name}.position`);
  if (i < 0) throw new Error(`wydzielRuchKorzenia: klip "${klip.name}" nie ma ścieżki ${korzenObj.name}.position`);
  const tr = klip.tracks[i], czasy = tr.times, v = tr.values, n = czasy.length;

  const qRodzic = korzenObj.parent ? korzenObj.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const gora = new THREE.Vector3(0, 1, 0).applyQuaternion(qRodzic.clone().invert()).normalize();
  const p0 = new THREE.Vector3(v[0], v[1], v[2]);
  const p = new THREE.Vector3(), poziom = new THREE.Vector3(), swiat = new THREE.Vector3();

  const xz = new Float32Array(n * 2), bezXZ = new Float32Array(n * 3);
  let droga = 0;
  for (let k = 0; k < n; k++) {
    p.set(v[k * 3], v[k * 3 + 1], v[k * 3 + 2]).sub(p0);
    const wysokosc = p.dot(gora);
    poziom.copy(p).addScaledVector(gora, -wysokosc);
    swiat.copy(poziom).applyQuaternion(qRodzic);
    xz[k * 2] = swiat.x; xz[k * 2 + 1] = swiat.z;
    // W klipie zostaje wyłącznie składowa pionowa (plus pozycja spoczynkowa) — reszta poszła do kontrolera.
    bezXZ[k * 3] = p0.x + gora.x * wysokosc;
    bezXZ[k * 3 + 1] = p0.y + gora.y * wysokosc;
    bezXZ[k * 3 + 2] = p0.z + gora.z * wysokosc;
    if (k) droga += Math.hypot(xz[k * 2] - xz[(k - 1) * 2], xz[k * 2 + 1] - xz[(k - 1) * 2 + 1]);
  }
  klip.tracks[i] = new THREE.VectorKeyframeTrack(tr.name, czasy, bezXZ);
  return { czasy, xz, droga };
}

/** Odczyt przemieszczenia korzenia w chwili t (interpolacja liniowa między klatkami). */
export function ruchKorzeniaW(rk, t, out) {
  const { czasy, xz } = rk, n = czasy.length;
  if (t <= czasy[0]) return out.set(xz[0], 0, xz[1]);
  if (t >= czasy[n - 1]) return out.set(xz[(n - 1) * 2], 0, xz[(n - 1) * 2 + 1]);
  let a = 0, b = n - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (czasy[m] <= t) a = m; else b = m; }
  const u = (t - czasy[a]) / (czasy[b] - czasy[a]);
  return out.set(xz[a * 2] + (xz[b * 2] - xz[a * 2]) * u, 0, xz[a * 2 + 1] + (xz[b * 2 + 1] - xz[a * 2 + 1]) * u);
}

/**
 * Przyziemia klip: przesuwa pionowo ścieżkę korzenia tak, żeby NAJNIŻSZY WIERZCHOLEK SIATKI w całym klipie
 * dotknął podłoża. Bez tego postać unosi się nad bruk — zmierzone przed poprawką: 3,4 mm przez cały cykl
 * chodu, czyli stopa nigdy nie dotyka ziemi. Bierze się to stąd, że wysokość miednicy przenosimy ze źródła
 * przez stosunek wysokości bioder, a długości goleni i stopy między szkieletami różnią się osobno.
 *
 * Mierzymy WIERZCHOŁKI, nie stawy: staw kostki leży kilka centymetrów nad podeszwą, więc jego wysokość nic
 * nie mówi o kontakcie. Próbkujemy tylko wierzchołki należące do stóp — reszta siatki nigdy nie jest najniżej.
 *
 * @returns {{przesuniecie: number, przed: number}} przesunięcie w metrach i wysokość przed poprawką
 */
export function przyziem(klip, skin, korzenObj, { fps = 30, kosciStop = /foot|ball|toe/i } = {}) {
  const i = klip.tracks.findIndex(t => t.name === `${korzenObj.name}.position`);
  if (i < 0) throw new Error(`przyziem: klip "${klip.name}" nie ma ścieżki ${korzenObj.name}.position`);

  const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, poz = geo.attributes.position;
  const stopy = new Set(skin.skeleton.bones.map((b, j) => kosciStop.test(b.name) ? j : -1).filter(j => j >= 0));
  const idx = [];
  for (let v = 0; v < poz.count; v++) {
    for (const k of ['X', 'Y', 'Z', 'W']) {
      if (sw[`get${k}`](v) > 0.5 && stopy.has(si[`get${k}`](v))) { idx.push(v); break; }
    }
  }
  if (!idx.length) throw new Error('przyziem: nie znalazłem wierzchołków stóp — sprawdź wzorzec nazw kości');

  // Aktualizujemy macierze od SZCZYTU hierarchii, nie od SkinnedMesh. W glTF kości są RODZEŃSTWEM siatki,
  // a nie jej potomkami, więc skin.updateMatrixWorld(true) nie rusza szkieletu — pomiar wychodził wtedy
  // identyczny przed i po przesunięciu ścieżki, co wyglądało jak „poprawka nie działa".
  let szczyt = korzenObj; while (szczyt.parent) szczyt = szczyt.parent;
  const mix = new THREE.AnimationMixer(szczyt);
  const akcja = mix.clipAction(klip); akcja.play();
  const v3 = new THREE.Vector3();
  let minY = Infinity;
  const N = Math.max(2, Math.round(klip.duration * fps) + 1);
  for (let f = 0; f < N; f++) {
    mix.setTime(Math.min(klip.duration - 1e-4, f / fps));
    szczyt.updateMatrixWorld(true);
    skin.skeleton.update();
    for (const v of idx) {
      v3.fromBufferAttribute(poz, v);
      skin.applyBoneTransform(v, v3);
      v3.applyMatrix4(skin.matrixWorld);
      if (v3.y < minY) minY = v3.y;
    }
  }
  akcja.stop(); mix.uncacheClip(klip);

  // Przesunięcie w ŚWIECIE przeliczone do układu rodzica korzenia — tak samo jak w wydzielRuchKorzenia,
  // bo kość Root jest obrócona o −90° wokół X i dodanie wektora świata wprost do pozycji lokalnej byłoby błędem.
  const qRodzic = korzenObj.parent ? korzenObj.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const dolLokalnie = new THREE.Vector3(0, -minY, 0).applyQuaternion(qRodzic.clone().invert());
  const tr = klip.tracks[i], nowe = new Float32Array(tr.values.length);
  for (let k = 0; k < tr.times.length; k++) {
    nowe[k * 3] = tr.values[k * 3] + dolLokalnie.x;
    nowe[k * 3 + 1] = tr.values[k * 3 + 1] + dolLokalnie.y;
    nowe[k * 3 + 2] = tr.values[k * 3 + 2] + dolLokalnie.z;
  }
  klip.tracks[i] = new THREE.VectorKeyframeTrack(tr.name, tr.times, nowe);
  return { przesuniecie: -minY, przed: minY };
}
