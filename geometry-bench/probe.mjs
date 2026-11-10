import { readFile,writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const packages=JSON.parse(await readFile(new URL('./registry.json',import.meta.url))).map(p=>p.name).concat('paper-latest');
const results=await Promise.all(packages.map(name=>new Promise(resolve=>{
 const source=`try { const m=await import(${JSON.stringify(name)}); const d=m.default; console.log(JSON.stringify({keys:Object.keys(m).slice(0,100),defaultType:typeof d,defaultKeys:d?Object.keys(d).slice(0,60):[],prototype:typeof d==='function'?Object.getOwnPropertyNames(d.prototype):[]})); } catch(e) {console.log(JSON.stringify({error:e.message}));}`;
 const child=spawn(process.execPath,['--input-type=module','-e',source],{cwd:new URL('.',import.meta.url),stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
 const timeout=setTimeout(()=>child.kill(),10000);
 child.on('close',code=>{clearTimeout(timeout);let result;try{result=JSON.parse(stdout.trim().split('\n').at(-1));}catch{result={error:stderr.slice(0,500)||'import timed out'}}resolve({name,code,...result});});
})));
await writeFile(new URL('./imports.json',import.meta.url),JSON.stringify(results,null,2));
for(const p of results) console.log(p.name, p.error??`${p.keys.join(', ')} | default: ${p.defaultKeys?.join(', ')}`);
