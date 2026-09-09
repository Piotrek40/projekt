// Narzędzia sygnałowe wspólne dla asercji ruchu. Wszystko na Float64Array, bez zależności.
// Zasada z zadania (K6): detrend albo JEDNĄ wspólną procedurą dla wszystkich kanałów, albo wcale — mieszanie
// (jeden kanał detrendowany, drugi nie) przerzuca wynik. Dlatego funkcje amplitudowe mają JEDEN parametr polityki.

export const srednia = a => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const rms = a => { let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); };
export const ptp = a => { let lo = Infinity, hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; } return hi - lo; };
export const mediana = a => { const b = Array.from(a).sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
export const kwantyl = (a, q) => { const b = Array.from(a).sort((x, y) => x - y); const i = (b.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return b[lo] + (b[hi] - b[lo]) * (i - lo); };
export const maks = a => { let hi = -Infinity; for (const v of a) if (v > hi) hi = v; return hi; };
export const min_ = a => { let lo = Infinity; for (const v of a) if (v < lo) lo = v; return lo; };

// Linia najmniejszych kwadratów y = a + b·i; zwraca residua (JEDNA procedura, stosowana do wszystkich kanałów naraz).
export function detrendLiniowy(a) {
  const n = a.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += a[i]; sxx += i * i; sxy += i * a[i]; }
  const d = n * sxx - sx * sx, b = d === 0 ? 0 : (n * sxy - sx * sy) / d, c = (sy - b * sx) / n;
  const out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = a[i] - (c + b * i);
  return out;
}
export const POLITYKI_DETRENDU = { wspolny: detrendLiniowy, brak: a => Float64Array.from(a) };

// Pearson
export function korelacja(a, b) {
  const n = Math.min(a.length, b.length); const ma = srednia(a.subarray ? a.subarray(0, n) : a.slice(0, n)), mb = srednia(b.subarray ? b.subarray(0, n) : b.slice(0, n));
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; sab += u * v; saa += u * u; sbb += v * v; }
  return (saa === 0 || sbb === 0) ? NaN : sab / Math.sqrt(saa * sbb);
}

// Dopasowanie najmniejszych kwadratów y ≈ p + q·t + c·cos(2πft) + d·sin(2πft). Amplituda = hypot(c,d).
// Trend liniowy JEST częścią modelu, więc wynik nie zależy od tego, czy sygnał wcześniej detrendowano —
// to zamyka pułapkę K6 (kilka cm dryfu z retargetu nie przenosi się na amplitudę harmonicznej).
export function dopasujSinus(sig, dt, f) {
  const n = sig.length, w = 2 * Math.PI * f;
  const B = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let i = 0; i < n; i++) { const t = i * dt; B[0][i] = 1; B[1][i] = t; B[2][i] = Math.cos(w * t); B[3][i] = Math.sin(w * t); }
  // normalne równania 4×4, eliminacja Gaussa z częściowym wyborem
  const A = [], y = [];
  for (let r = 0; r < 4; r++) { A.push(new Float64Array(5)); let s = 0; for (let i = 0; i < n; i++) s += B[r][i] * sig[i]; A[r][4] = s; }
  for (let r = 0; r < 4; r++) for (let c2 = 0; c2 < 4; c2++) { let s = 0; for (let i = 0; i < n; i++) s += B[r][i] * B[c2][i]; A[r][c2] = s; }
  for (let c2 = 0; c2 < 4; c2++) {
    let piv = c2; for (let r = c2 + 1; r < 4; r++) if (Math.abs(A[r][c2]) > Math.abs(A[piv][c2])) piv = r;
    [A[c2], A[piv]] = [A[piv], A[c2]];
    if (Math.abs(A[c2][c2]) < 1e-15) return { A: NaN, faza: NaN, c: NaN, d: NaN };
    for (let r = 0; r < 4; r++) { if (r === c2) continue; const k = A[r][c2] / A[c2][c2]; for (let j = c2; j < 5; j++) A[r][j] -= k * A[c2][j]; }
  }
  const x = [0, 1, 2, 3].map(r => A[r][4] / A[r][r]);
  return { A: Math.hypot(x[2], x[3]), faza: Math.atan2(x[3], x[2]), c: x[2], d: x[3], trendNaSek: x[1] };
}

// Największa amplituda harmoniczna w paśmie [f0,f1] (skan co df) + amplituda referencyjna poza pasmem.
export function skanPasma(sig, dt, f0, f1, df) {
  let best = { A: -1, f: NaN };
  for (let f = f0; f <= f1 + 1e-12; f += df) { const r = dopasujSinus(sig, dt, f); if (r.A > best.A) best = { A: r.A, f }; }
  return best;
}

// Prędkość pozioma punktu (różnice centralne) — [n] wartości w m/s.
export function predkoscPozioma(p, n, dt) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), h = (b - a) * dt;
    out[i] = Math.hypot(p[3 * b] - p[3 * a], p[3 * b + 2] - p[3 * a + 2]) / h;
  }
  return out;
}
// Wektor prędkości poziomej (2D) — do K8.
export function wektorPredkosci(p, n, dt) {
  const vx = new Float64Array(n), vz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), h = (b - a) * dt;
    vx[i] = (p[3 * b] - p[3 * a]) / h; vz[i] = (p[3 * b + 2] - p[3 * a + 2]) / h;
  }
  return { vx, vz };
}
export const wspolczynnikZmiennosci = a => { const m = srednia(a); return m === 0 ? NaN : Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length) / Math.abs(m); };
