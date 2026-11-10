import fs from 'node:fs/promises';import path from 'node:path';import{Resvg}from'@resvg/resvg-js';
const input=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),round=JSON.parse(await fs.readFile(input,'utf8'));
const groups=[...new Set(round.candidates.filter(c=>c.matchedGroup).map(c=>c.matchedGroup))];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${groups.length*650}"><rect width="100%" height="100%" fill="#e5e0d6"/>`;
for(const [y,g]of groups.entries()){const members=round.candidates.filter(c=>c.matchedGroup===g);for(const[x,c]of members.entries()){
 const file=new URL(c.imageURL),bytes=await fs.readFile(file);
 svg+=`<g transform="translate(${x*400},${y*650})"><image href="data:image/jpeg;base64,${bytes.toString('base64')}" x="10" y="10" width="380" height="570"/><text x="14" y="611" font-family="Helvetica" font-size="18">${esc(c.hypothesis)} · ${esc(c.control)}</text><text x="14" y="635" font-family="Helvetica" font-size="13">Generated-title recovery: ${c.generatedType.recoveredTitleFraction.toFixed(2)}</text></g>`
}}
await fs.writeFile(out,new Resvg(svg+'</svg>').render().asPng());console.log(out);
