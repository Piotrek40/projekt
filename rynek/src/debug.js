// Pomoce wizualne (?boxes=1): obrysy Box3 każdego W.put() (zielone), obrysy kolizji domów/wieży (czerwone) i kramów/rekwizytów (pomarańczowe),
// osie lokalne (x czerwona, y zielona, z niebieska = kierunek fasady/frontu). Każdy helper to 1 draw call — tylko do diagnostyki.
// Bez flagi wszystkie funkcje są puste; moduły wołają je przez W.dbgBox?.() itd., więc działają też bez initDebug (np. w lineup).
import * as THREE from 'three';

export function initDebug(W) {
  const { ctx, scene } = W;
  if (!ctx.flags.boxes) { W.dbgBox = () => {}; W.dbgAxes = () => {}; W.dbgRect = () => {}; W.dbgCircle = () => {}; return; }
  const g = new THREE.Group(); g.name = 'debug'; scene.add(g);
  const see = h => { h.material.depthTest = false; h.material.toneMapped = false; h.renderOrder = 999; return h; }; // widoczne przez ściany, pełny kolor
  W.dbgBox = (box, color = 0x00ff00) => g.add(see(new THREE.Box3Helper(box, color)));
  W.dbgAxes = (x, y, z, ry, size = 1.5) => { const a = see(new THREE.AxesHelper(size)); a.position.set(x, y, z); a.rotation.y = ry; g.add(a); };
  // prostokąt/koło kolizji jako płaski box 0.5 m nad ziemią (czerwony / pomarańczowy)
  W.dbgRect = (x, z, hw, hd) => W.dbgBox(new THREE.Box3(new THREE.Vector3(x - hw, 0, z - hd), new THREE.Vector3(x + hw, 0.5, z + hd)), 0xff3030);
  W.dbgCircle = (x, z, r) => W.dbgBox(new THREE.Box3(new THREE.Vector3(x - r, 0, z - r), new THREE.Vector3(x + r, 0.5, z + r)), 0xff8030);
}
