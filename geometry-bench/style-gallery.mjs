import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
const root=path.resolve(process.argv[2]||'output/style-studies-20261107'),winners=JSON.parse(await fs.readFile(path.join(root,'winners.json'),'utf8'));
let svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="550"><rect width="1600" height="550" fill="#e8e5dc"/>';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PosterLab · Five style studies</title><style>body{background:#e8e5dc;font:16px system-ui;margin:32px;color:#191919}h1{font-size:42px}section{margin:40px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px}img{display:block;width:100%;height:auto}.winner{max-width:460px}small{color:#555}.card{background:#faf8f0;padding:10px}a{color:inherit}details{margin-top:18px}</style><h1>Five directions / 80 posters</h1><p>Eight candidates per round · two rounds per direction · five Core ML style heads · weighted Borda voting.</p><p>Recipe-trained style scores are experimental. These studies explore explicit procedural grammars, with source similarity, typography, rhythm, composition and diversity retained as lower-weight judges.</p>';
for(const [i,winner] of winners.entries()){
 const bytes=await fs.readFile(new URL(winner.image)),data='data:image/png;base64,'+bytes.toString('base64');
 svg+=`<text x="${i*320+14}" y="30" font-family="Helvetica" font-size="20" font-weight="bold">${esc(winner.category)}</text><image x="${i*320+12}" y="46" width="296" height="419" xlink:href="${data}"/><text x="${i*320+14}" y="495" font-family="Helvetica" font-size="12">${esc(winner.winner)}</text><text x="${i*320+14}" y="516" font-family="Helvetica" font-size="13">${winner.consensus.toFixed(1)} weighted consensus</text>`;
 const relative=url=>path.relative(root,fileURLToPath(url)).split(path.sep).map(encodeURIComponent).join('/');
 const printFiles=await fs.readdir(path.join(root,winner.category.toLowerCase(),'print'));
 html+=`<section><h2>${esc(winner.category)}</h2><p>${esc(winner.winner)} · ${winner.consensus.toFixed(1)} consensus</p><img class="winner" src="${relative(winner.image)}" alt="${esc(winner.category)} winner"><p>${printFiles.map(f=>`<a href="${winner.category.toLowerCase()}/print/${encodeURIComponent(f)}">${esc(path.extname(f).slice(1).toUpperCase())} export</a>`).join(' · ')}</p><details><summary>All 16 candidates and judge scores</summary>`;
 for(let round=0;round<2;round++){
  const generation=JSON.parse(await fs.readFile(path.join(root,winner.category.toLowerCase(),`generation-${round}/generation.json`),'utf8'));
  html+=`<h3>Round ${round+1}</h3><div class="grid">`+generation.candidates.map(c=>`<div class="card"><a href="${relative(c.imageURL)}"><img loading="lazy" src="${relative(c.imageURL)}" alt="${esc(c.id)}"></a><p>#${c.rank} · ${c.consensus.toFixed(1)} consensus<br><small>${esc(c.id)}</small></p><small>${Object.entries(c.scores).map(([name,score])=>`${esc(name)} ${score.toFixed(3)}`).join(' · ')}</small></div>`).join('')+'</div>';
 }
 html+='</details></section>';
}
svg+='</svg>';await fs.writeFile(path.join(root,'winners.png'),new Resvg(svg).render().asPng());await fs.writeFile(path.join(root,'gallery.html'),html);
console.log(path.join(root,'gallery.html'));
