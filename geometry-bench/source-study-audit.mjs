import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]),library=JSON.parse(await fs.readFile('library/library.json','utf8')),records=new Map();
const values=e=>{if(e.revision!==2||e.dimensions!==768||e.preprocessing!=='upright-sRGB-vision-scaleFit-v1')throw Error('Unexpected embedding schema');const b=Buffer.from(e.data,'base64');return Array.from({length:e.dimensions},(_,i)=>b.readFloatLE(i*4))};
const distance=(a,b)=>Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0));
async function donor(id){if(!records.has(id)){const entry=library.posters.find(p=>p.id===id);if(!entry)throw Error('Unknown donor');records.set(id,values(JSON.parse(await fs.readFile(fileURLToPath(entry.recordURL),'utf8')).embedding))}return records.get(id)}
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));const audit={studies:manifest.length,rounds:0,candidates:0,uniqueWithinBatchSlots:0,cloneRejections:0,minimumAcceptedDistance:Infinity,maximumReferenceError:0,maximumDiversityError:0,minimumDiversity:Infinity};
const globalHashes=new Set();
for(const study of manifest){let used=new Set(),prior;
for(let round=0;round<Number(study.rounds);round++){
 const dir=path.join(root,study.category,`round-${round}`),r=JSON.parse(await fs.readFile(path.join(dir,'round.json'),'utf8')),a=await donor(r.donorIDs[0]),b=await donor(r.donorIDs[1]),vectors=new Map(),hashes=new Set();
 for(const id of r.donorIDs){if(used.has(id))throw Error('Donor repeated');used.add(id)}
 for(const scene of r.candidates){vectors.set(scene.id,values(JSON.parse(await fs.readFile(path.join(dir,scene.id+'-embedding.json'),'utf8'))));const bytes=await fs.readFile(fileURLToPath(scene.imageURL));const digest=createHash('sha256').update(bytes).digest('hex');hashes.add(digest);globalHashes.add(digest)}
 if(hashes.size!==r.candidates.length)throw Error('Duplicate candidate PNGs');
 if(prior){const before=prior.candidates.find(c=>c.id===prior.winnerID),elite=r.candidates[0];if(JSON.stringify(before.genome)!==JSON.stringify(elite.genome)||before.seed!==elite.seed)throw Error('Elite genome changed');if(!(await fs.readFile(fileURLToPath(before.imageURL))).equals(await fs.readFile(fileURLToPath(elite.imageURL))))throw Error('Elite pixels changed')}
 for(const c of r.judging.results){const f=vectors.get(c.id),nearest=Math.min(...[...vectors].filter(([id])=>id!==c.id).map(([,v])=>distance(f,v))),expected=(Math.exp(-1.4*distance(f,a))+Math.exp(-1.4*distance(f,b)))/2;
  audit.maximumReferenceError=Math.max(audit.maximumReferenceError,Math.abs(expected-c.scores.Reference));audit.maximumDiversityError=Math.max(audit.maximumDiversityError,Math.abs(Math.min(1,nearest/.8)-c.scores.Diversity));audit.minimumAcceptedDistance=Math.min(audit.minimumAcceptedDistance,nearest);audit.minimumDiversity=Math.min(audit.minimumDiversity,c.scores.Diversity);
  if(nearest+1e-7<r.minimumVisualDistance)throw Error('Visual distance gate violated');if(c.votes.Composition!==undefined)throw Error('Basel authored prior unexpectedly voted');
 }
 audit.rounds++;audit.candidates+=r.candidates.length;audit.uniqueWithinBatchSlots+=hashes.size;audit.cloneRejections+=r.rejectedVisualClones;prior=r;
}}
audit.globallyUniquePNGs=globalHashes.size;
if(audit.maximumReferenceError>1e-9||audit.maximumDiversityError>.005){await fs.writeFile(path.join(root,'audit-incomplete.json'),JSON.stringify({...audit,status:'feature-pipeline-mismatch'},null,2));throw Error('Saved native scores disagree with independently calculated features')}
await fs.writeFile(path.join(root,'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(audit);
