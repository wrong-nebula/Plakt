import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
const destination='output/quality-audit-v6';await fs.mkdir(destination,{recursive:true});
const catalog=JSON.parse(await fs.readFile('library/library.json','utf8'));
const local=u=>u.startsWith('file:')?fileURLToPath(u):u;
const selected=catalog.posters.filter((_,i)=>i%Math.floor(catalog.posters.length/24)===7).slice(0,24);
const real=JSON.parse(await fs.readFile('output/designer-references/dataset.json','utf8')).works;
const designers=['hofmann','muller-brockmann','bill','rand','tanaka','troxler','scher','yokoo','tschichold','vignelli','glaser','sato'];
const museum=designers.map(id=>real.filter(w=>w.designerID===id)[Math.floor(real.filter(w=>w.designerID===id).length/2)]).filter(Boolean);
async function sheet(items,file,caption){let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.ceil(items.length/6)*330}"><rect width="100%" height="100%" fill="#dfdcd2"/>`;
for(const [i,x]of items.entries()){const data=await fs.readFile(x.image);svg+=`<g transform="translate(${i%6*200},${Math.floor(i/6)*330})"><image href="data:image/${path.extname(x.image).slice(1)==='png'?'png':'jpeg'};base64,${data.toString('base64')}" x="8" y="10" width="184" height="285" preserveAspectRatio="xMidYMid meet"/><text x="8" y="316" font-family="Helvetica" font-size="10">${x.label.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text></g>`}svg+='</svg>';await fs.writeFile(path.join(destination,file),new Resvg(svg).render().asPng());await fs.writeFile(path.join(destination,file+'.json'),JSON.stringify({caption,items},null,2));}
await sheet(selected.map(p=>({image:local(p.imageURL),label:p.id.slice(0,16),id:p.id})),'library.png','Fixed uniform sample of 24 active proposed poster surfaces. Some borders may include photographs.');
await sheet(museum.map(p=>({image:p.localImagePath,label:p.designer,recordURL:p.recordURL,title:p.title})),'museum.png','Twelve credited graphic works as visual quality controls; local research references, not redistributed as generator assets.');
console.log(destination);
