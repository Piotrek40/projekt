// Postproces: okluzja otoczenia (GTAO), delikatny blask i wyjście z tonemapingiem.
//
// DLACZEGO DOPIERO TERAZ: przez cztery etapy postproces był zakazany, bo celem był telefon, a na Xclipse 940
// każdy dodatkowy przebieg pełnoekranowy kosztuje więcej niż cała geometria sceny (zmierzone w etapie 2:
// jedyny kadr ponad sufitem 60 Hz to ten z koroną lipy — przy MNIEJSZEJ geometrii niż kadr, który sufit trzymał).
// Po zmianie platformy na laptop ten zakaz przestał obowiązywać.
//
// DLACZEGO GTAO, A NIE SSAO: SSAO próbkuje półkulę wokół piksela i przy dużych promieniach daje ciemne obwódki
// wokół sylwetek. GTAO całkuje widoczność wzdłuż horyzontu i daje zacienienie tam, gdzie geometria naprawdę
// się zbiega — pod okapami, w wykuszach, pod ladą kramu, między bruk a ścianę. W scenie zbudowanej z brył
// to jest różnica między „brudem na krawędziach" a wrażeniem, że światło gdzieś nie dochodzi.
//
// UWAGA NA TONEMAPING: przy composerze RenderPass rysuje do celu pośredniego w przestrzeni liniowej, a
// tonemaping i konwersję do sRGB robi dopiero OutputPass. three.js pomija tonemaping przy rysowaniu do celu
// renderowania, więc NIE jest on nakładany dwa razy — ale tylko dlatego, że OutputPass jest ostatni.
// Wstawienie czegokolwiek po nim daje obraz podwójnie stonowany.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const USTAWIENIA_DOMYSLNE = {
  // GTAO — promień w METRACH sceny. Scena ma 44 m placu i detale rzędu 10 cm (belki, gzymsy, kostka bruku),
  // więc promień 0,5 m łapie styk elementu ze ścianą, a nie całą pierzeję.
  gtao: { promien: 0.5, grubosc: 1.0, skala: 1.0, moc: 1.0, probek: 16, mieszanie: 1.0 },
  // BLASK DOMYŚLNIE WYŁĄCZONY, i to jest wynik pomiaru, nie ostrożność. UnrealBloomPass pracuje na buforze
  // LINIOWYM HDR, przed tonemapingiem w OutputPass — więc próg podaje się w luminancji liniowej, nie w tym,
  // co widać. Zmierzone na kadrze startowym rynku:
  //   próg 0,85  — łapie niebo i każdą oświetloną ścianę; obraz wychodzi zamglony i wyprany z kontrastu
  //   próg 4 i 12 — zmienia 0,07 % pikseli (średnia różnica 0,24/255), czyli nie robi praktycznie nic
  // Nie ma tu użytecznego środka, bo AgX sam mocno kompresuje światła. Pełny przebieg pełnoekranowy za
  // 0,07 % pikseli to zły interes, więc przy moc = 0 przebieg NIE JEST w ogóle dodawany.
  blask: { moc: 0, promien: 0.5, prog: 4 },
};

/**
 * Buduje łańcuch postprocesu. Zwraca obiekt, który sam w sobie NIE renderuje — renderuje wywołujący,
 * przez `rysuj()`, żeby pętla gry miała jedno miejsce decyzji „composer czy renderer".
 */
export function zbudujPostproces(renderer, scena, kamera, opcje = {}) {
  const nad = opcje.ustawienia || {};
  const u = { gtao: { ...USTAWIENIA_DOMYSLNE.gtao, ...nad.gtao }, blask: { ...USTAWIENIA_DOMYSLNE.blask, ...nad.blask } };
  const rozmiarPx = () => {
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    return v;
  };
  const px = rozmiarPx();

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);          // composer dostaje rozmiar w pikselach BUFORA, więc DPR jest już w nim
  composer.setSize(px.x, px.y);

  const przejscieSceny = new RenderPass(scena, kamera);
  composer.addPass(przejscieSceny);

  const gtao = new GTAOPass(scena, kamera, px.x, px.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = u.gtao.mieszanie;
  gtao.updateGtaoMaterial({
    radius: u.gtao.promien, distanceExponent: 1, thickness: u.gtao.grubosc,
    scale: u.gtao.skala, samples: u.gtao.probek, screenSpaceRadius: false,
  });
  composer.addPass(gtao);

  const blask = u.blask.moc > 0 ? new UnrealBloomPass(new THREE.Vector2(px.x, px.y), u.blask.moc, u.blask.promien, u.blask.prog) : null;
  if (blask) composer.addPass(blask);

  // OutputPass MUSI być ostatni — patrz nota o tonemapingu na górze pliku.
  composer.addPass(new OutputPass());

  return {
    composer, gtao, blask,
    /** Kamera zmienia się przy widokach diagnostycznych (ortho) — przebiegi trzymają własne referencje. */
    ustawKamere(k) { przejscieSceny.camera = k; gtao.camera = k; },
    rozmiar(w, h) { composer.setSize(w, h); gtao.setSize(w, h); blask?.setSize(w, h); },
    rysuj() { composer.render(); },
    diag: { przejsc: composer.passes.length, gtao: u.gtao, blask: u.blask },
  };
}
