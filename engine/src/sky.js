// Niebo i słońce z jednego HDRI: tło + oświetlenie otoczenia (PMREM) + światło kierunkowe
// ustawione w kierunku najjaśniejszego piksela mapy. Jedno źródło prawdy dla światła.
import * as THREE from 'three';

// Najjaśniejszy piksel mapy równokątnej → kierunek w świecie (konwencja three.js: u = atan2(z, x)/2π + 0.5, v = asin(y)/π + 0.5).
export function brightestDirection(tex) {
  const { data, width: W, height: H } = tex.image;
  const half = data instanceof Uint16Array;
  const ch = data.length / (W * H);
  let best = -1, bi = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * ch;
    const r = half ? THREE.DataUtils.fromHalfFloat(data[o]) : data[o];
    const g = half ? THREE.DataUtils.fromHalfFloat(data[o + 1]) : data[o + 1];
    const b = half ? THREE.DataUtils.fromHalfFloat(data[o + 2]) : data[o + 2];
    const l = r + g + b; if (l > best) { best = l; bi = i; }
  }
  const row = Math.floor(bi / W), col = bi % W;
  const v = tex.flipY ? 1 - (row + 0.5) / H : (row + 0.5) / H;
  const u = (col + 0.5) / W;
  const theta = (v - 0.5) * Math.PI, phi = (u - 0.5) * 2 * Math.PI;
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
}

export function setupSky(scene, hdr, o) {
  const opt = { environmentIntensity: 0.35, sunIntensity: 3.5, sunColor: 0xfff2e0, distance: 60, shadowExtent: 20, shadow: 1024, shadowRadius: 2, minElevation: 0, rotation: 0, ...o };
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.environment = hdr;
  scene.environmentIntensity = opt.environmentIntensity;
  scene.backgroundRotation = new THREE.Euler(0, opt.rotation, 0);
  scene.environmentRotation = new THREE.Euler(0, opt.rotation, 0);

  const dir = brightestDirection(hdr).applyAxisAngle(new THREE.Vector3(0, 1, 0), opt.rotation);
  // słońce nisko nad horyzontem daje cienie bez końca — minimalna elewacja jest parametrem sceny
  if (Math.asin(dir.y) < opt.minElevation) { const h = Math.cos(opt.minElevation) / Math.hypot(dir.x, dir.z); dir.set(dir.x * h, Math.sin(opt.minElevation), dir.z * h); }
  const sun = new THREE.DirectionalLight(opt.sunColor, opt.sunIntensity);
  sun.position.copy(dir).multiplyScalar(opt.distance);
  sun.castShadow = true;
  const sc = sun.shadow.camera, E = opt.shadowExtent;
  sc.left = -E; sc.right = E; sc.top = E; sc.bottom = -E; sc.near = 1; sc.far = opt.distance * 2 + E * 2;
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.05; sun.shadow.radius = opt.shadowRadius;
  sun.shadow.mapSize.set(opt.shadow, opt.shadow);
  scene.add(sun, sun.target);
  scene.userData.sun = sun; scene.userData.sunDir = dir;
  return sun;
}

// Przesuwa obszar cienia za graczem (mapa cieni pokrywa tylko okolicę, więc jest ostra na dużej scenie).
export function followShadow(sun, x, z) {
  // kierunek i odległość zapamiętane przy pierwszym wywołaniu, ZANIM pozycja zostanie nadpisana
  if (!sun.userData.dir) { sun.userData.dir = sun.position.clone().normalize(); sun.userData.dist = sun.position.length(); }
  sun.target.position.set(x, 0, z);
  sun.position.copy(sun.target.position).addScaledVector(sun.userData.dir, sun.userData.dist);
}
