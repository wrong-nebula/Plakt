import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
const folder=path.resolve(process.argv[2]??'output/geometry-comparison');
const data=JSON.parse(await readFile(path.join(folder,'summary.json')));
const registry=JSON.parse(await readFile(path.resolve('geometry-bench/registry.json')));
const fixtures=JSON.parse(await readFile(path.join(folder,'fixtures.json')));
const rounds=await Promise.all(data.history.map(h=>readFile(h.report,'utf8').then(JSON.parse)));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const number=n=>n==null?'—':n.toFixed(2);
const safe=s=>s.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
await mkdir(path.join(folder,'sheets'),{recursive:true});
async function sheet(items,title,cols,to){
 const cellW=272,cellH=448,rows=Math.ceil(items.length/cols),width=cols*cellW+32,height=rows*cellH+76;
 let body=`<rect width="${width}" height="${height}" fill="#eeeeea"/><text x="20" y="29" font-family="Arial" font-size="16" font-weight="bold">${escape(title)}</text>`;
 for(const [i,item] of items.entries()){
  const x=20+(i%cols)*cellW,y=54+Math.floor(i/cols)*cellH;
  const png=await readFile(fileURLToPath(item.imageURL));
  body+=`<image x="${x}" y="${y}" width="252" height="356" href="data:image/png;base64,${png.toString('base64')}"/><text x="${x}" y="${y+378}" font-family="Arial" font-size="12" font-weight="bold">${escape(item.label)}</text><text x="${x}" y="${y+397}" font-family="Arial" font-size="10">${escape(item.detail.slice(0,47))}</text><text x="${x}" y="${y+412}" font-family="Arial" font-size="10">${escape(item.detail.slice(47,94))}</text>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`;
 const png=new Resvg(svg,{font:{fontFiles:['/System/Library/Fonts/Supplemental/Arial Bold.ttf'],loadSystemFonts:false}}).render().asPng();
 await writeFile(to,png);
}
const winners=data.summary.filter(s=>s.best).map(s=>({imageURL:s.best.imageURL,label:s.name,detail:`BEST ${number(s.best.consensus)} / MEAN ${number(s.meanFinalConsensus)} / ${s.role}`}));
await sheet(winners,'FORM / LAB — 22 GEOMETRY WORKFLOWS / FINAL GENERATION',5,path.join(folder,'winners.png'));
for(const backend of data.summary){
 const images=[];
 for(const round of rounds){
  for(const c of round.results){const sample=round.samples.find(s=>s.id===c.id);if(sample?.backend===backend.name){images.push({imageURL:c.imageURL,label:`ROUND ${sample.generation} / SEED ${sample.seed}`,detail:`VOTE ${number(c.consensus)} · CORE ML ${number(c.scores.Composition)} · REF ${number(c.scores.Reference)}`})}}
 }
 if(images.length)await sheet(images,`${backend.name.toUpperCase()} — THREE GENERATIONS, RANKED WITHIN EACH ROUND`,data.population,path.join(folder,'sheets',safe(backend.name)+'.png'));
}
let md=`# Poster geometry comparison\n\nTested on Apple silicon macOS with Node ${data.environment.node}. **${data.generated} successful candidates**, ${data.summary.length} workflows, ${data.rounds} generations × ${data.population} candidates per workflow. Every round was rendered and judged using the shared Core ML/Vision committee. The best two candidates within each workflow became parents; its champion was retained.\n\n[Full final contact sheet](winners.png). Individual iteration sheets are linked below. All SVG sources, PNGs, parent parameters, raw scores and ballots are retained in the generation folders.\n\n## Read the results correctly\n\nThese scores describe the **specific creative workflows**, not intrinsic library quality. Each adapter uses a distinctive operation, so the offset, skeleton, shaping and animation outputs solve different tasks. Higher consensus only means this committee preferred those rendered images in that batch. Timing is the mean of real adapter calls, **including first-use setup**, and excludes SVG rasterization and Apple judging; it is not a controlled speed ranking. Browser adapters also include browser setup/screenshot overhead. The starting seeds and surrounding poster template were shared. Static image judging does not assess animation timing or motion quality.\n\nThe Core ML composition model has authored heuristic weights; Vision contributes learned feature similarity and OCR. The five votes are correlated. No remote vision model or Apple Intelligence text critique was used for this comparison. Browser motifs are normalized to content bounds, animation styling is forced to its completed appearance, and a foreground-pixel check rejects blank captures.\n\n## Observed results\n\n| Workflow | Version | Success | Mean operation ms | Mean final vote | Best final vote |\n|---|---:|---:|---:|---:|---:|\n`;
for(const s of data.summary)md+=`| [${s.name}](sheets/${safe(s.name)}.png) | ${s.version} | ${s.successful}/${s.attempted} | ${number(s.meanOperationMs)} | ${number(s.meanFinalConsensus)} | ${number(s.best?.consensus)} |\n`;
md+='\n## Practical pros and cons\n\n';
for(const s of data.summary){
 const packageInfo=registry.find(p=>p.name===s.name);
 const source=packageInfo?.repository?.url?.replace(/^git\+/, '').replace(/^git:\/\//,'https://').replace(/^ssh:\/\/git@/,'https://').replace(/\.git$/,'') ?? `https://www.npmjs.com/package/${encodeURIComponent(s.name)}`;
 md+=`### [${s.name}](${source})\n\nTested role: ${s.role}.\n\n- **Pros:** ${s.pros}\n- **Cons:** ${s.cons}\n- **Evidence:** ${s.successful}/${s.attempted} candidates rendered successfully across ${data.rounds} judged generations. [Iteration sheet](sheets/${safe(s.name)}.png).\n`;
 if(s.failures.length)md+=`- **Runtime failures:** ${s.failures.map(f=>f.error).join('; ')}\n`;
}
md+='\n## Analytical fixtures\n\n| Backend | Fixture | Outcome |\n|---|---|---|\n';
for(const f of fixtures)md+=`| ${f.backend} | ${f.name} | ${f.status}${f.error?': '+f.error:''} |\n`;
md+='\nPathBool closes filled contours with coincident endpoints rather than an explicit `Z`. The adapter boundary explicitly closes contours before Pave area checks; this avoids measuring an open path as zero area. A rendered hole test also checks that counters survive.\n\n## Integration choice\n\nUse **Pave** for immutable shape processing, nonlinear warps, offsets and repeat-along geometry; it fits the seeded functional generator well. Use **Fontkit** for shaped glyph outlines when a JavaScript font pipeline is needed, or keep **Core Text** for the native app. Keep **svgpath** for small affine/serialization tasks and **svg-path-properties** when only arc-length placement is needed. Paper is valuable for an editable scene graph and booleans. Clipper is useful when polygon flattening is acceptable. The skeleton, single-stroke, wrapping and animation tools are optional specialist effects rather than replacements for the whole renderer.\n\nThese choices follow API fit and observed compatibility. They are not inferred solely from poster voting. The native app remains dependency-free; this optional workshop supplies the tested SVG pipeline and an image-judging bridge.\n\n## Reproduce and inspect\n\nSee [workshop instructions](../../geometry-bench/README.md), [raw summary](summary.json), [numerical fixtures](fixtures.json), [failures](failures.json), and the per-round `judging.json` files. Version and import probes are in `geometry-bench/registry.json` and `geometry-bench/imports.json`.\n';
await writeFile(path.join(folder,'COMPARISON.md'),md);
let html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PosterLab geometry comparison</title><style>body{font:16px system-ui;margin:36px;background:#eee;color:#161616}h1{font-size:36px;max-width:900px}p{max-width:900px;line-height:1.5}table{border-collapse:collapse;font-size:14px}td,th{padding:10px 16px;border-bottom:1px solid #bbb;text-align:left}img{max-width:100%;height:auto}a{color:#92331b}details{margin:24px 0}summary{cursor:pointer;font-weight:700}</style><h1>FORM / LAB — Geometry comparison</h1><p>${data.generated} rendered and judged candidates · ${data.summary.length} workflows · ${data.rounds} generations each.</p><p>Workflow-specific results, not a universal ranking of libraries. The same Core ML/Vision committee votes on all images. Timing includes first-use setup. <a href="COMPARISON.md">Read methods, pros and cons</a>.</p><table><tr><th>Workflow</th><th>Role</th><th>Mean ms</th><th>Final mean vote</th><th>Success</th></tr>`;
for(const s of data.summary)html+=`<tr><td><a href="#${safe(s.name)}">${escape(s.name)}</a></td><td>${escape(s.role)}</td><td>${number(s.meanOperationMs)}</td><td>${number(s.meanFinalConsensus)}</td><td>${s.successful}/${s.attempted}</td></tr>`;
html+='</table><h2>Final generation</h2><img src="winners.png" alt="Best final candidate for every workflow">';
for(const s of data.summary)html+=`<details id="${safe(s.name)}"><summary>${escape(s.name)} · ${escape(s.role)}</summary><p>${escape(s.pros)}</p><p>${escape(s.cons)}</p><img loading="lazy" src="sheets/${safe(s.name)}.png" alt="Three generations for ${escape(s.name)}"></details>`;
await writeFile(path.join(folder,'report.html'),html+'</html>');
console.log(path.join(folder,'COMPARISON.md'));
