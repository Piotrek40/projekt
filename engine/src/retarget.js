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
export function wydzielRuchKorzenia(klip, korzenObj, { wydziel = true } = {}) {
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
  // KLIPY, KTÓRE NIGDZIE NIE IDĄ, MUSZĄ ZOSTAĆ SAMOWYSTARCZALNE. W klipie stojącym poziomy ruch korzenia to
  // nie przemieszczenie, tylko KOŁYSANIE: miednica przenosi ciężar nad nieruchomymi stopami. Wydzielenie go do
  // kontrolera sprawia, że klip sam w sobie jest błędny — miednica stoi, a nogi wykonują kołysanie za nią,
  // czyli stopy jeżdżą po podłodze. W scenie kontroler to oddaje i wygląda dobrze, ale każdy inny odtwarzacz
  // (podgląd, edytor, test) pokazuje wadę. Zmierzone na idle_sway: wycinamy 51 x 181 mm, a stopa bez oddania
  // tego z powrotem wychyla się 37 x 151 mm. Dlatego dla klipów bez przemieszczenia zostawiamy ścieżkę w spokoju
  // i zwracamy zerowy ruch — kontroler nie ma wtedy czego dokładać.
  if (!wydziel) return { czasy, xz: new Float32Array(n * 2), droga: 0, drogaWKlipie: droga };
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
  const dane = przygotujPunkty(skin, idx), bufor = new Float64Array(idx.length * 3);

  // Aktualizujemy macierze od SZCZYTU hierarchii, nie od SkinnedMesh. W glTF kości są RODZEŃSTWEM siatki,
  // a nie jej potomkami, więc skin.updateMatrixWorld(true) nie rusza szkieletu — pomiar wychodził wtedy
  // identyczny przed i po przesunięciu ścieżki, co wyglądało jak „poprawka nie działa".
  let szczyt = korzenObj; while (szczyt.parent) szczyt = szczyt.parent;
  const mix = new THREE.AnimationMixer(szczyt);
  const akcja = mix.clipAction(klip); akcja.play();
  let minY = Infinity;
  const N = Math.max(2, Math.round(klip.duration * fps) + 1);
  for (let f = 0; f < N; f++) {
    mix.setTime(Math.min(klip.duration - 1e-4, f / fps));
    szczyt.updateMatrixWorld(true);
    policzPunkty(skin, dane, bufor);
    for (let j = 1; j < bufor.length; j += 3) if (bufor[j] < minY) minY = bufor[j];
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

// ---------------------------------------------------------------------------------------------------------
// BLOKADA STÓP. Trzy wady widoczne gołym okiem — lewitacja, ślizg i „chód na sztywnych nogach" — mają jedną
// wspólną przyczynę geometryczną, i warto ją tu zapisać, bo bez niej poprawka wygląda na arbitralną.
//
// Noga naszego ciała (MPFB) jest w pozie spoczynkowej praktycznie WYPROSTOWANA: udo 451,2 + goleń 446,9 =
// 898,1 mm, a rzeczywista odległość staw biodrowy–kostka to 896,8 mm. ZAPAS WYPROSTU: 1,3 mm (kolano zgięte
// o 6,23°, ale przy niemal prostej nodze długość zmienia się jak cosinus, więc te 6° kupuje tylko 1,3 mm).
// W ruchu jest tak samo: stosunek |biodro–kostka|/(udo+goleń) ma medianę 0,985 w chodzie i 0,998 w staniu,
// maksimum 0,99979. Kolano nie ma czego rozprostować, więc STOPY NIE DA SIĘ OPUŚCIĆ NOGĄ.
//
// (Uwaga na pułapkę, w którą sam wpadłem: kość `pelvis` NIE jest stawem biodrowym — thigh_l leży 6,2 mm
// niżej i 112,5 mm w bok. Odejmowanie długości nogi od wysokości miednicy nie jest tożsamością i daje
// liczbę bez sensu. Zapas liczy się z odległości staw–staw.)
//
// Konsekwencja: żeby stopa sięgnęła ziemi przy rozkroku, MIEDNICA MUSI OPAŚĆ. Wysokość miednicy bierzemy
// ze źródła przez stosunek wysokości bioder (mocap ACCAD: biodro 1065,6 mm, noga 923,5 mm — kostka 142,1 mm
// nad ziemią wobec naszych 74,6), a potrzebny opad w naszych proporcjach jest inny niż w cudzych. Stąd
// zmierzone dwa razy na cykl „obie stopy w powietrzu" (30,1 mm i 47,1 mm nad podłogą), czego w chodzie
// człowieka nie ma.
//
// DLATEGO KOREKTA IDZIE W MIEDNICĘ, NIE W NOGĘ. Samo IK nic tu nie da: przy medianie zasięgu nogi 0,985
// (a w staniu 0,998) noga jest już praktycznie prosta i nie ma jak sięgnąć niżej. Kolejność:
//   1. pion miednicy per klatka — tyle, żeby niższa podeszwa dotknęła podłogi, wygładzone filtrem dwumianowym
//      (bez wygładzania szarpnięcie miednicy rośnie z 3,06 do 19,67 mm/klatkę², czyli ok. 1,8 g — widać to),
//   2. IK dwukostne na resztę pionu (po wygładzeniu zostaje ±7 mm) i na skasowanie poślizgu poziomego.
// ---------------------------------------------------------------------------------------------------------

// Skinowanie garści wierzchołków, liczone szybko. THREE.SkinnedMesh.applyBoneTransform mnoży macierz kości
// przez jej odwrotność wiązania OSOBNO DLA KAŻDEGO WIERZCHOŁKA i dla każdej z czterech wag — przy 300
// wierzchołkach podeszwy i 480 klatkach to pół miliona mnożeń macierzy na klip. Tu macierz każdej kości
// liczymy raz na klatkę. Wynik jest identyczny co do bitu w granicach float, bo to ta sama formuła.
function przygotujPunkty(skin, idx) {
  const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, poz = geo.attributes.position;
  const n = idx.length, baza = new Float64Array(n * 3), ind = new Int32Array(n * 4), wagi = new Float64Array(n * 4);
  const v = new THREE.Vector3(), uzyte = new Set();
  for (let j = 0; j < n; j++) {
    v.fromBufferAttribute(poz, idx[j]).applyMatrix4(skin.bindMatrix);
    baza[j * 3] = v.x; baza[j * 3 + 1] = v.y; baza[j * 3 + 2] = v.z;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(idx[j], k), w = sw.getComponent(idx[j], k);
      ind[j * 4 + k] = b; wagi[j * 4 + k] = w;
      if (w !== 0) uzyte.add(b);
    }
  }
  return { n, baza, ind, wagi, uzyte: [...uzyte], mac: new Map(), F: new THREE.Matrix4() };
}
function policzPunkty(skin, d, out) {
  for (const b of d.uzyte) {
    const m = d.mac.get(b) || new THREE.Matrix4();
    m.multiplyMatrices(skin.skeleton.bones[b].matrixWorld, skin.skeleton.boneInverses[b]);
    d.mac.set(b, m);
  }
  d.F.multiplyMatrices(skin.matrixWorld, skin.bindMatrixInverse);
  const f = d.F.elements;
  for (let j = 0; j < d.n; j++) {
    const bx = d.baza[j * 3], by = d.baza[j * 3 + 1], bz = d.baza[j * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = d.wagi[j * 4 + k];
      if (w === 0) continue;
      const e = d.mac.get(d.ind[j * 4 + k]).elements;
      x += w * (e[0] * bx + e[4] * by + e[8] * bz + e[12]);
      y += w * (e[1] * bx + e[5] * by + e[9] * bz + e[13]);
      z += w * (e[2] * bx + e[6] * by + e[10] * bz + e[14]);
    }
    out[j * 3] = f[0] * x + f[4] * y + f[8] * z + f[12];
    out[j * 3 + 1] = f[1] * x + f[5] * y + f[9] * z + f[13];
    out[j * 3 + 2] = f[2] * x + f[6] * y + f[10] * z + f[14];
  }
  return out;
}

const NOGI_MPFB = [
  { nazwa: 'L', udo: 'thigh_l', golen: 'calf_l', stopa: 'foot_l', podeszwa: /^(foot_l|ball_l)$/ },
  { nazwa: 'P', udo: 'thigh_r', golen: 'calf_r', stopa: 'foot_r', podeszwa: /^(foot_r|ball_r)$/ },
];

/** Wierzchołki spodu stopy: te przypisane do kości stopy i leżące w dolnym pasie `pas` metrów pozy wiązania. */
function wierzcholkiPodeszwy(skin, wzorzec, pas) {
  const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, poz = geo.attributes.position;
  const kosci = new Set(skin.skeleton.bones.map((b, j) => wzorzec.test(b.name) ? j : -1).filter(j => j >= 0));
  const stopa = [];
  for (let v = 0; v < poz.count; v++) {
    let w = 0;
    for (const k of ['X', 'Y', 'Z', 'W']) if (kosci.has(si[`get${k}`](v))) w += sw[`get${k}`](v);
    if (w > 0.5) stopa.push(v);
  }
  if (!stopa.length) throw new Error(`zablokujStopy: brak wierzchołków dla wzorca ${wzorzec}`);
  let min = Infinity;
  for (const v of stopa) min = Math.min(min, poz.getY(v));
  return stopa.filter(v => poz.getY(v) < min + pas);
}

/** Filtr dwumianowy [1 4 6 4 1]/16, `ile` przebiegów. Dla klipu cyklicznego zawija (okres n−1: ostatnia próbka = pierwsza). */
function wygladz(a, ile, cykliczny) {
  let s = Float64Array.from(a);
  const n = a.length, okres = n - 1;
  for (let it = 0; it < ile; it++) {
    const t = s.slice();
    const g = j => cykliczny ? t[((j % okres) + okres) % okres] : t[Math.max(0, Math.min(n - 1, j))];
    for (let i = 0; i < n; i++) s[i] = (g(i - 2) + 4 * g(i - 1) + 6 * g(i) + 4 * g(i + 1) + g(i + 2)) / 16;
    if (cykliczny) s[n - 1] = s[0];
  }
  return s;
}

/** Obraca kość tak, żeby jej kierunek światowy przeszedł z `stary` na `nowy`, ZACHOWUJĄC skręt wokół osi kości. */
function obrocNaKierunek(obj, stary, nowy) {
  const q = qTmp.setFromUnitVectors(vB.copy(stary).normalize(), vC.copy(nowy).normalize());
  const qw = obj.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
  const qp = obj.parent ? swiatQ(obj.parent) : new THREE.Quaternion();
  obj.quaternion.copy(qp.invert().multiply(qw));
  obj.updateMatrixWorld(true);
}

/**
 * IK dwukostne (udo–goleń–kostka) w świecie. Cel = obecna pozycja kostki + `delta`.
 * Płaszczyzna zgięcia kolana brana z ORYGINAŁU (kolano zostaje po tej samej stronie), więc mocap nie dostaje
 * odwróconego kolana. Gdy noga jest prosta i płaszczyzny nie da się odczytać, bierzemy kierunek „w przód" stopy.
 * @returns {number} ile z żądanego przesunięcia udało się zrealizować (0..1 długości `delta`)
 */
function ikNoga(udoO, golenO, stopaO, delta, l1, l2) {
  const H = swiatP(udoO), K = swiatP(golenO), A = swiatP(stopaO);
  const qStopy = swiatQ(stopaO);
  const maxD = (l1 + l2) * 0.9995, minD = Math.abs(l1 - l2) + 1e-4;
  // CEL POZA ZASIĘGIEM: poświęcamy PION, nie poziom. Skrócenie wektora H→T po prostu (tak było wcześniej)
  // ścina obie składowe naraz, więc razem z niedosiężnym milimetrem pionu ginie część blokady poziomej —
  // a to właśnie poziom widać jako ślizganie się stopy. W staniu noga jest wyprostowana w 99,8%, więc
  // dzieje się to często: w idle_sway 96 klatek na 282. Najpierw więc zmniejszamy pionową część korekty
  // (dwudzielnie, bo zależność jest monotoniczna), a poziomą ruszamy dopiero, gdy sam poziom nie mieści się
  // w zasięgu nogi.
  const T = A.clone().add(delta);
  if (T.distanceTo(H) > maxD && Math.abs(delta.y) > 1e-6) {
    let lo = 0, hi = 1;
    for (let it = 0; it < 12; it++) {
      const m = (lo + hi) / 2;
      T.set(A.x + delta.x, A.y + delta.y * m, A.z + delta.z);
      if (T.distanceTo(H) > maxD) hi = m; else lo = m;
    }
    T.set(A.x + delta.x, A.y + delta.y * lo, A.z + delta.z);
  }
  const os = T.clone().sub(H);
  const zadane = os.length();
  const d = Math.min(maxD, Math.max(minD, zadane));
  if (zadane < 1e-6) return 1;
  os.divideScalar(zadane);

  // BIEGUN (płaszczyzna zgięcia kolana). Przy nodze prostej składowa prostopadła kolana to kilka milimetrów
  // i jej KIERUNEK jest wtedy szumem: zmierzone obroty płaszczyzny między sąsiednimi klatkami sięgają 109,9°
  // (walk_to_stand, sin zgięcia 0,0073) i 74,9° (stand_to_walk). UCZCIWIE: te obroty są w SAMYM retargecie,
  // identyczne z blokadą stóp i bez niej, i są niewidoczne — kolano jest wtedy 3 mm od osi, więc obrót
  // płaszczyzny przesuwa je o kilka milimetrów. To zabezpieczenie jest więc na zapas: gdyby IK musiało w takiej
  // klatce dołożyć realne zgięcie, postawiłoby kolano w losową stronę. Dlatego przy małej składowej mieszamy z kierunkiem PALCÓW
  // stopy — kolano człowieka zgina się w stronę, w którą patrzą palce, i ten kierunek jest zawsze określony.
  const biegun = K.clone().sub(H);
  biegun.addScaledVector(os, -biegun.dot(os));
  const dl = biegun.length();
  const przod = stopaO.children[0] ? swiatP(stopaO.children[0]).sub(A) : new THREE.Vector3(0, 0, 1);
  przod.addScaledVector(os, -przod.dot(os));
  if (przod.lengthSq() > 1e-10) {
    przod.normalize();
    const u = Math.min(1, Math.max(0, (dl - 0.005) / 0.010));   // 5 mm: sam kierunek palców, 15 mm: sam oryginał
    if (dl > 1e-8) biegun.divideScalar(dl); else biegun.copy(przod);
    biegun.multiplyScalar(u).addScaledVector(przod, 1 - u);
  }
  if (biegun.lengthSq() < 1e-10) return 0;
  biegun.normalize();

  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const Knowy = H.clone().addScaledVector(os, a).addScaledVector(biegun, h);
  const Tfakt = H.clone().addScaledVector(os, d);

  obrocNaKierunek(udoO, K.clone().sub(H), Knowy.clone().sub(H));
  const K2 = swiatP(golenO);
  obrocNaKierunek(golenO, swiatP(stopaO).sub(K2), Tfakt.clone().sub(K2));
  // Stopa ma ZOSTAĆ tak obrócona jak w mocapie — inaczej ginie przetoczenie pięta→palce.
  stopaO.quaternion.copy(swiatQ(stopaO.parent).invert().multiply(qStopy));
  stopaO.updateMatrixWorld(true);
  return d >= zadane - 1e-6 ? 1 : d / zadane;
}

/**
 * Przyszywa stopy do podłoża: koryguje pion miednicy i kasuje poślizg, wpisując wynik z powrotem w klip.
 * Robione RAZ, przy ładowaniu — w czasie gry kosztuje zero.
 *
 * Wywoływać PO przyziem() (stały offset ustawia punkt startowy) i PRZED wydzielRuchKorzenia() — na tym etapie
 * klip niesie jeszcze pełny ruch korzenia, więc „stopa stoi w miejscu" znaczy dokładnie to, co powinno:
 * w miejscu ŚWIATA. Po wydzieleniu kontroler dokłada dokładnie ten sam ruch, więc blokada zostaje ważna.
 *
 * @param {THREE.AnimationClip} klip klip po przeniesieniu i przyziemieniu
 * @param {THREE.SkinnedMesh} skin siatka ciała (potrzebna, bo kontakt mierzymy na WIERZCHOŁKACH, nie na stawach)
 * @param {THREE.Object3D} korzenObj kość miednicy
 * @returns {Object} diagnostyka z liczbami do asercji
 */
export function zablokujStopy(klip, skin, korzenObj, {
  nogi = NOGI_MPFB,
  wygladzenia = 1,
  rundy = 4,
  pasPodeszwy = 0.03,
  pasKontaktu = 0.012,
  oknoMinimum = 0.25,
  progWysokosci = 0.015,
  progPredkosci = 0.60,
  klatkiPrzenikania = 3,
  przeswit = 0.020,
  maxKorekta = 0.08,
  przebiegi = false,
} = {}) {
  const iPoz = klip.tracks.findIndex(t => t.name === `${korzenObj.name}.position`);
  if (iPoz < 0) throw new Error(`zablokujStopy: klip "${klip.name}" nie ma ścieżki ${korzenObj.name}.position`);
  const czasy = klip.tracks[iPoz].times, N = czasy.length;
  if (N < 5) throw new Error(`zablokujStopy: klip "${klip.name}" ma tylko ${N} klatek`);
  const dt = (czasy[N - 1] - czasy[0]) / (N - 1);

  let szczyt = korzenObj; while (szczyt.parent) szczyt = szczyt.parent;
  const poNazwie = new Map(skin.skeleton.bones.map(b => [b.name, b]));
  const L = nogi.map(n => {
    const o = ['udo', 'golen', 'stopa'].map(k => poNazwie.get(n[k]));
    if (o.some(x => !x)) throw new Error(`zablokujStopy: rig nie ma kości ${n.udo}/${n.golen}/${n.stopa}`);
    return { ...n, udoO: o[0], golenO: o[1], stopaO: o[2], idx: wierzcholkiPodeszwy(skin, n.podeszwa, pasPodeszwy) };
  });
  const punkty = L.map(n => przygotujPunkty(skin, n.idx));
  const bufory = L.map(n => new Float64Array(n.idx.length * 3));
  const podeszwa = (n, out) => {
    policzPunkty(skin, punkty[n], out);
    let min = Infinity;
    for (let j = 1; j < out.length; j += 3) if (out[j] < min) min = out[j];
    return min;
  };

  // --- przebieg 1: wysokości podeszew, prędkość PLAMY STYKU, lokalna pozycja korzenia --------------------
  // Prędkość plamy styku, a nie kostki. Podczas odbicia z palców kostka jedzie ponad 1,5 m/s, choć palec
  // stoi nieruchomo — na kostce ta faza wygląda jak lot i wypada z podparcia, a wtedy pion traci odniesienie
  // dokładnie w chwili, w której stopa NAPRAWDĘ jest na ziemi. Zmierzone na walk_cycle: kostka prawej stopy
  // 0,99 i 1,54 m/s w klatkach 3–4, gdy podeszwa jest 6,2 i 2,7 mm nad podłogą.
  // Przy okazji liczymy tu poślizg — jest identyczny przed i po korekcie pionu, bo ta jest czystym
  // przesunięciem w pionie i nie rusza współrzędnych poziomych.
  const mix1 = new THREE.AnimationMixer(szczyt), a1 = mix1.clipAction(klip); a1.play();
  const wys = L.map(() => new Float64Array(N)), vStyk = L.map(() => new Float64Array(N));
  const dPrzes = L.map(() => new Float64Array(N * 2)), korzenLok = new Float64Array(N * 3);
  const diagBezWspolnych = L.map(() => 0);
  const qPierwsza = [], qOstatnia = [];
  let poprzednie = L.map(() => null);
  for (let i = 0; i < N; i++) {
    mix1.setTime(Math.min(klip.duration - 1e-4, czasy[i]));
    szczyt.updateMatrixWorld(true);
    korzenLok[i * 3] = korzenObj.position.x; korzenLok[i * 3 + 1] = korzenObj.position.y; korzenLok[i * 3 + 2] = korzenObj.position.z;
    for (let n = 0; n < L.length; n++) {
      const min = podeszwa(n, bufory[n]);
      wys[n][i] = min;
      const teraz = new Map();
      for (let j = 0; j < L[n].idx.length; j++) {
        if (bufory[n][j * 3 + 1] < min + pasKontaktu) teraz.set(L[n].idx[j], [bufory[n][j * 3], bufory[n][j * 3 + 2]]);
      }
      if (poprzednie[n]) {
        let sx = 0, sz = 0, ile = 0;
        for (const [v, q] of teraz) { const r = poprzednie[n].get(v); if (r) { sx += q[0] - r[0]; sz += q[1] - r[1]; ile++; } }
        if (ile) { dPrzes[n][i * 2] = sx / ile; dPrzes[n][i * 2 + 1] = sz / ile; }
        else { diagBezWspolnych[n]++; dPrzes[n][i * 2] = dPrzes[n][(i - 1) * 2]; dPrzes[n][i * 2 + 1] = dPrzes[n][(i - 1) * 2 + 1]; }
        vStyk[n][i] = Math.hypot(dPrzes[n][i * 2], dPrzes[n][i * 2 + 1]) / dt;
      }
      poprzednie[n] = teraz;
    }
    if (i === 0 || i === N - 1) {
      const q = L.flatMap(n => [swiatQ(n.udoO), swiatQ(n.golenO), swiatQ(n.stopaO)]);
      (i === 0 ? qPierwsza : qOstatnia).push(...q);
    }
  }
  a1.stop(); mix1.uncacheClip(klip);
  for (const v of vStyk) v[0] = v[1];

  // Klip cykliczny (walk_cycle, idle_arms) musi po korekcie nadal zamykać się bez skoku, więc filtr ma zawijać,
  // a faza podparcia przechodząca przez szew liczyć się jako jedna. Rozpoznajemy po pozie, nie po nazwie pliku.
  let szewKat = 0;
  for (let k = 0; k < qPierwsza.length; k++) szewKat = Math.max(szewKat, qPierwsza[k].angleTo(qOstatnia[k]) * 180 / Math.PI);
  const cykliczny = szewKat < 1.0 && Math.abs(wys[0][0] - wys[0][N - 1]) < 0.001;

  // --- fazy podparcia -----------------------------------------------------------------------------------
  // Stopa stoi, gdy (a) jest blisko SWOJEGO lokalnego minimum wysokości i (b) plama styku sunie wolno.
  // Kryterium (a) jest względne, bo bezwzględny próg nie działa: walk_to_stand ma medianę podeszwy 36,7 mm
  // i próg 15 mm nie znalazłby tam ani jednego kontaktu. Kryterium (b) odrzuca stopę, która jest nisko,
  // ale leci — przyszycie takiej do podłogi ciągnie ją potem po ziemi (pierwsza wersja tej funkcji podniosła
  // tak ślizg z 17,6 do 429,9 mm w cyklu chodu).
  const W = Math.max(1, Math.round(oknoMinimum / dt));
  const wagi = L.map(() => new Float64Array(N)), fazy = L.map(() => []);
  for (let n = 0; n < L.length; n++) {
    const kontakt = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      let lok = Infinity;
      for (let j = i - W; j <= i + W; j++) {
        const q = cykliczny ? ((j % (N - 1)) + (N - 1)) % (N - 1) : Math.max(0, Math.min(N - 1, j));
        lok = Math.min(lok, wys[n][q]);
      }
      kontakt[i] = (wys[n][i] < lok + progWysokosci && vStyk[n][i] < progPredkosci) ? 1 : 0;
    }
    let i = 0;
    while (i < N) {
      if (!kontakt[i]) { i++; continue; }
      let j = i; while (j + 1 < N && kontakt[j + 1]) j++;
      if (j - i >= 2) fazy[n].push([i, j]);
      i = j + 1;
    }
    const f = fazy[n];
    if (cykliczny && f.length >= 2 && f[0][0] === 0 && f[f.length - 1][1] === N - 1) { f[0][0] = f[f.length - 1][0] - (N - 1); f.pop(); }
    const ramp = (x, o, d) => { const u = Math.min(1, (x - o + 1) / (klatkiPrzenikania + 1), (d - x + 1) / (klatkiPrzenikania + 1)); return u * u * (3 - 2 * u); };
    for (const [od, doK] of f) {
      for (let x = Math.max(0, od); x <= doK; x++) wagi[n][x] = Math.max(wagi[n][x], ramp(x, od, doK));
      if (od < 0) for (let x = N - 1 + od; x < N; x++) wagi[n][x] = Math.max(wagi[n][x], ramp(x - (N - 1), od, doK));
    }
  }

  // --- wyrównanie systematycznej różnicy między stopami --------------------------------------------------
  // Prawa podeszwa siedzi w retargecie wyżej niż lewa (mediany w podparciu 5,4 i 9,7 mm w cyklu chodu), więc
  // pion prowadzony raz jedną, raz drugą stopą modulował się z CZĘSTOTLIWOŚCIĄ KROKU — czyli postać utykała.
  // Zmierzone: rozrzut dwóch szczytów pionu miednicy rósł z 15,2 (sam mocap) do 27,3 mm. Miednica ma chodzić
  // symetrycznie, a różnicę między stopami mają brać NOGI: pion liczymy z wysokości wyrównanych, a IK niżej
  // dostaje wysokości PRAWDZIWE, więc każda stopa i tak ląduje dokładnie na bruku.
  // Robimy to tylko przy chodzie (stopy na przemian). W staniu obie stopy są w podparciu przez cały klip,
  // nie ma czego wyrównywać, a rozjechanie ich w przeciwne strony kosztowałoby zasięg nogi (w staniu
  // wyprostowanej w 99,8%).
  const wysR = wys.map(w => Float64Array.from(w));
  let naprzemienne = false;
  for (let i = 0; i < N && !naprzemienne; i++) {
    let ile = 0;
    for (let n = 0; n < L.length; n++) if (wagi[n][i] > 0) ile++;
    if (ile === 1) naprzemienne = true;
  }
  const przesuniecieStop = L.map(() => 0);
  if (naprzemienne && L.length === 2) {
    const med = L.map((_, n) => {
      const v = [];
      for (let i = 0; i < N; i++) if (wagi[n][i] > 0) v.push(wys[n][i]);
      v.sort((a, b) => a - b);
      return v.length ? v[v.length >> 1] : 0;
    });
    const sr = (med[0] + med[1]) / 2;
    for (let n = 0; n < L.length; n++) {
      przesuniecieStop[n] = med[n] - sr;
      for (let i = 0; i < N; i++) wysR[n][i] -= przesuniecieStop[n];
    }
  }

  // --- korekta pionu miednicy ---------------------------------------------------------------------------
  // Pion prowadzi WYŁĄCZNIE stopa w podparciu. Klatki bez podparcia (w cyklu chodu jest ich 17 na 34, bo mocap
  // ma tam obie stopy oderwane) dostają interpolację między sąsiednimi podparciami. Bez tego postać szoruje
  // po ziemi stopą, która akurat leci do przodu.
  const g = new Float64Array(N), znane = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let m = Infinity;
    for (let n = 0; n < L.length; n++) if (wagi[n][i] > 0) m = Math.min(m, wysR[n][i]);
    if (Number.isFinite(m)) { g[i] = m; znane[i] = 1; }
  }
  const ileZnanych = znane.reduce((a, b) => a + b, 0);
  if (!ileZnanych) { for (let i = 0; i < N; i++) g[i] = Math.min(...wysR.map(w => w[i])); }
  else {
    const okres = cykliczny ? N - 1 : N;
    const szukaj = (od, kier) => { for (let s = 1; s <= okres; s++) { const i = cykliczny ? (((od + s * kier) % okres) + okres) % okres : od + s * kier; if (i < 0 || i >= N) break; if (znane[i]) return [i, s]; } return null; };
    const kopia = Float64Array.from(g);
    for (let i = 0; i < N; i++) {
      if (znane[i]) continue;
      const a = szukaj(i, -1), b = szukaj(i, 1);
      if (a && b) g[i] = kopia[a[0]] + (kopia[b[0]] - kopia[a[0]]) * (a[1] / (a[1] + b[1]));
      else if (a) g[i] = kopia[a[0]]; else if (b) g[i] = kopia[b[0]];
    }
  }
  // Zakaz przenikania liczymy na wysokościach PRAWDZIWYCH (wys), nie wyrównanych (wysR) — wyrównanie ma prawo
  // kształtować tor miednicy, ale nie ma prawa wpuścić stopy pod bruk. Z wysR w tym miejscu stand_to_walk
  // schodził na −14,5 mm i szarpał 12,16 mm/klatkę².
  // Wygładzanie na przemian z zakazem przenikania. Sam zakaz jest operacją „minimum", więc wprowadza załamania
  // (szarpnięcie miednicy rosło z 3,06 do 7,53 mm/klatkę²); samo wygładzanie wpuszcza stopę pod bruk (−7,9 mm
  // w klatce 4 cyklu chodu). Naprzemiennie zbiegają do gładkiej krzywej leżącej pod wysokością najniższej stopy.
  let gs = Float64Array.from(g), ucietych = 0, vPrzyUcieciu = 0;
  for (let r = 0; r < rundy; r++) {
    gs = wygladz(gs, wygladzenia, cykliczny);
    ucietych = 0;
    for (let i = 0; i < N; i++) {
      let m = Infinity, vm = 0;
      for (let n = 0; n < L.length; n++) if (wys[n][i] < m) { m = wys[n][i]; vm = vStyk[n][i]; }
      if (gs[i] > m) { gs[i] = m; ucietych++; if (r === rundy - 1) vPrzyUcieciu = Math.max(vPrzyUcieciu, vm); }
    }
  }
  if (cykliczny) gs[N - 1] = gs[0];
  const doRodzica = (korzenObj.parent ? swiatQ(korzenObj.parent) : new THREE.Quaternion()).invert();
  const nowaPoz = new Float32Array(N * 3), przes = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    przes.set(0, -gs[i], 0).applyQuaternion(doRodzica);
    nowaPoz[i * 3] = korzenLok[i * 3] + przes.x;
    nowaPoz[i * 3 + 1] = korzenLok[i * 3 + 1] + przes.y;
    nowaPoz[i * 3 + 2] = korzenLok[i * 3 + 2] + przes.z;
  }
  klip.tracks[iPoz] = new THREE.VectorKeyframeTrack(klip.tracks[iPoz].name, czasy, nowaPoz);

  // Skumulowany poślizg liczymy w kolejności FAZY, nie klipu: podparcie prawej stopy w walk_cycle zaczyna się
  // przed końcem klipu i kończy po jego początku, więc licząc po indeksach zerwalibyśmy je dokładnie na szwie.
  const D = L.map(() => new Float64Array(N * 2));
  for (let n = 0; n < L.length; n++) for (const [od, doK] of fazy[n]) {
    let ax = 0, az = 0;
    for (let x = od; x <= doK; x++) {
      const i = x < 0 ? x + (N - 1) : x;
      if (x > od) { ax += dPrzes[n][i * 2]; az += dPrzes[n][i * 2 + 1]; }
      D[n][i * 2] = ax; D[n][i * 2 + 1] = az;
    }
  }

  // --- przebieg 2: IK -----------------------------------------------------------------------------------
  const mix2 = new THREE.AnimationMixer(szczyt), a2 = mix2.clipAction(klip); a2.play();
  mix2.setTime(0); szczyt.updateMatrixWorld(true);
  const dlugosci = L.map(n => [swiatP(n.udoO).distanceTo(swiatP(n.golenO)), swiatP(n.golenO).distanceTo(swiatP(n.stopaO))]);
  const kanaly = new Map();
  for (const n of L) for (const o of [n.udoO, n.golenO, n.stopaO]) kanaly.set(o.name, new Float32Array(N * 4));
  const diagKorekta = L.map(() => 0), diagNiedosieg = L.map(() => 0), diagObciete = L.map(() => 0), diagPodniesienia = L.map(() => 0);
  const delta = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    mix2.setTime(Math.min(klip.duration - 1e-4, czasy[i]));
    szczyt.updateMatrixWorld(true);
    for (let n = 0; n < L.length; n++) {
      const w = wagi[n][i];
      // Stopa MACHAJĄCA: opuszczenie miednicy przyciska ją do podłogi i wychodzi szuranie. Zmierzone bez tej
      // poprawki: prześwit stopy lecącej 4,2 m/s spadł z 33,5 mm do 0,0 mm w stand_to_walk. Dlatego stopie,
      // która jest nisko I szybko, dokładamy pionowy prześwit — waga rośnie z prędkością, więc stopa
      // dolatująca do zetknięcia (wolna) nie jest podnoszona i ląduje tam, gdzie chce mocap.
      if (w <= 0) {
        const h = wys[n][i] - gs[i];
        if (h >= przeswit) continue;
        const u = Math.min(1, Math.max(0, (vStyk[n][i] - progPredkosci) / progPredkosci));
        if (u <= 0) continue;
        const ws = u * u * (3 - 2 * u);
        delta.set(0, (przeswit - h) * ws, 0);
        diagPodniesienia[n]++;
        diagKorekta[n] = Math.max(diagKorekta[n], delta.length());
        if (ikNoga(L[n].udoO, L[n].golenO, L[n].stopaO, delta, dlugosci[n][0], dlugosci[n][1]) < 0.999) diagNiedosieg[n]++;
        continue;
      }
      delta.set(-D[n][i * 2] * w, -(wys[n][i] - gs[i]) * w, -D[n][i * 2 + 1] * w);
      if (delta.length() > maxKorekta) { delta.setLength(maxKorekta); diagObciete[n]++; }
      diagKorekta[n] = Math.max(diagKorekta[n], delta.length());
      if (delta.lengthSq() > 1e-12 && ikNoga(L[n].udoO, L[n].golenO, L[n].stopaO, delta, dlugosci[n][0], dlugosci[n][1]) < 0.999) diagNiedosieg[n]++;
    }
    for (const n of L) for (const o of [n.udoO, n.golenO, n.stopaO]) {
      const t = kanaly.get(o.name), q = o.quaternion;
      t[i * 4] = q.x; t[i * 4 + 1] = q.y; t[i * 4 + 2] = q.z; t[i * 4 + 3] = q.w;
    }
  }
  a2.stop(); mix2.uncacheClip(klip);

  // Klip cykliczny MUSI zamykać się co do bitu: ostatnia klatka to ta sama poza co pierwsza.
  if (cykliczny) for (const t of kanaly.values()) for (let k = 0; k < 4; k++) t[(N - 1) * 4 + k] = t[k];

  for (const [nazwa, dane] of kanaly) {
    const j = klip.tracks.findIndex(t => t.name === `${nazwa}.quaternion`);
    const tor = new THREE.QuaternionKeyframeTrack(`${nazwa}.quaternion`, czasy, dane);
    if (j >= 0) klip.tracks[j] = tor; else klip.tracks.push(tor);
  }

  const sr = a => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    cykliczny, szewKat: +szewKat.toFixed(3), klatek: N, klatekBezPodparcia: N - ileZnanych,
    pionPrzed: [Math.min(...g), sr(Array.from(g)), Math.max(...g)].map(v => +(v * 1000).toFixed(1)),
    korektaPionu: [Math.min(...gs), Math.max(...gs)].map(v => +(v * 1000).toFixed(1)),
    ucietychDoPodlogi: ucietych, vPrzyUcieciu: +vPrzyUcieciu.toFixed(2),
    fazy: L.map((n, i) => ({ noga: n.nazwa, ile: fazy[i].length, klatek: wagi[i].filter(v => v > 0).length })),
    maxKorekta: diagKorekta.map(v => +(v * 1000).toFixed(1)),
    niedosieg: diagNiedosieg, obciete: diagObciete, podniesienia: diagPodniesienia,
    przesuniecieStop: przesuniecieStop.map(v => +(v * 1000).toFixed(1)), bezWspolnychWierzcholkow: diagBezWspolnych,
    ...(przebiegi ? { przebiegi: { czasy, wys, vStyk, wagi, g, gs, fazy } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------
// RĘKA W BIODRZE. Kości rąk (i tylko one) dostają DOPASOWANIE KIERUNKÓW do źródła — tak trzeba, bo inaczej
// ramiona zostają w pozie A modelu, odstawione o 41°. Ale nasze ciało ma inne proporcje niż osoba z mocapu,
// więc ten sam kąt ramienia wprowadza dłoń w biodro. Zmierzone zanurzenie wierzchołków dłoni i przedramienia
// w przekroju tułowia: idle_sway 48,3 mm przez WSZYSTKIE 282 klatki, idle_lookaround 31,8 mm przez 427 z 479,
// walk_cycle 40,8 mm przez 7 z 34. Lewa ręka −25,4 mm (na zewnątrz) — asymetria jest w samym mocapie.
//
// Poprawka: tułów przybliżamy zestawem elips (przekrój na każdej wysokości, wyliczony RAZ z siatki w pozie
// wiązania i przypięty do miednicy), a ramię odchylamy na zewnątrz o najmniejszy kąt, który wyprowadza
// najgłębszy punkt poza tę bryłę. Kąt jest mały — dłoń jest ok. 0,6 m od barku, więc 48 mm to ok. 4,6° —
// więc wymach rąk zostaje nietknięty. Ciąg kątów jest wygładzany w czasie, żeby korekta nie migotała.
// ---------------------------------------------------------------------------------------------------------

/**
 * Profil bryły wokół kości: półosie elipsy na kolejnych wysokościach wzdłuż osi kości, liczone RAZ z siatki
 * w pozie wiązania. Tanie w sprawdzaniu (kilka mnożeń na punkt) i wystarczająco wierne, bo przekrój tułowia
 * i uda naprawdę jest z grubsza elipsą.
 */
function profilKosci(skin, nazwa, dziecko, wzorzec, krok, prawoRef) {
  const kosci = skin.skeleton.bones, ind = n => kosci.findIndex(b => b.name === n);
  const spocz = i => new THREE.Matrix4().copy(skin.skeleton.boneInverses[i]).invert();
  const [ik, id] = [nazwa, dziecko].map(ind);
  if (ik < 0 || id < 0) throw new Error(`profilKosci: rig nie ma kości ${nazwa}/${dziecko}`);
  const Pk = i => new THREE.Vector3().setFromMatrixPosition(spocz(i));
  const srodek = Pk(ik), gora = Pk(id).sub(srodek).normalize();
  const przod = new THREE.Vector3().crossVectors(prawoRef, gora).normalize();
  const prawo = new THREE.Vector3().crossVectors(gora, przod).normalize();

  const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, poz = geo.attributes.position;
  const zbior = new Set(kosci.map((b, j) => wzorzec.test(b.name) ? j : -1).filter(j => j >= 0));
  const plastry = new Map(), v = new THREE.Vector3();
  for (let x = 0; x < poz.count; x++) {
    let w = 0;
    for (const k of ['X', 'Y', 'Z', 'W']) if (zbior.has(si[`get${k}`](x))) w += sw[`get${k}`](x);
    if (w <= 0.5) continue;
    v.fromBufferAttribute(poz, x).sub(srodek);
    const j = Math.round(v.dot(gora) / krok), p = plastry.get(j) || { a: 0, b: 0 };
    p.a = Math.max(p.a, Math.abs(v.dot(prawo))); p.b = Math.max(p.b, Math.abs(v.dot(przod)));
    plastry.set(j, p);
  }
  if (plastry.size < 3) throw new Error(`profilKosci: za mało wierzchołków dla ${nazwa}`);
  const ramka = new THREE.Matrix4().makeBasis(prawo, gora, przod).setPosition(srodek);
  return { plastry, krok, lokalna: new THREE.Matrix4().copy(spocz(ik)).invert().multiply(ramka), kosc: kosci[ik] };
}

/**
 * Odsuwa ręce od tułowia i ud: wykrywa zanurzenie wierzchołków dłoni i przedramienia w bryle ciała i odchyla
 * ramię na zewnątrz o najmniejszy potrzebny kąt. Wywoływać po zablokujStopy(), przed wydzielRuchKorzenia().
 *
 * Uwaga na znak obrotu: oś to `ramię × kierunekNaZewnątrz`, a kąt DODATNI — pochodna obracanego wektora to
 * (r × k) × r = |r|²k, czyli obrót o dodatni kąt niesie punkt w stronę k. Z minusem poprawka wpycha dłoń
 * głębiej w biodro: zmierzone 40,8 → 73,3 mm w cyklu chodu i 47,3 → 94,6 mm w idle_sway.
 *
 * @returns {Object} diagnostyka z liczbami do asercji
 */
export function odsunRece(klip, skin, korzenObj, {
  rece = [{ nazwa: 'L', bark: 'upperarm_l', punkty: /^(hand_l|lowerarm_l)$/ }, { nazwa: 'P', bark: 'upperarm_r', punkty: /^(hand_r|lowerarm_r)$/ }],
  bryly = [['pelvis', 'spine_02', /^(pelvis|spine_0[123])$/], ['thigh_l', 'calf_l', /^thigh_l$/], ['thigh_r', 'calf_r', /^thigh_r$/]],
  krok = 0.02,
  luz = 0.008,
  wygladzenia = 2,
  krokiZbieznosci = 3,
  maxKat = 25,
  co = 4,
} = {}) {
  const iPoz = klip.tracks.findIndex(t => t.name === `${korzenObj.name}.position`);
  if (iPoz < 0) throw new Error(`odsunRece: klip "${klip.name}" nie ma ścieżki ${korzenObj.name}.position`);
  const czasy = klip.tracks[iPoz].times, N = czasy.length;
  let szczyt = korzenObj; while (szczyt.parent) szczyt = szczyt.parent;

  const kosci = skin.skeleton.bones, ind = n => kosci.findIndex(b => b.name === n);
  const spocz = i => new THREE.Matrix4().copy(skin.skeleton.boneInverses[i]).invert();
  const Pk = n => new THREE.Vector3().setFromMatrixPosition(spocz(ind(n)));
  const prawoRef = Pk('clavicle_l').sub(Pk('clavicle_r')).normalize();
  const kolidery = bryly.map(([a, b, w]) => profilKosci(skin, a, b, w, krok, prawoRef));

  const poNazwie = new Map(kosci.map(b => [b.name, b]));
  const geo = skin.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, poz = geo.attributes.position;
  const R = rece.map(r => {
    const barkO = poNazwie.get(r.bark);
    if (!barkO) throw new Error(`odsunRece: rig nie ma kości ${r.bark}`);
    const zbior = new Set(kosci.map((b, j) => r.punkty.test(b.name) ? j : -1).filter(j => j >= 0));
    const idx = [];
    for (let x = 0; x < poz.count; x++) {
      let w = 0;
      for (const k of ['X', 'Y', 'Z', 'W']) if (zbior.has(si[`get${k}`](x))) w += sw[`get${k}`](x);
      if (w > 0.5) idx.push(x);
    }
    return { ...r, barkO, idx: idx.filter((_, j) => j % co === 0) };
  });

  for (const r of R) { r.pkt = przygotujPunkty(skin, r.idx); r.buf = new Float64Array(r.idx.length * 3); }
  const lok = new THREE.Vector3();
  const najglebszy = r => {
    const ramki = kolidery.map(k => {
      const s = new THREE.Matrix4().multiplyMatrices(k.kosc.matrixWorld, k.lokalna);
      return { k, s, o: new THREE.Matrix4().copy(s).invert() };
    });
    let glMax = 0, wynik = null;
    policzPunkty(skin, r.pkt, r.buf);
    for (let j = 0; j < r.pkt.n; j++) {
      for (const { k, s, o } of ramki) {
        lok.set(r.buf[j * 3], r.buf[j * 3 + 1], r.buf[j * 3 + 2]).applyMatrix4(o);
        const p = k.plastry.get(Math.round(lok.y / k.krok));
        if (!p || p.a < 1e-4 || p.b < 1e-4) continue;
        const rr = Math.hypot(lok.x / p.a, lok.z / p.b);
        if (rr >= 1) continue;
        const d = Math.hypot(lok.x, lok.z);
        const gl = (rr > 1e-6 ? 1 / rr - 1 : 1) * d + luz;
        if (gl > glMax) {
          const kier = new THREE.Vector3(lok.x, 0, lok.z);
          if (kier.lengthSq() < 1e-10) kier.set(1, 0, 0);
          kier.normalize().transformDirection(s);
          glMax = gl; wynik = { swiat: new THREE.Vector3(r.buf[j * 3], r.buf[j * 3 + 1], r.buf[j * 3 + 2]), kier, glebokosc: gl };
        }
      }
    }
    return wynik;
  };
  const odchyl = (barkO, punkt, kier, kat) => {
    const bark = swiatP(barkO), ramie = punkt.clone().sub(bark);
    if (ramie.lengthSq() < 1e-6) return false;
    const os = new THREE.Vector3().crossVectors(ramie, kier);
    if (os.lengthSq() < 1e-10) return false;
    os.normalize();
    const qw = swiatQ(barkO).premultiply(new THREE.Quaternion().setFromAxisAngle(os, kat));
    barkO.quaternion.copy(swiatQ(barkO.parent).invert().multiply(qw));
    barkO.updateMatrixWorld(true);
    return true;
  };

  // --- przebieg 1: ile trzeba odchylić (kilka kroków, bo obrót zmienia geometrię kontaktu) --------------
  const mix1 = new THREE.AnimationMixer(szczyt), a1 = mix1.clipAction(klip); a1.play();
  const katy = R.map(() => new Float64Array(N)), przed = R.map(() => 0);
  for (let i = 0; i < N; i++) {
    mix1.setTime(Math.min(klip.duration - 1e-4, czasy[i]));
    szczyt.updateMatrixWorld(true);
    for (let n = 0; n < R.length; n++) {
      let suma = 0;
      for (let it = 0; it < krokiZbieznosci; it++) {
        const g = najglebszy(R[n]);
        if (!g) break;
        if (it === 0) przed[n] = Math.max(przed[n], g.glebokosc - luz);
        const r = g.swiat.distanceTo(swiatP(R[n].barkO));
        if (r < 1e-3) break;
        const kat = Math.min(g.glebokosc / r, maxKat * Math.PI / 180 - suma);
        if (kat <= 1e-5 || !odchyl(R[n].barkO, g.swiat, g.kier, kat)) break;
        suma += kat;
      }
      katy[n][i] = suma;
    }
  }
  a1.stop(); mix1.uncacheClip(klip);
  const gladkie = katy.map(k => wygladz(k, wygladzenia, false));

  // --- przebieg 2: nałożenie wygładzonego kąta ----------------------------------------------------------
  const mix2 = new THREE.AnimationMixer(szczyt), a2 = mix2.clipAction(klip); a2.play();
  const kanaly = new Map(R.map(r => [r.bark, new Float32Array(N * 4)]));
  const po = R.map(() => 0);
  for (let i = 0; i < N; i++) {
    mix2.setTime(Math.min(klip.duration - 1e-4, czasy[i]));
    szczyt.updateMatrixWorld(true);
    for (let n = 0; n < R.length; n++) {
      if (gladkie[n][i] > 1e-5) {
        const g = najglebszy(R[n]);
        if (g) odchyl(R[n].barkO, g.swiat, g.kier, gladkie[n][i]);
      }
      const g2 = najglebszy(R[n]);
      if (g2) po[n] = Math.max(po[n], g2.glebokosc - luz);
      const t = kanaly.get(R[n].bark), q = R[n].barkO.quaternion;
      t[i * 4] = q.x; t[i * 4 + 1] = q.y; t[i * 4 + 2] = q.z; t[i * 4 + 3] = q.w;
    }
  }
  a2.stop(); mix2.uncacheClip(klip);

  for (const [nazwa, dane] of kanaly) {
    const j = klip.tracks.findIndex(t => t.name === `${nazwa}.quaternion`);
    const tor = new THREE.QuaternionKeyframeTrack(`${nazwa}.quaternion`, czasy, dane);
    if (j >= 0) klip.tracks[j] = tor; else klip.tracks.push(tor);
  }
  return {
    zanurzeniePrzed: przed.map(x => +(x * 1000).toFixed(1)),
    zanurzeniePo: po.map(x => +(x * 1000).toFixed(1)),
    maxKat: gladkie.map(k => +(Math.max(...k) * 180 / Math.PI).toFixed(2)),
    klatekZKorekta: gladkie.map(k => k.filter(x => x > 1e-5).length), klatek: N,
  };
}

/**
 * Domyka pętlę klipu: rozkłada niezgodność między ostatnią a pierwszą klatką równomiernie na cały klip.
 *
 * Klipy ACCAD to wycinki nagrania, a nie zaprojektowane pętle — zmierzone skoki na szwie: idle_sway 11,75°
 * (dłoń prawa), idle_arms 5,05° (ramię prawe), idle_lookaround 3,54°. Przy LoopRepeat postać co kilka sekund
 * szarpie ręką. Poprawka: q'(i) = slerp(1, Δ⁻¹, i/(N−1)) · q(i), gdzie Δ = q(N−1)·q(0)⁻¹. Ostatnia klatka
 * wychodzi wtedy dokładnie na pierwszą, a błąd rozłożony na 9,4 s to 1,25°/s — niewidoczne.
 *
 * @param {'pelna'|'pion'|'brak'} korzen co zrobić ze ścieżką pozycji: „pelna" kasuje też dryf poziomy
 *   (dla idle, gdzie postać ma stać w miejscu), „pion" tylko pion (dla cyklu chodu, który MA jechać do przodu).
 */
export function zapetlij(klip, { korzen = 'pelna', prog = 0.0001 } = {}) {
  const diag = [];
  for (const tor of klip.tracks) {
    const v = tor.values;
    if (tor.name.endsWith('.quaternion')) {
      const n = v.length / 4;
      const q0 = new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
      const qn = new THREE.Quaternion(v[(n - 1) * 4], v[(n - 1) * 4 + 1], v[(n - 1) * 4 + 2], v[(n - 1) * 4 + 3]).normalize();
      const kat = q0.angleTo(qn);
      if (kat < prog) continue;
      diag.push([tor.name.replace('.quaternion', ''), +(kat * 180 / Math.PI).toFixed(2)]);
      const d = qn.clone().multiply(q0.clone().invert());
      if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);   // krótsza droga — bez tego korekta jedzie dookoła
      const inv = d.invert(), jed = new THREE.Quaternion(), kor = new THREE.Quaternion(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        kor.slerpQuaternions(jed, inv, i / (n - 1));
        q.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]).premultiply(kor);
        v[i * 4] = q.x; v[i * 4 + 1] = q.y; v[i * 4 + 2] = q.z; v[i * 4 + 3] = q.w;
      }
    } else if (tor.name.endsWith('.position') && korzen !== 'brak') {
      const n = v.length / 3;
      const d = [v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]];
      if (korzen === 'pion') { d[0] = 0; d[2] = 0; }   // poziom NIESIE krok — skasowanie go zatrzymałoby chód
      if (Math.hypot(...d) < prog) continue;
      diag.push([tor.name.replace('.position', '') + ' (pozycja)', +(Math.hypot(...d) * 1000).toFixed(1)]);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        v[i * 3] -= d[0] * f; v[i * 3 + 1] -= d[1] * f; v[i * 3 + 2] -= d[2] * f;
      }
    }
  }
  return { domkniete: diag };
}
