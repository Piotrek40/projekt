// Mapowanie nazw kości → role pomiarowe. Testy ruchu liczą metryki z POZYCJI ŚWIATOWYCH konkretnych stawów,
// więc muszą wiedzieć, która kość jest którym stawem. Obsługiwane konwencje nazw: ACCAD/CMU/BVH (Hips, LeftUpLeg,
// LeftLeg, LeftFoot, LeftToeBase), Rigify DEF (DEF-spine, DEF-thighL, DEF-shinL, DEF-footL, DEF-toeL), Mixamo
// (mixamorig:*). Nowy rig = dopisz nazwy do ALIASY albo podaj `nadpisz` w wywołaniu.
//
// UWAGA: role są STAWAMI (punktami początku kości), nie środkami kości. `kostkaL` to staw skokowy, `palecL` to
// nasada palców (ToeBase) — NIE czubek buta. Ma to znaczenie dla MTC (K4): mierzymy prześwit nasady palców.

export const ROLE = ['miednica', 'klatka', 'glowa', 'biodroL', 'biodroP', 'kolanoL', 'kolanoP', 'kostkaL', 'kostkaP',
  'palecL', 'palecP', 'barkL', 'barkP', 'lokiecL', 'lokiecP', 'nadgarstekL', 'nadgarstekP'];

// Aliasy są NORMALIZOWANE przed szukaniem (patrz mapujRig), więc wpisy z '-' i '_' są tu tylko dla czytelności.
// Uzupełnione o nazwy rigu game_engine z MPFB (konwencja Unreal), bo to on siedzi w rynek/assets/models/npc_body.glb:
// pelvis, spine_01..03, neck_01, head, clavicle_l/r, upperarm_l/r, lowerarm_l/r, hand_l/r, thigh_l/r, calf_l/r, foot_l/r, ball_l/r.
const ALIASY = {
  miednica: ['hips', 'pelvis', 'bip01pelvis', 'def-spine', 'root'],
  klatka:   ['spine1', 'chest', 'spine_02', 'spine_03', 'def-spine003', 'spine2', 'upperchest', 'tospine'],
  glowa:    ['head', 'def-spine006', 'head_end'],   // 'head' trafia i w ACCAD (Head), i w rig game_engine (head)
  biodroL:  ['leftupleg', 'thigh_l', 'l_thigh', 'def-thighl', 'upperleg_l', 'lefthip'],
  biodroP:  ['rightupleg', 'thigh_r', 'r_thigh', 'def-thighr', 'upperleg_r', 'righthip'],
  kolanoL:  ['leftleg', 'shin_l', 'calf_l', 'l_calf', 'def-shinl', 'lowerleg_l', 'leftknee', 'leftshin'],
  kolanoP:  ['rightleg', 'shin_r', 'calf_r', 'r_calf', 'def-shinr', 'lowerleg_r', 'rightknee', 'rightshin'],
  kostkaL:  ['leftfoot', 'foot_l', 'l_foot', 'def-footl', 'leftankle'],
  kostkaP:  ['rightfoot', 'foot_r', 'r_foot', 'def-footr', 'rightankle'],
  palecL:   ['lefttoebase', 'toe_l', 'l_toe0', 'def-toel', 'lefttoe', 'lefttoe_end', 'ball_l'],
  palecP:   ['righttoebase', 'toe_r', 'r_toe0', 'def-toer', 'righttoe', 'righttoe_end', 'ball_r'],
  barkL:    ['leftarm', 'upperarm_l', 'l_upperarm', 'def-upper_arml', 'leftshoulder'],
  barkP:    ['rightarm', 'upperarm_r', 'r_upperarm', 'def-upper_armr', 'rightshoulder'],
  lokiecL:  ['leftforearm', 'lowerarm_l', 'l_forearm', 'def-forearml', 'leftelbow'],
  lokiecP:  ['rightforearm', 'lowerarm_r', 'r_forearm', 'def-forearmr', 'rightelbow'],
  nadgarstekL: ['lefthand', 'hand_l', 'l_hand', 'def-handl', 'leftwrist'],
  nadgarstekP: ['righthand', 'hand_r', 'r_hand', 'def-handr', 'rightwrist'],
};
// Role bez których żadna metryka chodu nie ma sensu (brak = twardy błąd, nie ostrzeżenie)
export const WYMAGANE_CHOD = ['miednica', 'biodroL', 'biodroP', 'kolanoL', 'kolanoP', 'kostkaL', 'kostkaP', 'palecL', 'palecP'];
export const WYMAGANE_IDLE = ['glowa', 'miednica'];

const norm = s => s.toLowerCase().replace(/^mixamorig:?/, '').replace(/[ ._:-]/g, '').replace(/^bip\d*/, '');

// Zwraca { rola: Object3D } + listę braków. `nadpisz` = { rola: 'DokładnaNazwaKości' }.
export function mapujRig(root, { nadpisz = {}, role = ROLE } = {}) {
  const kosci = [];
  root.traverse(o => { if (o.isBone || o.isObject3D) kosci.push(o); });
  const wgNazwy = new Map();
  for (const b of kosci) if (b.name && !wgNazwy.has(b.name)) wgNazwy.set(b.name, b);
  const wgNorm = new Map();
  for (const b of kosci) { const k = norm(b.name || ''); if (k && !wgNorm.has(k)) wgNorm.set(k, b); }

  const wynik = {}, braki = [], jak = {};
  for (const r of role) {
    if (nadpisz[r]) {
      const b = wgNazwy.get(nadpisz[r]);
      if (!b) throw new Error(`mapujRig: nadpisana kość "${nadpisz[r]}" dla roli ${r} nie istnieje w rigu`);
      wynik[r] = b; jak[r] = b.name + ' (nadpisane)'; continue;
    }
    let b = null, dop = null;
    // norm() USUWA z nazwy kości '-', '_', '.', ':' i przedrostek mixamorig, a klucze w wgNorm są znormalizowane —
    // więc alias też trzeba znormalizować przed szukaniem. Bez tego każdy alias z separatorem ('DEF-thigh.L',
    // 'mixamorig:LeftUpLeg', 'thigh_l') nigdy nie trafiał: 56 z 95 aliasów było martwym kodem, a Rigify i Mixamo
    // nie mapowały się wcale. Zmierzone po poprawce: SP_anim1.glb i npc_DEFONLY.glb z 0/17 na 17/17.
    for (const a of (ALIASY[r] || [])) { const c = wgNorm.get(norm(a)); if (c) { b = c; dop = a; break; } }
    if (b) { wynik[r] = b; jak[r] = b.name + ` (alias ${dop})`; } else braki.push(r);
  }
  return { role: wynik, braki, jak, liczbaKosci: kosci.filter(b => b.isBone).length };
}

export function wymagaj(map, lista, gdzie) {
  const brak = lista.filter(r => !map.role[r]);
  if (brak.length) throw new Error(`${gdzie}: rig nie ma ról ${brak.join(', ')} — dopisz nazwy do audyt/testy/ruch/rig.mjs ALIASY albo podaj nadpisz:{}`);
}
