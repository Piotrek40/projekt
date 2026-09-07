import json, os, sys, urllib.request, hashlib
API="https://api.polyhaven.com/files/"
import time
def get(url):
    for i in range(5):
        try:
            req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 audyt-gry'})
            with urllib.request.urlopen(req, timeout=120) as r: return r.read()
        except Exception as e:
            print('retry', i, url, e); time.sleep(2*(i+1))
    raise RuntimeError(url)
def dl(url, path):
    if os.path.exists(path): return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path,'wb').write(get(url))
def model(name, res):
    d=json.loads(get(API+name)); g=d['gltf'][res]['gltf']
    base=f"models/{name}"; dl(g['url'], f"{base}/{name}.gltf")
    for rel,info in g['include'].items(): dl(info['url'], f"{base}/{rel}")
    print("model", name, res, "files", 1+len(g['include']))
def texture(name, res):
    d=json.loads(get(API+name))
    for m in ['Diffuse','nor_gl','Rough','AO','Displacement','arm']:
        if m in d and res in d[m] and 'jpg' in d[m][res]:
            dl(d[m][res]['jpg']['url'], f"textures/{name}/{name}_{m}_{res}.jpg")
    print("texture", name, res)
def hdri(name, res):
    d=json.loads(get(API+name)); dl(d['hdri'][res]['hdr']['url'], f"hdri/{name}_{res}.hdr"); print("hdri", name, res)
kind=sys.argv[1]; res=sys.argv[3]
{'model':model,'texture':texture,'hdri':hdri}[kind](sys.argv[2], res)
