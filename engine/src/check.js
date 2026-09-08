// Asercje sceny (engine/src/check.js): przy fałszu console.error('CHECK: …') — render_scene.js zbiera console.error do results.errors,
// więc nieudana asercja = niepusty `errors` w results.json = czerwone światło dla agenta. Nie rzuca wyjątku: scena ma się zbudować do końca,
// żeby jeden błąd nie zasłaniał następnych. Włączanie: zawsze (koszt to kilka Box3 na obiekt), wyłączanie ?nocheck=1.
import * as THREE from 'three';

let enabled = true, failures = 0;
export function checksEnabled(on) { enabled = on; }
export function check(cond, msg, extra) {
  if (!enabled || cond) return !!cond;
  failures++;
  console.error('CHECK: ' + msg + (extra !== undefined ? ' ' + JSON.stringify(extra, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v) : ''));
  return false;
}
export const checkFailures = () => failures;

// --- Geometria pomocnicza -------------------------------------------------------------------------------
// Normalna fasady w świecie: fasada domu leży w lokalnym +z, sideTransform daje ry → n = (sin ry, 0, cos ry).
export const facadeNormal = ry => new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
// Bounding box geometrii po macierzy (dla Batch.add: geometria już przetransformowana, więc matrix opcjonalny).
export function bboxOf(geometry, matrix) { geometry.computeBoundingBox(); const b = geometry.boundingBox.clone(); return matrix ? b.applyMatrix4(matrix) : b; }

// (a) okno/belka/szyld przed licem ściany: iloczyn skalarny (środek elementu − punkt lica) · normalna ≥ minOffset
export function checkInFrontOfWall(name, elementCenter, facadePoint, normal, minOffset = 0.005) {
  const d = elementCenter.clone().sub(facadePoint).dot(normal);
  return check(d >= minOffset, `${name}: element cofnięty w ścianę (d=${d.toFixed(3)} m, min ${minOffset})`, { c: elementCenter.toArray(), n: normal.toArray() });
}
// (b) wysokość modelu po skalowaniu w zakresie [lo, hi] m (bounds z W.bounds, przed put())
export function checkHeight(name, bounds, scale, lo, hi) {
  const h = (bounds.max.y - bounds.min.y) * scale;
  return check(h >= lo && h <= hi, `${name}: wysokość po skalowaniu ${h.toFixed(2)} m poza [${lo}, ${hi}]`);
}
// (c) obiekt nad ziemią: min.y ≥ -tol (Box3 w świecie); dla put() liczymy z bounds*scale + y (put sam podnosi o -min.y*scale)
export function checkAboveGround(name, worldBox, tol = 0.02) {
  return check(worldBox.min.y >= -tol, `${name}: pod ziemią (min.y=${worldBox.min.y.toFixed(3)})`);
}
// (d) heurystyka z-fightingu: dwie geometrie tego samego klucza materiału o niemal zerowej grubości w tej samej osi,
// o tym samym położeniu w tej osi (|Δ| < eps) i nachodzących się rzutach — to dwie koplanarne płaszczyzny.
export function checkNoCoplanar(key, geometries, eps = 0.003, thin = 0.06) {
  const boxes = geometries.map(g => bboxOf(g));
  const axes = ['x', 'y', 'z']; let dup = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    for (const ax of axes) {
      const ta = a.max[ax] - a.min[ax], tb = b.max[ax] - b.min[ax];
      if (ta > thin || tb > thin) continue; // obie muszą być cienkie w tej osi
      const ca = (a.max[ax] + a.min[ax]) / 2, cb = (b.max[ax] + b.min[ax]) / 2;
      if (Math.abs(ca - cb) > eps) continue;
      const overlap = axes.filter(o => o !== ax).every(o => Math.min(a.max[o], b.max[o]) - Math.max(a.min[o], b.min[o]) > 0.05);
      if (overlap) { dup++; if (dup <= 3) check(false, `${key}: koplanarne płaszczyzny #${i}/#${j} w osi ${ax} przy ${ca.toFixed(2)}`); }
    }
  }
  return check(dup === 0, `${key}: ${dup} par koplanarnych płaszczyzn (z-fighting)`);
}
// (f) punkt nad powierzchnią (np. spód okna lukarny nad WIERZCHEM połaci roofTopY(z), nie nad osią płyty): point.y ≥ surfaceY + tol
export function checkAboveSurface(name, pointWorld, surfaceY, tol = 0.05) {
  const d = pointWorld.y - surfaceY;
  return check(d >= tol, `${name}: punkt ${d.toFixed(3)} m nad powierzchnią (min ${tol})`, { p: pointWorld.toArray(), surfaceY });
}
// (e) kolizja pokrywa bryłę: środek koła/prostokąta kolizji leży w rzucie XZ bounding boxa bryły, a promień ≥ ~połowy mniejszego boku
export function checkCollisionCovers(name, worldBox, col) {
  const cx = col.x, cz = col.z;
  const inside = cx >= worldBox.min.x - 0.05 && cx <= worldBox.max.x + 0.05 && cz >= worldBox.min.z - 0.05 && cz <= worldBox.max.z + 0.05;
  let ok = check(inside, `${name}: środek kolizji poza bryłą`, { col, box: [worldBox.min.toArray(), worldBox.max.toArray()] });
  if (col.r !== undefined) { const minHalf = Math.min(worldBox.max.x - worldBox.min.x, worldBox.max.z - worldBox.min.z) / 2; ok = check(col.r >= minHalf * 0.8, `${name}: promień kolizji ${col.r.toFixed(2)} < 0.8·${minHalf.toFixed(2)}`) && ok; }
  if (col.hw !== undefined) ok = check(col.hw >= (worldBox.max.x - worldBox.min.x) / 2 - 0.05 && col.hd >= (worldBox.max.z - worldBox.min.z) / 2 - 0.05, `${name}: prostokąt kolizji mniejszy niż bryła`) && ok;
  return ok;
}
