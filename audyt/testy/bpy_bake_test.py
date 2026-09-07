import bpy, time, os, sys
t0=time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
src=os.path.abspath("../assets_src/models/Barrel_01/Barrel_01.gltf")
bpy.ops.import_scene.gltf(filepath=src)
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
print("imported meshes:", [(o.name, len(o.data.polygons)) for o in objs])
sc=bpy.context.scene
sc.render.engine='CYCLES'
sc.cycles.device='CPU'
sc.cycles.samples=32
sc.cycles.use_denoising=False
# AO bake into new image via existing UVs
for o in objs:
    bpy.context.view_layer.objects.active=o; o.select_set(True)
img=bpy.data.images.new("bake_ao", 512, 512)
for o in objs:
    for mat in o.data.materials:
        if not mat or not mat.use_nodes: continue
        nt=mat.node_tree; node=nt.nodes.new('ShaderNodeTexImage'); node.image=img; nt.nodes.active=node
sc.render.bake.use_selected_to_active=False
t1=time.time()
bpy.ops.object.bake(type='AO', margin=4, use_clear=True)
t2=time.time()
out=os.path.abspath("out/barrel_ao_bake.png"); img.filepath_raw=out; img.file_format='PNG'; img.save()
# export glb
bpy.ops.export_scene.gltf(filepath=os.path.abspath("out/barrel_from_blender.glb"), export_format='GLB')
print(f"import {t1-t0:.1f}s, bake AO 512px 32spp {t2-t1:.1f}s, total {time.time()-t0:.1f}s")
print("out exists:", os.path.exists(out), os.path.getsize(out))
