#!/usr/bin/env python3
"""Generate reproducible local studies from the four user-supplied images."""
import argparse,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--out',default='output/image-start-examples-v5')
parser.add_argument('--rounds',type=int,default=10)
parser.add_argument('--count',type=int,default=15)
parser.add_argument('--binary',default='.build/image-library/release/poster')
args=parser.parse_args()
out=root/args.out
out.mkdir(parents=True,exist_ok=True)
images=[
 ('gallop','codex-clipboard-db1c986e-a7c8-4823-bc8c-ad9a342bcfe4.png','AFTER THE GALLOP','Bodies, rhythm and the photographic instant','Fotomuseum Winterthur','Concept exhibition · 12–28 March 2027',20261108),
 ('airborne','codex-clipboard-56dff60e-9a73-477b-9f59-d73c3aa4669a.png','OFF THE GROUND','Skate films, movement and public space','La Friche la Belle de Mai · Marseille','Concept weekend · 14–16 May 2027',20261109),
 ('signals','codex-clipboard-07341e1d-621f-4fb9-a9a9-ed6e7373d6ce.png','NIGHT SIGNALS','Cinema, lettering and the city after dark','Eye Filmmuseum · Amsterdam','Concept programme · 8–11 October 2027',20261110),
 ('looking','codex-clipboard-c16348d4-732b-49a5-ae8c-d717eb15f4db.png','THE COLOUR OF LOOKING','Photography, paint and projected images','C/O Berlin','Concept exhibition · 3–19 September 2027',20261111)]
briefs=[]
for name,file,title,subtitle,venue,footer,seed in images:
 source=Path('/var/folders/z5/6rm_mqdx6nz17tgp5kwpksb80000gn/T')/file
 command=[str(root/args.binary),'from-image','--image',str(source),'--library',str(root/'library'),'--out',str(out/name),'--seed',str(seed),'--rounds',str(args.rounds),'--count',str(args.count),'--title',title,'--subtitle',subtitle,'--institution',venue,'--footer',footer,'--taste',str(root/'taste')]
 print(f'Starting {title}',flush=True)
 subprocess.run(command,cwd=root,check=True)
 briefs.append(dict(name=name,title=title,subtitle=subtitle,institution=venue,footer=footer,seed=seed,source=str(source),status='Newly authored concept; real venue; not an announced event'))
(out/'briefs.json').write_text(json.dumps(briefs,indent=2)+'\n')
