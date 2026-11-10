import fs from 'node:fs/promises';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(process.argv[2]),studies=[],rows=[];
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const dir of (await fs.readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name)){
 let raw;try{raw=JSON.parse(await fs.readFile(path.join(root,dir,'image-study.json'),'utf8'))}catch(e){if(e.code==='ENOENT')continue;throw e}
 const study={dir,title:raw.copy.title,venue:raw.copy.institution,rounds:raw.rounds.length,source:raw.profile.asset.url,finalists:raw.finalistIDs??[],winner:path.join(root,dir,'winner.png'),roundWinners:[]};
 for(const round of raw.rounds){
  for(const result of round.judging.results){
   const c=round.candidates.find(c=>c.id===result.id),influence=c.genome.imageInfluence;
   rows.push({study:dir,title:study.title,id:c.id,round:round.number,last:round.number===raw.rounds.length-1,rank:result.rank,score:result.consensus,finalist:study.finalists.includes(c.id),direction:c.hypothesis??'legacy',group:c.matchedGroup?dir+'/'+c.matchedGroup:'',control:c.control??'',role:c.role??'proposal',placement:influence.placement,image:path.relative(root,new URL(c.imageURL).pathname),genome:path.relative(root,new URL(c.imageURL).pathname).replace(/\.(png|jpg)$/,'-genome.json'),mask:c.generatedType?.maskURL?path.relative(root,new URL(c.generatedType.maskURL).pathname):'',operations:influence.operations,scores:result.scores,jurors:round.shapeJury??[]});
  }
  study.roundWinners.push(rows.find(r=>r.study===dir&&r.round===round.number&&r.id===round.winnerID));
 }
 if(!study.finalists.length)study.finalists=rows.filter(r=>r.study===dir&&r.last&&r.rank<=3).map(r=>r.id);
 studies.push(study);
}
if(!studies.length)throw Error('No completed image studies');
async function sheet(file,items,columns,tileW=400,tileH=700){
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${columns*tileW}" height="${Math.ceil(items.length/columns)*tileH}"><rect width="100%" height="100%" fill="#e5e0d6"/>`;
 for(const [i,item]of items.entries()){
  if(!item)continue;
  const location=item.absolute??path.join(root,item.image),bytes=await fs.readFile(location),mime=location.endsWith('.jpg')?'jpeg':'png';
  svg+=`<g transform="translate(${i%columns*tileW},${Math.floor(i/columns)*tileH})"><image href="data:image/${mime};base64,${bytes.toString('base64')}" x="10" y="10" width="${tileW-20}" height="${tileH-90}"/><text x="14" y="${tileH-48}" font-family="Helvetica" font-size="17">${esc(item.caption??item.title)}</text><text x="14" y="${tileH-20}" font-family="Helvetica" font-size="13">${esc(item.subtitle??'')}</text></g>`;
 }
 await fs.writeFile(path.join(root,file),new Resvg(svg+'</svg>').render().asPng());
}
const finalistItems=[];
for(let i=0;i<3;i++){for(const s of studies){const id=s.finalists[i],r=rows.find(r=>r.study===s.dir&&r.last&&r.id===id);finalistItems.push(r?{...r,caption:s.title,subtitle:r.direction+' · jury #'+r.rank}:null)}}
await sheet('finalists.png',finalistItems,studies.length);
await sheet('winners.png',studies.map(s=>({absolute:s.winner,caption:s.title})),studies.length);
for(const s of studies)await sheet(s.dir+'/round-winners.png',s.roundWinners.map(r=>({...r,caption:'Round '+(r.round+1)+' · '+r.direction,subtitle:r.id})),5,300,500);
const matched=[];
for(const s of studies){const candidates=rows.filter(r=>r.study===s.dir&&r.last&&r.group&&r.direction==='interaction'),group=candidates[0]?.group;if(group)matched.push(...candidates.filter(r=>r.group===group).sort((a,b)=>['none','large','offset','zoom'].indexOf(a.control)-['none','large','offset','zoom'].indexOf(b.control)).map(r=>({...r,caption:s.title+' · '+r.control,subtitle:'same image, type, crop and colors'})))}
if(matched.length)await sheet('matched-controls.png',matched,3);
const data=JSON.stringify(rows).replaceAll('<','\\u003c');
function render(){
 const filtered=rows.filter(r=>(!study.value||r.study===study.value)&&(!direction.value||r.direction===direction.value)&&(!group.value||r.group===group.value)&&(
 show.value==='all'||show.value==='finalists'&&r.last&&r.finalist||show.value==='jury'&&r.last&&r.rank<=3||show.value==='matched'&&r.group||show.value==='winners'&&r.rank===1));
 document.querySelector('#count').textContent=filtered.length+' posters';
 document.querySelector('#cards').innerHTML=filtered.map(r=>`<article><a href="${r.image}"><img loading="lazy" src="${r.image}" alt="${esc(r.title)} · ${esc(r.direction)}"></a><h2>${esc(r.title)}</h2><small>Round ${r.round+1} · jury #${r.rank} · ${esc(r.direction)}<br>${esc(r.control||r.role)} · ${esc(r.id)}</small><p><a href="${r.genome}">Scene genome</a>${r.mask?' · <a href="'+r.mask+'">Generated type layer</a>':''}</p><details><summary>Image response and jury</summary><ul>${r.operations.map(o=>'<li>'+esc(o)+'</li>').join('')}</ul><small>${Object.entries(r.scores).map(([k,v])=>esc(k)+': '+v.toFixed(3)).join('<br>')}</small><h3>Matched shape preferences</h3><small>${r.jurors.map(j=>esc(j.judge)+': '+Math.round(j.probability*100)+'% · width '+Math.round(j.preferredWidth*100)+'% · '+j.evidenceRounds+' evidence comparisons').join('<br>')}</small></details></article>`).join('');
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Image composition experiments</title><style>body{font:15px system-ui;background:#e5e0d6;color:#20231e;margin:28px}header{max-width:1050px}p{line-height:1.6}nav{display:flex;gap:18px;flex-wrap:wrap;position:sticky;top:0;padding:18px 0;background:#e5e0d6f5}select{font:inherit;padding:7px;max-width:270px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px}article{padding:14px;background:#faf7ef}img{width:100%;height:430px;object-fit:contain}small{display:block;color:#555e50;line-height:1.6}h2{font-size:19px}a{color:inherit}li{margin-bottom:8px}</style><header><h1>Image composition experiments</h1><p>${studies.length} images · ${rows.length} candidate instances · ${studies[0].rounds} rounds per image. Image-led, type-led and interaction directions keep separate parents. The shortlist preserves different directions; captions show their actual final-round jury ranks.</p><p>Shape controls hold the base composition fixed. Typography scoring mode is saved per run; generated-text-only scoring is optional. Article emphasis, pale palettes, overlap and crop remain artistic choices. Scores are relative proxies; no trained model, source-library record or taste vote is changed.</p><p><a href="finalists.png">Selected finalists</a> · <a href="winners.png">Jury winners</a>${matched.length?' · <a href="matched-controls.png">Matched shape controls</a>':''}</p>${studies.map(s=>`<p><strong>${esc(s.title)}</strong> — ${esc(s.venue)} · <a href="${s.dir}/winner.png">PNG</a> · <a href="${s.dir}/winner.pdf">PDF</a> · <a href="${s.dir}/round-winners.png">Evolution</a> · <a href="${s.dir}/image-study.json">Open in app</a></p>`).join('')}</header><nav><label>Image <select id="study"><option value="">All</option>${studies.map(s=>`<option value="${s.dir}">${esc(s.title)}</option>`).join('')}</select></label><label>Show <select id="show"><option value="finalists">Selected finalists</option><option value="jury">Jury top three</option><option value="matched">Matched controls</option><option value="winners">Round winners</option><option value="all">All candidates</option></select></label><label>Direction <select id="direction"><option value="">All</option><option>image-led</option><option>type-led</option><option>interaction</option><option>free</option></select></label><label>Matched group <select id="group"><option value="">All</option>${[...new Set(rows.filter(r=>r.group).map(r=>r.group))].map(g=>`<option>${esc(g)}</option>`).join('')}</select></label><span id="count"></span></nav><main id="cards"></main><script type="application/json" id="data">${data}</script><script>const rows=JSON.parse(document.querySelector('#data').textContent),study=document.querySelector('#study'),show=document.querySelector('#show'),direction=document.querySelector('#direction'),group=document.querySelector('#group');const esc=${esc.toString()};${render.toString()}[study,show,direction,group].forEach(e=>e.addEventListener('change',render));render();</script></html>`;
await fs.writeFile(path.join(root,'gallery.html'),html);
console.log({studies:studies.length,candidates:rows.length,finalists:finalistItems.filter(Boolean).length,matched:rows.filter(r=>r.group).length});
