#!/usr/bin/env python3
"""Fetch an explicitly curated OFL font set from a pinned google/fonts revision.
No font is installed globally. Original METADATA.pb and licenses accompany assets.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, re, urllib.request, urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]/'Sources/PosterCore/Resources/Fonts'
root.mkdir(parents=True,exist_ok=True)
manifest=root/'manifest.json'
old=json.loads(manifest.read_text()) if manifest.exists() else None

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'PosterLab-font-library'})
    return urllib.request.urlopen(req,timeout=60).read()
revision=old['revision'] if old else json.loads(fetch('https://api.github.com/repos/google/fonts/commits/main'))['sha']
ids=['archivo','archivoblack','anton','barlowcondensed','bebasneue','bodonimoda','cormorantgaramond','dmserifdisplay','spacegrotesk','syne','fraunces','unbounded','bricolagegrotesque','robotoflex','monoton','chivo','rubikmonoone','ibmplexmono','newsreader','librecaslondisplay']

def family(identifier):
    base=f'https://raw.githubusercontent.com/google/fonts/{revision}/ofl/{identifier}/'
    folder=root/identifier;folder.mkdir(exist_ok=True)
    def save(name):
        target=folder/name
        data=target.read_bytes() if target.exists() else fetch(base+urllib.parse.quote(name,safe=''))
        target.write_bytes(data);return data
    metadata=save('METADATA.pb').decode()
    if 'license: "OFL"' not in metadata:raise ValueError('Expected OFL family '+identifier)
    save('OFL.txt')
    def prop(key,text=metadata):
        m=re.search(r'(?m)^\s*'+key+r': "([^"]+)"',text);return m.group(1) if m else None
    blocks=re.findall(r'(?m)^fonts \{\n(.*?)^\}',metadata,re.S)
    faces=[]
    for block in blocks:
        filename=prop('filename',block)
        data=save(filename)
        faces.append({'filename':identifier+'/'+filename,'postscriptName':prop('post_script_name',block),'style':prop('style',block),'weight':int(re.search(r'weight: (\d+)',block).group(1)),'sha256':hashlib.sha256(data).hexdigest()})
    return {'id':identifier,'family':prop('name'),'category':prop('category').lower().replace('_','-'),'designer':prop('designer'),'sourceURL':f'https://github.com/google/fonts/tree/{revision}/ofl/{identifier}','license':'OFL-1.1','licenseFile':identifier+'/OFL.txt','faces':faces}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family',action='append',default=[],help='Add an OFL Google Fonts family name or directory slug; repeatable.')
args=parser.parse_args()
ids=list(dict.fromkeys(ids+([f['id'] for f in old['families']]if old else [])+[re.sub('[^a-z0-9]','',name.lower())for name in args.family]))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:families=list(pool.map(family,ids))
temporary=manifest.with_suffix('.next.json')
temporary.write_text(json.dumps({'version':1,'provider':'Google Fonts / official google/fonts repository','revision':revision,'families':families},indent=2)+'\n')
temporary.replace(manifest)
print(json.dumps({'families':len(families),'faces':sum(len(f['faces'])for f in families),'revision':revision,'bytes':sum(p.stat().st_size for p in root.rglob('*')if p.is_file())},indent=2))
