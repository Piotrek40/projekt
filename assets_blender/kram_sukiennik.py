# Model kramu sukiennika do rynku (Etap 3): rama z fazowanymi krawędziami, lada z osobnych desek,
# baldachim i sukno z SYMULACJI TKANINY (prawdziwy zwis i fałdy), wypalone AO, eksport GLB.
# Uruchomienie: python3 assets_blender/kram_sukiennik.py            (bpy jako moduł — w tym środowisku nie ma binarki `blender`)
# Wymiary 1:1 z rynek/src/config.js + stalls.js: cw 2.6, cd 1.0, ch 0.95, ph 2.3, słupy 0.12, belki 0.1.
# UKŁAD: Blender ma Z w górę, glTF ma Y w górę — eksporter sam obraca, więc tu budujemy w Z-up i myślimy „jak w Blenderze”.
# Front kramu (strona kupującego) = +Y w Blenderze  ->  +z w scenie three.js (kontrakt z stalls.js: lokalne +z = front).
import bpy, bmesh, math, os, sys, time
from mathutils import Vector

T0 = time.time()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'blender')
os.makedirs(OUT, exist_ok=True)

CW, CD, CH, PH = 2.6, 1.0, 0.95, 2.3      # szerokość lady, głębokość lady, wysokość blatu, wysokość słupa
POST, BEAM = 0.12, 0.10                    # przekrój słupa, przekrój belki
POST_Z = CD / 2 + 0.6                      # odsunięcie słupów w głąb/przód od osi lady (stalls.js:57)
BEV_W, BEV_SEG = 0.006, 2                  # faza: 6 mm, 2 segmenty — na 1,5 m widać jako miękkie światło na krawędzi
# CIESIOŁKA = CONFIG.stalls.frame w rynek/src/config.js (te same liczby, bo model stoi obok kramów proceduralnych).
BACK_RISE, OVERHANG, RAIL, BRACE, BRACE_T = 0.40, 0.10, 0.08, 0.40, 0.07

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    return sc

def mat(name, base, rough, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1.0)
    b.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = spec
    return m

def box(name, sx, sy, sz, loc, rot=(0, 0, 0), bevel=True, material=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new('faza', 'BEVEL'); m.width = BEV_W; m.segments = BEV_SEG; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(30)
        m.harden_normals = False
    if material: o.data.materials.append(material)
    return o

sc = reset()
# Nazwy materiałów są KONTRAKTEM z rynek/src/config.js (stalls.model.materials): props.js podmienia je na materiały sceny.
# Podział na konstrukcję i ladę jest istotny — geometria proceduralna używa dla belek klucza `timber` (ciemny dąb),
# a dla blatu i czoła `planks` (jasne, zwietrzałe deski). Pierwszy render „po" miał wszystko na `timber` i kram był czarny.
drewno = mat('drewno_konstr', (0.34, 0.24, 0.16), 0.78)     # słupy, belki, krokwie, wałki rolek -> W.mat.timber
drewno_lada = mat('drewno_lada', (0.52, 0.44, 0.34), 0.82)  # blat, czoło, nogi                  -> W.mat.planks
plotno = mat('plotno', (0.62, 0.50, 0.24), 0.95, spec=0.25) # baldachim                          -> W.mat.cloth2
sukna = [mat(f'sukno{i}', c, 0.95, spec=0.25) for i, c in enumerate(
    [(0.30, 0.10, 0.26), (0.18, 0.42, 0.40), (0.62, 0.50, 0.24), (0.48, 0.13, 0.10)])]  # -> cloth0..3

# ---------- 1. RAMA: 4 słupy + belka przednia (niżej) i tylna (wyżej) + krokwie ----------
frame = []
# Słup TYLNY (y < 0) jest wyższy o BACK_RISE — to on niesie belkę tylną. W pierwszej wersji wszystkie słupy miały PH = 2,30,
# a belka tylna siedziała na 2,65 i wisiała 30 cm nad nimi w powietrzu (znalezione na zrzucie z telefonu).
for sx in (-1, 1):
    for sz in (-1, 1):
        h = PH + BACK_RISE if sz < 0 else PH
        lean = 0.012 * sx * (1 if sz > 0 else -1)   # ręcznie ciosane drewno nie stoi idealnie w pionie
        frame.append(box(f'slup_{sx}_{sz}', POST, POST, h,
                         (sx * (CW / 2 - 0.1), sz * POST_Z, h / 2),
                         rot=(lean, 0, 0.02 * sz), material=drewno))
frame.append(box('belka_przod', CW + 2 * OVERHANG, BEAM, BEAM, (0, POST_Z, PH - 0.05), material=drewno))
frame.append(box('belka_tyl',   CW + 2 * OVERHANG, BEAM, BEAM, (0, -POST_Z, PH + BACK_RISE - 0.05), material=drewno))
# Płatwie boczne: wiążą słup przedni z tylnym. Bez nich kram jest dwiema osobnymi bramkami z płótnem w powietrzu.
rail_len = math.hypot(2 * POST_Z, BACK_RISE); rail_ang = math.atan2(BACK_RISE, 2 * POST_Z)
for sx in (-1, 1):
    frame.append(box(f'platew_{sx}', RAIL, rail_len, RAIL,
                     (sx * (CW / 2 - 0.1), 0, PH + BACK_RISE / 2 - RAIL / 2 - 0.005), rot=(-rail_ang, 0, 0), material=drewno))   # środek na linii wierzchów belek minus pół płatwi
# Zastrzały kolanowe pod belkami — ta sama ciesiołka, co w kamienicach sceny.
for sx in (-1, 1):
    for sz in (-1, 1):
        z_beam = (PH + BACK_RISE if sz < 0 else PH) - 0.1
        frame.append(box(f'zastrzal_{sx}_{sz}', BRACE_T, BRACE_T, BRACE * math.sqrt(2),
                         (sx * (CW / 2 - 0.1) - sx * BRACE / 2, sz * POST_Z, z_beam - BRACE / 2),
                         rot=(0, sx * math.pi / 4, 0), material=drewno))
# Krokwie POD płótnem, równoległe do niego: linia płótna biegnie od wierzchu belki tylnej (PH+0.40) do wierzchu przedniej (PH+0.00)
# na rozstawie 2·POST_Z. Krokiew ma leżeć tak, żeby jej WIERZCH dotykał tej linii — inaczej przebija płótno (kontrola 4b: 25 mm).
RAF_H = 0.07
CONFIG_RAFTERS = (-0.62, 0.0, 0.62)          # = CONFIG.stalls.rafters w rynek/src/config.js
# Podpory płótna w METRACH: 3 krokwie + 2 płatwie boczne. Płótno jest przybite do KAŻDEJ z nich, a festony powstają między nimi.
def _supports_m():
    return sorted([fx * (CW + 0.5) / 2 for fx in CONFIG_RAFTERS] + [-(CW / 2 - 0.1), (CW / 2 - 0.1)])
rise, depth = BACK_RISE, 2 * POST_Z    # 0.40 m spadku na 2.2 m
slope = math.hypot(depth, rise); ang = math.atan2(rise, depth)
for fx in CONFIG_RAFTERS:
    frame.append(box(f'krokiew_{fx}', 0.05, slope, RAF_H, (fx * (CW + 0.5) / 2, 0, PH + BACK_RISE / 2 + 0.01 - RAF_H / 2 - 0.002),
                     rot=(-ang, 0, 0), material=drewno))   # WIERZCH krokwi dokładnie na linii płótna (2,508 m): płótno ma na niej LEŻEĆ. Obniżenie krokwi o 22 mm odebrało mu podparcie i solver przeciskał je na wylot.

# ---------- 2. LADA: osobne deski ze szczelinami, każda z własnym uskokiem i przechyłem ----------
import random
random.seed(7)
nb, gap = 7, 0.006
bw = (CD - (nb - 1) * gap) / nb
lada = []
for i in range(nb):
    y = -CD / 2 + bw / 2 + i * (bw + gap)
    dz = random.uniform(-0.0035, 0.0035)      # deski nie leżą idealnie równo
    tilt = random.uniform(-0.006, 0.006)
    lada.append(box(f'deska_{i}', CW, bw, 0.045, (0, y, CH + dz), rot=(tilt, 0, 0), material=drewno_lada))
# czoło lady: pionowe deski
nf = 9; fw = (CW - (nf - 1) * gap) / nf
for i in range(nf):
    x = -CW / 2 + fw / 2 + i * (fw + gap)
    lada.append(box(f'czolo_{i}', fw, 0.035, CH - 0.12, (x, CD / 2 - 0.02, (CH - 0.12) / 2 + 0.02),
                    rot=(0, 0, random.uniform(-0.004, 0.004)), material=drewno_lada))
# nogi lady
for sx in (-1, 1):
    lada.append(box(f'noga_{sx}', 0.08, CD - 0.12, CH - 0.05, (sx * (CW / 2 - 0.12), 0, (CH - 0.05) / 2), material=drewno_lada))

print(f'rama+lada: {len(frame)+len(lada)} elementow, {time.time()-T0:.1f} s')

# ---------- 3. BALDACHIM Z SYMULACJI TKANINY ----------
# Płótno rozpięte między belką tylną (wyżej) a przednią (niżej), OPADAJĄCE na krokwie: przypięte tylko wzdłuż obu belek,
# reszta znajduje swój kształt sama — kolizja z krokwiami daje zwis między nimi, a nadmiar za belką przednią zwisa jako lambrekin.
BACK_Y, FRONT_Y = -POST_Z, POST_Z
BACK_Z, FRONT_Z = PH + BACK_RISE - 0.05 + BEAM / 2, PH - 0.05 + BEAM / 2
VAL = 0.42                                    # ile płótna zwisa za belką przednią (lambrekin, na nim wisi szyld kramu)
SLACK = 1.000                                 # BEZ luzu wzdłuż spadku: każdy nadmiar wzdłuż y zsuwa płótno pod krokwie (kontrola 4b: przechodziło przez nie na całej długości).
                                              # Nadmiar materiału jest teraz W POPRZEK (X_SLACK) — tam, gdzie ma powstać feston między krokwiami.
X_SLACK = 1.030                               # nadmiar materiału W POPRZEK: bez niego solver napina płótno i zjada festony
SAG_X = 0.075                                 # głębokość festonu MIĘDZY krokwiami (liczona analitycznie, nie zdana na solver)
NX, NY = 78, 62                               # siatka symulacji; po symulacji upraszczana do budżetu gry

bpy.ops.mesh.primitive_grid_add(x_subdivisions=NX, y_subdivisions=NY, size=1, location=(0, 0, 0))
canopy = bpy.context.object; canopy.name = 'baldachim'
me = canopy.data
span = FRONT_Y - BACK_Y
# Płat jest DŁUŻSZY niż rozpiętość (SLACK) i podniesiony łukiem — solver opuszcza go na krokwie i między nimi robi zwis.
# Losowe zaburzenie 3 mm łamie symetrię: idealnie płaska siatka nie ma powodu wybrać kierunku fałdy i zostaje płaska.
random.seed(11)
pin_idx = []                                   # przypięcie liczone ze współrzędnej MATERIAŁU (yl), nie z rzutu na oś y —
                                               # po rzutowaniu cały nadmiar ma y = FRONT_Y i poprzednia wersja przypinała 1501 z 4977 wierzchołków (sztywny lambrekin)
for v in me.vertices:                          # grid ma x,y w [-0.5, 0.5] — rozciągamy na płat
    u = v.co.x + 0.5; w = v.co.y + 0.5         # u wzdłuż szerokości kramu, w od tyłu do przodu
    v.co.x = (u - 0.5) * (CW + 0.18) * X_SLACK   # 9 cm zwisu na bok (przy +0,31 płótno spływało z belek) + nadmiar na festony
    L = span * SLACK + VAL                     # długość PŁATU (wzdłuż materiału), większa niż odległość belek
    yl = w * L                                 # położenie wzdłuż materiału
    t = min(1.0, yl / span)
    over = max(0.0, yl - span)                 # ile materiału zostało za belką przednią
    # Lambrekin zwisa PRZED licem belki przedniej (+BEAM/2 + 6 mm), a nie z jej osi — inaczej opada przez bryłę belki.
    v.co.y = BACK_Y + min(yl, span) + (max(BEAM, POST) / 2 + 0.010 if over > 0 else 0.0)   # przed licem SŁUPA (0.12), nie tylko belki (0.10)
    # (frac policzone niżej, przy festonie — tu potrzebne do FESTONOWEGO KROJU lambrekinu, więc liczymy je od razu)
    xw = v.co.x / ((CW + 0.18) * X_SLACK / 2)                       # -1..1, potrzebne i do festonu, i do przypięcia na krokwiach
    # KSZTAŁT ANALITYCZNY: płótno leży na 3 krokwiach + 2 końcach belek, więc między podporami robi feston.
    # sup = punkty podparcia wzdłuż szerokości (ułamek półszerokości płótna); frac = położenie między dwiema sąsiednimi podporami.
    # Węzły festonu MUSZĄ leżeć dokładnie na krokwiach. Krokwie stoją w ułamkach szerokości BALDACHIMU (CW+0.5),
    # a płótno ma szerokość CW+0.18 — pierwsza wersja użyła tych samych ułamków dla obu i płótno uginało się
    # o 10 cm obok krokwi, czyli przechodziło przez nie (kontrola 4b: 25 mm na każdej z trzech).
    sup = [-1.0] + [m / ((CW + 0.18) * X_SLACK / 2) for m in _supports_m()] + [1.0]
    k = max(0, min(len(sup) - 2, next((j for j in range(len(sup) - 1) if xw <= sup[j + 1]), len(sup) - 2)))
    frac = (xw - sup[k]) / (sup[k + 1] - sup[k])
    # Zwis MUSI być zerowy na każdej podporze: na krokwiach (sin(pi·frac) = 0) i przy obu belkach (sin(pi·t) = 0).
    # Pierwsza wersja miała osobny człon SAG_Y bez tego zerowania i płótno przechodziło przez belki (31–43 mm) i krokwie (25 mm)
    # — złapała to kontrola przenikania w kroku 4b.
    tf = min(1.0, max(0.0, (yl - BEAM) / (span - 2 * BEAM)))   # 0 na całej SZEROKOŚCI belek, nie tylko w ich osi
    feston = SAG_X * math.sin(math.pi * frac) * math.sin(math.pi * tf)
    # Lambrekin ma krój FESTONOWY: dłuższy między krokwiami, krótszy przy podporach. Prosta krawędź (pierwsza wersja)
    # czytała się w kadrze z wysokości oczu jako gładka żółta listwa i była najsłabszym elementem całego kramu.
    kroj = 0.45 + 0.55 * math.sin(math.pi * frac)
    v.co.z = (BACK_Z + 0.010 + t * (FRONT_Z - BACK_Z) - feston - over * 0.94 * kroj + random.uniform(-0.0015, 0.0015))   # +10 mm nad belkami: solver sam opuści płótno na podpory
    # Płótno jest PRZYWIĄZANE do obu belek ORAZ do trzech krokwi — tak buduje się markizę i tak samo rozwiązuje się
    # problem, którego solver nie rozwiązał: kolizja z krokwiami nie działała (kontrola 4b: tkanina przechodziła przez nie
    # na całej długości mimo thickness_outer 20 mm). Przypięcie na linii krokwi jest fizycznie poprawne i daje 0 przenikań
    # z konstrukcji, a festony powstają MIĘDZY przywiązaniami z nadmiaru materiału X_SLACK.
    na_krokwi = min(abs(xw - m / ((CW + 0.18) * X_SLACK / 2)) for m in _supports_m()) < 0.022
    if yl < 0.05 or abs(yl - span) < 0.05 or (na_krokwi and yl <= span): pin_idx.append(v.index)
canopy.data.materials.append(plotno)

# przypięcie: pas 4 cm przy belce tylnej i 4 cm po obu stronach belki przedniej (płótno jest tam przybite)
grp = canopy.vertex_groups.new(name='pin')
grp.add(pin_idx, 1.0, 'REPLACE')
print(f'baldachim: {len(me.vertices)} wierzcholkow, przypietych {len(pin_idx)} ({100*len(pin_idx)/len(me.vertices):.1f} %)')

# krokwie i belki jako obiekty kolizji — to one robią zwis między krokwiami
for o in frame:
    if o.name.startswith(('krokiew', 'belka')):
        col = o.modifiers.new('kolizja', 'COLLISION')
        o.collision.thickness_outer = 0.020   # 4 mm było za mało: solver przeciskał płótno przez krokwie (kontrola 4b)
        o.collision.damping = 0.85

# ile wierzchołków KSZTAŁTU STARTOWEGO (analitycznego) siedzi w drewnie — rozdziela winę: moja geometria czy solver
def _pen_start():
    n = 0
    for o in frame:
        o.data.calc_loop_triangles()
        mi = [min(v.co[i] for v in o.data.vertices) for i in range(3)]
        ma = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
        inv = o.matrix_world.inverted()
        for v in me.vertices:
            q = inv @ (canopy.matrix_world @ v.co)
            if all(mi[i] + 0.002 < q[i] < ma[i] - 0.002 for i in range(3)): n += 1
    return n
START_PEN = _pen_start()

cl = canopy.modifiers.new('tkanina', 'CLOTH')
st = cl.settings
st.quality = 14
st.mass = 0.30                     # płótno żaglowe, ok. 300 g/m2
st.tension_stiffness = 22
st.compression_stiffness = 8       # trzyma długość płatu: przy 0,5 luz zbierał się w kłąb i płótno zsuwało się z belki
st.shear_stiffness = 2.5
st.bending_stiffness = 0.5         # płótno, nie blacha: szerokie fałdy zamiast sztywnej płyty (1. render: 1,2 dawało płytę)
st.tension_damping = 10
st.bending_damping = 0.5
st.use_pressure = False
st.vertex_group_mass = 'pin'
cl.collision_settings.use_self_collision = True
cl.collision_settings.self_distance_min = 0.005
cl.collision_settings.distance_min = 0.018
cl.collision_settings.collision_quality = 8

sc.frame_start = 1; sc.frame_end = 45
t = time.time()
bpy.context.view_layer.objects.active = canopy
for f in range(1, 46):
    sc.frame_set(f)
print(f'symulacja tkaniny (relaksacja ksztaltu analitycznego): 45 klatek w {time.time()-t:.1f} s')

# utrwalenie kształtu z ostatniej klatki
bpy.ops.object.select_all(action='DESELECT'); canopy.select_set(True)
bpy.context.view_layer.objects.active = canopy
bpy.ops.object.modifier_apply(modifier='tkanina')
cv = canopy.data.vertices
srodek = [v.co.z for v in cv if BACK_Y + 0.2 < v.co.y < FRONT_Y - 0.2]
lambrekin = [v.co.z for v in cv if v.co.y >= FRONT_Y - 0.12]
print(f'baldachim: zwis miedzy belkami do z {min(srodek):.3f} m (belka przod {FRONT_Z:.2f}), lambrekin do z {min(lambrekin):.3f} m = {FRONT_Z-min(lambrekin):.2f} m ponizej belki; lambrekin wysuniety do y {max(v.co.y for v in cv):.3f} (szyld kramu stoi na y = cd/2+0.62+out)')


# ---------- 4. SUKNO: rolki na wałkach + JEDEN BELE ROZWINIĘTY przez ladę (symulacja) ----------
# Rolka = walec z fazą na krawędziach denka (ostra krawędź walca to najczystszy sygnał „prymityw z silnika”).
rolki = []
BW, BLEN = 0.28, 1.06
BLAT = CH + 0.045 / 2          # wierzch desek lady (deska: box grubosci 0.045 o srodku na CH)
for i, (rx, rz, ry_rot) in enumerate([(-0.33, 0, 0.09), (0.0, 0, -0.05), (0.33, 0, 0.04), (-0.17, 1, 0.11), (0.17, 1, -0.08)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=BW / 2, depth=BLEN,
                                        location=(rx, 0, BLAT + BW / 2 + rz * BW * 0.93), rotation=(math.pi / 2, 0, ry_rot))
    o = bpy.context.object; o.name = f'rolka_{i}'
    m = o.modifiers.new('faza', 'BEVEL'); m.width = 0.010; m.segments = 2; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(35)
    o.data.materials.append(sukna[i % len(sukna)]); rolki.append(o)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.032, depth=BLEN + 0.18,
                                        location=o.location, rotation=(math.pi / 2, 0, ry_rot))
    w = bpy.context.object; w.name = f'walek_{i}'; w.data.materials.append(drewno); rolki.append(w)

# kolizja dla desek lady, czoła ORAZ rolek — sukno ma się o nie oprzeć, a nie przez nie przelecieć
for o in list(lada) + list(rolki):
    o.modifiers.new('kolizja', 'COLLISION'); o.collision.thickness_outer = 0.004; o.collision.damping = 0.8

# rozwinięty pas sukna: startuje na wierzchu środkowej rolki, przechodzi przez blat i zwisa przez czoło lady
DX, DW, DSLACK = -0.02, 0.86, 1.10
bpy.ops.mesh.primitive_grid_add(x_subdivisions=34, y_subdivisions=76, size=1, location=(0, 0, 0))
drape = bpy.context.object; drape.name = 'sukno_rozwiniete'
TOPZ = BLAT + BW * 1.93 + 0.01
random.seed(23)
for v in drape.data.vertices:
    u, w = v.co.x + 0.5, v.co.y + 0.5
    # szerokość z lekkim „ściągnięciem” przy górze: pas materiału zbiegający się przy rolce zmusza go do ułożenia się w fałdy
    v.co.x = DX + (u - 0.5) * DW * (0.72 + 0.28 * w) + random.uniform(-0.004, 0.004)
    v.co.y = -0.12 + w * 1.06 * DSLACK           # nadmiar materiału: sukno układa się na blacie, a nie napina jak struna
    v.co.z = TOPZ + 0.004 * math.sin(u * math.pi * 5) + random.uniform(-0.002, 0.002)
drape.data.materials.append(sukna[0])
g2 = drape.vertex_groups.new(name='pin')
g2.add([v.index for v in drape.data.vertices if v.co.y < -0.06], 1.0, 'REPLACE')

cl2 = drape.modifiers.new('tkanina', 'CLOTH')
s2 = cl2.settings
s2.quality = 10; s2.mass = 0.22
s2.tension_stiffness = 12; s2.compression_stiffness = 0.2; s2.shear_stiffness = 0.8
s2.bending_stiffness = 0.06                       # sukno jest MIĘKKIE — wąskie fałdy na krawędzi lady
s2.tension_damping = 5; s2.bending_damping = 0.25
s2.vertex_group_mass = 'pin'
cl2.collision_settings.use_self_collision = True
cl2.collision_settings.self_distance_min = 0.003
cl2.collision_settings.distance_min = 0.003
cl2.collision_settings.collision_quality = 4

t = time.time()
sc.frame_set(1)
for f in range(1, 101): sc.frame_set(f)
print(f'symulacja sukna: 100 klatek w {time.time()-t:.1f} s')
bpy.ops.object.select_all(action='DESELECT'); drape.select_set(True)
bpy.context.view_layer.objects.active = drape
bpy.ops.object.modifier_apply(modifier='tkanina')
dz = [v.co.z for v in drape.data.vertices]
print(f'sukno po symulacji: z {min(dz):.3f}..{max(dz):.3f} m (blat {CH+0.045:.3f}, spod lady 0.02)')

# usuwamy modyfikatory kolizji — do eksportu niepotrzebne
for o in list(lada) + list(frame) + list(rolki):
    for m in list(o.modifiers):
        if m.type == 'COLLISION': o.modifiers.remove(m)


# ---------- 4b. KONTROLA PRZENIKANIA (tkanina vs drewno) ----------
# Symulacja bywa niestabilna: płótno potrafi wpaść w krokiew, a sukno w blat. Sprawdzamy KAŻDY wierzchołek tkaniny
# względem bryły (AABB w układzie lokalnym) każdego elementu drewnianego, z zapasem 2 mm.
def aabb_local(o):
    o.data.calc_loop_triangles()
    mi = [min(v.co[i] for v in o.data.vertices) for i in range(3)]
    ma = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
    return o, mi, ma
drewniane = [aabb_local(o) for o in list(frame) + list(lada)]   # bez rolek/wałków: to walce, a AABB walca ma puste narożniki i dawałoby fałszywe trafienia
# Próg: tkanina LEŻĄCA na podporze siedzi 1–2 mm pod jej licem i to jest kontakt, nie przenikanie.
# Za przenikanie uznajemy dopiero wejście głębiej niż PROG w bryłę (mierzone jako odległość od najbliższego lica).
naruszenia, MARG, PROG = {}, 0.002, 0.005
glebokosc = {}
for tk in (canopy, drape):
    mw = tk.matrix_world
    for v in tk.data.vertices:
        p = mw @ v.co
        for o, mi, ma in drewniane:
            q = o.matrix_world.inverted() @ p
            if all(mi[i] + MARG < q[i] < ma[i] - MARG for i in range(3)):
                d = min(min(q[i] - mi[i], ma[i] - q[i]) for i in range(3))
                if d <= PROG: break                      # kontakt: tkanina leży na podporze
                k = f'{tk.name} -> {o.name}'
                naruszenia[k] = naruszenia.get(k, 0) + 1
                glebokosc[k] = max(glebokosc.get(k, 0), d)
                break
tot = sum(naruszenia.values())
print(f'KONTROLA PRZENIKANIA (PO symulacji): {tot} wierzcholkow glebiej niz {PROG*1000:.0f} mm w drewnie')
for k, n in sorted(naruszenia.items(), key=lambda x: -x[1])[:8]:
    print(f'   {k}: {n} wierzch., najglebiej {glebokosc[k]*1000:.1f} mm')
print(f'   [PORÓWNANIE] ksztalt startowy baldachimu mial {START_PEN} wierzcholkow w drewnie')
# gdzie dokładnie na krokwi: lokalne y (wzdłuż krokwi) i z (0 = oś, ±0.035 = lica)
_kr = next(o for o in frame if o.name.startswith('krokiew_0.0'))
_inv = _kr.matrix_world.inverted(); _mi = [min(v.co[i] for v in _kr.data.vertices) for i in range(3)]; _ma = [max(v.co[i] for v in _kr.data.vertices) for i in range(3)]
_hits = []
for v in canopy.data.vertices:
    q = _inv @ (canopy.matrix_world @ v.co)
    if all(_mi[i] + 0.002 < q[i] < _ma[i] - 0.002 for i in range(3)): _hits.append((round(q[1], 2), round(q[2], 4), round(q[0], 4)))
if _hits:
    print(f'   DIAGNOZA krokiew_0.0 (lokalne, polowa: x ±{_ma[0]:.3f}, y ±{_ma[1]:.3f}, z ±{_ma[2]:.3f}):')
    print(f'     y od {min(h[0] for h in _hits):.2f} do {max(h[0] for h in _hits):.2f}; z od {min(h[1] for h in _hits):.4f} do {max(h[1] for h in _hits):.4f}; x od {min(h[2] for h in _hits):.4f} do {max(h[2] for h in _hits):.4f}')

# ---------- 5. UPROSZCZENIE DO BUDŻETU GRY ----------
def tri(o):
    o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
for o, ratio in ((canopy, 0.34), (drape, 0.45)):
    d = o.modifiers.new('uprosc', 'DECIMATE'); d.ratio = ratio
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='uprosc')

# ---------- 6. SCALENIE + UV ----------
# UV0 = rzut sześcienny w METRACH (1 jednostka UV = 1 m) — kafelkowanie ustawiamy potem w three.js przez repeat = 1/mpt,
#       dzięki czemu model ma DOKŁADNIE tę samą skalę tekstury co geometria proceduralna obok (drewno 1,5 m, deski 2,0 m).
# UV1 = rozpakowanie bez nakładek pod wypalone AO (three.js aoMap czyta uv1).
wszystko = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in wszystko:
    o.select_set(True)
    for m in list(o.modifiers):
        if m.type == 'BEVEL':
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
bpy.context.view_layer.objects.active = wszystko[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
kram = bpy.context.object; kram.name = 'kram_sukiennik'
print(f'po scaleniu: {len(kram.data.polygon_layers_int) if False else len(kram.data.polygons)} scian, materialy: {[m.name for m in kram.data.materials]}')

me = kram.data
while len(me.uv_layers) < 2: me.uv_layers.new(name=f'UV{len(me.uv_layers)}')
me.uv_layers[0].name, me.uv_layers[1].name = 'UVMap', 'UV1'
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
me.uv_layers.active_index = 0
bpy.ops.uv.cube_project(cube_size=1.0)              # 1 jednostka UV = 1 m
bpy.ops.object.mode_set(mode='OBJECT')
me.uv_layers.active_index = 1
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
bpy.ops.object.mode_set(mode='OBJECT')
me.calc_loop_triangles()
print(f'kram: {len(me.loop_triangles)} trojkatow, {len(me.vertices)} wierzcholkow, UV: {[u.name for u in me.uv_layers]}')

# ---------- 7. WYPALENIE AO (Cycles CPU) ----------
# Płyta bruku jako okludent — dzięki niej spód lady i podstawy słupów dostają prawdziwy cień kontaktowy. NIE jest eksportowana.
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0)); podloze = bpy.context.object; podloze.name = '_okludent'
# Dystans AO: to ma być cień KONTAKTOWY (naroża, spód lady, styk słupa z brukiem), a nie globalna okluzja nieba —
# tę three.js liczy już z HDRI. Przy domyślnych 10 m płyta bruku zacieniała cały model (średnia mapy 0,37 = 37 % światła
# otoczenia) i kram był czarny. Przy 0,5 m mapa zbiera tylko styki.
sc.world = sc.world or bpy.data.worlds.new('w')
sc.world.light_settings.distance = 0.5
RES, SAMP = 2048, 64
ao = bpy.data.images.new('kram_ao', RES, RES)
for m in me.materials:
    nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.image = ao; n.select = True; nt.nodes.active = n
sc.cycles.samples = SAMP; sc.cycles.use_denoising = True
sc.render.bake.margin = 6
sc.render.bake.use_selected_to_active = False
bpy.ops.object.select_all(action='DESELECT'); kram.select_set(True); bpy.context.view_layer.objects.active = kram
t = time.time(); bpy.ops.object.bake(type='AO', use_clear=True); print(f'wypalenie AO {RES}x{RES}, {SAMP} probek: {time.time()-t:.1f} s')
ao_path = os.path.join(OUT, 'kram_sukiennik_ao.png'); ao.filepath_raw = ao_path; ao.file_format = 'PNG'; ao.save()
print('AO zapisane:', ao_path)
bpy.data.objects.remove(podloze, do_unlink=True)

# ---------- 8. EKSPORT GLB ----------
glb = os.path.join(OUT, 'kram_sukiennik.glb')
bpy.ops.object.select_all(action='DESELECT'); kram.select_set(True); bpy.context.view_layer.objects.active = kram
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_image_format='NONE')
print(f'GLB: {glb} ({os.path.getsize(glb)} B)')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'kram_etap1.blend'))
print(f'CALOSC: {time.time()-T0:.1f} s')
