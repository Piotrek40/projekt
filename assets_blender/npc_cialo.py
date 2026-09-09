#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
npc_cialo.py - powtarzalny build ciala NPC dla sceny "rynek".

Uruchomienie (bez binarki blender, bpy jako modul):
    python3 /home/user/projekt/assets_blender/npc_cialo.py
    NPC_RENDER=1 python3 /home/user/projekt/assets_blender/npc_cialo.py   # + rendery Cycles CPU

Wynik: /home/user/projekt/rynek/assets/models/npc_body.glb

Cel: naga meska figura ludzka, 1,80 m, umiesnienie czytelne w sylwetce
(nie kulturysta), lysa, bez ubran, bez rzes. Szkielet do animacji: 53 kosci.

WYBORY, KAZDY Z LICZBA (pomiary w komentarzu przy stalej):
  * droga (b) HumanService.create_human(macro_detail_dict=...) - patrz MACRO
  * rig "game_engine" - patrz RIG_NAME
  * height=0.550 -> 1,8023 m zmierzone
  * muscle=0.78  -> RMS 3,53 mm / max 21,8 mm przesuniecia wzgledem muscle=0.50
"""

import os
import sys
import json
import math
import struct
import time

T_START = time.time()

import bpy
import addon_utils

OUT_GLB   = "/home/user/projekt/rynek/assets/models/npc_body.glb"
WORK      = "/tmp/claude-0/-home-user-projekt/51bf51f1-3a2c-5752-acdf-ae27d700e1e0/scratchpad/npc_build/cialo"
os.makedirs(WORK, exist_ok=True)

# ---------------------------------------------------------------------------
# WYBOR 1: droga generowania ciala.
#
# Droga (a) bpy.ops.mpfb.create_human() ma ZERO parametrow operatora
# (get_rna_type().properties == []) i czyta 27 wlasciwosci sceny, w ktorych
# makra sa ENUMAMI: phenotype_height = minheight|average|maxheight,
# phenotype_muscle = minmuscle|averagemuscle|maxmuscle, wymieszanymi jednym
# wspolnym floatem phenotype_influence. Trzy dyskretne wzrosty nie pozwalaja
# trafic w 1,80 m, a jeden wspolny influence nie pozwala ustawic muscle
# niezaleznie od weight.
#
# Droga (b) przyjmuje kazde makro jako osobny float. Wybrana.
# ---------------------------------------------------------------------------
MACRO = {
    "gender":      1.0,    # mezczyzna
    "age":         0.5,    # ~25-45 lat
    "muscle":      0.78,   # zmierzone: RMS 3,53 mm, max 21,8 mm vs muscle=0.50.
                           # muscle=1.00 dawalo max 39,8 mm (kulturysta) - odrzucone.
    "weight":      0.48,   # nieco ponizej srodka: mieszczanin, nie otylly
    "height":      0.550,  # zmierzone 1,8023 m (sweep: 0.50->1.7473, 0.60->1.8711)
    "proportions": 0.5,    # klucz nazywa sie "proportions", NIE "bodyproportions"
    "cupsize":     0.0,
    "firmness":    0.5,
    "race": {"asian": 0.0, "african": 0.0, "caucasian": 1.0},
}

# ---------------------------------------------------------------------------
# WYBOR 2: rig.
#
# NPC ma chodzic, patrzec na gracza i oddychac. Wymagania:
#   - szyja i glowa osobno            -> look-at bez obracania calego tulowia
#   - kregoslup >= 2 segmenty         -> oddech / przenoszenie ciezaru
#   - stopa + palce (ball)            -> foot IK roll przy chodzie
#
# Katalog MPFB (policzone z data/rigs/standard/rig.*.json):
#   cmu_mb                 31  Spine,Spine1 (2), Neck,Neck1,Head, ToeBase. Dlonie:
#                              LeftFingerBase/LeftHandFinger1/LThumb - kikuty.
#   game_engine            53  spine_01/02/03 (3), neck_01+head, ball_l/r,
#                              5 palcow x 3 czlony na dlon, Root. ZERO martwych kosci.
#   game_engine_with_breast 55  = game_engine + breast_l/r (bezuzyteczne u mezczyzny)
#   mixamo_unity           64  = 53 potrzebnych + Jaw, LeftEye, RightEye,
#                              Orbicularis x4, Breast x2, Buttock x2 = 11 kosci
#                              martwych dla lysej figury bez osobnej geometrii oczu
#   default_no_toes       137  + cala mimika twarzy i jezyk
#   default               163  + palce stop
#
# game_engine (53) spelnia wszystkie trzy wymagania i nie ma ani jednej kosci,
# ktorej ten NPC nie uzyje. mixamo_unity dokladalby 11 kosci sterujacych
# geometria, ktorej w tym eksporcie nie ma (oczy sa w MPFB osobnym obiektem,
# tu nieobecnym). Liczba kosci jest tania (bone texture w three r185), ale
# martwa kosc nie staje sie przez to uzyteczna.
# ---------------------------------------------------------------------------
RIG_NAME = "game_engine"

TARGET_HEIGHT_M = 1.80
HEIGHT_TOL_M    = 0.02


def log(*a):
    print(*a)
    sys.stdout.flush()


def hdr(t):
    log("\n" + "=" * 74)
    log(t)
    log("=" * 74)


# ===========================================================================
# 1. CZYSTY START + ADDON
# ===========================================================================
hdr("1. reset + addon")
bpy.ops.wm.read_factory_settings(use_empty=True)
# PULAPKA: read_factory_settings wylacza addony. Wlaczamy PO resecie.
# Nazwa musi byc "bl_ext.user_default.mpfb"; legacy "mpfb" rzuca ValueError.
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
log("mpfb enabled:", "bl_ext.user_default.mpfb" in [m.__name__ for m in addon_utils.modules()
                                                    if addon_utils.check(m.__name__)[1]])

from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0

# ===========================================================================
# 2. CIALO
# ===========================================================================
hdr("2. cialo (HumanService.create_human, droga b)")
t = time.time()
obj = HumanService.create_human(macro_detail_dict=MACRO)
obj.name = "npc_body"
obj.data.name = "npc_body_mesh"
log("create_human: %.2f s" % (time.time() - t))
log("obiekt:", obj.name, "| wierzcholki bazowe:", len(obj.data.vertices))
log("shape keys po create_human:",
    len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0)
log("modyfikatory:", [(m.name, m.type) for m in obj.modifiers])

# wysokosc PRZED rigiem i zapiekiem, liczona z ewaluowanej siatki (maska helperow
# juz nalozona, wiec to jest samo cialo, bez klatki pomocniczej)
def evaluated_body_bbox(o):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    mn = [1e9] * 3
    mx = [-1e9] * 3
    for v in me.vertices:
        w = o.matrix_world @ v.co
        for i in range(3):
            mn[i] = min(mn[i], w[i])
            mx[i] = max(mx[i], w[i])
    ev.to_mesh_clear()
    return n, mn, mx


n_pre, mn_pre, mx_pre = evaluated_body_bbox(obj)
H_PRE = mx_pre[2] - mn_pre[2]
log("PRZED rigiem: nverts_eval=%d  wzrost=%.4f m  szer=%.4f m  glab=%.4f m"
    % (n_pre, H_PRE, mx_pre[0] - mn_pre[0], mx_pre[1] - mn_pre[1]))

# ===========================================================================
# 3. RIG  (NAJPIERW rig, POTEM delete_helpers - odwrotnie = ZeroDivisionError)
# ===========================================================================
hdr("3. rig: %s" % RIG_NAME)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
t = time.time()
arm = HumanService.add_builtin_rig(obj, RIG_NAME)
arm.name = "npc_rig"
arm.data.name = "npc_rig_data"
log("add_builtin_rig: %.2f s" % (time.time() - t))
log("kosci: %d" % len(arm.data.bones))
log("nazwy:", sorted(b.name for b in arm.data.bones))
log("modyfikatory ciala po rigu:", [(m.name, m.type) for m in obj.modifiers])

# ===========================================================================
# 4. USUNIECIE HELPEROW
# ===========================================================================
hdr("4. delete_helpers")
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
t = time.time()
bpy.ops.mpfb.delete_helpers()
log("delete_helpers: %.2f s" % (time.time() - t))
log("wierzcholki bazowe po usunieciu:", len(obj.data.vertices))
log("modyfikatory:", [(m.name, m.type) for m in obj.modifiers])
assert not any(m.type == 'MASK' for m in obj.modifiers), \
    "MASK modifier przezyl delete_helpers - eksport wyprodukowalby klatke helperow"

# ===========================================================================
# 5. ZAPIECZENIE SHAPE KEYS  (dokladnie ta sekwencja, inna daje CICHO zla figure)
# ===========================================================================
hdr("5. zapiek shape keys")
nk = len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0
log("shape keys przed zapiekiem:", nk)

n_bake_pre, mn_bp, mx_bp = evaluated_body_bbox(obj)
H_BAKE_PRE = mx_bp[2] - mn_bp[2]
log("wzrost PRZED zapiekiem (ewaluowany): %.4f m  (nverts_eval=%d, nverts_base=%d)"
    % (H_BAKE_PRE, n_bake_pre, len(obj.data.vertices)))
assert n_bake_pre == len(obj.data.vertices), \
    "ewaluowana siatka ma inna liczbe wierzcholkow niz bazowa - jakis modyfikator zmienia topologie"

t = time.time()
dg = bpy.context.evaluated_depsgraph_get()
me = obj.evaluated_get(dg).to_mesh()
co = [0.0] * (len(me.vertices) * 3)
me.vertices.foreach_get("co", co)
obj.evaluated_get(dg).to_mesh_clear()
obj.shape_key_clear()
obj.data.vertices.foreach_set("co", co)
obj.data.update()
log("zapiek: %.2f s" % (time.time() - t))
log("shape keys po zapieku:",
    len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0)

n_post, mn_post, mx_post = evaluated_body_bbox(obj)
H_POST = mx_post[2] - mn_post[2]
log("wzrost PO zapieku: %.4f m   delta vs przed = %+.4f m" % (H_POST, H_POST - H_BAKE_PRE))
log("obj.dimensions: (%.4f, %.4f, %.4f)" % tuple(obj.dimensions))

# ---- ASERCJA A1: zapiek zachowal figure -----------------------------------
# Oblewa, gdy zapiek sie nie udal: shape_key_add(from_mix=True) daje 2,05 m,
# a export_morph=False bez zadnego zapieku daje neutralne 1,67 m.
assert abs(H_POST - H_BAKE_PRE) < 0.001, \
    "ZAPIEK NIEUDANY: %.4f m -> %.4f m" % (H_BAKE_PRE, H_POST)
# ---- ASERCJA A2: to jest FIGURA Z MACRO, nie neutralna ---------------------
assert abs(H_POST - TARGET_HEIGHT_M) < HEIGHT_TOL_M, \
    "wzrost %.4f m poza %.2f +/- %.2f m" % (H_POST, TARGET_HEIGHT_M, HEIGHT_TOL_M)
log("OK: zapiek zachowal figure, wzrost %.4f m" % H_POST)

# ===========================================================================
# 6. MATERIAL - jeden, OPAQUE, FrontSide, bez alphaTest/transmission
# ===========================================================================
hdr("6. material")
obj.data.materials.clear()
mat = bpy.data.materials.new("npc_skin")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial")
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
# sRGB (0.76, 0.57, 0.46) -> linear
bsdf.inputs["Base Color"].default_value = (0.538, 0.285, 0.179, 1.0)
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.62
if "Alpha" in bsdf.inputs:
    bsdf.inputs["Alpha"].default_value = 1.0
for dead in ("Transmission Weight", "Coat Weight", "Sheen Weight",
             "Subsurface Weight", "Emission Strength"):
    if dead in bsdf.inputs:
        bsdf.inputs[dead].default_value = 0.0
# Specular IOR Level MUSI zostac na 0.5. Kazda inna wartosc kaze eksporterowi
# dopisac rozszerzenie KHR_materials_specular (0.35 -> specularFactor 0.7),
# a to jest dodatkowa permutacja shadera na telefonie za zero zysku wizualnego.
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
obj.data.materials.append(mat)

mat.use_backface_culling = True          # -> "doubleSided": false w glTF
for attr, val in (("blend_method", 'OPAQUE'), ("shadow_method", 'OPAQUE'),
                  ("surface_render_method", 'DITHERED')):
    if hasattr(mat, attr):
        try:
            setattr(mat, attr, val)
        except Exception as e:
            log("  (nie ustawiono %s: %s)" % (attr, e))
log("material:", mat.name, "| sloty:", len(obj.data.materials),
    "| backface_culling:", mat.use_backface_culling)

# gladkie cieniowanie - miesnie maja byc czytelne w shadingu, nie fasetowane
for p in obj.data.polygons:
    p.use_smooth = True
obj.data.update()
log("polygony smooth:", sum(1 for p in obj.data.polygons if p.use_smooth), "/",
    len(obj.data.polygons))

# ===========================================================================
# 6b. OGRANICZENIE WPLYWOW DO 4 (three.js czyta tylko JOINTS_0 - pulapka 8)
#
# MPFB przypisuje wiecej niz 4 wagi na wierzcholek. Eksporter glTF i tak
# obetnie do 4 najciezszych i znormalizuje, ale zrobi to po cichu (jeden
# WARNING w logu). Robimy to jawnie w Blenderze, zeby siatka w .blend i na
# renderach kontrolnych byla TA SAMA co w GLB, i zeby zmierzyc strate.
# ===========================================================================
hdr("6b. wplywy kosci na wierzcholek")


BONE_NAMES = {b.name for b in arm.data.bones}
DEFORM_IDX = {vg.index for vg in obj.vertex_groups if vg.name in BONE_NAMES}
log("grup wierzcholkow razem: %d, z tego deformujacych (= nazwa kosci): %d"
    % (len(obj.vertex_groups), len(DEFORM_IDX)))


def influence_stats(o):
    hist = {}
    lost_max = 0.0
    lost_sum = 0.0
    n_over = 0
    sums = []
    for v in o.data.vertices:
        ws = sorted((g.weight for g in v.groups
                     if g.group in DEFORM_IDX and g.weight > 1e-6), reverse=True)
        hist[len(ws)] = hist.get(len(ws), 0) + 1
        sums.append(sum(ws))
        if len(ws) > 4:
            n_over += 1
            tot = sum(ws)
            lost = sum(ws[4:]) / tot if tot > 0 else 0.0
            lost_sum += lost
            lost_max = max(lost_max, lost)
    return hist, n_over, lost_max, (lost_sum / n_over if n_over else 0.0), sums


h0, n_over0, lmax0, lavg0, s0 = influence_stats(obj)
log("histogram wplywow PRZED obcieciem:", dict(sorted(h0.items())))
log("wierzcholkow z >4 wplywami: %d (%.2f%%)  max utracona waga %.4f  srednia %.4f"
    % (n_over0, 100.0 * n_over0 / len(obj.data.vertices), lmax0, lavg0))
log("suma wag deformujacych PRZED: min=%.6f max=%.6f" % (min(s0), max(s0)))

# recznie, bez operatorow: bpy.ops.object.vertex_group_normalize_all normalizuje
# KAZDA GRUPE osobno (sumy wychodza 3.0/4.0), a nie sume wag na wierzcholku.
t = time.time()
IDX2VG = {vg.index: vg for vg in obj.vertex_groups}
n_touched = 0
for v in obj.data.vertices:
    ws = [(g.group, g.weight) for g in v.groups
          if g.group in DEFORM_IDX and g.weight > 1e-6]
    ws.sort(key=lambda x: -x[1])
    keep = ws[:4]
    drop = ws[4:]
    tot = sum(w for _, w in keep)
    if not tot:
        continue
    if drop or abs(sum(w for _, w in ws) - 1.0) > 1e-5:
        n_touched += 1
    for gi, _ in drop:
        IDX2VG[gi].remove([v.index])
    for gi, w in keep:
        IDX2VG[gi].add([v.index], w / tot, 'REPLACE')
log("przepisanych wierzcholkow: %d  (%.2f s)" % (n_touched, time.time() - t))

h1, n_over1, lmax1, lavg1, s1 = influence_stats(obj)
log("histogram wplywow PO obcieciu: ", dict(sorted(h1.items())))
log("suma wag deformujacych PO: min=%.6f max=%.6f" % (min(s1), max(s1)))
assert n_over1 == 0, "nadal %d wierzcholkow z >4 wplywami" % n_over1
assert abs(min(s1) - 1.0) < 1e-4 and abs(max(s1) - 1.0) < 1e-4, \
    "wagi nieznormalizowane: %.6f..%.6f" % (min(s1), max(s1))
assert min(h1.keys()) >= 1, "wierzcholek bez zadnej wagi"
log("OK: <=4 wplywy, kazdy wierzcholek ma sume wag 1.0")

# ===========================================================================
# 7. EKSPORT GLB
# ===========================================================================
hdr("7. eksport GLB")
for o in bpy.context.scene.objects:
    o.select_set(False)
obj.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm

EXPORT_KW = dict(
    export_format='GLB',
    use_selection=True,
    export_skins=True,          # skinning
    export_morph=False,         # po zapieku - zadnych morph targets (pulapka 7)
    export_yup=True,
    export_apply=False,         # NIE aplikuj modyfikatorow (armature musi zostac)
    export_materials='EXPORT',
    export_normals=True,
    export_tangents=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_yup_pointcloud=True if hasattr(bpy.ops.export_scene.gltf.get_rna_type(),
                                          'export_yup_pointcloud') else True,
)
EXPORT_KW.pop('export_yup_pointcloud', None)

t = time.time()
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_texcoords=True, **EXPORT_KW)
log("eksport (z UV): %.2f s -> %s  %d B" % (time.time() - t, OUT_GLB, os.path.getsize(OUT_GLB)))

NOUV = os.path.join(WORK, "npc_body_nouv.glb")
bpy.ops.export_scene.gltf(filepath=NOUV, export_texcoords=False, **EXPORT_KW)
log("wariant bez UV (tylko do porownania kosztu szwow): %d B" % os.path.getsize(NOUV))

# ===========================================================================
# 8. ODCZYT NAGLOWKA GLB (nie ufamy "udanemu eksportowi")
# ===========================================================================
hdr("8. naglowek JSON wynikowego GLB")


def glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, "to nie jest GLB"
    off = 12
    js = None
    binbuf = None
    while off < total:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binbuf = chunk
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js, binbuf, len(data)


G, BIN, GSIZE = glb_json(OUT_GLB)
log("rozmiar pliku: %d B" % GSIZE)
log("meshes: %d, nodes: %d, skins: %d, materials: %d, images: %d, animations: %d"
    % (len(G.get("meshes", [])), len(G.get("nodes", [])), len(G.get("skins", [])),
       len(G.get("materials", [])), len(G.get("images", [])), len(G.get("animations", []))))
log("extensionsUsed:", G.get("extensionsUsed", []))

skin = G["skins"][0]
log("joints w skinie: %d" % len(skin["joints"]))

prim = G["meshes"][0]["primitives"][0]
log("atrybuty primitive:", sorted(prim["attributes"].keys()))
acc_pos = G["accessors"][prim["attributes"]["POSITION"]]
log("POSITION count = %d  min=%s  max=%s"
    % (acc_pos["count"], [round(x, 4) for x in acc_pos["min"]],
       [round(x, 4) for x in acc_pos["max"]]))
GLB_H = acc_pos["max"][1] - acc_pos["min"][1]     # yup -> wzrost na osi Y
log("WZROST Z GLB (Y max-min) = %.4f m" % GLB_H)
n_idx = G["accessors"][prim["indices"]]["count"]
log("indeksy = %d  ->  trojkaty = %d" % (n_idx, n_idx // 3))

M = G["materials"][0]
log("material JSON:", json.dumps(M, sort_keys=True))

# ---- ASERCJE MATERIALU ----------------------------------------------------
assert M.get("doubleSided", False) is False, "material jest doubleSided"
assert "alphaMode" not in M or M["alphaMode"] == "OPAQUE", \
    "alphaMode = %s" % M.get("alphaMode")
assert "alphaCutoff" not in M, "material ma alphaCutoff"
assert not any(k.startswith("KHR_materials_transmission") for k in M.get("extensions", {})), \
    "material ma transmission"
assert len(G["materials"]) == 1, "wiecej niz jeden material"
log("OK: 1 material, OPAQUE, doubleSided=false, bez alphaCutoff/transmission")

# ---- ASERCJA: wzrost w GLB zgodny ze zmierzonym w Blenderze ---------------
assert abs(GLB_H - TARGET_HEIGHT_M) < HEIGHT_TOL_M, \
    "wzrost w GLB %.4f m poza celem" % GLB_H
assert len(skin["joints"]) == len(arm.data.bones), \
    "eksport zgubil kosci: %d z %d" % (len(skin["joints"]), len(arm.data.bones))
assert "JOINTS_0" in prim["attributes"] and "WEIGHTS_0" in prim["attributes"], \
    "brak JOINTS_0/WEIGHTS_0 - skinning nie przeszedl"
assert "JOINTS_1" not in prim["attributes"], \
    "JOINTS_1 obecne - three.js czyta tylko JOINTS_0, czesc wag przepadnie"
assert not G.get("animations"), "GLB zawiera animacje, mial byc samo cialo"
assert not G.get("images"), "GLB zawiera obrazy"
log("OK: %d jointow, JOINTS_0 bez JOINTS_1, brak animacji i tekstur" % len(skin["joints"]))

G2, _, _ = glb_json(NOUV)
p2 = G2["meshes"][0]["primitives"][0]
log("bez UV: POSITION count = %d (z UV: %d, roznica = szwy UV: +%d, +%.1f%%)"
    % (G2["accessors"][p2["attributes"]["POSITION"]]["count"], acc_pos["count"],
       acc_pos["count"] - G2["accessors"][p2["attributes"]["POSITION"]]["count"],
       100.0 * (acc_pos["count"] - G2["accessors"][p2["attributes"]["POSITION"]]["count"])
       / G2["accessors"][p2["attributes"]["POSITION"]]["count"]))

# ===========================================================================
# 9. ANATOMIA RIGU WZGLEDEM SIATKI
# ===========================================================================
hdr("9. anatomia: czy glowy i ogony kosci leza WEWNATRZ siatki")

mw_arm = arm.matrix_world
inv_body = obj.matrix_world.inverted()


def depth_mm(p_world):
    """<0 = wewnatrz siatki. Zwraca (glebokosc_mm, odleglosc_do_powierzchni_mm)."""
    pl = inv_body @ p_world
    ok, loc, nor, _ = obj.closest_point_on_mesh(pl)
    if not ok:
        return None, None
    d = pl - loc
    dist = d.length * 1000.0
    return (-dist if d.dot(nor) < 0 else dist), dist


LIMB = ["thigh_l", "calf_l", "foot_l", "ball_l",
        "thigh_r", "calf_r", "foot_r", "ball_r",
        "upperarm_l", "lowerarm_l", "hand_l",
        "upperarm_r", "lowerarm_r", "hand_r",
        "clavicle_l", "clavicle_r",
        "spine_01", "spine_02", "spine_03", "neck_01", "head", "pelvis"]

# ogon kosci jest STAWEM, gdy jakies dziecko zaczyna sie w tym samym punkcie.
# ogon koncowy (czubek palca, czubek czaszki) LEZY na powierzchni z definicji -
# wymaganie, zeby byl w srodku, byloby bledem anatomicznym, nie testem.
def tail_is_joint(b):
    return any((c.head_local - b.tail_local).length < 1e-4 for c in b.children)


JOINT_MIN_DEPTH_MM = 5.0    # staw musi byc co najmniej 5 mm pod skora
TERMINAL_TOL_MM = 20.0      # ogon koncowy: max 20 mm poza powierzchnia

log("%-12s %8s %10s %10s  %s" % ("kosc", "dlug_mm", "glowa_mm", "ogon_mm", "ogon"))
anat = {}
bad_joint = []
bad_term = []
for bn in LIMB:
    b = arm.data.bones[bn]
    h = mw_arm @ b.head_local
    tl = mw_arm @ b.tail_local
    dh, _ = depth_mm(h)
    dt, _ = depth_mm(tl)
    L = (tl - h).length * 1000.0
    tj = tail_is_joint(b)
    anat[bn] = (L, dh, dt)
    log("%-12s %8.1f %10.1f %10.1f  %s"
        % (bn, L, dh, dt, "staw" if tj else "koncowy"))
    if dh > -JOINT_MIN_DEPTH_MM:
        bad_joint.append(("%s.head" % bn, round(dh, 1)))
    if tj and dt > -JOINT_MIN_DEPTH_MM:
        bad_joint.append(("%s.tail" % bn, round(dt, 1)))
    if (not tj) and dt > TERMINAL_TOL_MM:
        bad_term.append(("%s.tail" % bn, round(dt, 1)))

log("\nstawy plycej niz %.0f mm pod skora: %s" % (JOINT_MIN_DEPTH_MM, bad_joint or "brak"))
log("ogony koncowe dalej niz %.0f mm poza siatka: %s" % (TERMINAL_TOL_MM, bad_term or "brak"))
assert not bad_joint, "stawy poza/przy powierzchni siatki: %s" % bad_joint
assert not bad_term, "ogony koncowe za daleko poza siatka: %s" % bad_term
log("OK: %d kosci - kazdy staw >=%.0f mm pod skora, ogony koncowe w normie"
    % (len(LIMB), JOINT_MIN_DEPTH_MM))

# ---- 9b. CENTROWANIE OSI KOSCI W KONCZYNIE --------------------------------
# Kosc moze byc "wewnatrz siatki" i mimo to biec tuz pod skora zamiast srodkiem
# konczyny - wtedy zginanie wyglada nieludzko. Mierzymy: w kilku punktach wzdluz
# kosci bierzemy plaster siatki prostopadly do osi kosci i liczymy
# offset = |punkt_kosci - srodek_plastra| / promien_plastra.
import numpy as np  # noqa: E402
import mathutils    # noqa: E402

VCO = np.empty(len(obj.data.vertices) * 3, dtype=np.float64)
obj.data.vertices.foreach_get("co", VCO)
VCO = VCO.reshape(-1, 3)
MW = np.array(obj.matrix_world.to_4x4())
VW = VCO @ MW[:3, :3].T + MW[:3, 3]


# wierzcholki nalezace do konkretnej kosci: waga > 0.5 w jej grupie.
# Bez tego ograniczenia plaster prostopadly do kosci lapie druga noge i tulow,
# co dawalo bezsensowny "promien uda" 150 mm i offset 330 mm.
VG_BY_NAME = {vg.name: vg.index for vg in obj.vertex_groups}
OWNED = {}
for _v in obj.data.vertices:
    for _g in _v.groups:
        if _g.weight > 0.5 and _g.group in DEFORM_IDX:
            OWNED.setdefault(_g.group, []).append(_v.index)
            break


def axis_centering_shift(bn, shift, nsamp=5):
    b = arm.data.bones[bn]
    gi = VG_BY_NAME.get(bn)
    if gi is None or gi not in OWNED:
        return None
    P = VW[np.array(OWNED[gi])]
    h = np.array(mw_arm @ b.head_local) + shift
    tl = np.array(mw_arm @ b.tail_local) + shift
    ax = tl - h
    L = np.linalg.norm(ax)
    ax = ax / L
    slab = max(0.008, L * 0.09)
    out = []
    for f in np.linspace(0.25, 0.75, nsamp):
        p = h + ax * (L * f)
        d = P - p
        t = d @ ax
        sel = np.abs(t) < slab
        if sel.sum() < 12:
            continue
        perp = d[sel] - np.outer(t[sel], ax)
        c = perp.mean(axis=0)
        rad = np.linalg.norm(perp - c, axis=1).mean()
        if rad < 1e-6:
            continue
        out.append((np.linalg.norm(c), rad, int(sel.sum())))
    if not out:
        return None
    off = np.array([o[0] for o in out])
    rad = np.array([o[1] for o in out])
    return off.max() * 1000.0, rad.mean() * 1000.0, (off / rad).max(), min(o[2] for o in out)


def axis_centering(bn, nsamp=5):
    return axis_centering_shift(bn, np.zeros(3), nsamp)


log("\ncentrowanie osi kosci w konczynie (offset od srodka przekroju / promien):")
log("%-12s %12s %12s %10s %8s" % ("kosc", "max_off_mm", "sr_prom_mm", "off/prom", "n_min"))
# Metryka zaklada, ze kosc siedzi w RURZE. To prawda dla segmentow konczyn.
# Nie jest prawda dla spine_03 (wlasciciel calej klatki piersiowej, jej srodek
# masy lezy daleko od linii kregoslupa -> 1.33), head (czaszka, 1.42) ani
# neck_01 (pierscien z 16 wierzcholkow siegajacy podbrodka -> 2.12). Te trzy
# kosci sa wylaczone z asercji SWIADOMIE, nie dlatego, ze "oblewaja".
#
# PROG 0.65 wyznaczony pomiarem, nie na oko (cal4_centering.py):
#   rig rzeczywisty, 6 segmentow konczyn + stopa + dlon: 0.233 .. 0.544
#   ta sama kosc przesunieta o 30 mm w bok lub w przod:  0.688 .. 0.912
#   przesunieta o 20 mm:                                 0.229 .. 0.674  <- za malo
# Czulosc testu: lapie przesuniecie kosci >= 30 mm, nie lapie <= 20 mm.
# "Kosc uda konczaca sie 5 cm od kolana" (50 mm) daje 0.84..1.09 - zlapane.
CENTER_LIMBS = ["thigh_l", "calf_l", "upperarm_l", "lowerarm_l", "foot_l", "hand_l",
                "thigh_r", "calf_r", "upperarm_r", "lowerarm_r", "foot_r", "hand_r"]
CENTER_INFO_ONLY = ["neck_01", "spine_03", "head"]
CENTER_MAX = 0.65
bad_center = []
center_res = {}
for bn in CENTER_LIMBS:
    r = axis_centering(bn)
    if r is None:
        log("%-12s  (za malo wierzcholkow w plastrze)" % bn)
        continue
    center_res[bn] = r
    log("%-12s %12.1f %12.1f %10.3f %8d" % (bn, r[0], r[1], r[2], r[3]))
    if r[2] > CENTER_MAX:
        bad_center.append((bn, round(r[2], 3)))
log("kosci biegnace poza srodkiem (off/prom > %.2f): %s" % (CENTER_MAX, bad_center or "brak"))
assert not bad_center, "kosci nie biegna srodkiem konczyny: %s" % bad_center
log("OK: wszystkie %d kosci konczyn biegna srodkiem konczyny" % len(CENTER_LIMBS))
log("(poza asercja, zalozenie 'rury' nie obowiazuje):")
for bn in CENTER_INFO_ONLY:
    r = axis_centering(bn)
    if r:
        log("   %-10s off/prom=%.3f  off=%.1f mm  prom=%.1f mm  n=%d"
            % (bn, r[2], r[0], r[1], r[3]))

# ---- proporcje antropometryczne (Drillis & Contini, ulamki wzrostu H) -----
log("\nproporcje wzgledem wzrostu %.4f m (odniesienie: Drillis & Contini 1966)" % H_POST)
REF = {"udo (thigh)": ("thigh_l", 0.245), "podudzie (calf)": ("calf_l", 0.246),
       "ramie (upperarm)": ("upperarm_l", 0.186), "przedramie (lowerarm)": ("lowerarm_l", 0.146)}
log("%-22s %9s %9s %9s" % ("segment", "zmierz", "wzorzec", "delta"))
prop_dev = {}
for label, (bn, ref) in REF.items():
    frac = (anat[bn][0] / 1000.0) / H_POST
    prop_dev[bn] = frac - ref
    log("%-22s %9.4f %9.4f %+9.4f" % (label, frac, ref, frac - ref))

# ---- wysokosci stawow nad podloga -----------------------------------------
log("\nwysokosci stawow nad podloga (ulamek wzrostu):")
ZREF = {"bark (clavicle_l head)": ("clavicle_l", "head", 0.818),
        "biodro (thigh_l head)": ("thigh_l", "head", 0.530),
        "kolano (calf_l head)": ("calf_l", "head", 0.285),
        "kostka (foot_l head)": ("foot_l", "head", 0.039)}
for label, (bn, end, ref) in ZREF.items():
    b = arm.data.bones[bn]
    p = mw_arm @ (b.head_local if end == "head" else b.tail_local)
    frac = (p.z - mn_post[2]) / H_POST
    log("%-26s %7.4f  wzorzec %7.4f  delta %+7.4f" % (label, frac, ref, frac - ref))

# ===========================================================================
# 9d. SAMOKALIBRACJA ASERCJI
#
# Asercja, ktorej nigdy nie widzialem oblewajacej, nic nie znaczy. Kazda
# asercja z sekcji 5/8/9 jest tu puszczana na DANYCH ZLYCH i MUSI oblac.
# Uruchamia sie przy kazdym buildzie, wiec test nie moze zgnic.
# ===========================================================================
hdr("9d. samokalibracja: kazda asercja na zlych danych MUSI oblac")

CAL = []


def must_fail(name, fn, expect_hint):
    try:
        fn()
    except AssertionError as e:
        CAL.append((name, "OBLALA (dobrze)", str(e)[:110]))
        log("  [PASS] %-38s oblala na: %s" % (name, expect_hint))
        return
    CAL.append((name, "PRZESZLA NA ZLYCH DANYCH", expect_hint))
    raise AssertionError("ASERCJA-TAUTOLOGIA: '%s' nie oblala na %s" % (name, expect_hint))


# --- (1) wzrost: figura neutralna (domyslne makro) musi oblac ---------------
_neutral = HumanService.create_human()      # macro_detail_dict=None -> same 0.5
_nb = evaluated_body_bbox(_neutral)
H_NEUTRAL = _nb[2][2] - _nb[1][2]
log("  figura neutralna (wszystkie makra 0.5): wzrost %.4f m" % H_NEUTRAL)
must_fail("wzrost == 1,80 m +/- 0,02",
          lambda: (_ for _ in ()).throw(AssertionError("neutral %.4f" % H_NEUTRAL))
          if abs(H_NEUTRAL - TARGET_HEIGHT_M) >= HEIGHT_TOL_M else None,
          "figurze neutralnej %.4f m" % H_NEUTRAL)
bpy.data.objects.remove(_neutral, do_unlink=True)

# --- (2) glebokosc stawu: kosc wypchnieta 120 mm w bok musi oblac -----------
_b = arm.data.bones["thigh_l"]
_shifted = mw_arm @ _b.head_local + mathutils.Vector((0.120, 0, 0))
_d, _ = depth_mm(_shifted)
log("  thigh_l.head przesunieta o 120 mm w bok: glebokosc %+.1f mm" % _d)
must_fail("staw >= 5 mm pod skora",
          lambda: (_ for _ in ()).throw(AssertionError("%.1f mm" % _d))
          if _d > -JOINT_MIN_DEPTH_MM else None,
          "kosci wypchnietej 120 mm w bok (%.1f mm)" % _d)

# --- (3) centrowanie: kosc przesunieta o 30 mm musi oblac -------------------
_bad = {}
for _bn in ["thigh_l", "calf_l", "upperarm_l", "lowerarm_l"]:
    _sh = axis_centering_shift(_bn, np.array([0.030, 0.0, 0.0]))
    _bad[_bn] = round(_sh[2], 3)
log("  off/prom po przesunieciu kosci o 30 mm w bok: %s" % _bad)
log("  off/prom rig rzeczywisty:                     %s"
    % {k: round(center_res[k][2], 3) for k in _bad})
must_fail("off/prom <= %.2f" % CENTER_MAX,
          lambda: (_ for _ in ()).throw(AssertionError(str(_bad)))
          if max(_bad.values()) > CENTER_MAX else None,
          "rigu z kosciami przesunietymi o 30 mm (max %.3f)" % max(_bad.values()))

# --- (4) material: doubleSided/BLEND/alphaClip musi oblac ------------------
_m2 = bpy.data.materials.new("cal_bad_skin")
_m2.use_nodes = True
_m2.use_backface_culling = False
if hasattr(_m2, "blend_method"):
    try:
        _m2.blend_method = 'BLEND'
    except Exception:
        pass
_obj2 = obj.copy()
_obj2.data = obj.data.copy()
_obj2.data.materials.clear()
_obj2.data.materials.append(_m2)
bpy.context.scene.collection.objects.link(_obj2)
for _o in bpy.context.scene.objects:
    _o.select_set(False)
_obj2.select_set(True)
bpy.context.view_layer.objects.active = _obj2
_badglb = os.path.join(WORK, "cal_bad_material.glb")
bpy.ops.export_scene.gltf(filepath=_badglb, export_format='GLB', use_selection=True,
                          export_skins=False, export_morph=False, export_yup=True,
                          export_apply=False, export_materials='EXPORT',
                          export_animations=False, export_texcoords=False)
_GB, _, _ = glb_json(_badglb)
_MB = _GB["materials"][0]
log("  material kontrolny w GLB: %s" % json.dumps(_MB, sort_keys=True))
must_fail("material OPAQUE + doubleSided=false",
          lambda: (_ for _ in ()).throw(AssertionError(json.dumps(_MB)))
          if (_MB.get("doubleSided", False) or _MB.get("alphaMode", "OPAQUE") != "OPAQUE")
          else None,
          "materiale doubleSided/BLEND (doubleSided=%s alphaMode=%s)"
          % (_MB.get("doubleSided", False), _MB.get("alphaMode", "OPAQUE")))
bpy.data.objects.remove(_obj2, do_unlink=True)

# --- (5) liczba jointow: eksport bez skinow musi oblac ---------------------
log("  joints w GLB bez export_skins: %d (w wlasciwym: %d)"
    % (len(_GB.get("skins", [])), len(skin["joints"])))
must_fail("skin ma %d jointow" % len(arm.data.bones),
          lambda: (_ for _ in ()).throw(AssertionError("brak skins"))
          if not _GB.get("skins") else None,
          "GLB wyeksportowanym z export_skins=False (skins=%d)" % len(_GB.get("skins", [])))

log("\n%d/%d asercji udowodnilo, ze potrafi oblac" % (len(CAL), len(CAL)))

# ===========================================================================
# 10. ZAPIS .blend + META
# ===========================================================================
hdr("10. zapis")
BLEND = os.path.join(WORK, "npc_body.blend")
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
log("blend:", BLEND, os.path.getsize(BLEND), "B")

META = {
    "macro": MACRO, "rig": RIG_NAME, "bones": len(arm.data.bones),
    "height_blender_m": round(H_POST, 5), "height_glb_m": round(GLB_H, 5),
    "verts_blender": len(obj.data.vertices), "verts_glb": acc_pos["count"],
    "tris": n_idx // 3, "glb_bytes": GSIZE,
    "bone_names": sorted(b.name for b in arm.data.bones),
    "anat_mm": {k: [round(x, 2) if x is not None else None for x in v] for k, v in anat.items()},
}
with open(os.path.join(WORK, "npc_body_meta.json"), "w") as f:
    json.dump(META, f, indent=1)
log("meta:", os.path.join(WORK, "npc_body_meta.json"))

# ===========================================================================
# 11. (opcja) RENDERY KONTROLNE - CYCLES CPU
# ===========================================================================
if os.environ.get("NPC_RENDER") == "1":
    hdr("11. rendery kontrolne (Cycles CPU)")
    import mathutils

    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = int(os.environ.get("NPC_SAMPLES", "64"))
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 400
    sc.render.resolution_y = 600
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False

    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.055, 0.07, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    def area(name, loc, rot, size, energy):
        d = bpy.data.lights.new(name, 'AREA')
        d.size = size
        d.energy = energy
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        sc.collection.objects.link(o)
        return o

    area("key",  (2.6, -2.6, 2.7), (math.radians(58), 0, math.radians(45)), 2.0, 900)
    area("fill", (-2.8, -1.6, 1.4), (math.radians(80), 0, math.radians(-60)), 2.5, 220)
    area("rim",  (-1.2, 3.0, 2.4), (math.radians(120), 0, math.radians(200)), 2.0, 700)

    cd = bpy.data.cameras.new("cam")
    cd.lens = 70
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam

    def aim(dist, ang_deg, height=0.95, target_z=0.95):
        a = math.radians(ang_deg)
        cam.location = (dist * math.sin(a), -dist * math.cos(a), height)
        v = mathutils.Vector((0, 0, target_z)) - mathutils.Vector(cam.location)
        cam.rotation_euler = v.to_track_quat('-Z', 'Y').to_euler()

    def set_pose(pose):
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = (0, 0, 0)
        for bn, rot in pose.items():
            pb = arm.pose.bones[bn]
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = [math.radians(x) for x in rot]
        bpy.context.view_layer.update()

    BENT = {"thigh_l": (-45, 0, 0), "calf_l": (75, 0, 0), "foot_l": (-25, 0, 0),
            "thigh_r": (18, 0, 0), "calf_r": (-12, 0, 0),
            "upperarm_r": (0, 0, -35), "lowerarm_r": (0, 0, -70),
            "upperarm_l": (0, 0, 20), "lowerarm_l": (0, 0, -25),
            "spine_02": (-6, 0, 0), "neck_01": (8, 0, 0), "head": (5, 0, 12)}

    shots = [("tpose_front", {}, 4.6, 0.0), ("tpose_side", {}, 4.6, 90.0),
             ("bent_front", BENT, 4.2, 15.0), ("bent_side", BENT, 4.2, 95.0)]
    for name, pose, dist, ang in shots:
        set_pose(pose)
        aim(dist, ang)
        p = os.path.join(WORK, "render_%s.png" % name)
        sc.render.filepath = p
        tr = time.time()
        bpy.ops.render.render(write_still=True)
        log("render %-12s %s  %d B  %.1f s" % (name, p, os.path.getsize(p), time.time() - tr))
    set_pose({})

hdr("KONIEC")
log("CALKOWITY CZAS SKRYPTU: %.2f s" % (time.time() - T_START))
