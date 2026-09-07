// Warstwa UI (tylko odczyt, bez interakcji): ekran startowy z nazwą miejsca, pergaminowy HUD, podpisy miejsc z CONFIG.pois. Flaga: ?noui=1.
// Rejestruje updater przez W.ctx.updaters; elementy DOM z rynek/index.html. Wypełnia tor „UI".
export function initUI(W) {
  if (W.ctx.flags.noui) return;
}
