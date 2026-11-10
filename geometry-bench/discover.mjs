import { writeFile } from 'node:fs/promises';
const names = ['@baku89/pave','paper','svg-path-commander','svg-path-properties','path-bool','clipper-lib','paper-clipper','svgpath','bezier-js','svg-path-morph','flo-mat','js-svg-path','pathomorph','opentype.js','fontkit','typr.js','svg-text-to-path','plumin.js','typesettable','hersheytext','svg-text-animate','khoshnus'];
const results = await Promise.all(names.map(async name => {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!response.ok) return {name,status:response.status};
    const meta = await response.json(); const version=meta['dist-tags']?.latest; const p=meta.versions[version];
    return {name,version,license:p.license,description:p.description,repository:p.repository,dependencies:p.dependencies,
      unpackedBytes:p.dist?.unpackedSize,published:meta.time?.[version],readme:meta.readme ?? '',status:200};
  } catch(e) { return {name,error:String(e)}; }
}));
await writeFile(new URL('./registry.json',import.meta.url),JSON.stringify(results,null,2));
for (const p of results) console.log(`${p.name}: ${p.version ?? p.status ?? p.error} ${p.unpackedBytes ?? ''}`);
