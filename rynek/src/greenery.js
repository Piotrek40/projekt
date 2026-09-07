// Zieleń z modeli (W.put): krzewy w donicach przy portalach (W.portals), rabatki, kwiaty w skrzynkach na parapetach (W.sills). Flaga: ?nogreenery=1.
// Kontrakt z torem „kamienice": W.sills = [{x, y, z, ry, w}] (środek górnej krawędzi parapetu w świecie, ry = obrót fasady, w = szerokość okna),
// W.portals = [{x, z, ry}] (punkt na ziemi przed drzwiami). Gdy tablic nie ma — traktuj jak puste. Wypełnia tor „plac".
export function buildGreenery(W) {
  if (W.ctx.flags.nogreenery) return;
}
