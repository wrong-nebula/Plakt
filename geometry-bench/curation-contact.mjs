import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(process.argv[2]),curation=JSON.parse(await fs.readFile(path.join(root,'curation.json'),'utf8')),picks=curation.picks??[curation],catalog=JSON.parse(await fs.readFile('library/library.json','utf8')),entries=new Map(catalog.posters.map(x=>[x.id,x]));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640"><rect width="100%" height="100%" fill="#dedbd1"/>`,comparison=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${picks.length*470}"><rect width="100%" height="100%" fill="#dedbd1"/>`;
async function tag(url,x,y,w,h){const file=url.startsWith('file:')?fileURLToPath(url):url,bytes=await fs.readFile(file),kind=file.endsWith('.png')?'png':'jpeg';return `<image href="data:image/${kind};base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`}
for(const [i,pick]of picks.entries()){
 const r=JSON.parse(await fs.readFile(path.join(root,pick.category,`round-${pick.round}/round.json`),'utf8')),winner=r.candidates.find(c=>c.id===pick.selectedCandidate);
 svg+=`<text x="${i*400+14}" y="28" font-family="Helvetica" font-size="22">${escape(pick.direction)}</text>`+await tag(winner.imageURL,i*400+12,45,376,532);
 svg+=`<text x="${i*400+14}" y="610" font-family="Helvetica" font-size="14">${escape(pick.selectedCandidate)}</text>`;
 const urls=[entries.get(r.donorIDs[0]).imageURL,winner.imageURL,entries.get(r.donorIDs[1]).imageURL];
 for(let j=0;j<3;j++){comparison+=await tag(urls[j],j*320+10,i*470+10,300,418)+`<text x="${j*320+10}" y="${i*470+452}" font-family="Helvetica" font-size="13">${j===1?escape(pick.direction):'Unconfirmed donor '+(j===0?'A':'B')}</text>`}
}
await fs.writeFile(path.join(root,'curated.png'),new Resvg(svg+'</svg>').render().asPng());await fs.writeFile(path.join(root,'curated-donor-comparison.png'),new Resvg(comparison+'</svg>').render().asPng());
