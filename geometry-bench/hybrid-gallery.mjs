import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(process.argv[2]||'output/source-crossovers-20261107-5rounds');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const rel=url=>path.relative(root,url.startsWith('file:')?fileURLToPath(url):url).split(path.sep).map(encodeURIComponent).join('/');
const columns=Math.min(5,manifest.length),rows=Math.ceil(manifest.length/columns);
let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${columns*320}" height="${rows*550}"><rect width="${columns*320}" height="${rows*550}" fill="#e8e5dc"/>`;
let html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PosterLab · Source genome crossovers</title><style>body{margin:32px;background:#e8e5dc;color:#171717;font:15px system-ui}h1{font-size:40px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px}img{width:100%;display:block}.winner{max-width:440px}.card{background:#faf8f0;padding:10px}section{margin:40px 0}details{margin:20px 0}small{color:#555}a{color:inherit}.stages{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}</style><h1>Two donors / five rounds</h1><p>Two new source genomes per round. Every candidate, donor pair, construction pass and ballot is retained below.</p><p>Source palettes, typographic density and spatial rhythm feed declared layout grammars. Every genome records its actual regions, natural glyph proportions and construction rules. Style-family heads use authored recipes; designer-affinity heads use credited museum works. Source borders still need manual review.</p>';
let curation;try{curation=JSON.parse(await fs.readFile(path.join(root,'curation.json'),'utf8'))}catch{}
if(curation?.picks?.length){
 html+='<section><h2>Curator picks</h2><p>Selected by visual review. The complete committee results remain below.</p><div class="grid">';
 for(const pick of curation.picks){const folder=path.resolve(root,pick.exportDirectory),png=rel(path.join(folder,'poster.png')),pdf=rel(path.join(folder,'poster.pdf'));html+=`<div class="card"><img src="${png}" alt="${esc(pick.direction)} curator pick"><h3>${esc(pick.direction)}</h3><p>${esc(pick.note)}</p><p><a href="${png}">3508px PNG</a> · <a href="${pdf}">Vector PDF</a></p></div>`}
 html+='</div></section>';
}
for(const [i,study]of manifest.entries()){
 const column=i%columns,row=Math.floor(i/columns);
 const bytes=await fs.readFile(study.image),data='data:image/png;base64,'+bytes.toString('base64');
 svg+=`<g transform="translate(${column*320},${row*550})"><text x="14" y="30" font-family="Helvetica" font-size="20" font-weight="bold">${esc(study.direction)}</text><image x="12" y="46" width="296" height="419" xlink:href="${data}"/><text x="14" y="495" font-family="Helvetica" font-size="13">${esc(study.winnerID)}</text><text x="14" y="516" font-family="Helvetica" font-size="13">${study.rounds} rounds · ${study.uniqueDonors} source donors</text></g>`;
 html+=`<section><h2>${esc(study.direction)}</h2><p>${esc(study.winnerID)} · ${study.rounds} rounds · ${study.uniqueDonors} donors introduced</p><img class="winner" src="${rel(study.image)}" alt="${esc(study.direction)} final source crossover"><p><a href="${study.category}/winner.png">PNG export</a> · <a href="${study.category}/winner.pdf">Vector PDF</a> · <a href="${study.category}/winner.json">Genome and ancestry</a></p>`;
 const used=new Set();
 for(let round=0;round<Number(study.rounds);round++){
  const r=JSON.parse(await fs.readFile(path.join(root,study.category,`round-${round}/round.json`),'utf8'));
  if(r.candidates.length<4||r.candidates.length>16||r.judging.results.length!==r.candidates.length)throw Error('Candidate count mismatch');
  for(const id of r.donorIDs){if(used.has(id))throw Error('Donor reused in a study');used.add(id)}
  if(round>0){const prev=JSON.parse(await fs.readFile(path.join(root,study.category,`round-${round-1}/round.json`),'utf8'));const winner=prev.candidates.find(c=>c.id===prev.winnerID),elite=r.candidates[0];if(JSON.stringify(winner.genome)!==JSON.stringify(elite.genome)||winner.seed!==elite.seed)throw Error('Elite changed');const before=await fs.readFile(fileURLToPath(winner.imageURL)),after=await fs.readFile(fileURLToPath(elite.imageURL));if(!before.equals(after))throw Error('Elite pixels changed')}
  html+=`<details ${round===Number(study.rounds)-1?'open':''}><summary>Round ${round+1} · ${esc(r.winnerID)} · compatibility ${r.donorCompatibility.toFixed(3)}</summary><p>${r.donorIDs.map(esc).join(' + ')}</p><b>Winner construction</b><div class="stages">${r.constructionImages.map((url,j)=>`<div><img loading="lazy" src="${rel(url)}" alt="Winner construction stage ${j+1}"><small>${['Large shapes','Primary type','Secondary type','Repetition and detail'][j]}</small></div>`).join('')}</div><h3>All candidates</h3><div class="grid">`;
  html+=r.judging.results.map(c=>{const scene=r.candidates.find(s=>s.id===c.id);return`<div class="card"><a href="${rel(c.imageURL)}"><img loading="lazy" src="${rel(c.imageURL)}" alt="${esc(c.id)}"></a><p>#${c.rank} · ${esc(c.id)}<br>${c.consensus.toFixed(1)} consensus</p><small>${Object.entries(c.scores).map(([name,score])=>`${esc(name)} ${score.toFixed(3)}`).join(' · ')}</small><p><small>${scene.parentID?'Parent: '+esc(scene.parentID):'First crossover'}</small></p></div>`}).join('')+'</div></details>';
 }
 html+='</section>';
}
svg+='</svg>';await fs.writeFile(path.join(root,'winners.png'),new Resvg(svg).render().asPng());await fs.writeFile(path.join(root,'gallery.html'),html);
console.log(JSON.stringify({studies:manifest.length,rounds:manifest.reduce((n,s)=>n+Number(s.rounds),0),eliteGenomesAndPixels:'verified',gallery:path.join(root,'gallery.html')}));
