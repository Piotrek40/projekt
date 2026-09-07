// Układ placu: obszar chodzenia, ulice, podział pierzei na kamienice (z ziarna) i transformacja pierzeja→świat.
import { plane } from '../../engine/src/geometry.js';

export function buildLayout(W) {
  const { ctx, R, CONFIG, P, T, H, S, half, B } = W;
  // z panoramą (skyline.js) bruk sięga CONFIG.skyline.groundExtent (wieże w oddali stoją na gruncie); ?noskyline=1 → jak dawniej
  const extent0 = half + CONFIG.plaza.streetLength + H.depth + 6; // zasięg bez panoramy (52 m)
  const groundExtent = (!ctx.flags.noskyline && CONFIG.skyline.groundExtent) || extent0;
  // uvOffset kotwiczy wzór bruku tak, jak przy zasięgu extent0 (UV płaszczyzny liczy się od jej rogu — bez tego większa płaszczyzna przesuwa wzór na całym placu)
  B.place('cobble', plane(groundExtent * 2, groundExtent * 2, T.cobble.mpt, [(extent0 - groundExtent) / T.cobble.mpt, (extent0 - groundExtent) / T.cobble.mpt]), 0, 0, 0, 0, -Math.PI / 2); // rot: rx=−π/2 → normalna płaszczyzny (0,0,1) → (0,1,0) w górę, góra UV (0,1,0) → (0,0,−1) = północ (policzone §3.1)
  ctx.addWalkable(0, 0, half - 0.3, half - 0.3);
  const sw = CONFIG.plaza.streetWidth, sl = CONFIG.plaza.streetLength;
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const cx = dx * (half + sl / 2), cz = dz * (half + sl / 2);
    ctx.addWalkable(cx, cz, dx ? sl / 2 : sw / 2 - 0.3, dz ? sl / 2 : sw / 2 - 0.3);
  }

  // ---------- kamienice wokół placu ----------
  // Każda pierzeja: domy jeden przy drugim, przerwa na ulicę pośrodku. Dom stoi tuż za linią placu.
  const houses = [];
  function layoutSide(side) {
    // side: 0 = północ (z<0), 1 = wschód (x>0), 2 = południe (z>0), 3 = zachód (x<0)
    const segs = [[-half - H.depth, -sw / 2], [sw / 2, half + H.depth]]; // dwa odcinki pierzei z przerwą na ulicę
    for (const [a, b] of segs) {
      let pos = a;
      while (b - pos > H.widthMin) {
        let w = Math.min(R.range(H.widthMin, H.widthMax), b - pos);
        if (b - pos - w < H.widthMin) w = b - pos; // ostatni dom domyka pierzeję
        houses.push({ side, along: pos + w / 2, w, floors: R.int(H.floorsMin, H.floorsMax), plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: R() < 0.35, jetty: R() < 0.7, seedLocal: R.int(1, 1e6) });
        pos += w;
      }
    }
  }
  for (let s = 0; s < 4; s++) layoutSide(s);
  // domy zamykające ulice (widok w głąb ulicy kończy się fasadą)
  for (let s = 0; s < 4; s++) houses.push({ side: s, along: 0, w: sw + 2 * H.depth, floors: 3, plaster: R.int(0, P.plaster.length - 1), roof: R.int(0, P.roof.length - 1), gableFront: false, jetty: true, seedLocal: R.int(1, 1e6), setback: sl });

  // transformacja: układ lokalny domu (fasada w +z, oś domu wzdłuż x) → świat
  function sideTransform(side, along, setback = 0) {
    const dist = half + H.depth / 2 + setback;
    switch (side) {
      case 0: return { x: along, z: -dist, ry: 0 };
      case 2: return { x: -along, z: dist, ry: Math.PI };
      case 1: return { x: dist, z: along, ry: -Math.PI / 2 };
      default: return { x: -dist, z: -along, ry: Math.PI / 2 };
    }
  }
  W.sw = sw; W.sl = sl; W.houses = houses; W.sideTransform = sideTransform;
}
