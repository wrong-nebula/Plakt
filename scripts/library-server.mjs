#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,realpath,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,randomUUID} from 'node:crypto';
const exec=promisify(execFile),args=process.argv.slice(2);
const option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const root=await realpath(path.resolve(option('--library','library'))),port=Number(option('--port','8765'));
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a port from 1024 to 65535');
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url))),binary=path.join(project,'dist/poster');
const token=randomBytes(32).toString('hex'),origin=`http://127.0.0.1:${port}`;
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))};
const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.heic':'image/heic'};
async function sendFile(res,file,allowedRoot){const actual=await realpath(file);if(!inside(allowedRoot,actual))throw Error('File outside allowed library/source root');const type=mime[path.extname(actual).toLowerCase()];if(!type)throw Error('Unsupported file type');res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(actual))}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);res.end('Invalid host');return}
  const url=new URL(req.url,origin);
  if(req.method==='GET'&&url.pathname==='/api/config'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({token,localOnly:true}));return}
  if(req.method==='GET'&&url.pathname.startsWith('/api/source/')){
   const id=decodeURIComponent(url.pathname.slice('/api/source/'.length));
   const index=JSON.parse(await readFile(path.join(root,'library.json')));const entry=index.posters.find(p=>p.id===id);if(!entry)throw Error('Unknown poster');
   const record=JSON.parse(await readFile(fileURLToPath(entry.recordURL)));const sourceRoot=await realpath(fileURLToPath(index.sourceRoot));
   await sendFile(res,fileURLToPath(record.source.sourceURL),sourceRoot);return;
  }
  if(req.method==='POST'&&url.pathname==='/api/apply'){
   if(req.headers.origin!==origin||req.headers['x-poster-token']!==token||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(403);res.end('Same-origin review request required');return}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2_000_000)throw Error('Review request too large')}
   const edits=JSON.parse(body);if(!Array.isArray(edits)||edits.length>1000)throw Error('Expected up to 1000 review edits');
   const inbox=path.join(root,'reviews','inbox');await mkdir(inbox,{recursive:true});const file=path.join(inbox,randomUUID()+'.json');await writeFile(file,JSON.stringify(edits,null,2));
   const result=await exec(binary,['library','apply','--library',root,'--input',file],{timeout:240000,maxBuffer:2e6});
   await exec(binary,['library','report','--library',root],{timeout:120000,maxBuffer:2e6});
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,output:result.stdout}));return;
  }
  if(req.method==='GET'){
   const relative=decodeURIComponent(url.pathname==='/'?'/review.html':url.pathname);const file=path.resolve(root,'.'+relative);
   if(!inside(root,file))throw Error('Path outside library');await sendFile(res,file,root);return;
  }
  res.writeHead(404);res.end('Not found');
 }catch(e){if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.stderr||e.message}))}
});
server.listen(port,'127.0.0.1',()=>console.log(`PosterLab review: ${origin}/review.html\nLocal only. Ctrl-C stops the review server.`));
