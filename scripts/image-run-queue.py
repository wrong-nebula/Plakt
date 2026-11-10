#!/usr/bin/env python3
"""Persistent, local, one-pass poster batch queue. No scheduler or model training."""
import argparse,datetime,hashlib,html,json,os,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('action',choices=['run','status'])
parser.add_argument('--queue',default='output/image-run-queue-v1/queue.json')
parser.add_argument('--binary',default='.build/image-library/release/poster')
a=parser.parse_args();queuefile=(root/a.queue).resolve();directory=queuefile.parent

def read():return json.loads(queuefile.read_text())
def save(q):
 temporary=queuefile.with_suffix('.json.next');temporary.write_text(json.dumps(q,indent=2)+'\n');temporary.replace(queuefile)
 cards=[]
 for job in q['jobs']:
  image=Path(job['image']).relative_to(directory)
  result=f'<p><a href="{job["id"]}/winner.png">Winner PNG</a> · <a href="{job["id"]}/winner.pdf">PDF</a></p>' if job['status']=='complete' else ''
  cards.append(f'<article><img src="{image}" alt="{html.escape(job["title"])}"><h2>{html.escape(job["title"])}</h2><strong>{html.escape(job["status"])}</strong><p>{html.escape(job["institution"])}<br>{job["rounds"]} rounds · {job["count"]} candidates per round</p>{result}<a href="{job["id"]}.log">Run log</a></article>')
 page='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="15"><title>Queued image studies</title><style>body{font:15px system-ui;background:#e5e0d6;color:#20231e;margin:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:24px}article{background:#faf7ef;padding:16px}img{width:100%;height:300px;object-fit:contain}h2{font-size:19px}p{line-height:1.6}a{color:inherit}</style><h1>Queued image studies</h1><p>Free evolution. Generated-type-only judging, diverse finalists and forced composition directions are off. Matched shape comparisons remain on. Briefs are concept programmes at real venues.</p><p>Status: '+html.escape(q['status'])+'</p><main>'+''.join(cards)+'</main></html>'
 (directory/'queue.html').write_text(page)

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
q=read()
if a.action=='status':
 print(q['status'])
 for job in q['jobs']:print(job['id'],job['status'],job.get('error',''))
 sys.exit(0)
lock=directory/'worker.lock'
try:
 fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,str(os.getpid()).encode());os.close(fd)
except FileExistsError:
 raise SystemExit('A queue worker lock already exists. Check worker.lock and worker.log before restarting.')
try:
 backend=directory/'backend';backend.mkdir(exist_ok=True);binary=backend/'poster'
 if not binary.exists():
  source=(root/a.binary).resolve();shutil.copy2(source,binary)
  shutil.copytree(source.parent/'PosterLab_PosterCore.bundle',backend/'PosterLab_PosterCore.bundle',dirs_exist_ok=True)
 q['backend']=str(binary);q['backendSHA256']=hashlib.sha256(binary.read_bytes()).hexdigest();q['status']='running';q['startedAt']=now();save(q)
 for job in q['jobs']:
  if job['status']!='queued':continue
  image=Path(job['image'])
  if hashlib.sha256(image.read_bytes()).hexdigest()!=job['sha256']:
   job.update(status='failed',error='Queued source image checksum changed');save(q);continue
  job.update(status='running',startedAt=now());save(q);print('Starting',job['title'],flush=True)
  command=[str(binary),'from-image','--image',str(image),'--library',str(root/'library'),'--out',job['output'],'--seed',str(job['seed']),'--rounds',str(job['rounds']),'--count',str(job['count']),'--title',job['title'],'--subtitle',job['subtitle'],'--institution',job['institution'],'--footer',job['footer'],'--taste',str(root/'taste'),'--generated-type-judging',str(job['generatedTypeJudging']).lower(),'--diverse-finalists',str(job['diverseFinalists']).lower(),'--composition-directions',str(job['compositionDirections']).lower()]
  with (directory/(job['id']+'.log')).open('w') as log:result=subprocess.run(command,cwd=root,stdout=log,stderr=subprocess.STDOUT)
  job['finishedAt']=now();job['exitCode']=result.returncode
  if result.returncode==0:job['status']='complete'
  else:job.update(status='failed',error='Generation failed; completed rounds and the job log are preserved.')
  save(q);print(job['id'],job['status'],flush=True)
 q['status']='complete' if all(j['status']=='complete' for j in q['jobs']) else 'complete-with-errors';q['finishedAt']=now();save(q)
finally:
 lock.unlink(missing_ok=True)
