#!/usr/bin/env node
// Local page for labelling technique candidates built by build-technique-review.py.
// Saves only to DIR/judgments.json; no library record is changed.
// node scripts/label-techniques.mjs --dir output/technique-review-v1 --port 8811
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,rename,realpath} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir=await realpath(path.resolve(option('--dir','output/technique-review-v1'))),port=Number(option('--port','8811'));
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a port from 1024 to 65535');
const origin=`http://127.0.0.1:${port}`,token=randomBytes(32).toString('hex');
const pools=JSON.parse(await readFile(path.join(dir,'pools.json')));
const valid=new Map(pools.pools.map(p=>[p.technique,new Set(p.candidates.map(c=>c.posterID))]));
const store=path.join(dir,'judgments.json');
let judgments;
try{judgments=JSON.parse(await readFile(store))}catch{judgments={version:1,pools:'pools.json',judgments:{}}}
let writing=Promise.resolve();
async function save(){const temporary=store+'.tmp';await writeFile(temporary,JSON.stringify(judgments,null,1));await rename(temporary,store)}

const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);res.end('Invalid host');return}
  const url=new URL(req.url,origin),json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
  if(req.method==='GET'&&url.pathname==='/api/state'){json(200,{token,pools,judgments:judgments.judgments});return}
  if(req.method==='POST'&&url.pathname==='/api/judgment'){
   if(req.headers['x-label-token']!==token||!req.headers['content-type']?.startsWith('application/json')){json(403,{error:'Same-page request required'});return}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)throw Error('Request too large')}
   const {technique,posterID,label}=JSON.parse(body);
   if(!valid.get(technique)?.has(posterID)||![null,'yes','no','unsure'].includes(label)){json(400,{error:'Unknown technique, poster or label'});return}
   const entries=judgments.judgments[technique]??={};
   if(label===null)delete entries[posterID];else entries[posterID]={label,at:new Date().toISOString()};
   writing=writing.then(save);await writing;json(200,{ok:true});return;
  }
  if(req.method==='GET'){
   const files={'/':[path.join(project,'scripts/label-techniques.html'),'text/html; charset=utf-8']};
   let [file,type]=files[url.pathname]??[];
   const thumb=url.pathname.match(/^\/thumbs\/([A-Za-z0-9-]+\.jpg)$/);
   if(thumb){file=path.join(dir,'thumbs',thumb[1]);type='image/jpeg'}
   if(!file){res.writeHead(404);res.end('Not found');return}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':thumb?'max-age=3600':'no-store'});res.end(await readFile(file));return;
  }
  res.writeHead(405);res.end('Method not allowed');
 }catch(e){if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
});
server.listen(port,'127.0.0.1',()=>console.log(`Technique labelling: ${origin}/  (saving to ${store})`));
