// Kamienice szachulcowe (parter kamienny, piętra z wykuszem, belki, okna, dach, komin).
import * as THREE from 'three';
import { box, plane, gable, cylinder, M4, rng } from '../../engine/src/geometry.js';
import { checkInFrontOfWall, checkCollisionCovers, facadeNormal } from '../../engine/src/check.js';

export function buildHouses(W) {
  const { ctx, CONFIG, P, T, H, B, houses, sideTransform } = W;
  const chimneys = [];
  for (const h of houses) {
    const r = rng(h.seedLocal);
    const tr = sideTransform(h.side, h.along, h.setback);
    const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M4(x, y, z, ry, rx, rz).premultiply(M4(tr.x, 0, tr.z, tr.ry)); // lokalny → świat
    const LP = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry)); // punkt lokalny → świat (do asercji)
    const nrm = facadeNormal(tr.ry), id = `dom s${h.side} along${h.along.toFixed(1)}`; // normalna fasady w świecie (fasada w lokalnym +z); NIE `n` — w pętli pięter `n` to liczba słupków
    const w = h.w, d = H.depth, gf = H.groundFloor, fh = h.floorHeight; // wysokość kondygnacji per dom (layout.js, motyw #3)
    const off = [r(), r()];
    // parter kamienny
    B.add('stone', box(w, gf, d, T.stone.mpt, off), L(0, gf / 2, 0));
    // kolizja: obrys domu (osiowy w świecie — domy stoją wzdłuż osi)
    const wx = (h.side % 2 === 0) ? w : d, wz = (h.side % 2 === 0) ? d : w;
    ctx.addRect(tr.x, tr.z, wx / 2, wz / 2);
    checkCollisionCovers(id, new THREE.Box3().setFromPoints([LP(-w / 2, 0, -d / 2), LP(w / 2, gf, d / 2)]), { x: tr.x, z: tr.z, hw: wx / 2, hd: wz / 2 }); // prostokąt kolizji pokrywa parter
    W.dbgRect?.(tr.x, tr.z, wx / 2, wz / 2); W.dbgAxes?.(tr.x, 0.05, tr.z, tr.ry, 2); // ?boxes=1: L(0,0,0) domu, niebieska oś +z = fasada
    // piętra z wykuszem (jetty): każde wyższe piętro wysunięte do przodu
    let y = gf, jet = 0;
    const plasterKey = 'plaster' + h.plaster;
    for (let f = 1; f < h.floors; f++) {
      if (h.jetty) jet += H.jetty;
      const fw = w, fd = d + jet;
      B.add(plasterKey, box(fw, fh, fd, T.plaster.mpt, off), L(0, y + fh / 2, jet / 2));
      // belki: narożne, poziome (podwalina/oczep), słupki co ~1.6 m, zastrzały ukośne
      const front = jet / 2 + fd / 2; // lico fasady w układzie domu (bryła piętra jest przesunięta o jet/2)
      const bt = 0.16, zf = front + 0.01;
      B.add('timber', box(fw + bt, bt, bt, T.timber.mpt), L(0, y + bt / 2, zf));
      B.add('timber', box(fw + bt, bt, bt, T.timber.mpt), L(0, y + fh - bt / 2, zf));
      const n = Math.max(2, Math.round(fw / 1.6));
      for (let i = 0; i <= n; i++) {
        const x = -fw / 2 + i * fw / n;
        B.add('timber', box(bt, fh, bt, T.timber.mpt), L(x, y + fh / 2, zf));
        if (i < n && r() < 0.5) { // zastrzał w polu
          const len = Math.hypot(fw / n, fh) * 0.7;
          B.add('timber', box(bt * 0.8, len, bt * 0.8, T.timber.mpt), L(x + fw / n / 2, y + fh / 2, zf, 0, 0, Math.atan2(fw / n, fh) * (r() < 0.5 ? 1 : -1)));
        }
      }
      // belki stropowe wystające pod wykuszem
      if (h.jetty) for (let i = 0; i <= n; i++) B.add('timber', box(bt, bt, H.jetty + 0.3, T.timber.mpt), L(-fw / 2 + i * fw / n, y - bt / 2, front - (H.jetty + 0.3) / 2 - 0.05));
      // okna piętra: w polach między słupkami
      for (let i = 0; i < n; i++) {
        if (r() < 0.25) continue;
        const cx = -fw / 2 + (i + 0.5) * fw / n, ww = Math.min(1.0, fw / n - 0.5), wh = 1.3;
        const lit = r() < 0.35;
        B.add(lit ? 'glassLit' : 'glass', box(ww, wh, 0.04), L(cx, y + fh * 0.55, front + 0.01));
        checkInFrontOfWall(`${id} okno p${f}`, LP(cx, y + fh * 0.55, front + 0.01), LP(cx, y + fh * 0.55, front), nrm); // środek okna 1 cm przed licem (d=0.01 ≥ 0.005)
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 - wh / 2, front + 0.02));
        B.add('timber', box(ww + 0.16, 0.08, 0.1), L(cx, y + fh * 0.55 + wh / 2, front + 0.02));
        B.add('timber', box(0.06, wh, 0.1), L(cx, y + fh * 0.55, front + 0.02));
      }
      y += fh;
    }
    // parter: drzwi i okna
    const doorX = (r() - 0.5) * (w - 3);
    B.add('door', box(1.2, 2.3, 0.1, 1.2), L(doorX, 1.15, d / 2 + 0.02));
    B.add('timber', box(1.5, 0.14, 0.2, T.timber.mpt), L(doorX, 2.4, d / 2 + 0.02));
    for (const sx of [-1, 1]) {
      const cx = doorX + sx * 2.2; if (Math.abs(cx) > w / 2 - 0.9) continue;
      B.add(r() < 0.3 ? 'glassLit' : 'glass', box(0.9, 1.1, 0.04), L(cx, 1.8, d / 2 + 0.01));
      checkInFrontOfWall(`${id} okno parteru`, LP(cx, 1.8, d / 2 + 0.01), LP(cx, 1.8, d / 2), nrm);
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 - 0.55, d / 2 + 0.02));
      B.add('timber', box(1.05, 0.08, 0.1), L(cx, 1.8 + 0.55, d / 2 + 0.02));
    }
    // dach
    const roofKey = 'roof' + h.roof, ov = H.overhang, pitch = h.pitch; // spadek per dom (layout.js, motyw #3)
    const topD = d + jet;
    if (h.gableFront) {
      // kalenica wzdłuż z: szczyt widoczny od placu
      const span = w + 2 * ov, rise = (w / 2) * Math.tan(pitch), slope = Math.hypot(w / 2 + ov, rise);
      for (const sx of [-1, 1]) B.add(roofKey, box(slope, 0.14, topD + 2 * ov, T.roof.mpt, off), L(sx * (w / 4 + ov / 2), y + rise / 2, jet / 2, 0, 0, -sx * Math.atan2(rise, w / 2 + ov)));
      B.add(plasterKey, gable(w, rise, topD, T.plaster.mpt), L(0, y, jet / 2));
      B.add('timber', box(0.2, 0.2, topD + 2 * ov, T.timber.mpt), L(0, y + rise, jet / 2));
      // belki szczytu
      B.add('timber', box(0.14, rise * 0.9, 0.14, T.timber.mpt), L(0, y + rise * 0.45, topD / 2 + jet / 2 + 0.01));
    } else {
      // kalenica wzdłuż x: okap nad fasadą
      const rise = (topD / 2) * Math.tan(pitch), slope = Math.hypot(topD / 2 + ov, rise);
      for (const sz of [-1, 1]) B.add(roofKey, box(w + 2 * ov, 0.14, slope, T.roof.mpt, off), L(0, y + rise / 2, jet / 2 + sz * (topD / 4 + ov / 2), 0, sz * Math.atan2(rise, topD / 2 + ov))); // rx=+a opuszcza koniec +z: dla sz=+1 (połać przednia) okap z przodu idzie w dół, kalenica zostaje wyżej (policzone w Node)
      // szczyty boczne (trójkąty) — widoczne między domami różnej wysokości
      for (const sx of [-1, 1]) B.add(plasterKey, gable(topD, rise, 0.3, T.plaster.mpt), L(sx * (w / 2 - 0.15), y, jet / 2, Math.PI / 2));
      B.add('timber', box(w + 2 * ov, 0.2, 0.2, T.timber.mpt), L(0, y + rise, jet / 2));
      // lukarna
      if (r() < 0.5) {
        const dx = (r() - 0.5) * (w - 3);
        B.add(plasterKey, box(1.4, 1.2, 1.2, T.plaster.mpt), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.9));
        B.add(roofKey, box(1.8, 0.12, 1.4, T.roof.mpt), L(dx, y + 1.5, topD / 2 + jet / 2 - 0.9, 0, 0.5)); // rx=+0.5: przód (+z, okap lukarny) niżej niż tył
        B.add('glass', box(0.7, 0.6, 0.04), L(dx, y + 0.8, topD / 2 + jet / 2 - 0.28));
      }
    }
    // komin
    const chx = (r() - 0.5) * (w - 2);
    B.add('stone', box(0.9, y + 2.2 - gf, 0.9, T.stone.mpt, off), L(chx, (gf + y + 2.2) / 2, -1.5));
    chimneys.push(new THREE.Vector3(chx, y + 2.2, -1.5).applyMatrix4(M4(tr.x, 0, tr.z, tr.ry)));
  }
  W.chimneys = chimneys;
}
