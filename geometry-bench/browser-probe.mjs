import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('output/browser-fixtures',{recursive:true});
import {browserAdapters,closeBrowser} from './browser-adapters.mjs';
for(const a of browserAdapters){try{const result=await a.make({warp:.4,offset:5,stretch:1,tilt:4,repetition:.6});if(result.markup)await writeFile('output/browser-fixtures/'+a.name+'.svg',result.markup);if(result.image)await writeFile('output/browser-fixtures/'+a.name+'.png',Buffer.from(result.image,'base64'));console.log(a.name,result.d?.length,result.image?.length,result.markup?.length)}catch(e){console.log(a.name,e.stack?.split('\n').slice(0,4).join('\n'))}}
await closeBrowser();
