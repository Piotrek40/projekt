#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
npc_mocap.py — wybor, normalizacja i eksport klipow mocap ACCAD pod NPC na rynku.

Zrodlo ruchu: ACCAD Open Motion Project (Ohio State University), licencja CC-BY 3.0.
Atrybucja obowiazkowa — patrz audyt/research/mocap_npc.md.

Etapy (kazdy osobno, przez argument):
    python3 npc_mocap.py --scan          # inwentaryzacja 299 plikow BVH (czysty Python, bez bpy)
    python3 npc_mocap.py --anthro        # wzrost podmiotow z dlugosci kosci -> global_scale
    python3 npc_mocap.py --cycle         # wyciecie i domkniecie cyklu chodu -> BVH
    python3 npc_mocap.py --export        # import BVH -> decymacja 30 fps -> GLB (wymaga bpy)
    python3 npc_mocap.py --optimize      # resample+prune (gltf-transform): -56% bajtow
    python3 npc_mocap.py --decim-demo    # dowod, ze decymacja 120->30 fps dziala
    python3 npc_mocap.py --trap3         # dowod na pulapke update_scene_fps
    python3 npc_mocap.py --verify        # odczyt naglowkow JSON z GLB

Pulapki, ktore ten skrypt omija swiadomie:
  * import_anim.bvh BEZ update_scene_fps=True -> eksporter glTF liczy czas przez
    scene.render.fps (domyslnie 24). Klip 30 fps wychodzi 24/30 = 0.8x. Patrz --trap3.
  * export_def_bones / export_armature_object_remove — NIE uzywane (patrz nota w kodzie).
"""
import os, sys, json, math, struct, argparse

BASE   = os.path.dirname(os.path.abspath(__file__))
SCRATCH= '/tmp/claude-0/-home-user-projekt/51bf51f1-3a2c-5752-acdf-ae27d700e1e0/scratchpad'
ACCAD  = os.path.join(SCRATCH, 'npc_research', 'accad')
OUT    = os.path.join(SCRATCH, 'npc_build', 'mocap')
GLB    = os.path.join(OUT, 'glb')

# ---------------------------------------------------------------- USTALENIA
# Podmiot: Male1. Uzasadnienie liczbowe w audyt/research/mocap_npc.md:
#   - zgodnosc antropometryczna 2.5% (Female1: 20.4%, bo udo/podudzie = 1.22 zamiast ~1.0)
#   - 69/69 plikow @ 30 fps, 69/69 z pelnymi 22 komi (Male2 miesza 30 i 120 fps i ma 3 pliki
#     bez jointa ToSpine)
#   - wzrost 1.882 m, praktycznie rowny cialu MPFB 1.856 m -> retarget bez skalowania
SUBJECT     = 'Male1'
GLOBAL_SCALE= 0.01          # jednostki BVH to centymetry
TARGET_FPS  = 30

# cykl chodu: klatki [A, B] w Male1_B3_Walk.bvh (kontakt piety lewej -> kolejny kontakt)
WALK_SRC, WALK_A, WALK_B = 'Male1_B3_Walk.bvh', 47, 80
WALK_FIX_K  = 22            # ile ostatnich klatek cyklu absorbuje reszte szwu (dobrane pomiarem)

CLIPS = [
    # (plik zrodlowy,                     nazwa klipu,        rola,                          przyciecie klatek)
    ('Male1_A2_Sway.bvh',                 'idle_sway',        'idle dlugie, przenoszenie ciezaru', None),
    ('Male1_A4_LookAround.bvh',           'idle_lookaround',  'rozgladanie sie',                   None),
    ('Male1_A3_SwingArms.bvh',            'idle_arms',        'idle krotkie, korzen calkiem nieruchomy', None),
    ('__CYCLE__',                         'walk_cycle',       'chod petlowy, jeden pelny cykl',    None),
    # przyciecia w klatkach BVH, dobrane pomiarem: granice to kontakty piety LEWEJ,
    # zeby zlacze z walk_cycle wypadalo w tej samej fazie kroku (patrz mocap_npc.md)
    ('Male1_B1_StandToWalk.bvh',          'stand_to_walk',    'wejscie w chod',                    (45, 172)),
    ('Male1_B2_WalkToStand.bvh',          'walk_to_stand',    'wyjscie z chodu',                   (24, 210)),
]
# klip TYLKO do kalibracji, nie wchodzi do gry: ten sam cykl bez naprawy szwu
CLIP_RAW = ('__CYCLE_RAW__', 'walk_cycle_raw', 'kalibracja: cykl bez naprawy szwu', None)

# ============================================================ 1. PARSER BVH
def parse_header(path):
    joints=[]; parents=[]; offsets=[]; chans=[]; ends=[]; stack=[]; nf=None; dt=None
    with open(path,'r',errors='replace') as f:
        for line in f:
            s=line.strip()
            if not s: continue
            w=s.split(); k=w[0]
            if k in ('ROOT','JOINT'):
                joints.append(w[1]); parents.append(stack[-1] if stack else -1)
                stack.append(len(joints)-1); offsets.append(None); chans.append(None)
            elif k=='End':
                ends.append([stack[-1],None]); stack.append(-2)
            elif k=='OFFSET':
                o=[float(x) for x in w[1:4]]
                if stack and stack[-1]==-2: ends[-1][1]=o
                else: offsets[stack[-1]]=o
            elif k=='CHANNELS': chans[stack[-1]]=w[2:]
            elif k=='}':
                if stack: stack.pop()
            elif k=='MOTION':
                nf=int(next(f).split()[-1]); dt=float(next(f).split()[-1]); break
    return dict(path=path,joints=joints,parents=parents,offsets=offsets,chans=chans,ends=ends,
                nframes=nf,frame_time=dt,duration=(nf-1)*dt if nf else None,nbones=len(joints))

def parse_full(path):
    import numpy as np
    h=parse_header(path); rows=[]
    with open(path,'r',errors='replace') as f:
        seen=False
        for line in f:
            if seen:
                if line.strip(): rows.append(line.split())
            elif line.strip().startswith('Frame Time'): seen=True
    h['data']=np.array(rows,dtype=float); return h

def _R(axis,deg):
    import numpy as np
    r=np.radians(deg); c=np.cos(r); s=np.sin(r); M=np.zeros((len(r),3,3))
    M[:,0,0]=M[:,1,1]=M[:,2,2]=1.0
    if axis=='X': M[:,1,1]=c; M[:,1,2]=-s; M[:,2,1]=s; M[:,2,2]=c
    elif axis=='Y': M[:,0,0]=c; M[:,0,2]=s; M[:,2,0]=-s; M[:,2,2]=c
    elif axis=='Z': M[:,0,0]=c; M[:,0,1]=-s; M[:,1,0]=s; M[:,1,1]=c
    return M

def fk(h):
    import numpy as np
    J=h['joints']; par=h['parents']; off=h['offsets']; ch=h['chans']; D=h['data']
    nf=D.shape[0]; nb=len(J)
    pos=np.zeros((nf,nb,3)); Rg=np.zeros((nf,nb,3,3)); col=0
    for j in range(nb):
        loc=np.tile(np.array(off[j],float),(nf,1)); Rj=np.tile(np.eye(3),(nf,1,1))
        for c in ch[j]:
            v=D[:,col]; col+=1
            if   c=='Xposition': loc[:,0]=v
            elif c=='Yposition': loc[:,1]=v
            elif c=='Zposition': loc[:,2]=v
            else: Rj=Rj@_R(c[0],v)
        p=par[j]
        if p<0: pos[:,j]=loc; Rg[:,j]=Rj
        else:
            pos[:,j]=pos[:,p]+np.einsum('nij,nj->ni',Rg[:,p],loc); Rg[:,j]=Rg[:,p]@Rj
    h['pos']=pos; h['R']=Rg
    h['tips']={J[pi]+'_End': pos[:,pi]+np.einsum('nij,j->ni',Rg[:,pi],np.array(o,float))
               for pi,o in h['ends']}
    return h

def local_R(h):
    import numpy as np
    Rg=h['R']; par=h['parents']; Rl=np.empty_like(Rg)
    for j in range(Rg.shape[1]):
        p=par[j]
        Rl[:,j]= Rg[:,j] if p<0 else np.einsum('nji,njk->nik',Rg[:,p],Rg[:,j])
    return Rl

def geo(Ra,Rb):
    import numpy as np
    M=np.einsum('...ji,...jk->...ik',Ra,Rb)
    return np.degrees(np.arccos(np.clip((np.trace(M,axis1=-2,axis2=-1)-1)/2,-1,1)))

def write_bvh(h, data, path, frame_time):
    """Zapis naglowka zrodlowego + podanej macierzy MOTION."""
    src=open(h['path'],errors='replace').read()
    head=src.split('MOTION')[0]
    with open(path,'w') as f:
        f.write(head); f.write('MOTION\n')
        f.write('Frames: %d\n' % data.shape[0])
        f.write('Frame Time: %.7f\n' % frame_time)
        for r in data: f.write(' '.join('%.6f'%v for v in r)+'\n')
    return path

# ============================================================ 2. KONTAKT / CHOD
def contacts(h, h_thr=0.09, v_thr=0.35):
    import numpy as np
    T=h['tips']; Jm={n:i for i,n in enumerate(h['joints'])}; P=h['pos']; dt=h['frame_time']
    fl=min(T['LeftToeBase_End'][:,1].min(),T['RightToeBase_End'][:,1].min())
    H=float(T['Head_End'][:,1].max()-fl); out={}
    for s in ('Left','Right'):
        c=np.zeros(P.shape[0],bool)
        for Pt in (P[:,Jm[s+'Foot']], T[s+'ToeBase_End']):
            sp=np.linalg.norm(np.gradient(Pt,dt,axis=0)[:,[0,2]],axis=1)*GLOBAL_SCALE
            c |= (((Pt[:,1]-fl)/H)<h_thr)&(sp<v_thr)
        out[s]=c
    return out,H,fl

def runs(m,minlen=2):
    r=[];i=0
    while i<len(m):
        if m[i]:
            j=i
            while j<len(m) and m[j]: j+=1
            if j-i>=minlen: r.append((i,j))
            i=j
        else: i+=1
    return r

def heel_strikes(h, side='Left'):
    """Zeni et al. 2008: kontakt piety = maksimum (stopa - miednica) wzdluz kierunku marszu."""
    import numpy as np
    Jm={n:i for i,n in enumerate(h['joints'])}; P=h['pos']; dt=h['frame_time']; nf=P.shape[0]
    hip=P[:,Jm['Hips']]; d=(hip[-1]-hip[0])*np.array([1,0,1])
    n=np.linalg.norm(d)
    if n<1e-6: return [],d
    d=d/n; r=(P[:,Jm[side+'Foot']]-hip)@d; w=max(2,int(0.20/dt))
    out=[]
    for i in range(w,nf-w):
        if r[i]==r[i-w:i+w+1].max():
            if not out or i-out[-1]>int(0.4/dt): out.append(i)
            elif r[i]>r[out[-1]]: out[-1]=i
    return out,d

# ============================================================ 3. ETAPY
def stage_scan():
    import glob, csv, hashlib
    from collections import Counter
    files=sorted(glob.glob(ACCAD+'/*.bvh')); rows=[]; sigs={}
    for p in files:
        h=parse_header(p); sig=','.join(sorted(h['joints']))
        sh=hashlib.md5(sig.encode()).hexdigest()[:8]
        sigs.setdefault(sh,dict(sig=sig,nbones=h['nbones'],files=[]))['files'].append(os.path.basename(p))
        nch=sum(len(c) for c in h['chans'])
        with open(p,errors='replace') as f:
            seen=False; ncols=None
            for line in f:
                if seen and line.strip(): ncols=len(line.split()); break
                if line.strip().startswith('Frame Time'): seen=True
        rows.append(dict(file=os.path.basename(p),subject=os.path.basename(p).split('_')[0],
                         nbones=h['nbones'],sig=sh,nframes=h['nframes'],frame_time=h['frame_time'],
                         fps=round(1/h['frame_time'],4),duration=round(h['duration'],4),
                         nchan=nch,ncols=ncols,selfcheck=(nch==ncols)))
    os.makedirs(OUT,exist_ok=True)
    with open(os.path.join(OUT,'inwentarz.csv'),'w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    print('plikow BVH:',len(rows))
    print('samokontrola (suma CHANNELS == liczba kolumn MOTION) nieudana dla:',
          sum(0 if r['selfcheck'] else 1 for r in rows),'plikow')
    for sh,v in sorted(sigs.items(),key=lambda kv:-len(kv[1]['files'])):
        print(f"  sygnatura {sh}: {v['nbones']} kosci, {len(v['files'])} plikow"
              + ('' if len(v['files'])>5 else '  '+str(v['files'])))
    ks=list(sigs)
    if len(ks)==2:
        a=set(sigs[ks[0]]['sig'].split(',')); b=set(sigs[ks[1]]['sig'].split(','))
        print('  roznica sygnatur:',sorted(a^b))
    for ft,n in sorted(Counter(r['frame_time'] for r in rows).items()):
        print(f"  Frame Time {ft} = {1/ft:.0f} fps : {n} plikow")
    for s in sorted({r['subject'] for r in rows}):
        g=[r for r in rows if r['subject']==s]
        print(f"  {s}: {len(g)} plikow, fps={sorted({r['fps'] for r in g})}, "
              f"kosci={sorted({r['nbones'] for r in g})}, lacznie {sum(r['duration'] for r in g):.1f}s")
    print('zapisano',os.path.join(OUT,'inwentarz.csv'))

def stage_anthro():
    """Wzrost z dlugosci segmentow (Winter): udo=0.245H, kretarz=0.530H, podudzie=0.246H."""
    import numpy as np
    for subj,fn in (('Female1','Female1_A01_Stand.bvh'),('Male1','Male1_A1_Stand.bvh'),
                    ('Male2','Male2_A1_Stand.bvh')):
        h=fk(parse_full(os.path.join(ACCAD,fn))); Jm={n:i for i,n in enumerate(h['joints'])}
        L=lambda n: float(np.linalg.norm(h['offsets'][Jm[n]]))
        femur=(L('LeftLeg')+L('RightLeg'))/2; tibia=(L('LeftFoot')+L('RightFoot'))/2
        hy=h['pos'][:,Jm['LeftUpLeg'],1]; sel=np.argsort(hy)[-max(1,len(hy)//10):]
        fl=min(h['tips']['LeftToeBase_End'][:,1].min(),h['tips']['RightToeBase_End'][:,1].min())
        troch=float(hy[sel].mean()-fl); head=float(h['tips']['Head_End'][sel,1].mean()-fl)
        H=[femur/0.245, troch/0.530, tibia/0.246]; Hm=float(np.mean(H))
        print(f"{subj:<8} udo={femur:6.2f} podudzie={tibia:6.2f} kretarz={troch:6.2f} czubek={head:6.2f} (j.BVH)")
        print(f"         H_udo={H[0]:6.2f} H_kretarz={H[1]:6.2f} H_podudzie={H[2]:6.2f} "
              f"rozrzut={max(H)-min(H):5.2f} ({100*(max(H)-min(H))/Hm:4.1f}%)")
        print(f"         udo/H={femur/Hm:.4f} (cel 0.245)  kretarz/H={troch/Hm:.4f} (cel 0.530)  "
              f"=> wzrost @ global_scale={GLOBAL_SCALE}: {Hm*GLOBAL_SCALE:.4f} m")

def stage_cycle():
    """Wycina cykl chodu, domyka petle, zapisuje BVH. Zwraca sciezke."""
    import numpy as np
    h=fk(parse_full(os.path.join(ACCAD,WALK_SRC))); Rl=local_R(h); Jn=h['joints']
    dt=h['frame_time']; A,B=WALK_A,WALK_B; N=B-A
    hs,_=heel_strikes(h)
    print(f'{WALK_SRC}: kontakty piety lewej (Zeni 2008) = {hs}  ({[round(i*dt,3) for i in hs]} s)')
    assert A in hs and B in hs, 'A i B musza byc kontaktami piety lewej'
    ch=[(j,c) for j,cs in enumerate(h['chans']) for c in cs]
    U=h['data'].copy()
    for k,(j,c) in enumerate(ch):
        if c.endswith('rotation'): U[:,k]=np.degrees(np.unwrap(np.radians(U[:,k])))
    res=U[A]-U[B]
    per=geo(Rl[:-1],Rl[1:])
    seam0=float(geo(Rl[A],Rl[B]).max())
    print(f'cykl {A}..{B} = {N} kl = {N*dt:.3f} s;  szew przed naprawa {seam0:.3f} st;  '
          f'mediana zmiany klatka->klatka {float(np.median(per[per>1e-9])):.3f} st')
    w=np.zeros(N+1); i=np.arange(N+1); m=i>=(N-WALK_FIX_K)
    t=(i[m]-(N-WALK_FIX_K))/WALK_FIX_K; w[m]=t*t*(3-2*t)     # smoothstep
    F=U[A:B+1].copy()
    for k,(j,c) in enumerate(ch):
        if c in ('Xposition','Zposition'): continue          # krok w przod musi zostac
        F[:,k]+=w*res[k]
    g=dict(h); g['data']=F; fk(g); Rf=local_R(g)
    print(f'szew po naprawie (okno K={WALK_FIX_K} kl): {float(geo(Rf[0],Rf[-1]).max()):.2e} st')
    # Zapisujemy WSZYSTKIE N+1 klatek: ostatnia jest teraz identyczna z pierwsza.
    # Dzieki temu czas klipu w glTF = N*dt = pelny okres cyklu, a AnimationMixer w three.js
    # zawija czas modulo duration i trafia dokladnie w poze poczatkowa (brak zgubionej klatki).
    os.makedirs(OUT,exist_ok=True)
    # wersja SUROWA (bez naprawy) — sluzy wylacznie jako punkt odniesienia w kalibracji:
    # w three.js musi pokazac szew ~6.3 st tam, gdzie naprawiona pokazuje ~0.
    write_bvh(h,U[A:B+1],os.path.join(OUT,'Male1_walk_cycle_raw.bvh'),dt)
    p=write_bvh(h,F,os.path.join(OUT,'Male1_walk_cycle.bvh'),dt)
    print(f'zapisano {p}: {F.shape[0]} klatek, okres {N*dt:.4f} s przy {1/dt:.0f} fps '
          f'(pierwsza i ostatnia klatka identyczne)')
    return p

# ============================================================ 4. BPY
def _reset():
    import bpy, addon_utils
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in ('io_anim_bvh','io_scene_gltf2'):        # PULAPKA 1: reset gasi addony
        addon_utils.enable(m, default_set=False, persistent=True)

def _fcurves(obj):
    """Blender 5.0: akcje slotowane, brak action.fcurves."""
    ad=obj.animation_data
    if not ad or not ad.action: return []
    act=ad.action
    if not act.layers: return []
    cb=act.layers[0].strips[0].channelbag(ad.action_slot)
    return list(cb.fcurves) if cb else []

def _trim_rebase(obj, a=None, b=None):
    """Usuwa keyframe'y poza [a,b] (w klatkach BVH, 0-indeksowanych) i przesuwa pozostale tak,
    by pierwsza byla w klatce 0. Dzieki temu klip w glTF zaczyna sie w t=0 — bez tego eksporter
    zostawia martwy odcinek na poczatku (zmierzone: stand_to_walk startowal w t=1.5333 s)."""
    import bpy
    fcs=_fcurves(obj)
    f0=min(min(k.co[0] for k in f.keyframe_points) for f in fcs)   # klatka BVH 0 == f0
    if a is not None:
        lo,hi=f0+a, f0+b
        for f in fcs:
            rm=[k for k in f.keyframe_points if k.co[0]<lo-1e-6 or k.co[0]>hi+1e-6]
            for k in reversed(rm): f.keyframe_points.remove(k, fast=True)
            f.update()
        f0=lo
    for f in fcs:
        for k in f.keyframe_points:
            k.co[0]-=f0; k.handle_left[0]-=f0; k.handle_right[0]-=f0
        f.update()
    f1=max(max(k.co[0] for k in f.keyframe_points) for f in fcs)
    n=min(len(f.keyframe_points) for f in fcs)
    bpy.context.scene.frame_start=0; bpy.context.scene.frame_end=int(round(f1))
    return int(round(f1)), n

def _decimate(obj, src_fps, dst_fps):
    """Decymacja przez USUWANIE keyframe'ow. Zwraca (przed, po, krok)."""
    import bpy
    step=int(round(src_fps/dst_fps))
    fcs=_fcurves(obj); before=sum(len(f.keyframe_points) for f in fcs)
    if step<=1: return before,before,1
    f0=min(min(k.co[0] for k in f.keyframe_points) for f in fcs)
    for f in fcs:
        rm=[k for k in f.keyframe_points if int(round(k.co[0]-f0))%step!=0]
        for k in reversed(rm): f.keyframe_points.remove(k, fast=True)
        for k in f.keyframe_points: k.co[0]=f0+(k.co[0]-f0)/step
        f.update()
    after=sum(len(f.keyframe_points) for f in fcs)
    bpy.context.scene.render.fps=dst_fps
    f1=max(max(k.co[0] for k in f.keyframe_points) for f in fcs)
    bpy.context.scene.frame_start=int(round(f0)); bpy.context.scene.frame_end=int(round(f1))
    return before,after,step

def _import_bvh(path, update_fps=True):
    import bpy
    bpy.ops.import_anim.bvh(filepath=path, global_scale=GLOBAL_SCALE,
                            update_scene_fps=update_fps, use_fps_scale=False,
                            rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
    obj=bpy.context.selected_objects[0]
    # PULAPKA (zlapana pomiarem): po read_factory_settings zakres sceny to 1..250 i import BVH
    # go NIE rozszerza. Eksporter glTF z export_frame_range=True obcialby dluzsze klipy do 250
    # klatek, a krotsze DOPELNIL do 250 — bez zadnego komunikatu. Ustawiamy zakres z keyframe'ow.
    fcs=_fcurves(obj)
    f0=min(min(k.co[0] for k in f.keyframe_points) for f in fcs)
    f1=max(max(k.co[0] for k in f.keyframe_points) for f in fcs)
    bpy.context.scene.frame_start=int(round(f0)); bpy.context.scene.frame_end=int(round(f1))
    return obj

def _export_glb(obj, out, name):
    import bpy
    obj.animation_data.action.name=name
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS', export_frame_range=True,
        export_force_sampling=True,          # bez tego czesc ustawien animacji jest ignorowana
        export_skins=False, export_morph=False, export_materials='NONE',
        export_lights=False, export_cameras=False, export_yup=True,
        export_apply=False, export_optimize_animation_size=False)
    return os.path.getsize(out)

def stage_export():
    import bpy, numpy as np
    os.makedirs(GLB,exist_ok=True)
    cyc=os.path.join(OUT,'Male1_walk_cycle.bvh')
    if not os.path.exists(cyc): stage_cycle()
    rep=[]
    for src,name,rola,trim in CLIPS+[CLIP_RAW]:
        p = (cyc if src=='__CYCLE__' else
             os.path.join(OUT,'Male1_walk_cycle_raw.bvh') if src=='__CYCLE_RAW__' else
             os.path.join(ACCAD,src))
        h = parse_header(p); _reset()
        arm=_import_bvh(p)
        sc=bpy.context.scene
        fcs=_fcurves(arm); nk=sum(len(f.keyframe_points) for f in fcs)
        print(f"\n--- {name}  <- {os.path.basename(p)}")
        print(f"    BVH: {h['nframes']} kl @ {1/h['frame_time']:.0f} fps = {h['duration']:.4f} s")
        print(f"    po imporcie: scene.fps={sc.render.fps} zakres {sc.frame_start}..{sc.frame_end}, "
              f"kosci={len(arm.data.bones)}, fcurve={len(fcs)}, keyframe={nk}")
        assert sc.render.fps==round(1/h['frame_time']), \
            'update_scene_fps nie zadzialalo — PULAPKA 3'
        b4,af,st=_decimate(arm, sc.render.fps, TARGET_FPS)
        if st>1: print(f"    decymacja {b4} -> {af} keyframe (krok {st})")
        ta,tb=(trim[0]//st, trim[1]//st) if trim else (None,None)
        f1,nk2=_trim_rebase(arm, ta, tb)
        print(f"    po przycieciu/przesunieciu: klatki 0..{f1}, {nk2} keyframe na fcurve, "
              f"czas {f1/sc.render.fps:.4f} s" + (f"  (z klatek BVH {trim[0]}..{trim[1]})" if trim else ""))
        dur=(sc.frame_end-sc.frame_start)/sc.render.fps
        out=os.path.join(GLB,name+'.glb')
        sz=_export_glb(arm,out,name)
        print(f"    GLB: {out}  {sz} B ({sz/1024:.1f} kB), oczekiwany czas {dur:.4f} s")
        rep.append(dict(name=name,src=os.path.basename(p),rola=rola,glb=out,bytes=sz,
                        bvh_frames=h['nframes'],bvh_fps=round(1/h['frame_time']),
                        bvh_duration=round(h['duration'],4),expected_duration=round(dur,4),
                        bones=len(arm.data.bones)))
    json.dump(rep,open(os.path.join(OUT,'eksport.json'),'w'),indent=1)
    print('\nlacznie',sum(r['bytes'] for r in rep),'B');  print('zapisano',os.path.join(OUT,'eksport.json'))

def stage_decim_demo():
    """Dowod, ze decymacja 120->30 fps naprawde usuwa keyframe'y i zachowuje czas."""
    import bpy
    p=os.path.join(ACCAD,'Male2_B3_Walk.bvh'); h=parse_header(p)
    _reset(); arm=_import_bvh(p); sc=bpy.context.scene
    print(f"BVH {os.path.basename(p)}: {h['nframes']} kl @ {1/h['frame_time']:.0f} fps = {h['duration']:.4f} s")
    print(f"po imporcie: scene.fps={sc.render.fps}, zakres {sc.frame_start}..{sc.frame_end}")
    b4,af,st=_decimate(arm,sc.render.fps,TARGET_FPS)
    print(f"decymacja krok={st}: keyframe {b4} -> {af} (stosunek {b4/af:.3f}, oczekiwany ~{st})")
    print(f"po decymacji: scene.fps={sc.render.fps}, zakres {sc.frame_start}..{sc.frame_end}, "
          f"czas {(sc.frame_end-sc.frame_start)/sc.render.fps:.4f} s (oryginal {h['duration']:.4f} s)")

def stage_trap3():
    """Dwa importy tego samego BVH: z update_scene_fps i bez. Rozne GLB, rozny czas."""
    import bpy
    os.makedirs(GLB,exist_ok=True)
    p=os.path.join(ACCAD,'Male1_A3_SwingArms.bvh'); h=parse_header(p)
    print(f"zrodlo: {h['nframes']} kl @ {1/h['frame_time']:.0f} fps = {h['duration']:.4f} s")
    for flag,tag in ((True,'trap3_ok'),(False,'trap3_zle')):
        _reset(); arm=_import_bvh(p,update_fps=flag); sc=bpy.context.scene
        out=os.path.join(GLB,tag+'.glb'); _export_glb(arm,out,tag)
        print(f"  update_scene_fps={flag!s:<5} scene.fps={sc.render.fps:3d}  "
              f"czas w GLB={glb_duration(out):.4f} s  -> {out}")

def stage_optimize():
    """resample + prune przez gltf-transform 4.5.0.
    Eksporter Blendera zapisuje pelne TRS dla kazdej kosci w kazdej klatce; sciezki scale
    i translation (poza Hips) sa stale. resample zwija je do 2 kluczy. Zmierzone: -56% B."""
    import subprocess, shutil
    GT=os.path.join(os.path.dirname(BASE),'tools','node_modules','.bin','gltf-transform')
    OPT=os.path.join(OUT,'glb_opt'); os.makedirs(OPT,exist_ok=True)
    rep=json.load(open(os.path.join(OUT,'eksport.json'))); tot=[0,0]
    for r in rep:
        src=r['glb']; tmp=os.path.join(OPT,r['name']+'.tmp.glb'); dst=os.path.join(OPT,r['name']+'.glb')
        subprocess.run([GT,'resample',src,tmp,'--tolerance','1e-5'],check=True,capture_output=True)
        q=subprocess.run([GT,'prune',tmp,dst],capture_output=True)
        if q.returncode: shutil.copy(tmp,dst)
        os.remove(tmp)
        a=os.path.getsize(src); b=os.path.getsize(dst); tot[0]+=a; tot[1]+=b
        r['glb_opt']=dst; r['bytes_opt']=b
        print(f"  {r['name']:<18}{a:>8} -> {b:>7} B  ({100*b/a:.0f}%)")
    print(f"  RAZEM {tot[0]} -> {tot[1]} B ({100*tot[1]/tot[0]:.0f}%)")
    json.dump(rep,open(os.path.join(OUT,'eksport.json'),'w'),indent=1)

# ============================================================ 5. WERYFIKACJA GLB
def glb_json(path):
    with open(path,'rb') as f:
        magic,ver,total=struct.unpack('<III',f.read(12))
        assert magic==0x46546C67,'to nie jest GLB'
        ln,ty=struct.unpack('<II',f.read(8))
        return json.loads(f.read(ln).decode('utf-8'))

def glb_times(path):
    """(t_min, t_max, liczba probek) po wszystkich samplerach animacji."""
    j=glb_json(path); lo=float('inf'); hi=-float('inf'); n=0
    for a in j.get('animations',[]):
        for s in a['samplers']:
            ac=j['accessors'][s['input']]
            lo=min(lo,float(ac['min'][0])); hi=max(hi,float(ac['max'][0])); n=max(n,ac['count'])
    return lo,hi,n

def glb_duration(path):
    lo,hi,_=glb_times(path); return hi-lo

def stage_verify():
    rep=json.load(open(os.path.join(OUT,'eksport.json')))
    print(f"{'klip':<18}{'bajty':>8}{'anim':>5}{'kanaly':>7}{'wezly':>6}{'probek':>7}"
          f"{'t_min':>7}{'t_max':>8}{'czas GLB':>9}{'czas ocz.':>10}{'blad':>8}  ocena")
    ok=True
    for r in rep:
        j=glb_json(r['glb']); a=j['animations'][0]
        lo,hi,n=glb_times(r['glb']); d=hi-lo; exp=r['expected_duration']
        err=abs(d-exp); good=(err<1e-3) and (lo<1e-6) and len(j['animations'])==1
        ok&=good
        print(f"{r['name']:<18}{r['bytes']:>8}{len(j['animations']):>5}{len(a['channels']):>7}"
              f"{len(j['nodes']):>6}{n:>7}{lo:>7.4f}{hi:>8.4f}{d:>9.4f}{exp:>10.4f}{err:>8.4f}"
              f"  {'OK' if good else 'ZLE'}")
        if abs(d-exp*TARGET_FPS/24)<0.02 and err>1e-3:
            print('    !!! czas = 30/24 oczekiwanego -> PULAPKA 3 (update_scene_fps)')
    print('WYNIK:','wszystkie zgodne' if ok else 'SA ROZBIEZNOSCI')

# ============================================================
if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for s in ('scan','anthro','cycle','export','optimize','decim-demo','trap3','verify'):
        ap.add_argument('--'+s,action='store_true')
    a=ap.parse_args()
    if a.scan: stage_scan()
    if a.anthro: stage_anthro()
    if a.cycle: stage_cycle()
    if a.export: stage_export()
    if a.optimize: stage_optimize()
    if getattr(a,'decim_demo'): stage_decim_demo()
    if a.trap3: stage_trap3()
    if a.verify: stage_verify()
