import fs from 'node:fs/promises';
const names=['Josef Müller-Brockmann','Armin Hofmann','Emil Ruder','Wolfgang Weingart','April Greiman','Ikko Tanaka','Shigeo Fukuda','Paul Rand','Saul Bass','Herbert Bayer','László Moholy-Nagy','Jan Tschichold','Niklaus Troxler','Ralph Schraivogel'];
const directory='output/designer-research';
for(const name of names){
 const slug=name.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replaceAll(/[^a-z0-9]+/g,'-');
 for(const museum of ['vam','artic']){
  const file=`${directory}/${museum}-${slug}.json`;
  try{await fs.access(file);continue}catch{}
  const url=museum==='vam'?`https://api.vam.ac.uk/v2/objects/search?${new URLSearchParams({q:name,page_size:'100',images_exist:'true'})}`:`https://api.artic.edu/api/v1/artworks/search?${new URLSearchParams({q:name,limit:'100',fields:'id,title,artist_id,artist_title,artist_display,image_id,artwork_type_title,is_public_domain,copyright_notice,date_display,medium_display'})}`;
  try{
   const response=await fetch(url,{headers:{'User-Agent':'PosterLab local research (personal collection study)'},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const data=await response.json();await fs.writeFile(file,JSON.stringify({query:name,url,data},null,2));
   const rows=data.records||data.data||[];
   console.log(name,museum,'rows',rows.length,'sample',JSON.stringify(rows[0]).slice(0,600));
  }catch(error){console.log(name,museum,error.message)}
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
}
