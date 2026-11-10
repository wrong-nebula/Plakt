import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {Resvg} from '@resvg/resvg-js';
const root=process.argv[2]||'output/shape-library-v1';
const catalog=JSON.parse(await fs.readFile('Sources/PosterCore/Resources/ShapeLibrary/catalog.json','utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${Math.ceil(catalog.recipes.length/6)*355}"><rect width="100%" height="100%" fill="#d9d7d0"/>`;
const studyFolder=path.basename(root).replace('shape-library','shape-source-study');
let html='<!doctype html><meta charset="utf-8"><title>PosterLab shape library</title><meta name="viewport" content="width=device-width"><style>body{font:15px system-ui;background:#e7e3da;color:#202322;margin:30px}header{max-width:850px}input{font:inherit;padding:10px;width:300px;margin:12px 0}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px}article{padding:18px;background:#faf7ef}h2{font-size:20px}p{line-height:1.5}img{width:50%;vertical-align:top}a{color:inherit}small{display:block;color:#5b5e59;margin-top:8px}details{margin-top:10px}</style><header><h1>36 reusable shape recipes</h1><p>Each pair uses a different parameter setting and a different suggested font family. Geometry stays procedural and can be exported as vector PDF. Compatibility is an authored starting point; saved SigLIP retrievals supply reference hints.</p><p><a href="index/embeddings.json">Descriptors and native Vision embeddings</a> · <a href="audit.json">Validation</a></p><input id="filter" aria-label="Search shapes" placeholder="Search shape, group or technique"></header><main>';
const hashes=new Set();
for(const [i,r]of catalog.recipes.entries()){
 const image=await fs.readFile(path.join(root,'index',r.id+'.png'));hashes.add(createHash('sha256').update(image).digest('hex'));
 svg+=`<g transform="translate(${i%6*300},${Math.floor(i/6)*355})"><image href="data:image/png;base64,${image.toString('base64')}" x="10" y="8" width="280" height="280"/><text x="12" y="316" font-size="18" font-family="Helvetica">${esc(r.name)}</text><text x="12" y="338" font-size="12" font-family="Helvetica">${esc(r.group)}</text></g>`;
 html+=`<article data-search="${esc((r.name+' '+r.group+' '+r.tags.join(' ')).toLowerCase())}"><h2>${esc(r.name)}</h2><small>${esc(r.group)}</small><p>${esc(r.logic)}</p>${[0,1].map(v=>`<a href="pairs/${r.id}/v${v}/poster.pdf"><img loading="lazy" src="pairs/${r.id}/v${v}/poster.png" alt="${esc(r.name)} variation ${v+1}"></a>`).join('')}<small>${esc(r.tags.join(' · '))}</small><details><summary>Reusable rule and preset</summary><a href="pairs/${r.id}/v0/preset.json">Preset JSON</a> · <a href="pairs/${r.id}/v0/genome.json">Scene genome</a><p>${esc(r.basis)}</p>${r.references.map(ref=>`<small>${esc(ref.queryID)} · ${esc(ref.posterID)}</small>`).join('')}</details></article>`;
}
let posterSVG='<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2520"><rect width="100%" height="100%" fill="#d9d7d0"/>';
let posterCount=0;
for(const [i,r]of catalog.recipes.entries()){
 const file=path.join(root,'posters',r.id,'v0','poster.png');
 try{const bytes=await fs.readFile(file);posterSVG+=`<g transform="translate(${i%6*300},${Math.floor(i/6)*420})"><image href="data:image/png;base64,${bytes.toString('base64')}" x="12" y="6" width="276" height="380"/><text x="12" y="408" font-family="Helvetica" font-size="16">${esc(r.name)}</text></g>`;posterCount++}catch(error){if(error.code!=='ENOENT')throw error}
}
if(posterCount){await fs.writeFile(path.join(root,'poster-contact.png'),new Resvg(posterSVG+'</svg>').render().asPng());html=html.replace('</header>','<p><a href="poster-contact.png">36 shapes in the inherited Offene Formen composition</a></p></header>')}
await fs.writeFile(path.join(root,'contact.png'),new Resvg(svg+'</svg>').render().asPng());
html=html.replace('<a href="audit.json">Validation</a>',`<a href="audit.json">Specimen audit</a> · <a href="../${studyFolder}/gallery.html">Five-round poster study</a>`);
await fs.writeFile(path.join(root,'gallery.html'),html+'</main><script>document.querySelector("#filter").addEventListener("input",e=>{for(const a of document.querySelectorAll("article"))a.hidden=!a.dataset.search.includes(e.target.value.toLowerCase())})</script>');
const embeddings=JSON.parse(await fs.readFile(path.join(root,'index','embeddings.json'),'utf8'));
for(const e of embeddings){if(e.descriptor.length!==10||e.descriptor.some(x=>!Number.isFinite(x))||Math.abs(Math.hypot(...e.descriptor)-1)>1e-8||e.vision.dimensions!==768)throw Error('Invalid shape embedding '+e.recipeID)}
const audit={recipes:catalog.recipes.length,uniqueNeutralRenders:hashes.size,sourcePosterVariations:posterCount*2,parameterAndFontPairs:catalog.recipes.length*2,descriptorDimensions:10,visionDimensions:768,siglipDiscoverySHA256:catalog.discoverySnapshotSHA256,note:catalog.note};
await fs.writeFile(path.join(root,'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(audit);
