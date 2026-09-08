# RENDER KONTROLNY BLENDERA (nie jest to render gry!) — sprawdzenie kształtu modelu przed integracją.
import bpy, os, math, time, sys
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'blender')
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'kram_etap1.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = int(sys.argv[1]) if len(sys.argv) > 1 else 48
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 900, 900
sc.render.film_transparent = False
# słońce z tego samego kierunku co w grze: sunDir (0.4976, 0.5, 0.7088) w układzie three.js (y w górę)
# → w Blenderze (z w górę): x 0.4976, y -0.7088, z 0.5  (three.js +z = Blender -y)
import mathutils
d = mathutils.Vector((0.4976, -0.7088, 0.5)).normalized()
sun = bpy.data.lights.new('slonce', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.5)
so = bpy.data.objects.new('slonce', sun); sc.collection.objects.link(so)
so.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
w = bpy.data.worlds.new('niebo'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.42, 0.52, 0.68, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
# bruk pod kramem, żeby było widać cień kontaktowy
bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, 0))
g = bpy.context.object
gm = bpy.data.materials.new('bruk'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.30, 0.30, 0.30, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
g.data.materials.append(gm)
cam_d = bpy.data.cameras.new('kam'); cam_d.lens = 30
cam = bpy.data.objects.new('kam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
POS = {'front': ((0.0, 3.4, 1.62), (0, 0, 1.35)), 'skos': ((2.5, 2.9, 1.75), (0, 0, 1.30))}
name = sys.argv[2] if len(sys.argv) > 2 else 'front'
p, look = POS[name]
cam.location = p
cam.rotation_euler = (mathutils.Vector(p) - mathutils.Vector(look)).to_track_quat('Z', 'Y').to_euler()
sc.render.filepath = os.path.join(OUT, f'BLENDER_kram_{name}.png')
t = time.time(); bpy.ops.render.render(write_still=True)
print(f'RENDER BLENDERA gotowy: {sc.render.filepath} w {time.time()-t:.1f} s')
