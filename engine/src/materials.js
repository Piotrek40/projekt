// Materiały PBR z zestawów Poly Haven: diff (kolor), nor (normalna OpenGL), arm (AO/Roughness/Metalness — układ glTF).
import * as THREE from 'three';

export async function loadPbrSet(loaders, name, o = {}) {
  const [map, normalMap, arm] = await Promise.all([
    loaders.loadTexture(name, 'diff'), loaders.loadTexture(name, 'nor'), loaders.loadTexture(name, 'arm'),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = o.aniso ?? 4; }
  const set = { name, map, normalMap, arm, metersPerTile: o.metersPerTile ?? 2 };
  // Materiał z powtórzeniem tekstury w metrach (repeat liczony z rozmiaru powierzchni)
  set.material = (opts = {}) => {
    const m = new (opts.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({
      map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm, metalness: 1, roughness: 1,
      color: opts.color ?? 0xffffff, ...opts.params,
    });
    if (opts.normalScale != null) m.normalScale.set(opts.normalScale, opts.normalScale);
    return m;
  };
  return set;
}

// Kopia zestawu tekstur z innym powtórzeniem (dla ścian o innej skali niż podłoga itp.)
export function repeatSet(set, rx, ry, offsetX = 0, offsetY = 0) {
  const c = {};
  for (const k of ['map', 'normalMap', 'arm']) { const t = set[k].clone(); t.repeat.set(rx, ry); t.offset.set(offsetX, offsetY); t.needsUpdate = true; c[k] = t; }
  return c;
}
