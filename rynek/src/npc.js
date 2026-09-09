// NPC: jedna postać ludzka na placu — stoi, chodzi trasą, reaguje na gracza.
//
// Ciało: rynek/assets/models/npc_body.glb (MPFB2, siatka bazowa CC0, rig game_engine 53 kości, 1,8023 m).
// Ruch: rynek/assets/anim/*.glb (ACCAD Open Motion Project, CC BY 3.0) — sześć klipów na 22-stawowym
// szkielecie ACCAD, przenoszonych na rig ciała przy ładowaniu przez engine/src/retarget.js.
//
// DLACZEGO NIE PRZEZ W.put() ANI W.B — to nie jest wygoda, tylko konieczność:
//  • put() w trybie noinst (czyli ZAWSZE na Xclipse) robi root.clone(true), a SkinnedMesh.copy przypisuje
//    this.skeleton = source.skeleton — klony DZIELIŁYBY jeden szkielet i ruszały się identycznie;
//  • ścieżka instancji buduje InstancedMesh z gołej geometrii i gubi skinning całkowicie;
//  • Batch.add scala geometrie, co niszczy skinIndex/skinWeight.
// NPC ma więc własną ścieżkę ładowania i własny obiekt w scenie.
//
// RUCH KORZENIA: klipy niosą przemieszczenie, ale wydzielamy je (wydzielRuchKorzenia) i oddajemy
// kontrolerowi, który przesuwa cały obiekt. Pion miednicy ZOSTAJE w klipie — bez niego chód wygląda jak
// sunięcie (zmierzone: cykl chodu ma 37,0 mm pionu miednicy przy normie 25–50 mm).
import * as THREE from 'three';
import { przygotuj, przenies, przyziem, wydzielRuchKorzenia, ruchKorzeniaW, MAPA_ACCAD_MPFB } from '../../engine/src/retarget.js';
import { check } from '../../engine/src/check.js';

const KLIPY = ['idle_sway', 'idle_lookaround', 'idle_arms', 'walk_cycle', 'stand_to_walk', 'walk_to_stand'];

export async function buildNPC(W) {
  const { ctx, scene, loaders, CONFIG } = W;
  const N = CONFIG.npc;
  if (ctx.flags.nonpc) return;
  // Wariant inline (Artifact) ma 15,41 MB z limitu 16 MB, a NPC to 933 kB ciała plus 552 kB klipów.
  // Tam NPC nie wchodzi — tak samo jak model kramu z Blendera (props.js). Pages i wersja lokalna mają go.
  if (loaders.mode === 'inline') return;

  // ?noskin=1: zastępczy walec zamiast postaci ze skinningiem. Nie po to, żeby ładnie wyglądał, tylko żeby
  // dało się zbisekcjować awarię sterownika NA URZĄDZENIU — tak jak ?noinst=1 przy InstancedMesh.
  // Skinning idzie w three r185 wyłącznie przez teksturę RGBA32F czytaną w vertex shaderze i nie ma
  // żadnego wariantu zapasowego w silniku; ta flaga jest jedynym sposobem oddzielenia go od reszty sceny.
  if (ctx.flags.noskin) {
    const zastepnik = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.85 }));
    zastepnik.position.set(N.start.x, 0.87, N.start.z);
    zastepnik.castShadow = true; zastepnik.name = 'npc_zastepnik';
    scene.add(zastepnik);
    ctx.addCircle(N.start.x, N.start.z, N.kolizjaR);
    return;
  }

  const [cialoGltf, ...klipyGltf] = await Promise.all([
    loaders.loadAsset('models/npc_body.glb'),
    ...KLIPY.map(k => loaders.loadAsset(`anim/${k}.glb`)),
  ]);

  let skin = null;
  cialoGltf.scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
  check(!!skin, 'npc: w npc_body.glb nie ma SkinnedMesh');
  if (!skin) return;

  // Przeniesienie liczone RAZ, na pierwszym klipie: pary kości i poprawki zależą tylko od pary szkieletów,
  // nie od klipu. Sześć klipów × ok. 480 klatek × 21 kości to kilkadziesiąt tysięcy operacji na kwaternionach —
  // pojedyncze milisekundy przy ładowaniu, a w pętli gry zero przeliczania.
  // Poza odniesienia: PIERWSZA KLATKA klipu stojącego, nie poza spoczynkowa BVH — ta w plikach ACCAD jest
  // śmieciem (wszystko powyżej bioder wskazuje w bok). Szczegóły i liczby w engine/src/retarget.js.
  const przyg = przygotuj(klipyGltf[0].scene, cialoGltf.scene, MAPA_ACCAD_MPFB,
    { klipOdniesienia: klipyGltf[0].animations[0], czasOdniesienia: 0 });
  check(przyg.pary.length >= 20, 'npc: za mało zmapowanych kości między mocapem a rigiem ciała', { par: przyg.pary.length });
  const maxOdchylka = Math.max(...przyg.diag.odchylkaPo.map(x => x[1]));
  check(maxOdchylka < 0.5, 'npc: dopasowanie póz spoczynkowych nie zeszło poniżej 0,5°', { maxOdchylka });

  const klipy = {}, ruchy = {};
  for (let i = 0; i < KLIPY.length; i++) {
    const nazwa = KLIPY[i], zrodlo = klipyGltf[i];
    const k = przenies({ zrodloRoot: zrodlo.scene, klip: zrodlo.animations[0], pary: przyg.pary, celRoot: cialoGltf.scene, skala: przyg.skala, fps: N.fps });
    k.name = nazwa;
    // Przyziemienie PRZED wydzieleniem ruchu poziomego: wysokość miednicy przenosimy ze źródła przez stosunek
    // wysokości bioder, a długości goleni i stopy różnią się osobno — bez korekty postać albo unosi się nad
    // bruk, albo się w niego zapada. Zmierzone przed poprawką: chód +3,5 mm nad bruk, idle −10…−11 mm pod,
    // klipy przejściowe −44 i −52 mm pod bruk.
    const pelvisKosc = przyg.pary.find(w => w.cs === 'pelvis').c;
    przyziem(k, skin, pelvisKosc, { fps: N.fps });
    ruchy[nazwa] = wydzielRuchKorzenia(k, pelvisKosc);
    klipy[nazwa] = k;
  }
  // Prędkość chodu wynika z KLIPU, nie z konfiguracji — to on dyktuje tempo kontrolerowi, nie odwrotnie.
  // Odwrotnie byłoby poślizgiem stóp: postać przesuwana szybciej, niż stawia kroki, sunie po bruku.
  const vChodu = ruchy.walk_cycle.droga / klipy.walk_cycle.duration;
  check(vChodu > 1.0 && vChodu < 1.6, 'npc: prędkość cyklu chodu poza zakresem chodu swobodnego', { vChodu });

  // ---------- obiekt w scenie ----------
  const npc = new THREE.Object3D();
  npc.name = 'npc';
  npc.position.set(N.start.x, 0, N.start.z);
  npc.rotation.y = N.start.ry;   // rot: ry = kurs startowy z konfiguracji; klipy są znormalizowane do kursu 0, więc kurs niesie wyłącznie ten obiekt
  npc.add(cialoGltf.scene);
  scene.add(npc);

  skin.castShadow = true; skin.receiveShadow = true;
  // Skeleton liczy boundingSphere RAZ, w pozie spoczynkowej, i nigdy jej nie odświeża — przy rozłożonych rękach
  // albo w kroku NPC znikałby przy krawędzi ekranu. Kula liczona ręcznie, z zapasem na wymach kończyn.
  skin.geometry.computeBoundingSphere();
  skin.geometry.boundingSphere.set(new THREE.Vector3(0, 0.9, 0), skin.geometry.boundingSphere.radius * N.zapasKuli);

  const mieszacz = new THREE.AnimationMixer(cialoGltf.scene);
  const akcje = {};
  for (const [n, k] of Object.entries(klipy)) {
    const petla = n.startsWith('idle') || n === 'walk_cycle';
    const a = mieszacz.clipAction(k);
    a.setLoop(petla ? THREE.LoopRepeat : THREE.LoopOnce);
    if (!petla) a.clampWhenFinished = true;
    akcje[n] = a;
  }

  // ---------- maszyna stanów ----------
  // idle → stand_to_walk → walk_cycle (do celu) → walk_to_stand → idle. Klipy przejściowe mają granice
  // na kontaktach pięty, czyli w tej samej fazie kroku co start cyklu — dlatego wystarcza krótkie przenikanie.
  let stan = 'idle', akcjaBiezaca = akcje.idle_sway, cel = 0, licznikIdle = 0, poprzedniCzas = 0;
  akcjaBiezaca.play();
  const ruchPoprz = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const OS_Y = new THREE.Vector3(0, 1, 0);

  const przelacz = (nowyStan, klip) => {
    const a = akcje[klip];
    a.reset(); a.play();
    akcjaBiezaca.crossFadeTo(a, N.przenikanie, true);
    akcjaBiezaca = a; stan = nowyStan;
    ruchPoprz.set(0, 0, 0); poprzedniCzas = 0;
  };

  // Spojrzenie: NPC śledzi gracza szyją i głową. CCDIKSolver się do tego NIE nadaje — przyjmuje wyłącznie
  // indeksy kości i rozwiązuje łańcuch do punktu, a tu chodzi o dwie kości z twardym ograniczeniem kąta.
  const szyja = cialoGltf.scene.getObjectByName('neck_01'), glowa = cialoGltf.scene.getObjectByName('head');
  check(!!szyja && !!glowa, 'npc: rig nie ma kości neck_01 albo head — spojrzenie za graczem nie zadziała');
  const qPom = new THREE.Quaternion(), qPom2 = new THREE.Quaternion(), qObrot = new THREE.Quaternion();
  const vPoz = new THREE.Vector3(), vDo = new THREE.Vector3(), vPrzod = new THREE.Vector3();
  let wagaSpojrzenia = 0;

  const doCelu = new THREE.Vector3();

  // KROK SYMULACJI. Wydzielony z updatera, bo scena ma kontrakt: dt === 0 znaczy „przewiń na czas bezwzględny t",
  // a nie „stój". Wszystkie pozostałe updatery rynku są funkcją t (woda, dym, wiatr, girlandy), więc harness
  // renderu potrafi je próbkować deterministycznie. Maszyna stanów NPC funkcją t nie jest — ma histerezę —
  // więc zamiast udawać, że jest, przy dt === 0 DOSYMULOWUJEMY ją stałym krokiem od ostatnio policzonej chwili.
  // Efekt jest ten sam: ta sama chwila t daje tę samą pozę, niezależnie od tego, kiedy się o nią zapyta.
  const KROK = 1 / 60;
  let czasNpc = 0;
  const stanPoczatkowy = () => {
    stan = 'idle'; cel = 0; licznikIdle = 0; poprzedniCzas = 0; wagaSpojrzenia = 0;
    ruchPoprz.set(0, 0, 0);
    npc.position.set(N.start.x, 0, N.start.z);
    npc.rotation.y = N.start.ry;   // rot: ry = kurs startowy (jak przy budowie obiektu)
    for (const a of Object.values(akcje)) { a.stop(); a.reset(); }
    akcjaBiezaca = akcje.idle_sway; akcjaBiezaca.play();
    mieszacz.setTime(0);
    czasNpc = 0;
  };

  const krok = (dt, gracz) => {
    const p = N.trasa[cel];
    doCelu.set(p.x - npc.position.x, 0, p.z - npc.position.z);
    const dystansDoCelu = doCelu.length();
    const dGracz = Math.hypot(gracz.x - npc.position.x, gracz.z - npc.position.z);

    if (stan === 'idle') {
      licznikIdle += dt;
      // Rusza dopiero, gdy gracz się oddali — inaczej odchodziłby w trakcie przyglądania się,
      // co czyta się jak ucieczka, a nie jak mieszczanin czekający na kupca.
      if (licznikIdle > N.postojS && dGracz > N.dystansZainteresowania) { przelacz('rusza', 'stand_to_walk'); licznikIdle = 0; }
    } else if (stan === 'rusza') {
      if (akcje.stand_to_walk.time >= klipy.stand_to_walk.duration - N.przenikanie) przelacz('chod', 'walk_cycle');
    } else if (stan === 'chod') {
      // Hamowanie z wyprzedzeniem: klip walk_to_stand sam przechodzi jeszcze kawałek drogi (zmierzone 5,006 m),
      // więc decyzja o zatrzymaniu musi zapaść tyle metrów przed punktem trasy — inaczej NPC go przejeżdża.
      if (dystansDoCelu < ruchy.walk_to_stand.droga || dGracz < N.dystansZatrzymania) { przelacz('staje', 'walk_to_stand'); cel = (cel + 1) % N.trasa.length; }
    } else if (stan === 'staje') {
      if (akcje.walk_to_stand.time >= klipy.walk_to_stand.duration - N.przenikanie) { przelacz('idle', N.klipyIdle[cel % N.klipyIdle.length]); licznikIdle = 0; }
    }

    if (stan === 'chod' || stan === 'rusza') {
      const kursDocelowy = Math.atan2(doCelu.x, doCelu.z);
      let d = kursDocelowy - npc.rotation.y;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      npc.rotation.y += Math.max(-N.skretRadS * dt, Math.min(N.skretRadS * dt, d));   // rot: ry = kurs marszu, przyrost ograniczony prędkością skrętu N.skretRadS
    }

    mieszacz.update(dt);

    // ---- ruch korzenia z klipu na obiekt ----
    // Bierzemy PRZYROST między klatkami. walk_cycle jest zapętlony, więc czas skacze z duration do zera:
    // wtedy przyrost to (koniec − poprzedni) + (nowy − początek). Bez tego NPC cofałby się o cały krok
    // przy każdym obrocie pętli. Ten sam wzór jest poprawny dla klipów jednorazowych, gdzie czas nie maleje.
    const klipBiez = akcjaBiezaca.getClip(), rk = ruchy[klipBiez.name];
    const czas = akcjaBiezaca.time;
    ruchKorzeniaW(rk, czas, tmp);
    if (czas < poprzedniCzas) {
      ruchKorzeniaW(rk, klipBiez.duration, tmp2).sub(ruchPoprz);
      ruchKorzeniaW(rk, 0, ruchPoprz);
      tmp2.add(tmp).sub(ruchPoprz);
    } else {
      tmp2.copy(tmp).sub(ruchPoprz);
    }
    ruchPoprz.copy(tmp); poprzedniCzas = czas;
    // Bezpiecznik na przeskok przy przełączaniu klipów: przyrost większy niż N.maxPrzyrostM w jednej klatce
    // nie jest krokiem, tylko artefaktem przenikania — odrzucamy go zamiast teleportować postać.
    if (tmp2.lengthSq() > 1e-12 && tmp2.lengthSq() < N.maxPrzyrostM * N.maxPrzyrostM) {
      npc.position.add(tmp2.applyAxisAngle(OS_Y, npc.rotation.y));
    }

    // ---- spojrzenie za graczem ----
    // Liczone PO mieszaczu, bo to on właśnie nadpisał rotacje kości. Waga narasta i opada płynnie, żeby głowa
    // nie przeskakiwała w chwili wejścia gracza w promień; kąt ograniczony, bo człowiek nie obraca głowy o 180°.
    if (szyja && glowa) {
      const chce = dGracz < N.dystansZainteresowania ? 1 : 0;
      wagaSpojrzenia += Math.max(-dt / N.spojrzenieOpadS, Math.min(dt / N.spojrzenieNarostS, chce - wagaSpojrzenia));
      wagaSpojrzenia = Math.max(0, Math.min(1, wagaSpojrzenia));
      if (wagaSpojrzenia > 0.001) {
        for (const [kosc, udzial] of [[szyja, N.udzialSzyi], [glowa, 1 - N.udzialSzyi]]) {
          kosc.updateMatrixWorld(true);
          vPoz.setFromMatrixPosition(kosc.matrixWorld);
          vDo.set(gracz.x - vPoz.x, (gracz.y ?? 1.65) - vPoz.y, gracz.z - vPoz.z).normalize();
          // Oś kości w rigu game_engine biegnie wzdłuż lokalnego +y (tak wychodzi z MPFB), więc „przód" tej
          // kości to +y obrócone jej rotacją światową. Obrót liczymy jako minimalny obrót z tego kierunku
          // na kierunek do gracza, a potem skracamy go limitem kąta i wagą.
          vPrzod.set(0, 1, 0).applyQuaternion(kosc.getWorldQuaternion(qPom)).normalize();
          const kat = Math.acos(Math.max(-1, Math.min(1, vPrzod.dot(vDo))));
          const limit = N.limitSpojrzeniaRad * udzial;
          qObrot.setFromUnitVectors(vPrzod, vDo);
          const ulamek = Math.min(1, limit / Math.max(kat, 1e-6)) * wagaSpojrzenia;
          qPom2.identity().slerp(qObrot, ulamek);
          const qSwiat = qPom2.multiply(kosc.getWorldQuaternion(qPom));
          kosc.quaternion.copy(kosc.parent.getWorldQuaternion(qObrot).invert().multiply(qSwiat));
          kosc.updateMatrixWorld(true);
        }
      }
    }
  };

  ctx.updaters.push((dt, t, gracz) => {
    if (dt > 0) { krok(dt, gracz); czasNpc += dt; return; }
    // dt === 0: przewijanie. Wstecz — od zera, bo maszyna stanów nie ma odwrotności. Do przodu — dosymulowanie
    // stałym krokiem. Limit kroków chroni przed zawieszeniem strony, gdyby ktoś poprosił o t = 10 000 s.
    if (t < czasNpc - 1e-6) stanPoczatkowy();
    let n = 0;
    while (czasNpc < t - 1e-6 && n++ < N.maxKrokowPrzewijania) {
      const d = Math.min(KROK, t - czasNpc);
      krok(d, gracz); czasNpc += d;
    }
    if (n >= N.maxKrokowPrzewijania) console.warn('npc: przewijanie ucięte na limicie kroków', { t, czasNpc });
  });

  ctx.addCircle(N.start.x, N.start.z, N.kolizjaR);   // koło kolizji w punkcie startu; NPC chodzi po placu, gracz go omija

  W.npc = { obiekt: npc, skin, mieszacz, klipy, ruchy, vChodu, przyg, stan: () => stan };
  window.__npc = W.npc;   // diagnostyka z konsoli i z harnessu renderu
}
